package services

import (
	"errors"
	"fmt"
	"time"
	Init "vulnmain/Init"
	"vulnmain/models"
	"vulnmain/utils"
)

type MFAService struct{}

type MFASetupResponse struct {
	Secret     string `json:"secret"`
	OtpauthURL string `json:"otpauth_url"`
	Issuer     string `json:"issuer"`
	Account    string `json:"account"`
}

type MFAStatusResponse struct {
	Enabled bool `json:"enabled"`
}

func (s *AuthService) buildMFAChallenge(user *models.User) (*LoginResponse, error) {
	mfaToken, err := utils.GenerateMFAToken(user)
	if err != nil {
		return nil, errors.New("生成MFA令牌失败")
	}

	return &LoginResponse{
		User:        user,
		Permissions: nil,
		ExpiresIn:   600,
		MFARequired: true,
		MFAToken:    mfaToken,
	}, nil
}

func (s *AuthService) issueLoginResponse(user *models.User, loginDetails string) (*LoginResponse, error) {
	db := Init.GetDB()

	now := time.Now().Truncate(time.Second)
	user.LastLoginAt = &now
	if err := db.Save(user).Error; err != nil {
		return nil, errors.New("更新登录时间失败")
	}

	token, err := utils.GenerateToken(user)
	if err != nil {
		return nil, errors.New("生成令牌失败")
	}

	var permissions []string
	for _, perm := range user.Role.Permissions {
		permissions = append(permissions, perm.Code)
	}

	s.LogLogin(user, "success", loginDetails)

	return &LoginResponse{
		Token:       token,
		User:        user,
		Permissions: permissions,
		ExpiresIn:   int64(utils.GetJWTExpire().Seconds()),
	}, nil
}

func (s *MFAService) GetStatus(userID uint) (*MFAStatusResponse, error) {
	db := Init.GetDB()

	var user models.User
	if err := db.Select("id", "mfa_enabled").Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, errors.New("用户不存在")
	}

	return &MFAStatusResponse{Enabled: user.MFAEnabled}, nil
}

func (s *MFAService) SetupMFA(userID uint) (*MFASetupResponse, error) {
	db := Init.GetDB()

	var user models.User
	if err := db.Preload("Role").Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, errors.New("用户不存在")
	}

	if user.MFAEnabled {
		return nil, errors.New("当前账号已启用MFA，如需关闭请联系管理员")
	}

	secret, err := utils.GenerateTOTPSecret()
	if err != nil {
		return nil, errors.New("生成MFA密钥失败")
	}

	encryptedSecret, err := utils.EncryptMFASecret(secret)
	if err != nil {
		return nil, errors.New("保存MFA密钥失败")
	}

	if err := db.Model(&user).Updates(map[string]interface{}{
		"mfa_pending_secret": encryptedSecret,
		"updated_at":         time.Now().Truncate(time.Second),
	}).Error; err != nil {
		return nil, errors.New("保存MFA配置失败")
	}

	accountName := user.Email
	if accountName == "" {
		accountName = user.Username
	}

	return &MFASetupResponse{
		Secret:     secret,
		OtpauthURL: utils.BuildTOTPKeyURI("VulnMain", accountName, secret),
		Issuer:     "VulnMain",
		Account:    accountName,
	}, nil
}

func (s *MFAService) EnableMFA(userID uint, code string) error {
	db := Init.GetDB()

	var user models.User
	if err := db.Where("id = ?", userID).First(&user).Error; err != nil {
		return errors.New("用户不存在")
	}

	if user.MFAEnabled {
		return errors.New("当前账号已启用MFA")
	}

	if user.MFAPendingSecret == "" {
		return errors.New("请先生成MFA绑定密钥")
	}

	secret, err := utils.DecryptMFASecret(user.MFAPendingSecret)
	if err != nil {
		return errors.New("读取MFA密钥失败")
	}

	valid, step := utils.VerifyTOTPCode(secret, code, 1)
	if !valid {
		return errors.New("验证码错误或已过期")
	}

	if err := db.Model(&user).Updates(map[string]interface{}{
		"mfa_enabled":        true,
		"mfa_secret":         user.MFAPendingSecret,
		"mfa_pending_secret": "",
		"mfa_last_used_step": step,
		"updated_at":         time.Now().Truncate(time.Second),
	}).Error; err != nil {
		return errors.New("启用MFA失败")
	}

	return nil
}

func (s *MFAService) VerifyMFALogin(mfaToken, code string) (*LoginResponse, error) {
	claims, err := utils.ParseMFAToken(mfaToken)
	if err != nil {
		return nil, errors.New("MFA令牌无效或已过期")
	}

	db := Init.GetDB()
	var user models.User
	if err := db.Preload("Role.Permissions").Where("id = ?", claims.UserID).First(&user).Error; err != nil {
		return nil, errors.New("用户不存在")
	}

	if user.Status != 1 {
		return nil, errors.New("用户已被禁用")
	}

	if !user.MFAEnabled || user.MFASecret == "" {
		return nil, errors.New("当前账号未启用MFA")
	}

	secret, err := utils.DecryptMFASecret(user.MFASecret)
	if err != nil {
		return nil, errors.New("读取MFA密钥失败")
	}

	valid, step := utils.VerifyTOTPCode(secret, code, 1)
	if !valid {
		return nil, errors.New("验证码错误或已过期")
	}

	if step <= user.MFALastUsedStep {
		return nil, errors.New("验证码已使用，请等待下一个动态码")
	}

	if err := db.Model(&user).Updates(map[string]interface{}{
		"mfa_last_used_step": step,
		"updated_at":         time.Now().Truncate(time.Second),
	}).Error; err != nil {
		return nil, errors.New("更新MFA状态失败")
	}

	authSvc := &AuthService{}
	return authSvc.issueLoginResponse(&user, "MFA登录成功")
}

func (s *MFAService) ListEnabledUsers() ([]models.User, error) {
	db := Init.GetDB()

	var users []models.User
	if err := db.Preload("Role").
		Where("mfa_enabled = ?", true).
		Order("updated_at DESC").
		Find(&users).Error; err != nil {
		return nil, errors.New("查询MFA用户失败")
	}

	return users, nil
}

func (s *MFAService) AdminDisableMFA(targetUserID, operatorID uint) error {
	db := Init.GetDB()

	var user models.User
	if err := db.Preload("Role").Where("id = ?", targetUserID).First(&user).Error; err != nil {
		return errors.New("目标用户不存在")
	}

	if !user.MFAEnabled && user.MFASecret == "" && user.MFAPendingSecret == "" {
		return errors.New("该用户未启用MFA")
	}

	if err := db.Model(&user).Updates(map[string]interface{}{
		"mfa_enabled":        false,
		"mfa_secret":         "",
		"mfa_pending_secret": "",
		"mfa_last_used_step": 0,
		"updated_at":         time.Now().Truncate(time.Second),
	}).Error; err != nil {
		return errors.New("关闭MFA失败")
	}

	log := models.OperationLog{
		UserID:   operatorID,
		Module:   "mfa",
		Action:   "disable",
		Resource: fmt.Sprintf("user:%d", targetUserID),
		Details:  fmt.Sprintf("管理员关闭用户 %s 的MFA", user.Username),
		Status:   "success",
	}
	db.Create(&log)

	return nil
}
