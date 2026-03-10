// 认证API接口包
// 该包提供用户认证相关的HTTP接口，包括登录、登出、令牌刷新等功能
package api

import (
	"fmt"
	"net/http" // 导入HTTP包，用于HTTP状态码
	"path/filepath"
	"strconv"
	"strings"
	"vulnmain/services" // 导入服务层包，使用认证服务
	"vulnmain/utils"    // 导入工具包，用于密码验证

	"github.com/gin-gonic/gin" // 导入Gin框架，用于HTTP路由处理
)

// authService是认证服务的实例，用于处理认证相关的业务逻辑
var authService = &services.AuthService{}

// Login函数处理用户登录请求
// POST /api/login
// 接收用户登录凭据，验证后返回JWT令牌和用户信息
func Login(c *gin.Context) {
	// 绑定请求体JSON数据到登录请求结构体
	var req services.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// 参数绑定失败，返回400错误
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "参数错误: " + err.Error(),
		})
		return
	}

	// 调用认证服务进行用户登录验证
	resp, err := authService.Login(&req)
	if err != nil {
		// 登录失败，返回400错误和具体错误信息
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  err.Error(),
		})
		return
	}

	// 登录成功，返回200状态码和登录响应数据（包含令牌、用户信息、权限等）
	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "登录成功",
		"data": resp,
	})
}

// RefreshToken函数处理JWT令牌刷新请求
// POST /api/refresh
// 当访问令牌即将过期时，使用此接口获取新的访问令牌
func RefreshToken(c *gin.Context) {
	// 定义刷新令牌请求的数据结构
	type RefreshRequest struct {
		Token string `json:"token" binding:"required"` // 待刷新的JWT令牌，必填
	}

	// 绑定请求体JSON数据到刷新请求结构体
	var req RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// 参数绑定失败，返回400错误
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "参数错误: " + err.Error(),
		})
		return
	}

	// 调用认证服务刷新令牌
	resp, err := authService.RefreshToken(req.Token)
	if err != nil {
		// 令牌刷新失败，返回400错误和具体错误信息
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  err.Error(),
		})
		return
	}

	// 令牌刷新成功，返回新的令牌和用户信息
	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "刷新成功",
		"data": resp,
	})
}

// Logout函数处理用户登出请求
// POST /api/logout
// 用户主动登出，可以记录登出日志或将令牌加入黑名单
func Logout(c *gin.Context) {
	// 从Gin上下文中获取当前用户ID（由JWT中间件设置）
	userID, exists := c.Get("user_id")
	if !exists {
		// 用户未认证，返回401错误
		c.JSON(http.StatusUnauthorized, gin.H{
			"code": 401,
			"msg":  "用户未认证",
		})
		return
	}

	// 调用认证服务处理用户登出逻辑
	err := authService.Logout(userID.(uint))
	if err != nil {
		// 登出处理失败，返回500错误
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "登出失败",
		})
		return
	}

	// 登出成功
	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "登出成功",
	})
}

// GetUserInfo函数获取当前登录用户的信息
// GET /api/user/info
// 返回当前用户的详细信息，包括角色和权限
func GetUserInfo(c *gin.Context) {
	// 从Gin上下文中获取用户信息（由JWT中间件预加载）
	user, exists := c.Get("user")
	if !exists {
		// 用户未认证，返回401错误
		c.JSON(http.StatusUnauthorized, gin.H{
			"code": 401,
			"msg":  "用户未认证",
		})
		return
	}

	// 返回用户信息
	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "获取成功",
		"data": user,
	})
}

// ChangePassword 修改密码
func ChangePassword(c *gin.Context) {
	type ChangePasswordRequest struct {
		OldPassword string `json:"old_password" binding:"required"`
		NewPassword string `json:"new_password" binding:"required,min=6"`
	}

	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "参数错误: " + err.Error(),
		})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"code": 401,
			"msg":  "用户未认证",
		})
		return
	}

	err := userService.ChangePassword(userID.(uint), req.OldPassword, req.NewPassword)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "密码修改成功",
	})
}

// UpdateProfile 修改个人信息
func UpdateProfile(c *gin.Context) {
	type UpdateProfileRequest struct {
		RealName   string `json:"real_name"`
		Email      string `json:"email" binding:"email"`
		Phone      string `json:"phone"`
		Department string `json:"department"`
	}

	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "参数错误: " + err.Error(),
		})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"code": 401,
			"msg":  "用户未认证",
		})
		return
	}

	// 调用用户服务更新个人信息
	updateReq := &services.UserUpdateRequest{
		RealName:   req.RealName,
		Email:      req.Email,
		Phone:      req.Phone,
		Department: req.Department,
	}

	user, err := userService.UpdateUser(userID.(uint), updateReq)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "个人信息修改成功",
		"data": user,
	})
}

// UploadVulnImage 上传漏洞相关图片
func UploadVulnImage(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"code": 401,
			"msg":  "用户未认证",
		})
		return
	}

	// 获取上传的文件
	file, err := c.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "获取文件失败: " + err.Error(),
		})
		return
	}

	// 检查文件大小 - 使用系统配置
	maxSize, err := getMaxUploadSize()
	if err != nil {
		maxSize = 5 // 默认5MB
	}
	maxSizeBytes := int64(maxSize) * 1024 * 1024
	if file.Size > maxSizeBytes {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  fmt.Sprintf("文件大小不能超过%dMB", maxSize),
		})
		return
	}

	// 检查文件类型 - 使用系统配置
	if !isValidImageTypeByConfig(file.Filename, file.Header.Get("Content-Type")) {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "文件格式不支持，请检查系统设置中允许的文件类型",
		})
		return
	}

	// 构造基础URL - 固定指向后端服务器
	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	}

	// 固定使用后端地址，避免前端端口影响
	host := c.Request.Host
	if strings.Contains(host, ":3000") || strings.Contains(host, "localhost") {
		// 如果是从前端访问，固定使用后端地址
		host = "127.0.0.1"
		if scheme == "https" {
			host = "127.0.0.1:443" // 如果需要HTTPS
		}
	}

	baseURL := fmt.Sprintf("%s://%s", scheme, host)

	// 调用用户服务上传图片
	imageURL, err := userService.UploadVulnImage(userID.(uint), file, baseURL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "图片上传成功",
		"data": gin.H{
			"image_url": imageURL,
		},
	})
}

// isValidImageType 检查是否为有效的图片类型
func isValidImageType(contentType string) bool {
	validTypes := []string{
		"image/jpeg",
		"image/jpg",
		"image/png",
		"image/gif",
		"image/webp",
	}

	for _, validType := range validTypes {
		if contentType == validType {
			return true
		}
	}
	return false
}

// GetPasswordPolicy 获取密码策略
func GetPasswordPolicy(c *gin.Context) {
	policy, err := utils.GetPasswordPolicy()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "获取密码策略失败",
		})
		return
	}

	requirements, err := utils.GetPasswordRequirements()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "获取密码要求失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "获取成功",
		"data": gin.H{
			"policy":       policy,
			"requirements": requirements,
		},
	})
}

// getMaxUploadSize 获取系统配置的最大上传文件大小(MB)
func getMaxUploadSize() (int, error) {
	systemService := &services.SystemService{}
	config, err := systemService.GetSystemConfig("upload.max_size")
	if err != nil {
		return 5, err // 默认5MB
	}

	size, err := strconv.Atoi(config.Value)
	if err != nil {
		return 5, err // 默认5MB
	}

	return size, nil
}

// getAllowedFileTypes 获取系统配置的允许文件类型
func getAllowedFileTypes() ([]string, error) {
	systemService := &services.SystemService{}
	config, err := systemService.GetSystemConfig("upload.allowed_types")
	if err != nil {
		return []string{"jpg", "jpeg", "png", "gif"}, err // 默认图片类型
	}

	types := strings.Split(config.Value, ",")
	var cleanTypes []string
	for _, t := range types {
		cleanTypes = append(cleanTypes, strings.TrimSpace(strings.ToLower(t)))
	}

	return cleanTypes, nil
}

// isValidImageTypeByConfig 根据系统配置检查文件类型是否有效
func isValidImageTypeByConfig(filename, contentType string) bool {
	// 获取允许的文件类型
	allowedTypes, err := getAllowedFileTypes()
	if err != nil {
		// 如果获取配置失败，使用默认的图片类型检查
		return isValidImageType(contentType)
	}

	// 获取文件扩展名
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(filename), "."))

	// 检查扩展名是否在允许的类型中
	for _, allowedType := range allowedTypes {
		if ext == allowedType {
			// 对于图片文件，还需要检查Content-Type
			if isImageExtension(ext) {
				return isValidImageType(contentType)
			}
			return true
		}
	}

	return false
}

// isImageExtension 检查扩展名是否为图片类型
func isImageExtension(ext string) bool {
	imageExts := []string{"jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"}
	for _, imageExt := range imageExts {
		if ext == imageExt {
			return true
		}
	}
	return false
}
