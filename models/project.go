// 项目管理模型包
// 该包定义了项目管理相关的数据模型，包括项目、项目成员关联等
package models

import (
	"time" // 导入时间包，用于时间字段处理
)

// Project结构体定义项目表的数据模型
// 项目是漏洞管理系统的核心组织单位，用于管理不同的安全项目
type Project struct {
	ID          uint            `gorm:"primary_key" json:"id"`                       // 项目唯一标识符，主键
	Name        string          `gorm:"not null;size:255" json:"name"`               // 项目名称，不能为空，最大255字符
	Type        string          `gorm:"size:50" json:"type"`                         // 项目类型：web_project网站项目、api_interface接口项目、mobile_app移动应用、software_app软件应用
	Priority    string          `gorm:"size:20" json:"priority"`                     // 优先级：high高、medium中、low低
	Description string          `gorm:"type:text" json:"description"`                // 项目详细描述，长文本类型
	OwnerID     uint            `json:"owner_id"`                                    // 项目负责人ID，外键
	Owner       User            `gorm:"foreignkey:OwnerID" json:"owner"`             // 项目负责人用户对象
	StartDate   *time.Time      `json:"start_date"`                                  // 项目开始日期，可为空
	EndDate     *time.Time      `json:"end_date"`                                    // 项目结束日期，可为空，为空表示永久不到期
	IsPublic    bool            `gorm:"default:false" json:"is_public"`              // 是否公开给所有用户，默认不公开
	Status      string          `gorm:"size:20;default:'active'" json:"status"`      // 项目状态：active活跃、inactive非活跃、completed已完成、archived已归档
	Members     []ProjectMember `gorm:"foreignkey:ProjectID" json:"members"`         // 项目成员列表
	Assets      []Asset         `gorm:"foreignkey:ProjectID" json:"assets"`          // 项目资产列表
	Vulns       []Vulnerability `gorm:"foreignkey:ProjectID" json:"vulnerabilities"` // 项目漏洞列表
	CreatedBy   uint            `json:"created_by"`                                  // 创建者用户ID，外键
	Creator     User            `gorm:"foreignkey:CreatedBy" json:"creator"`         // 创建者用户对象
	CreatedAt   time.Time       `json:"created_at"`                                  // 创建时间，GORM自动管理
	UpdatedAt   time.Time       `json:"updated_at"`                                  // 更新时间，GORM自动管理
	DeletedAt   *time.Time      `sql:"index" json:"deleted_at"`                      // 删除时间，软删除标记
}

// ProjectMember结构体定义项目成员关联表的数据模型
// 用于管理项目与用户的多对多关系，支持不同的成员角色
type ProjectMember struct {
	ID        uint      `gorm:"primary_key" json:"id"`               // 关联唯一标识符，主键
	ProjectID uint      `json:"project_id"`                          // 项目ID，外键
	Project   Project   `gorm:"foreignkey:ProjectID" json:"project"` // 关联的项目对象
	UserID    uint      `json:"user_id"`                             // 用户ID，外键
	User      User      `gorm:"foreignkey:UserID" json:"user"`       // 关联的用户对象
	Role      string    `gorm:"size:20" json:"role"`                 // 成员角色：security_engineer安全工程师、dev_engineer研发工程师
	JoinedAt  time.Time `json:"joined_at"`                           // 加入时间，由代码设置为精确到秒
	CreatedAt time.Time `json:"created_at"`                          // 创建时间，GORM自动管理
	UpdatedAt time.Time `json:"updated_at"`                          // 更新时间，GORM自动管理
}

// ProjectStats结构体定义项目统计信息的数据模型
// 用于缓存项目的统计数据，提高查询性能
type ProjectStats struct {
	ID             uint      `gorm:"primary_key" json:"id"`               // 统计唯一标识符，主键
	ProjectID      uint      `gorm:"unique" json:"project_id"`            // 项目ID，外键，唯一索引
	Project        Project   `gorm:"foreignkey:ProjectID" json:"project"` // 关联的项目对象
	TotalAssets    int       `gorm:"default:0" json:"total_assets"`       // 总资产数量
	TotalVulns     int       `gorm:"default:0" json:"total_vulns"`        // 总漏洞数量
	UnfixedVulns   int       `gorm:"default:0" json:"unfixed_vulns"`      // 未修复漏洞数量
	FixingVulns    int       `gorm:"default:0" json:"fixing_vulns"`       // 修复中漏洞数量
	FixedVulns     int       `gorm:"default:0" json:"fixed_vulns"`        // 已修复漏洞数量
	RetestingVulns int       `gorm:"default:0" json:"retesting_vulns"`    // 复测中漏洞数量
	CompletedVulns int       `gorm:"default:0" json:"completed_vulns"`    // 已完成漏洞数量
	IgnoredVulns   int       `gorm:"default:0" json:"ignored_vulns"`      // 已忽略漏洞数量
	CriticalVulns  int       `gorm:"default:0" json:"critical_vulns"`     // 严重漏洞数量
	HighVulns      int       `gorm:"default:0" json:"high_vulns"`         // 高危漏洞数量
	MediumVulns    int       `gorm:"default:0" json:"medium_vulns"`       // 中危漏洞数量
	LowVulns       int       `gorm:"default:0" json:"low_vulns"`          // 低危漏洞数量
	InfoVulns      int       `gorm:"default:0" json:"info_vulns"`         // 提示漏洞数量
	LastUpdated    time.Time `json:"last_updated"`                        // 最后更新时间，由代码设置为精确到秒
}

// Project模型的业务方法

// IsExpired方法检查项目是否已到期
// 如果EndDate为空，表示永久不到期
func (p *Project) IsExpired() bool {
	if p.EndDate == nil {
		return false // 永久不到期
	}
	return time.Now().After(*p.EndDate)
}

// CanSubmitVulns方法检查项目是否可以提交新漏洞
// 项目必须是活跃状态且未到期
func (p *Project) CanSubmitVulns() bool {
	return p.Status == "active" && !p.IsExpired()
}

// HasMember方法检查用户是否是项目成员
// 可以指定检查特定角色或检查任意角色
func (p *Project) HasMember(userID uint, role ...string) bool {
	for _, member := range p.Members {
		if member.UserID == userID {
			if len(role) == 0 {
				return true // 检查任意角色
			}
			for _, r := range role {
				if member.Role == r {
					return true // 检查特定角色
				}
			}
		}
	}
	return false
}

// GetSecurityEngineers方法获取项目的所有安全工程师
func (p *Project) GetSecurityEngineers() []User {
	var engineers []User
	for _, member := range p.Members {
		if member.Role == "security_engineer" {
			engineers = append(engineers, member.User)
		}
	}
	return engineers
}

// GetDevEngineers方法获取项目的所有研发工程师
func (p *Project) GetDevEngineers() []User {
	var engineers []User
	for _, member := range p.Members {
		if member.Role == "dev_engineer" {
			engineers = append(engineers, member.User)
		}
	}
	return engineers
}

// HasAccess方法检查用户是否有项目访问权限
// 项目负责人和项目成员都有访问权限
func (p *Project) HasAccess(userID uint) bool {
	// 检查是否是项目负责人
	if p.OwnerID == userID {
		return true
	}

	// 检查是否是项目成员
	return p.HasMember(userID)
}

// 数据库表名设置方法
// GORM会调用这些方法来确定实际的数据库表名

// Project模型对应的数据库表名
func (Project) TableName() string {
	return "projects"
}

// ProjectMember模型对应的数据库表名
func (ProjectMember) TableName() string {
	return "project_members"
}

// ProjectStats模型对应的数据库表名
func (ProjectStats) TableName() string {
	return "project_stats"
}
