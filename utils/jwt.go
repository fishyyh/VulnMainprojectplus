// JWT工具包
// 该包提供JWT令牌的生成、解析、刷新等功能
package utils

import (
	"errors"             // 导入错误处理包
	"strconv"            // 导入字符串转换包，用于配置值转换
	"time"               // 导入时间包，用于处理过期时间
	Init "vulnmain/Init" // 导入初始化包，获取数据库连接
	"vulnmain/models"    // 导入模型包，使用系统配置模型

	"github.com/dgrijalva/jwt-go" // 导入JWT处理包
)

// Claims结构体定义JWT声明信息
// 包含用户基本信息和标准JWT声明
type Claims struct {
	UserID             uint   `json:"user_id"`   // 用户ID
	Username           string `json:"username"`  // 用户名
	RoleCode           string `json:"role_code"` // 角色代码
	jwt.StandardClaims        // JWT标准声明，包含过期时间等
}

// GetJWTSecret函数获取JWT签名密钥
// 从系统配置中读取密钥，如果不存在则返回默认值
func GetJWTSecret() string {
	// 获取数据库连接
	db := Init.GetDB()
	var config models.SystemConfig
	// 查询JWT密钥配置
	if err := db.Where("`key` = ?", "auth.jwt.secret").First(&config).Error; err != nil {
		// 如果没有找到配置，返回默认密钥
		return "vulnmain_default_secret"
	}
	// 返回配置中的密钥值
	return config.Value
}

// GetJWTExpire函数获取JWT过期时间
// 从系统配置中读取过期时间，如果不存在则返回默认值
func GetJWTExpire() time.Duration {
	// 获取数据库连接
	db := Init.GetDB()
	var config models.SystemConfig
	// 查询JWT过期时间配置
	if err := db.Where("`key` = ?", "auth.jwt.expire").First(&config).Error; err != nil {
		// 如果没有找到配置，返回默认值（2小时）
		return 2 * time.Hour
	}

	// 将配置值（小时数）转换为时间间隔
	if hours, err := strconv.Atoi(config.Value); err == nil {
		return time.Duration(hours) * time.Hour
	}

	// 转换失败，返回默认值（2小时）
	return 2 * time.Hour
}

// GenerateToken函数为用户生成JWT令牌
// 根据用户信息创建包含用户ID、用户名、角色等信息的JWT令牌
func GenerateToken(user *models.User) (string, error) {
	// 获取当前时间
	nowTime := time.Now()
	// 计算令牌过期时间
	expireTime := nowTime.Add(time.Duration(GetJWTExpire()))

	// 创建JWT声明
	claims := Claims{
		UserID:   user.ID,        // 用户ID
		Username: user.Username,  // 用户名
		RoleCode: user.Role.Code, // 角色代码
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: expireTime.Unix(), // 过期时间（Unix时间戳）
			IssuedAt:  nowTime.Unix(),    // 签发时间（Unix时间戳）
			Issuer:    "vulnmain",        // 签发者
		},
	}

	// 使用HS256算法创建令牌
	tokenClaims := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	// 使用密钥签名令牌
	token, err := tokenClaims.SignedString([]byte(GetJWTSecret()))

	return token, err
}

// ParseToken函数解析JWT令牌
// 验证令牌有效性并返回令牌中的声明信息
func ParseToken(token string) (*Claims, error) {
	// 解析JWT令牌
	tokenClaims, err := jwt.ParseWithClaims(token, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		// 返回用于验证签名的密钥
		return []byte(GetJWTSecret()), nil
	})

	// 如果令牌解析成功
	if tokenClaims != nil {
		// 提取声明信息并验证令牌有效性
		if claims, ok := tokenClaims.Claims.(*Claims); ok && tokenClaims.Valid {
			return claims, nil
		}
	}

	// 解析失败或令牌无效
	return nil, err
}

// RefreshToken函数刷新JWT令牌
// 当令牌即将过期时，为用户生成新的令牌
func RefreshToken(tokenString string) (string, error) {
	// 解析现有令牌
	claims, err := ParseToken(tokenString)
	if err != nil {
		return "", err
	}

	// 检查令牌是否即将过期（30分钟内）
	if time.Unix(claims.StandardClaims.ExpiresAt, 0).Sub(time.Now()) > 30*time.Minute {
		return "", errors.New("令牌还未到刷新时间")
	}

	// 从数据库获取最新的用户信息
	db := Init.GetDB()
	var user models.User
	if err := db.Preload("Role").Where("id = ?", claims.UserID).First(&user).Error; err != nil {
		return "", err
	}

	// 为用户生成新的令牌
	return GenerateToken(&user)
}
