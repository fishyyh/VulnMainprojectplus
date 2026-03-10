// 资产管理模型包
// 该包定义了资产管理相关的数据模型，包括资产、资产组、标签、审计日志等
package models

import (
	"time" // 导入时间包，用于时间字段处理
)

// Asset结构体定义资产表的数据模型
// 资产是漏洞管理系统中的核心实体，代表需要保护的网络资源
type Asset struct {
	ID           uint        `gorm:"primary_key" json:"id"`                      // 资产唯一标识符，主键
	Name         string      `gorm:"not null;size:255" json:"name"`              // 资产名称，不能为空，最大255字符
	Type         string      `gorm:"size:50" json:"type"`                        // 资产类型：server服务器、network_device网络设备、database数据库、storage_device存储设备、custom自定义类型
	Domain       string      `gorm:"size:255" json:"domain"`                     // 资产域名，可选，必须加http或https，最大255字符
	IP           string      `gorm:"not null;size:45" json:"ip"`                 // 资产IP地址，必填，支持IPv4和IPv6格式
	Port         string      `gorm:"not null;size:100" json:"port"`              // 资产端口信息，必填，支持多端口用逗号分隔
	OS           string      `gorm:"size:100" json:"os"`                         // 操作系统：CentOS、Windows、Ubuntu、Debian、Red Hat、龙蜥(Anolis)、其他
	Owner        string      `gorm:"size:100" json:"owner"`                      // 资产负责人名字，最大100字符
	Environment  string      `gorm:"size:50" json:"environment"`                 // 所属环境：production生产环境、pre_production准生产环境、staging预发环境、testing测试环境、development开发环境、disaster_recovery容灾环境
	Department   string      `gorm:"size:100" json:"department"`                 // 资产所属部门，最大100字符
	Importance   string      `gorm:"size:20" json:"importance"`                  // 资产重要性：extremely_high极高、high高、medium中、low低
	ProjectID    uint        `json:"project_id"`                                 // 关联项目ID，外键
	Project      Project     `gorm:"foreignkey:ProjectID" json:"project"`        // 关联的项目对象
	AssetGroupID *uint       `json:"asset_group_id"`                             // 所属资产组ID，外键，可为空
	AssetGroup   *AssetGroup `gorm:"foreignkey:AssetGroupID" json:"asset_group"` // 关联的资产组对象
	CreatedBy    uint        `json:"created_by"`                                 // 创建者用户ID，外键
	Creator      User        `gorm:"foreignkey:CreatedBy" json:"creator"`        // 创建者用户对象
	Tags         string      `gorm:"size:500" json:"tags"`                       // 资产标签，用逗号分隔，便于分类和搜索
	Status       string      `gorm:"size:20;default:'active'" json:"status"`     // 资产状态：active活跃、inactive非活跃、maintenance维护中
	Description  string      `gorm:"type:text" json:"description"`               // 资产详细描述，长文本类型
	CreatedAt    time.Time   `json:"created_at"`                                 // 创建时间，GORM自动管理
	UpdatedAt    time.Time   `json:"updated_at"`                                 // 更新时间，GORM自动管理
	DeletedAt    *time.Time  `sql:"index" json:"deleted_at"`                     // 删除时间，软删除标记
}

// AssetGroup结构体定义资产组表的数据模型
// 资产组用于对资产进行分类管理，支持层级结构
type AssetGroup struct {
	ID          uint         `gorm:"primary_key" json:"id"`                // 资产组唯一标识符，主键
	Name        string       `gorm:"unique;not null;size:100" json:"name"` // 资产组名称，唯一且不能为空，最大100字符
	Description string       `gorm:"size:255" json:"description"`          // 资产组描述，最大255字符
	ParentID    *uint        `json:"parent_id"`                            // 父资产组ID，可为空，用于构建层级结构
	Parent      *AssetGroup  `gorm:"foreignkey:ParentID" json:"parent"`    // 父资产组对象，可为空
	Children    []AssetGroup `gorm:"foreignkey:ParentID" json:"children"`  // 子资产组列表
	Level       int          `gorm:"default:1" json:"level"`               // 分组层级，默认为1
	Sort        int          `gorm:"default:0" json:"sort"`                // 排序权重，默认为0
	Status      int          `gorm:"default:1" json:"status"`              // 状态，1=启用，0=禁用，默认启用
	CreatedBy   uint         `json:"created_by"`                           // 创建者用户ID，外键
	Creator     User         `gorm:"foreignkey:CreatedBy" json:"creator"`  // 创建者用户对象
	CreatedAt   time.Time    `json:"created_at"`                           // 创建时间，GORM自动管理
	UpdatedAt   time.Time    `json:"updated_at"`                           // 更新时间，GORM自动管理
}

// AssetTag结构体定义资产标签表的数据模型
// 标签用于对资产进行标记和分类，便于筛选和管理
type AssetTag struct {
	ID        uint      `gorm:"primary_key" json:"id"`               // 标签唯一标识符，主键
	Name      string    `gorm:"unique;not null;size:50" json:"name"` // 标签名称，唯一且不能为空，最大50字符
	Color     string    `gorm:"size:10" json:"color"`                // 标签颜色，用于前端显示，最大10字符（如#FF0000）
	CreatedAt time.Time `json:"created_at"`                          // 创建时间，GORM自动管理
	UpdatedAt time.Time `json:"updated_at"`                          // 更新时间，GORM自动管理
}

// AssetAuditLog结构体定义资产审计日志表的数据模型
// 记录资产的所有操作历史，用于审计和追踪
type AssetAuditLog struct {
	ID        uint      `gorm:"primary_key" json:"id"`           // 日志唯一标识符，主键
	AssetID   uint      `json:"asset_id"`                        // 关联资产ID，外键
	Asset     Asset     `gorm:"foreignkey:AssetID" json:"asset"` // 关联的资产对象
	Action    string    `gorm:"size:50" json:"action"`           // 操作类型：create创建、update更新、delete删除、scan扫描
	Before    string    `gorm:"type:text" json:"before"`         // 变更前的数据，JSON格式存储
	After     string    `gorm:"type:text" json:"after"`          // 变更后的数据，JSON格式存储
	UserID    uint      `json:"user_id"`                         // 操作者用户ID，外键
	User      User      `gorm:"foreignkey:UserID" json:"user"`   // 操作者用户对象
	IP        string    `gorm:"size:45" json:"ip"`               // 操作者IP地址，支持IPv4和IPv6
	UserAgent string    `gorm:"size:500" json:"user_agent"`      // 操作者浏览器信息，最大500字符
	CreatedAt time.Time `json:"created_at"`                      // 创建时间，GORM自动管理
}

// 数据库表名设置方法
// GORM会调用这些方法来确定实际的数据库表名

// Asset模型对应的数据库表名
func (Asset) TableName() string {
	return "assets"
}

// AssetGroup模型对应的数据库表名
func (AssetGroup) TableName() string {
	return "asset_groups"
}

// AssetTag模型对应的数据库表名
func (AssetTag) TableName() string {
	return "asset_tags"
}

// AssetAuditLog模型对应的数据库表名
func (AssetAuditLog) TableName() string {
	return "asset_audit_logs"
}
