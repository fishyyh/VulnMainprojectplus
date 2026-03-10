// 定时任务服务包
// 该包负责处理系统的定时任务，包括周报生成和发送
package services

import (
	"fmt"
	"log"
	"time"

	"github.com/robfig/cron/v3"
)

// SchedulerService 定时任务服务
type SchedulerService struct {
	cron           *cron.Cron
	weeklyReportService *WeeklyReportService
	vulnService    *VulnService
}

// NewSchedulerService 创建定时任务服务实例
func NewSchedulerService() *SchedulerService {
	// 创建带时区的cron实例
	location, _ := time.LoadLocation("Asia/Shanghai")
	c := cron.New(cron.WithLocation(location))
	
	return &SchedulerService{
		cron:           c,
		weeklyReportService: &WeeklyReportService{},
		vulnService:    &VulnService{},
	}
}

// Start 启动定时任务
func (s *SchedulerService) Start() error {
	// 添加周报任务：每周五下午18点执行
	// cron表达式：分 时 日 月 周
	// 0 18 * * 5 表示每周五18:00执行
	_, err := s.cron.AddFunc("0 18 * * 5", s.sendWeeklyReport)
	if err != nil {
		return fmt.Errorf("添加周报定时任务失败: %v", err)
	}

	// 添加漏洞截止时间提醒任务：每天上午8点执行
	// 0 8 * * * 表示每天08:00执行
	_, err = s.cron.AddFunc("0 8 * * *", s.sendVulnDeadlineReminders)
	if err != nil {
		return fmt.Errorf("添加漏洞截止时间提醒任务失败: %v", err)
	}


	// 根据配置添加LDAP同步任务
	// 默认cron表达式保存在 system_configs.ldap.sync_cron
	ldapSvc := &LDAPService{}
	cfg, _ := ldapSvc.loadConfig()
	if cfg != nil && cfg.Enabled {
		cronExpr := "0 0 * * *"
		// 从系统配置读取表达式
		cronConfig := &SystemService{}
		if c, err := cronConfig.GetSystemConfig("ldap.sync_cron"); err == nil && c.Value != "" {
			cronExpr = c.Value
		}
		_, err = s.cron.AddFunc(cronExpr, func() {
			log.Println("开始执行LDAP用户同步...")
			created, updated, err := ldapSvc.SyncUsers()
			if err != nil {
				log.Printf("LDAP同步失败: %v", err)
			} else {
				log.Printf("LDAP同步完成，新增: %d，更新: %d", created, updated)
			}
		})
		if err != nil {
			log.Printf("添加LDAP同步任务失败: %v", err)
		}
	}

	// 启动定时任务
	s.cron.Start()
	log.Println("定时任务服务已启动")

	return nil
}

// Stop 停止定时任务
func (s *SchedulerService) Stop() {
	if s.cron != nil {
		s.cron.Stop()
		log.Println("定时任务服务已停止")
	}
}

// sendWeeklyReport 发送周报的定时任务
func (s *SchedulerService) sendWeeklyReport() {
	log.Println("开始执行周报发送任务...")
	
	err := s.weeklyReportService.SendWeeklyReport()
	if err != nil {
		log.Printf("周报发送失败: %v", err)
	} else {
		log.Println("周报发送成功")
	}
}

// sendWeeklyReportTest 测试用的周报发送任务
func (s *SchedulerService) sendWeeklyReportTest() {
	log.Println("开始执行测试周报发送任务...")
	
	err := s.weeklyReportService.SendWeeklyReport()
	if err != nil {
		log.Printf("测试周报发送失败: %v", err)
	} else {
		log.Println("测试周报发送成功")
	}
}

// sendVulnDeadlineReminders 发送漏洞截止时间提醒的定时任务
func (s *SchedulerService) sendVulnDeadlineReminders() {
	log.Println("开始执行漏洞截止时间提醒任务...")

	err := s.vulnService.SendDeadlineReminders()
	if err != nil {
		log.Printf("漏洞截止时间提醒发送失败: %v", err)
	} else {
		log.Println("漏洞截止时间提醒发送完成")
	}
}

// ManualSendWeeklyReport 手动发送周报（用于测试或紧急情况）
func (s *SchedulerService) ManualSendWeeklyReport() error {
	log.Println("手动发送周报...")
	
	err := s.weeklyReportService.SendWeeklyReport()
	if err != nil {
		log.Printf("手动周报发送失败: %v", err)
		return err
	}
	log.Println("手动周报发送成功")
	return nil
}

// ManualSendVulnDeadlineReminders 手动发送漏洞截止时间提醒（用于测试或紧急情况）
func (s *SchedulerService) ManualSendVulnDeadlineReminders() error {
	log.Println("手动发送漏洞截止时间提醒...")

	err := s.vulnService.SendDeadlineReminders()
	if err != nil {
		log.Printf("手动漏洞截止时间提醒发送失败: %v", err)
		return err
	}
	log.Println("手动漏洞截止时间提醒发送成功")
	return nil
}

// GetNextWeeklyReportTime 获取下次周报发送时间
func (s *SchedulerService) GetNextWeeklyReportTime() time.Time {
	entries := s.cron.Entries()
	if len(entries) > 0 {
		return entries[0].Next
	}
	return time.Time{}
}

// GetSchedulerStatus 获取定时任务状态
func (s *SchedulerService) GetSchedulerStatus() map[string]interface{} {
	entries := s.cron.Entries()
	
	status := map[string]interface{}{
		"running":    len(entries) > 0,
		"task_count": len(entries),
		"tasks":      []map[string]interface{}{},
	}
	
	for i, entry := range entries {
		taskInfo := map[string]interface{}{
			"id":        i + 1,
			"next_run":  entry.Next.Format("2006-01-02 15:04:05"),
			"prev_run":  entry.Prev.Format("2006-01-02 15:04:05"),
		}
		
		// 根据任务索引确定任务名称
		if i == 0 {
			taskInfo["name"] = "周报发送"
			taskInfo["schedule"] = "每周五 18:00"
		} else if i == 1 {
			taskInfo["name"] = "漏洞截止时间提醒"
			taskInfo["schedule"] = "每天 08:00"
		}
		
		status["tasks"] = append(status["tasks"].([]map[string]interface{}), taskInfo)
	}
	
	return status
}

// 全局定时任务服务实例
var globalScheduler *SchedulerService

// InitScheduler 初始化全局定时任务服务
func InitScheduler() error {
	globalScheduler = NewSchedulerService()
	return globalScheduler.Start()
}

// StopScheduler 停止全局定时任务服务
func StopScheduler() {
	if globalScheduler != nil {
		globalScheduler.Stop()
	}
}

// GetGlobalScheduler 获取全局定时任务服务实例
func GetGlobalScheduler() *SchedulerService {
	return globalScheduler
}
