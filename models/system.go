// 系统管理模型包
// 该包定义了系统管理相关的数据模型，包括配置、日志、通知、文件存储、字典等
package models

import (
	"time" // 导入时间包，用于时间字段处理
)

// SystemConfig结构体定义系统配置表的数据模型
// 系统配置用于存储应用程序的各种设置参数，支持动态配置
type SystemConfig struct {
	ID          uint      `gorm:"primary_key" json:"id"`               // 配置唯一标识符，主键
	Key         string    `gorm:"unique;not null;size:100" json:"key"` // 配置键名，唯一且不能为空，最大100字符
	Value       string    `gorm:"type:text" json:"value"`              // 配置值，长文本类型，支持复杂配置
	Type        string    `gorm:"size:20" json:"type"`                 // 配置值类型：string字符串、int整数、bool布尔、json对象
	Group       string    `gorm:"size:50" json:"group"`                // 配置分组：auth认证、email邮件、scan扫描等
	Description string    `gorm:"size:255" json:"description"`         // 配置描述，最大255字符
	IsPublic    bool      `gorm:"default:false" json:"is_public"`      // 是否前端可见，false表示仅后端使用
	CreatedAt   time.Time `json:"created_at"`                          // 创建时间，GORM自动管理
	UpdatedAt   time.Time `json:"updated_at"`                          // 更新时间，GORM自动管理
}

// OperationLog结构体定义操作日志表的数据模型
// 记录用户在系统中的所有操作行为，用于审计和安全监控
type OperationLog struct {
	ID        uint      `gorm:"primary_key" json:"id"`         // 日志唯一标识符，主键
	UserID    uint      `json:"user_id"`                       // 操作者用户ID，外键
	User      User      `gorm:"foreignkey:UserID" json:"user"` // 操作者用户对象
	Module    string    `gorm:"size:50" json:"module"`         // 操作模块：user用户、vuln漏洞、asset资产、project项目、system系统
	Action    string    `gorm:"size:50" json:"action"`         // 操作类型：create创建、update更新、delete删除、login登录、logout登出
	Resource  string    `gorm:"size:100" json:"resource"`      // 操作的资源标识，如用户名、资产名等
	Details   string    `gorm:"type:text" json:"details"`      // 操作详细描述，长文本类型
	IP        string    `gorm:"size:45" json:"ip"`             // 操作者IP地址，支持IPv4和IPv6
	UserAgent string    `gorm:"size:500" json:"user_agent"`    // 操作者浏览器信息，最大500字符
	Status    string    `gorm:"size:20" json:"status"`         // 操作状态：success成功、failed失败
	CreatedAt time.Time `json:"created_at"`                    // 创建时间，GORM自动管理
}

// Notification结构体定义通知表的数据模型
// 系统通知用于向用户推送重要信息和提醒
type Notification struct {
	ID        uint       `gorm:"primary_key" json:"id"`         // 通知唯一标识符，主键
	UserID    uint       `json:"user_id"`                       // 通知接收者用户ID，外键
	User      User       `gorm:"foreignkey:UserID" json:"user"` // 通知接收者用户对象
	Type      string     `gorm:"size:50" json:"type"`           // 通知类型：vuln漏洞、asset资产、project项目、system系统
	Title     string     `gorm:"size:255" json:"title"`         // 通知标题，最大255字符
	Content   string     `gorm:"type:text" json:"content"`      // 通知内容，长文本类型
	IsRead    bool       `gorm:"default:false" json:"is_read"`  // 是否已读，默认为未读
	Data      string     `gorm:"type:text" json:"data"`         // JSON格式的附加数据，存储相关业务信息
	CreatedAt time.Time  `json:"created_at"`                    // 创建时间，GORM自动管理
	ReadAt    *time.Time `json:"read_at"`                       // 阅读时间，可为空
}

// FileStorage结构体定义文件存储表的数据模型
// 管理系统中上传的文件，包括头像、附件、导出文件等
type FileStorage struct {
	ID        uint      `gorm:"primary_key" json:"id"`         // 文件唯一标识符，主键
	FileName  string    `gorm:"size:255" json:"file_name"`     // 文件原始名称，最大255字符
	FilePath  string    `gorm:"size:500" json:"file_path"`     // 文件存储路径，最大500字符
	FileSize  int64     `json:"file_size"`                     // 文件大小，以字节为单位
	MimeType  string    `gorm:"size:100" json:"mime_type"`     // 文件MIME类型，如image/jpeg、application/pdf
	Hash      string    `gorm:"size:64" json:"hash"`           // 文件SHA256哈希值，用于去重和完整性验证
	UserID    uint      `json:"user_id"`                       // 上传者用户ID，外键
	User      User      `gorm:"foreignkey:UserID" json:"user"` // 上传者用户对象
	Category  string    `gorm:"size:50" json:"category"`       // 文件分类：avatar头像、attachment附件、export导出文件
	CreatedAt time.Time `json:"created_at"`                    // 创建时间，GORM自动管理
}

// Dictionary结构体定义数据字典表的数据模型
// 存储系统中的各种枚举值和配置选项，便于统一管理
type Dictionary struct {
	ID          uint      `gorm:"primary_key" json:"id"`       // 字典唯一标识符，主键
	Type        string    `gorm:"size:50" json:"type"`         // 字典类型：vuln_type漏洞类型、severity严重程度、status状态等
	Label       string    `gorm:"size:100" json:"label"`       // 字典项显示名称，最大100字符
	Value       string    `gorm:"size:100" json:"value"`       // 字典项值，最大100字符
	Description string    `gorm:"size:255" json:"description"` // 字典项描述，最大255字符
	Sort        int       `gorm:"default:0" json:"sort"`       // 排序权重，默认为0
	Status      int       `gorm:"default:1" json:"status"`     // 状态，1=启用，0=禁用，默认启用
	CreatedAt   time.Time `json:"created_at"`                  // 创建时间，GORM自动管理
	UpdatedAt   time.Time `json:"updated_at"`                  // 更新时间，GORM自动管理
}

// 数据库表名设置方法
// GORM会调用这些方法来确定实际的数据库表名

// SystemConfig模型对应的数据库表名
func (SystemConfig) TableName() string {
	return "system_configs"
}

// OperationLog模型对应的数据库表名
func (OperationLog) TableName() string {
	return "operation_logs"
}

// Notification模型对应的数据库表名
func (Notification) TableName() string {
	return "notifications"
}

// FileStorage模型对应的数据库表名
func (FileStorage) TableName() string {
	return "file_storage"
}

// Dictionary模型对应的数据库表名
func (Dictionary) TableName() string {
	return "dictionaries"
}
