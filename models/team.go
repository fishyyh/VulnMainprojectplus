// 团队管理模型包
// 该包定义了团队管理相关的数据模型，包括团队、团队成员关联等
package models

import (
	"time" // 导入时间包，用于时间字段处理
)

// Team结构体定义团队表的数据模型
// 团队是漏洞管理系统的组织单位，用于管理不同的安全团队
type Team struct {
	ID          uint         `gorm:"primary_key" json:"id"`                   // 团队唯一标识符，主键
	Name        string       `gorm:"not null;size:255" json:"name"`           // 团队名称，不能为空，最大255字符
	Description string       `gorm:"type:text" json:"description"`            // 团队详细描述，长文本类型
	LeaderID    uint         `json:"leader_id"`                               // 团队负责人ID，外键
	Leader      User         `gorm:"foreignkey:LeaderID" json:"leader"`       // 团队负责人用户对象
	Members     []TeamMember `gorm:"foreignkey:TeamID" json:"members"`        // 团队成员列表
	Status      int          `gorm:"default:1" json:"status"`                 // 团队状态：1活跃、0停用
	VulnCount   int64        `gorm:"-" json:"vuln_count"`                     // 漏洞数量，非数据库字段，动态计算
	CreatedAt   time.Time    `json:"created_at"`                              // 创建时间，GORM自动管理
	UpdatedAt   time.Time    `json:"updated_at"`                              // 更新时间，GORM自动管理
	DeletedAt   *time.Time   `sql:"index" json:"deleted_at"`                  // 删除时间，软删除标记
}

// TeamMember结构体定义团队成员关联表的数据模型
// 用于管理团队与用户的多对多关系
type TeamMember struct {
	ID        uint      `gorm:"primary_key" json:"id"`           // 关联唯一标识符，主键
	TeamID    uint      `json:"team_id"`                         // 团队ID，外键
	Team      Team      `gorm:"foreignkey:TeamID" json:"team"`   // 关联的团队对象
	UserID    uint      `json:"user_id"`                         // 用户ID，外键
	User      User      `gorm:"foreignkey:UserID" json:"user"`   // 关联的用户对象
	JoinedAt  time.Time `json:"joined_at"`                       // 加入时间，由代码设置为精确到秒
	CreatedAt time.Time `json:"created_at"`                      // 创建时间，GORM自动管理
	UpdatedAt time.Time `json:"updated_at"`                      // 更新时间，GORM自动管理
}

// Team模型的业务方法

// HasMember方法检查用户是否是团队成员
func (t *Team) HasMember(userID uint) bool {
	for _, member := range t.Members {
		if member.UserID == userID {
			return true
		}
	}
	return false
}

// IsLeader方法检查用户是否是团队负责人
func (t *Team) IsLeader(userID uint) bool {
	return t.LeaderID == userID
}

// GetMemberIDs方法获取团队所有成员的用户ID列表
func (t *Team) GetMemberIDs() []uint {
	var ids []uint
	for _, member := range t.Members {
		ids = append(ids, member.UserID)
	}
	return ids
}

// 数据库表名设置方法
// GORM会调用这些方法来确定实际的数据库表名

// Team模型对应的数据库表名
func (Team) TableName() string {
	return "teams"
}

// TeamMember模型对应的数据库表名
func (TeamMember) TableName() string {
	return "team_members"
}
