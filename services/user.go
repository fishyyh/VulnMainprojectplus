package services

import (
	"errors"
	"fmt"
	"mime/multipart"
	"os"
	"path/filepath"
	"time"
	Init "vulnmain/Init"
	"vulnmain/models"
	"vulnmain/utils"
)

type UserService struct{}

type UserCreateRequest struct {
	Username   string `json:"username" binding:"required"`
	Email      string `json:"email" binding:"required,email"`
	Password   string `json:"password" binding:"required,min=6"`
	RealName   string `json:"real_name"`
	Phone      string `json:"phone"`
	Department string `json:"department"`
	RoleID     uint   `json:"role_id" binding:"required"`
}

type UserUpdateRequest struct {
	Email      string `json:"email" binding:"email"`
	RealName   string `json:"real_name"`
	Phone      string `json:"phone"`
	Department string `json:"department"`
	RoleID     uint   `json:"role_id"`
	Status     *int   `json:"status"` // 使用指针以区分0值和未设置
}

type UserListRequest struct {
	Page       int    `form:"page" binding:"min=1"`
	PageSize   int    `form:"page_size" binding:"min=1,max=100"`
	Keyword    string `form:"keyword"`
	Username   string `form:"username"`
	Email      string `form:"email"`
	RealName   string `form:"real_name"`
	Department string `form:"department"`
	Status     *int   `form:"status"`
	RoleID     *uint  `form:"role_id"`
}

type UserListResponse struct {
	Users       []models.User `json:"users"`
	Total       int64         `json:"total"`
	Page        int           `json:"page"`
	PageSize    int           `json:"page_size"`
	CurrentPage int           `json:"current_page"`
	TotalPages  int           `json:"total_pages"`
}

// CreateUser 创建用户
func (s *UserService) CreateUser(req *UserCreateRequest) (*models.User, error) {
	db := Init.GetDB()

	// 检查用户名是否已存在
	var existUser models.User
	if err := db.Where("username = ? OR email = ?", req.Username, req.Email).First(&existUser).Error; err == nil {
		return nil, errors.New("用户名或邮箱已存在")
	}

	// 验证角色是否存在
	var role models.Role
	if err := db.Where("id = ?", req.RoleID).First(&role).Error; err != nil {
		return nil, errors.New("角色不存在")
	}

	user := models.User{
		Username:   req.Username,
		Email:      req.Email,
		RealName:   req.RealName,
		Phone:      req.Phone,
		Department: req.Department,
		Status:     1, // 默认启用
		RoleID:     req.RoleID,
		Source:     "local",
	}

	// 验证密码复杂度
	if err := utils.ValidatePassword(req.Password); err != nil {
		return nil, err
	}

	// 设置密码
	if err := user.SetPassword(req.Password); err != nil {
		return nil, errors.New("密码设置失败")
	}

	if err := db.Create(&user).Error; err != nil {
		return nil, errors.New("创建用户失败")
	}

	// 重新查询用户信息(包含关联的角色)
	db.Preload("Role").Where("id = ?", user.Model.ID).First(&user)

	// 发送用户注册成功邮件通知
	go func() {
		userName := user.RealName
		if userName == "" {
			userName = user.Username
		}

		if err := SendUserRegisteredNotification(userName, user.Email, req.Password); err != nil {
			// 记录邮件发送失败的日志，但不影响用户创建
			fmt.Printf("发送用户注册通知邮件失败: %v\n", err)
		}
	}()

	return &user, nil
}

// GetUserByID 根据ID获取用户
func (s *UserService) GetUserByID(userID uint) (*models.User, error) {
	db := Init.GetDB()

	var user models.User
	if err := db.Preload("Role.Permissions").Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, errors.New("用户不存在")
	}

	return &user, nil
}

// UpdateUser 更新用户信息
func (s *UserService) UpdateUser(userID uint, req *UserUpdateRequest) (*models.User, error) {
	db := Init.GetDB()

	var user models.User
	if err := db.Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, errors.New("用户不存在")
	}

	// 检查邮箱是否已被其他用户使用
	if req.Email != "" && req.Email != user.Email {
		var existUser models.User
		if err := db.Where("email = ? AND id != ?", req.Email, userID).First(&existUser).Error; err == nil {
			return nil, errors.New("邮箱已被其他用户使用")
		}
		user.Email = req.Email
	}

	// 验证角色是否存在
	if req.RoleID != 0 && req.RoleID != user.RoleID {
		var role models.Role
		if err := db.Where("id = ?", req.RoleID).First(&role).Error; err != nil {
			return nil, errors.New("角色不存在")
		}
		user.RoleID = req.RoleID
	}

	// 更新其他字段
	if req.RealName != "" {
		user.RealName = req.RealName
	}
	if req.Phone != "" {
		user.Phone = req.Phone
	}
	if req.Department != "" {
		user.Department = req.Department
	}
	if req.Status != nil {
		user.Status = *req.Status
	}

	if err := db.Save(&user).Error; err != nil {
		return nil, errors.New("更新用户失败")
	}

	// 重新查询用户信息(包含关联的角色)
	db.Preload("Role").Where("id = ?", userID).First(&user)

	return &user, nil
}

// DeleteUser 删除用户(软删除)
func (s *UserService) DeleteUser(userID uint) error {
	db := Init.GetDB()

	var user models.User
	if err := db.Where("id = ?", userID).First(&user).Error; err != nil {
		return errors.New("用户不存在")
	}

	// 不能删除自己
	if user.Username == "admin" {
		return errors.New("不能删除管理员用户")
	}

	if err := db.Delete(&user).Error; err != nil {
		return errors.New("删除用户失败")
	}

	return nil
}

// GetUserList 获取用户列表
func (s *UserService) GetUserList(req *UserListRequest) (*UserListResponse, error) {
	db := Init.GetDB()

	// 设置默认值
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = 10
	}

	query := db.Model(&models.User{}).Preload("Role")

	// 添加过滤条件
	if req.Keyword != "" {
		// 支持关键词搜索，在用户名、姓名、邮箱、部门中搜索
		query = query.Where("username LIKE ? OR real_name LIKE ? OR email LIKE ? OR department LIKE ?",
			"%"+req.Keyword+"%", "%"+req.Keyword+"%", "%"+req.Keyword+"%", "%"+req.Keyword+"%")
	}
	if req.Username != "" {
		query = query.Where("username LIKE ?", "%"+req.Username+"%")
	}
	if req.Email != "" {
		query = query.Where("email LIKE ?", "%"+req.Email+"%")
	}
	if req.RealName != "" {
		query = query.Where("real_name LIKE ?", "%"+req.RealName+"%")
	}
	if req.Department != "" {
		query = query.Where("department LIKE ?", "%"+req.Department+"%")
	}
	if req.Status != nil {
		query = query.Where("status = ?", *req.Status)
	}
	if req.RoleID != nil {
		query = query.Where("role_id = ?", *req.RoleID)
	}

	// 获取总数
	var total int64
	query.Count(&total)

	// 分页查询
	var users []models.User
	offset := (req.Page - 1) * req.PageSize
	if err := query.Offset(offset).Limit(req.PageSize).Find(&users).Error; err != nil {
		return nil, errors.New("查询用户列表失败")
	}

	// 计算总页数
	totalPages := int((total + int64(req.PageSize) - 1) / int64(req.PageSize))

	return &UserListResponse{
		Users:       users,
		Total:       total,
		Page:        req.Page,
		PageSize:    req.PageSize,
		CurrentPage: req.Page,
		TotalPages:  totalPages,
	}, nil
}

// ResetPassword 重置用户密码
func (s *UserService) ResetPassword(userID uint, newPassword string) error {
	db := Init.GetDB()

	var user models.User
	if err := db.Where("id = ?", userID).First(&user).Error; err != nil {
		return errors.New("用户不存在")
	}

	// LDAP用户不支持本地重置密码
	if user.Source == "ldap" {
		return errors.New("LDAP用户密码由目录服务管理，不能在本系统重置")
	}

	// 验证密码复杂度
	if err := utils.ValidatePassword(newPassword); err != nil {
		return err
	}

	if err := user.SetPassword(newPassword); err != nil {
		return errors.New("密码设置失败")
	}

	if err := db.Save(&user).Error; err != nil {
		return errors.New("重置密码失败")
	}

	// 发送密码重置邮件通知
	go func() {
		userName := user.RealName
		if userName == "" {
			userName = user.Username
		}

		if err := SendPasswordResetNotification(userName, user.Email, newPassword); err != nil {
			// 记录邮件发送失败的日志，但不影响密码重置
			fmt.Printf("发送密码重置通知邮件失败: %v\n", err)
		}
	}()

	return nil
}

// ChangePassword 修改密码
func (s *UserService) ChangePassword(userID uint, oldPassword, newPassword string) error {
	db := Init.GetDB()

	var user models.User
	if err := db.Where("id = ?", userID).First(&user).Error; err != nil {
		return errors.New("用户不存在")
	}

	// LDAP用户不支持在本系统修改密码
	if user.Source == "ldap" {
		return errors.New("LDAP用户密码由目录服务管理，不能在本系统修改")
	}

	// 验证原密码
	if !user.CheckPassword(oldPassword) {
		return errors.New("原密码错误")
	}

	// 验证新密码复杂度
	if err := utils.ValidatePassword(newPassword); err != nil {
		return err
	}

	// 设置新密码
	if err := user.SetPassword(newPassword); err != nil {
		return errors.New("新密码设置失败")
	}

	if err := db.Save(&user).Error; err != nil {
		return errors.New("修改密码失败")
	}

	return nil
}

// ToggleUserStatus 切换用户状态
func (s *UserService) ToggleUserStatus(userID uint) error {
	db := Init.GetDB()

	var user models.User
	if err := db.Where("id = ?", userID).First(&user).Error; err != nil {
		return errors.New("用户不存在")
	}

	// 不能禁用管理员
	if user.Username == "admin" {
		return errors.New("不能禁用管理员用户")
	}

	// 切换状态
	if user.Status == 1 {
		user.Status = 0
	} else {
		user.Status = 1
	}

	if err := db.Save(&user).Error; err != nil {
		return errors.New("更新用户状态失败")
	}

	return nil
}

// GetSecurityEngineers 获取安全工程师列表
func (s *UserService) GetSecurityEngineers() ([]models.User, error) {
	db := Init.GetDB()

	var users []models.User
	if err := db.Preload("Role").
		Joins("JOIN roles ON roles.id = users.role_id").
		Where("roles.code IN (?, ?, ?) AND users.status = ?", "super_admin", "admin", "security_engineer", 1).
		Find(&users).Error; err != nil {
		return nil, errors.New("获取安全工程师列表失败")
	}

	return users, nil
}

// GetDevEngineers 获取研发工程师列表
func (s *UserService) GetDevEngineers() ([]models.User, error) {
	db := Init.GetDB()

	var users []models.User
	if err := db.Preload("Role").
		Joins("JOIN roles ON roles.id = users.role_id").
		Where("roles.code = ? AND users.status = ?", "dev_engineer", 1).
		Find(&users).Error; err != nil {
		return nil, errors.New("获取研发工程师列表失败")
	}

	return users, nil
}

// GetAllEngineers 获取所有工程师列表（安全工程师和研发工程师）
func (s *UserService) GetAllEngineers() ([]models.User, error) {
	db := Init.GetDB()

	var users []models.User
	if err := db.Preload("Role").
		Joins("JOIN roles ON roles.id = users.role_id").
		Where("roles.code IN (?, ?, ?, ?) AND users.status = ?", "super_admin", "admin", "security_engineer", "dev_engineer", 1).
		Find(&users).Error; err != nil {
		return nil, errors.New("获取工程师列表失败")
	}

	return users, nil
}

// GetUserStats 获取用户统计信息
func (s *UserService) GetUserStats() (map[string]interface{}, error) {
	db := Init.GetDB()

	// 总用户数
	var totalUsers int64
	db.Model(&models.User{}).Count(&totalUsers)

	// 活跃用户数（状态为1）
	var activeUsers int64
	db.Model(&models.User{}).Where("status = ?", 1).Count(&activeUsers)

	// 非活跃用户数
	inactiveUsers := totalUsers - activeUsers

	// 按角色统计
	type RoleStat struct {
		RoleName string `json:"role_name"`
		Count    int64  `json:"count"`
	}

	var roleStats []RoleStat
	db.Table("users").
		Select("roles.name as role_name, COUNT(users.id) as count").
		Joins("LEFT JOIN roles ON users.role_id = roles.id").
		Where("users.deleted_at IS NULL").
		Group("roles.name").
		Scan(&roleStats)

	return map[string]interface{}{
		"total_users":    totalUsers,
		"active_users":   activeUsers,
		"inactive_users": inactiveUsers,
		"role_stats":     roleStats,
	}, nil
}

// UploadVulnImage 上传漏洞相关图片
func (s *UserService) UploadVulnImage(userID uint, file *multipart.FileHeader, baseURL string) (string, error) {
	// 创建上传目录
	uploadDir := "uploads/vuln-images"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return "", errors.New("创建上传目录失败")
	}

	// 生成唯一文件名
	fileExt := filepath.Ext(file.Filename)
	if fileExt == "" {
		// 如果没有扩展名，根据Content-Type设置
		contentType := file.Header.Get("Content-Type")
		switch contentType {
		case "image/jpeg", "image/jpg":
			fileExt = ".jpg"
		case "image/png":
			fileExt = ".png"
		case "image/gif":
			fileExt = ".gif"
		case "image/webp":
			fileExt = ".webp"
		default:
			fileExt = ".jpg"
		}
	}

	fileName := fmt.Sprintf("vuln_img_%d_%d%s", userID, time.Now().Unix(), fileExt)
	filePath := filepath.Join(uploadDir, fileName)

	// 保存文件
	src, err := file.Open()
	if err != nil {
		return "", errors.New("打开文件失败")
	}
	defer src.Close()

	dst, err := os.Create(filePath)
	if err != nil {
		return "", errors.New("创建文件失败")
	}
	defer dst.Close()

	// 复制文件内容
	if _, err := dst.ReadFrom(src); err != nil {
		return "", errors.New("保存文件失败")
	}

	// 生成访问URL
	imageURL := fmt.Sprintf("%s/uploads/vuln-images/%s", baseURL, fileName)

	return imageURL, nil
}


// GetRoles 获取角色列表
func (s *UserService) GetRoles() ([]models.Role, error) {
	db := Init.GetDB()

	var roles []models.Role
	if err := db.Find(&roles).Error; err != nil {
		return nil, errors.New("获取角色列表失败")
	}

	return roles, nil
}
