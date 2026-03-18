// 用户管理模型包
// 该包定义了用户、角色、权限相关的数据模型和业务逻辑
package models

import (
	"time" // 导入时间包，用于时间字段

	"golang.org/x/crypto/bcrypt" // 导入bcrypt包，用于密码加密
	"gorm.io/gorm"
)

// User结构体定义用户表的数据模型
// 包含用户的基本信息、认证信息、角色关联等
type User struct {
	gorm.Model
	Username         string     `gorm:"uniqueIndex;not null" json:"username"`
	Email            string     `gorm:"uniqueIndex;not null" json:"email"`
	Password         string     `gorm:"not null" json:"-"`
	RealName         string     `json:"real_name"`
	Phone            string     `json:"phone"`
	Department       string     `json:"department"`
	Source           string     `gorm:"size:20;default:'local'" json:"source"` // 账户来源：local/ldap
	Status           int        `gorm:"default:1" json:"status"`               // 1:启用 0:禁用
	LastLoginAt      *time.Time `json:"last_login_at"`
	RoleID           uint       `gorm:"not null" json:"role_id"`
	Role             Role       `gorm:"foreignKey:RoleID" json:"role"`
	MFAEnabled       bool       `gorm:"default:false" json:"mfa_enabled"`
	MFASecret        string     `gorm:"type:text" json:"-"`
	MFAPendingSecret string     `gorm:"type:text" json:"-"`
	MFALastUsedStep  int64      `gorm:"default:0" json:"-"`
}

// Role结构体定义角色表的数据模型
// 角色用于权限控制，每个用户关联一个角色
type Role struct {
	ID          uint         `gorm:"primary_key" json:"id"`                          // 角色唯一标识符，主键
	Name        string       `gorm:"unique;not null;size:50" json:"name"`            // 角色名称，唯一且不能为空，最大50字符
	Code        string       `gorm:"unique;not null;size:50" json:"code"`            // 角色代码，唯一且不能为空，用于程序逻辑判断
	Description string       `gorm:"size:255" json:"description"`                    // 角色描述，最大255字符
	Status      int          `gorm:"default:1" json:"status"`                        // 角色状态，1=启用，0=禁用，默认启用
	Permissions []Permission `gorm:"many2many:role_permissions;" json:"permissions"` // 权限列表，多对多关系
	CreatedAt   time.Time    `json:"created_at"`                                     // 创建时间，GORM自动管理
	UpdatedAt   time.Time    `json:"updated_at"`                                     // 更新时间，GORM自动管理
}

// Permission结构体定义权限表的数据模型
// 权限用于控制用户对系统功能的访问
type Permission struct {
	ID          uint      `gorm:"primary_key" json:"id"`                // 权限唯一标识符，主键
	Name        string    `gorm:"unique;not null;size:50" json:"name"`  // 权限名称，唯一且不能为空，最大50字符
	Code        string    `gorm:"unique;not null;size:100" json:"code"` // 权限代码，唯一且不能为空，用于程序逻辑判断
	Description string    `gorm:"size:255" json:"description"`          // 权限描述，最大255字符
	Module      string    `gorm:"size:50" json:"module"`                // 所属模块，如user、vuln、asset、project、system
	Action      string    `gorm:"size:50" json:"action"`                // 操作类型，如view、create、edit、delete、audit
	CreatedAt   time.Time `json:"created_at"`                           // 创建时间，GORM自动管理
	UpdatedAt   time.Time `json:"updated_at"`                           // 更新时间，GORM自动管理
}

// RolePermission结构体定义角色权限关联表的数据模型
// 建立角色与权限的多对多关系
type RolePermission struct {
	RoleID       uint `gorm:"primary_key"` // 角色ID，复合主键的一部分
	PermissionID uint `gorm:"primary_key"` // 权限ID，复合主键的一部分
}

// User模型的业务方法

// SetPassword方法为用户设置密码
// 使用bcrypt算法对密码进行加密存储，确保密码安全
func (u *User) SetPassword(password string) error {
	// 使用bcrypt默认强度对密码进行哈希加密
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		// 加密失败，返回错误
		return err
	}
	// 将加密后的密码存储到用户对象中
	u.Password = string(hashedPassword)
	return nil
}

// CheckPassword方法验证用户密码
// 将输入的明文密码与存储的哈希密码进行比较
func (u *User) CheckPassword(password string) bool {
	// 使用bcrypt比较明文密码与哈希密码
	err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password))
	// 如果比较成功（err == nil），返回true，否则返回false
	return err == nil
}

// HasPermission方法检查用户是否具有指定权限
// 通过遍历用户角色的权限列表来判断
func (u *User) HasPermission(code string) bool {
	// 遍历用户角色的所有权限
	for _, permission := range u.Role.Permissions {
		// 如果找到匹配的权限代码，返回true
		if permission.Code == code {
			return true
		}
	}
	// 没有找到匹配的权限，返回false
	return false
}

// 数据库表名设置方法
// GORM会调用这些方法来确定实际的数据库表名

// User模型对应的数据库表名
func (User) TableName() string {
	return "users"
}

// Role模型对应的数据库表名
func (Role) TableName() string {
	return "roles"
}

// Permission模型对应的数据库表名
func (Permission) TableName() string {
	return "permissions"
}

// RolePermission模型对应的数据库表名
func (RolePermission) TableName() string {
	return "role_permissions"
}
