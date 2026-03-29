// 密码验证工具包
// 该包提供密码复杂度验证功能，根据系统配置验证密码是否符合安全策略
package utils

import (
	"errors"
	"regexp"
	"strconv"
	Init "vulnmain/Init"
	"vulnmain/models"
)

// PasswordPolicy 密码策略结构体
type PasswordPolicy struct {
	MinLength        int  `json:"min_length"`        // 最小长度
	RequireUppercase bool `json:"require_uppercase"` // 需要大写字母
	RequireLowercase bool `json:"require_lowercase"` // 需要小写字母
	RequireNumber    bool `json:"require_number"`    // 需要数字
	RequireSpecial   bool `json:"require_special"`   // 需要特殊字符
}

// GetPasswordPolicy 获取密码策略配置
func GetPasswordPolicy() (*PasswordPolicy, error) {
	db := Init.GetDB()
	
	policy := &PasswordPolicy{
		MinLength:        8,     // 默认最小长度
		RequireUppercase: false, // 默认不需要大写字母
		RequireLowercase: false, // 默认不需要小写字母
		RequireNumber:    false, // 默认不需要数字
		RequireSpecial:   false, // 默认不需要特殊字符
	}

	// 获取密码策略配置
	var configs []models.SystemConfig
	if err := db.Where("`group` = ?", "password").Find(&configs).Error; err != nil {
		// 如果获取配置失败，返回默认策略
		return policy, nil
	}

	// 解析配置
	for _, config := range configs {
		switch config.Key {
		case "password.min_length":
			if length, err := strconv.Atoi(config.Value); err == nil {
				policy.MinLength = length
			}
		case "password.require_uppercase":
			policy.RequireUppercase = config.Value == "true"
		case "password.require_lowercase":
			policy.RequireLowercase = config.Value == "true"
		case "password.require_number":
			policy.RequireNumber = config.Value == "true"
		case "password.require_special":
			policy.RequireSpecial = config.Value == "true"
		}
	}

	return policy, nil
}

// ValidatePassword 验证密码是否符合策略
func ValidatePassword(password string) error {
	policy, err := GetPasswordPolicy()
	if err != nil {
		return err
	}

	// 检查密码长度
	if len(password) < policy.MinLength {
		return errors.New("密码长度不能少于 " + strconv.Itoa(policy.MinLength) + " 位")
	}

	// 检查是否包含大写字母
	if policy.RequireUppercase {
		matched, _ := regexp.MatchString(`[A-Z]`, password)
		if !matched {
			return errors.New("密码必须包含至少一个大写字母")
		}
	}

	// 检查是否包含小写字母
	if policy.RequireLowercase {
		matched, _ := regexp.MatchString(`[a-z]`, password)
		if !matched {
			return errors.New("密码必须包含至少一个小写字母")
		}
	}

	// 检查是否包含数字
	if policy.RequireNumber {
		matched, _ := regexp.MatchString(`[0-9]`, password)
		if !matched {
			return errors.New("密码必须包含至少一个数字")
		}
	}

	// 检查是否包含特殊字符
	if policy.RequireSpecial {
		matched, _ := regexp.MatchString(`[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~` + "`" + `]`, password)
		if !matched {
			return errors.New("密码必须包含至少一个特殊字符")
		}
	}

	return nil
}

// GetPasswordRequirements 获取密码要求描述
func GetPasswordRequirements() ([]string, error) {
	policy, err := GetPasswordPolicy()
	if err != nil {
		return nil, err
	}

	var requirements []string

	requirements = append(requirements, "密码长度至少 "+strconv.Itoa(policy.MinLength)+" 位")

	if policy.RequireUppercase {
		requirements = append(requirements, "包含至少一个大写字母 (A-Z)")
	}

	if policy.RequireLowercase {
		requirements = append(requirements, "包含至少一个小写字母 (a-z)")
	}

	if policy.RequireNumber {
		requirements = append(requirements, "包含至少一个数字 (0-9)")
	}

	if policy.RequireSpecial {
		requirements = append(requirements, "包含至少一个特殊字符 (!@#$%^&*等)")
	}

	return requirements, nil
}
