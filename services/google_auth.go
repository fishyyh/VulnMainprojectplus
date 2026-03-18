package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
	Init "vulnmain/Init"
	"vulnmain/models"
	"vulnmain/utils"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// GoogleUserInfo 谷歌用户信息
type GoogleUserInfo struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

// GoogleAuthService 谷歌认证服务
type GoogleAuthService struct{}

// GetOAuthConfig 获取 Google OAuth2 配置
func (s *GoogleAuthService) GetOAuthConfig() (*oauth2.Config, error) {
	systemSvc := &SystemService{}

	// 兼容两种来源：
	// 1) 系统配置表（优先）
	// 2) 环境变量（兜底）
	getConfigValue := func(configKey, envKey string) string {
		cfg, err := systemSvc.GetSystemConfig(configKey)
		if err == nil && strings.TrimSpace(cfg.Value) != "" {
			return strings.TrimSpace(cfg.Value)
		}
		return strings.TrimSpace(os.Getenv(envKey))
	}

	clientID := getConfigValue("google.client_id", "GOOGLE_CLIENT_ID")
	if clientID == "" {
		return nil, errors.New("Google OAuth 未配置 Client ID（google.client_id 或 GOOGLE_CLIENT_ID）")
	}

	clientSecret := getConfigValue("google.client_secret", "GOOGLE_CLIENT_SECRET")
	if clientSecret == "" {
		return nil, errors.New("Google OAuth 未配置 Client Secret（google.client_secret 或 GOOGLE_CLIENT_SECRET）")
	}

	redirectURL := getConfigValue("google.redirect_url", "GOOGLE_REDIRECT_URL")
	if redirectURL == "" {
		return nil, errors.New("Google OAuth 未配置回调地址（google.redirect_url 或 GOOGLE_REDIRECT_URL）")
	}

	return &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURL,
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint:     google.Endpoint,
	}, nil
}

// GetAuthURL 获取 Google 授权 URL
func (s *GoogleAuthService) GetAuthURL(state string) (string, error) {
	config, err := s.GetOAuthConfig()
	if err != nil {
		return "", err
	}
	return config.AuthCodeURL(state, oauth2.AccessTypeOffline), nil
}

// getAllowedEmailSuffixes 获取允许的邮箱后缀列表
func (s *GoogleAuthService) getAllowedEmailSuffixes() []string {
	systemSvc := &SystemService{}
	cfg, err := systemSvc.GetSystemConfig("google.allowed_email_suffix")
	if err != nil || cfg.Value == "" {
		return nil // 未配置则不限制
	}
	var suffixes []string
	for _, s := range strings.Split(cfg.Value, ",") {
		s = strings.TrimSpace(s)
		if s != "" {
			// 确保以 @ 开头
			if !strings.HasPrefix(s, "@") {
				s = "@" + s
			}
			suffixes = append(suffixes, strings.ToLower(s))
		}
	}
	return suffixes
}

// checkEmailAllowed 检查邮箱后缀是否在允许列表中
func (s *GoogleAuthService) checkEmailAllowed(email string) error {
	suffixes := s.getAllowedEmailSuffixes()
	if len(suffixes) == 0 {
		return nil // 未配置限制，所有邮箱都允许
	}
	emailLower := strings.ToLower(email)
	for _, suffix := range suffixes {
		if strings.HasSuffix(emailLower, suffix) {
			return nil
		}
	}
	return fmt.Errorf("邮箱后缀不在允许范围内，允许的后缀: %s", strings.Join(suffixes, ", "))
}

// HandleCallback 处理 Google OAuth 回调
func (s *GoogleAuthService) HandleCallback(code string) (*LoginResponse, error) {
	config, err := s.GetOAuthConfig()
	if err != nil {
		return nil, err
	}

	// 用授权码换取 token
	token, err := config.Exchange(context.Background(), code)
	if err != nil {
		return nil, fmt.Errorf("授权码交换失败: %v", err)
	}

	// 获取用户信息
	userInfo, err := s.fetchGoogleUserInfo(token.AccessToken)
	if err != nil {
		return nil, fmt.Errorf("获取 Google 用户信息失败: %v", err)
	}

	if !userInfo.VerifiedEmail {
		return nil, errors.New("Google 邮箱未验证")
	}

	// 检查邮箱后缀限制
	if err := s.checkEmailAllowed(userInfo.Email); err != nil {
		return nil, err
	}

	// 仅查找已有用户，不自动创建
	user, err := s.findExistingUser(userInfo.Email)
	if err != nil {
		return nil, err
	}

	// 检查用户状态
	if user.Status != 1 {
		return nil, errors.New("用户已被禁用")
	}

	// 更新登录时间
	db := Init.GetDB()
	now := time.Now().Truncate(time.Second)
	user.LastLoginAt = &now
	db.Save(user)

	// 生成 JWT
	jwtToken, err := utils.GenerateToken(user)
	if err != nil {
		return nil, errors.New("生成令牌失败")
	}

	// 提取权限
	var permissions []string
	for _, perm := range user.Role.Permissions {
		permissions = append(permissions, perm.Code)
	}

	// 记录登录日志
	authSvc := &AuthService{}
	authSvc.LogLogin(user, "success", "Google 登录成功")

	return &LoginResponse{
		Token:       jwtToken,
		User:        user,
		Permissions: permissions,
		ExpiresIn:   int64(utils.GetJWTExpire().Seconds()),
	}, nil
}

// fetchGoogleUserInfo 从 Google API 获取用户信息
func (s *GoogleAuthService) fetchGoogleUserInfo(accessToken string) (*GoogleUserInfo, error) {
	resp, err := http.Get("https://www.googleapis.com/oauth2/v2/userinfo?access_token=" + accessToken)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var userInfo GoogleUserInfo
	if err := json.Unmarshal(body, &userInfo); err != nil {
		return nil, err
	}

	return &userInfo, nil
}

// findExistingUser 根据邮箱查找已有用户，不存在则报错
func (s *GoogleAuthService) findExistingUser(email string) (*models.User, error) {
	db := Init.GetDB()

	var user models.User
	err := db.Preload("Role.Permissions").Where("email = ?", email).First(&user).Error
	if err != nil {
		return nil, fmt.Errorf("该邮箱(%s)未在系统中注册，请联系管理员添加账号", email)
	}

	return &user, nil
}
