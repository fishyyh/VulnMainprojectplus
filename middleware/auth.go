// 认证中间件包
// 该包提供JWT认证、权限验证、角色验证等中间件功能
package middleware

import (
	"net/http"           // 导入HTTP包，用于状态码常量
	"strings"            // 导入字符串处理包，用于分割Authorization头
	Init "vulnmain/Init" // 导入初始化包，获取数据库连接
	"vulnmain/models"    // 导入模型包，使用用户模型
	"vulnmain/utils"     // 导入工具包，使用JWT解析功能

	"github.com/gin-gonic/gin" // 导入Gin框架，用于中间件开发
)

func isMFASetupAllowedPath(path string) bool {
	allowed := map[string]struct{}{
		"/api/logout":     {},
		"/api/user/info":  {},
		"/api/mfa/status": {},
		"/api/mfa/setup":  {},
		"/api/mfa/enable": {},
	}

	_, ok := allowed[path]
	return ok
}

// JWTAuthMiddleware函数创建JWT认证中间件
// 该中间件验证请求头中的JWT令牌，并将用户信息存储到上下文中
func JWTAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从请求头中获取Authorization字段
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			// Authorization头为空，返回401未授权错误
			c.JSON(http.StatusUnauthorized, gin.H{
				"code": 401,
				"msg":  "请求头中Authorization为空",
			})
			c.Abort() // 终止请求处理
			return
		}

		// 按空格分割Authorization头，期望格式为"Bearer <token>"
		parts := strings.SplitN(authHeader, " ", 2)
		if !(len(parts) == 2 && parts[0] == "Bearer") {
			// Authorization头格式不正确，返回401未授权错误
			c.JSON(http.StatusUnauthorized, gin.H{
				"code": 401,
				"msg":  "请求头中Authorization格式有误",
			})
			c.Abort() // 终止请求处理
			return
		}

		// 解析JWT令牌，获取用户声明信息
		claims, err := utils.ParseToken(parts[1])
		if err != nil {
			// 令牌解析失败，返回401未授权错误
			c.JSON(http.StatusUnauthorized, gin.H{
				"code": 401,
				"msg":  "无效的Token",
			})
			c.Abort() // 终止请求处理
			return
		}

		// 根据令牌中的用户ID获取用户信息
		db := Init.GetDB()
		var user models.User
		// 预加载用户角色和权限信息
		if err := db.Preload("Role.Permissions").Where("id = ?", claims.UserID).First(&user).Error; err != nil {
			// 用户不存在，返回401未授权错误
			c.JSON(http.StatusUnauthorized, gin.H{
				"code": 401,
				"msg":  "用户不存在",
			})
			c.Abort() // 终止请求处理
			return
		}

		// 检查用户状态是否为启用状态
		if user.Status != 1 {
			// 用户已被禁用，返回401未授权错误
			c.JSON(http.StatusUnauthorized, gin.H{
				"code": 401,
				"msg":  "用户已被禁用",
			})
			c.Abort() // 终止请求处理
			return
		}

		// 将用户信息存储到Gin上下文中，供后续处理使用
		c.Set("user", &user)               // 完整的用户对象
		c.Set("user_id", user.ID)          // 用户ID
		c.Set("username", user.Username)   // 用户名
		c.Set("role_code", user.Role.Code) // 角色代码

		if !user.MFAEnabled && !isMFASetupAllowedPath(c.Request.URL.Path) {
			c.JSON(http.StatusForbidden, gin.H{
				"code": 403,
				"msg":  "请先启用MFA后再继续使用系统",
			})
			c.Abort()
			return
		}

		// 继续处理请求
		c.Next()
	}
}

// PermissionMiddleware函数创建权限验证中间件
// 该中间件检查当前用户是否拥有指定的权限，如果没有则拒绝访问
func PermissionMiddleware(permissionCode string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从上下文中获取用户信息
		userInterface, exists := c.Get("user")
		if !exists {
			// 用户未认证，返回401未授权错误
			c.JSON(http.StatusUnauthorized, gin.H{
				"code": 401,
				"msg":  "用户未认证",
			})
			c.Abort() // 终止请求处理
			return
		}

		// 将接口类型转换为用户模型
		user := userInterface.(*models.User)

		// 超级管理员拥有所有权限，直接通过
		if user.Role.Code == "super_admin" || user.Role.Code == "admin" {
			c.Next() // 继续处理请求
			return
		}

		// 检查用户是否拥有指定权限
		if !user.HasPermission(permissionCode) {
			// 权限不足，返回403禁止访问错误
			c.JSON(http.StatusForbidden, gin.H{
				"code": 403,
				"msg":  "权限不足",
			})
			c.Abort() // 终止请求处理
			return
		}

		// 权限验证通过，继续处理请求
		c.Next()
	}
}

// RoleMiddleware函数创建角色验证中间件
// 该中间件检查当前用户是否拥有指定的角色，支持多个角色选择
func RoleMiddleware(roleCodes ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从上下文中获取用户信息
		userInterface, exists := c.Get("user")
		if !exists {
			// 用户未认证，返回401未授权错误
			c.JSON(http.StatusUnauthorized, gin.H{
				"code": 401,
				"msg":  "用户未认证",
			})
			c.Abort() // 终止请求处理
			return
		}

		// 将接口类型转换为用户模型
		user := userInterface.(*models.User)

		// 检查用户角色是否在允许的角色列表中
		hasRole := false
		for _, roleCode := range roleCodes {
			if user.Role.Code == roleCode {
				hasRole = true // 找到匹配的角色
				break
			}
		}

		// 如果用户角色不在允许的列表中，拒绝访问
		if !hasRole {
			c.JSON(http.StatusForbidden, gin.H{
				"code": 403,
				"msg":  "角色权限不足",
			})
			c.Abort() // 终止请求处理
			return
		}

		// 角色验证通过，继续处理请求
		c.Next()
	}
}

// OptionalAuthMiddleware函数创建可选认证中间件
// 该中间件不强制要求用户登录，但如果提供了有效的JWT令牌，会将用户信息存储到上下文中
func OptionalAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从请求头中获取Authorization字段
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			// 按空格分割Authorization头
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && parts[0] == "Bearer" {
				// 尝试解析JWT令牌
				claims, err := utils.ParseToken(parts[1])
				if err == nil {
					// 令牌有效，获取用户信息
					db := Init.GetDB()
					var user models.User
					// 预加载角色和权限信息，并验证用户状态
					if err := db.Preload("Role.Permissions").Where("id = ?", claims.UserID).First(&user).Error; err == nil && user.Status == 1 {
						// 用户有效且状态正常，将用户信息存储到上下文中
						c.Set("user", &user)
						c.Set("user_id", user.ID)
						c.Set("username", user.Username)
						c.Set("role_code", user.Role.Code)
					}
				}
			}
		}
		// 无论是否有有效的认证信息，都继续处理请求
		c.Next()
	}
}
