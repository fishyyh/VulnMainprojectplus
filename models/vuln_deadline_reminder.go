package models

import (
	"time"
)

// VulnDeadlineReminder 漏洞截止时间提醒记录表
// 用于记录已发送的截止时间提醒，避免重复发送
type VulnDeadlineReminder struct {
	ID             uint      `gorm:"primary_key" json:"id"`
	VulnID         uint      `gorm:"not null;index" json:"vuln_id"`         // 漏洞ID
	DaysLeft       int       `gorm:"not null" json:"days_left"`             // 剩余天数（1、2、3天）
	ReminderDate   time.Time `gorm:"not null" json:"reminder_date"`         // 提醒日期（年月日）
	SentAt         time.Time `gorm:"not null" json:"sent_at"`               // 发送时间
	AssigneeID     uint      `gorm:"not null" json:"assignee_id"`           // 被提醒人ID
	AssigneeEmail  string    `gorm:"size:100" json:"assignee_email"`        // 被提醒人邮箱
	Status         string    `gorm:"size:20;default:'sent'" json:"status"`  // 发送状态：sent-已发送，failed-发送失败
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`

	// 关联关系
	Vulnerability Vulnerability `gorm:"foreignKey:VulnID" json:"vulnerability,omitempty"`
	Assignee      User          `gorm:"foreignKey:AssigneeID" json:"assignee,omitempty"`
}

// TableName 指定表名
func (VulnDeadlineReminder) TableName() string {
	return "vuln_deadline_reminders"
}
