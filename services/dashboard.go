package services

import (
	"time"
	Init "vulnmain/Init"
	"vulnmain/models"

	"github.com/jinzhu/gorm"
)

type DashboardService struct{}

// DashboardData 仪表板数据结构
type DashboardData struct {
	// 基础统计
	TotalVulns    int64 `json:"total_vulns"`    // 总漏洞数
	TotalProjects int64 `json:"total_projects"` // 总项目数
	DueSoonVulns  int64 `json:"due_soon_vulns"` // 即将到期漏洞数

	// 漏洞状态统计
	VulnStatusStats map[string]int64 `json:"vuln_status_stats"`

	// 严重程度统计
	SeverityStats map[string]int64 `json:"severity_stats"`

	// 趋势数据（最近7天）
	TrendData []TrendDataItem `json:"trend_data"`

	// 排行榜
	SecurityEngineerRanking []EngineerRankingItem `json:"security_engineer_ranking,omitempty"`
	DevEngineerRanking      []EngineerRankingItem `json:"dev_engineer_ranking,omitempty"`

	// 最新漏洞
	LatestVulns []VulnListItem `json:"latest_vulns"`

	// 当前用户特定数据（仅安全工程师和研发工程师）
	CurrentUserVulns *UserVulnStats `json:"current_user_vulns,omitempty"`
}

// TrendDataItem 趋势数据项
type TrendDataItem struct {
	Date         string `json:"date"`
	NewVulns     int64  `json:"new_vulns"`
	FixedVulns   int64  `json:"fixed_vulns"`
	PendingVulns int64  `json:"pending_vulns"`
}

// EngineerRankingItem 工程师排行榜项
type EngineerRankingItem struct {
	UserID   uint   `json:"user_id"`
	Username string `json:"username"`
	RealName string `json:"real_name"`
	Count    int64  `json:"count"`
}

// VulnListItem 漏洞列表项
type VulnListItem struct {
	ID           uint       `json:"id"`
	Title        string     `json:"title"`
	Severity     string     `json:"severity"`
	Status       string     `json:"status"`
	ProjectName  string     `json:"project_name"`
	ReporterName string     `json:"reporter_name"`
	SubmittedAt  time.Time  `json:"submitted_at"`
	FixDeadline  *time.Time `json:"fix_deadline,omitempty"`
}

// UserVulnStats 用户漏洞统计
type UserVulnStats struct {
	TotalCount   int64            `json:"total_count"`   // 所有历史漏洞总数
	MonthlyCount int64            `json:"monthly_count"` // 当月提交漏洞数
	StatusStats  map[string]int64 `json:"status_stats"`
	DueSoonCount int64            `json:"due_soon_count"`
}

// GetDashboardData 获取仪表板数据
func (s *DashboardService) GetDashboardData(userID uint, roleCode string) (*DashboardData, error) {
	db := Init.GetDB()

	switch roleCode {
	case "super_admin", "admin", "security_engineer":
		return s.getSuperAdminDashboard(db)
	case "dev_engineer":
		return s.getDevEngineerDashboard(db, userID)
	default:
		return s.getDefaultDashboard(db)
	}
}

// getSuperAdminDashboard 获取超级管理员仪表板数据
func (s *DashboardService) getSuperAdminDashboard(db *gorm.DB) (*DashboardData, error) {
	data := &DashboardData{
		VulnStatusStats: make(map[string]int64),
		SeverityStats:   make(map[string]int64),
	}

	// 总漏洞数
	db.Model(&models.Vulnerability{}).
		Where("deleted_at IS NULL").
		Count(&data.TotalVulns)

	// 总项目数
	db.Model(&models.Project{}).Where("status != ?", "archived").Count(&data.TotalProjects)

	// 即将到期漏洞数（今天起7天内）
	now := time.Now()
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)
	sevenDaysLater := startOfToday.AddDate(0, 0, 7)
	db.Model(&models.Vulnerability{}).
		Where("deleted_at IS NULL").
		Where("fix_deadline IS NOT NULL AND fix_deadline >= ? AND fix_deadline <= ? AND status NOT IN ('fixed', 'completed', 'closed', 'ignored')", startOfToday, sevenDaysLater).
		Count(&data.DueSoonVulns)

	// 漏洞状态统计
	var statusStats []struct {
		Status string `json:"status"`
		Count  int64  `json:"count"`
	}
	db.Model(&models.Vulnerability{}).
		Select("status, COUNT(*) as count").
		Where("deleted_at IS NULL").
		Group("status").
		Scan(&statusStats)

	for _, stat := range statusStats {
		data.VulnStatusStats[stat.Status] = stat.Count
	}

	// 严重程度统计（排除已删除漏洞）
	var severityStats []struct {
		Severity string `json:"severity"`
		Count    int64  `json:"count"`
	}
	db.Model(&models.Vulnerability{}).
		Select("severity, COUNT(*) as count").
		Where("deleted_at IS NULL").
		Group("severity").
		Scan(&severityStats)
	for _, stat := range severityStats {
		data.SeverityStats[stat.Severity] = stat.Count
	}

	// 近7天趋势数据（排除已删除漏洞）
	trendData := make([]TrendDataItem, 7)
	for i := 6; i >= 0; i-- {
		dayStart := time.Date(now.Year(), now.Month(), now.Day()-i, 0, 0, 0, 0, time.Local)
		dayEnd := dayStart.Add(24 * time.Hour)
		var newVulns, fixedVulns, pendingVulns int64
		db.Model(&models.Vulnerability{}).
			Where("deleted_at IS NULL AND submitted_at >= ? AND submitted_at < ?", dayStart, dayEnd).
			Count(&newVulns)
		db.Model(&models.Vulnerability{}).
			Where("deleted_at IS NULL AND fixed_at >= ? AND fixed_at < ?", dayStart, dayEnd).
			Count(&fixedVulns)
		db.Model(&models.Vulnerability{}).
			Where("deleted_at IS NULL AND submitted_at >= ? AND submitted_at < ? AND status NOT IN ('fixed', 'completed', 'closed', 'ignored', 'rejected')", dayStart, dayEnd).
			Count(&pendingVulns)
		trendData[6-i] = TrendDataItem{
			Date:         dayStart.Format("01-02"),
			NewVulns:     newVulns,
			FixedVulns:   fixedVulns,
			PendingVulns: pendingVulns,
		}
	}
	data.TrendData = trendData

	// 安全工程师排行榜（当月提交漏洞数）
	currentMonth := time.Now().Format("2006-01")
	var secRanking []EngineerRankingItem
	db.Table("vulnerabilities").
		Select("users.id as user_id, users.username, users.real_name, COUNT(*) as count").
		Joins("JOIN users ON vulnerabilities.reporter_id = users.id").
		Where("vulnerabilities.deleted_at IS NULL AND vulnerabilities.submitted_at >= ? AND vulnerabilities.submitted_at < ?",
			currentMonth+"-01", getNextMonthStart(currentMonth)).
		Group("users.id").
		Order("count DESC").
		Limit(10).
		Scan(&secRanking)
	data.SecurityEngineerRanking = secRanking

	// 研发工程师排行榜（当月修复完成漏洞数）
	var devRanking []EngineerRankingItem

	// 首先尝试基于 fixed_by 和 fixed_at 的查询（标准流程）
	db.Table("vulnerabilities").
		Select("users.id as user_id, users.username, users.real_name, COUNT(*) as count").
		Joins("JOIN users ON vulnerabilities.fixed_by = users.id").
		Where("vulnerabilities.deleted_at IS NULL AND vulnerabilities.fixed_at >= ? AND vulnerabilities.fixed_at < ? AND vulnerabilities.fixed_by IS NOT NULL",
			currentMonth+"-01", getNextMonthStart(currentMonth)).
		Group("users.id").
		Order("count DESC").
		Limit(10).
		Scan(&devRanking)

	// 如果基于 fixed_by 的查询没有结果，使用 assignee_id 和状态的查询（兼容性查询）
	if len(devRanking) == 0 {
		db.Table("vulnerabilities").
			Select("users.id as user_id, users.username, users.real_name, COUNT(*) as count").
			Joins("JOIN users ON vulnerabilities.assignee_id = users.id").
			Where("vulnerabilities.deleted_at IS NULL AND vulnerabilities.status IN ('fixed', 'closed', 'completed') AND vulnerabilities.updated_at >= ? AND vulnerabilities.updated_at < ? AND vulnerabilities.assignee_id IS NOT NULL",
				currentMonth+"-01", getNextMonthStart(currentMonth)).
			Group("users.id").
			Order("count DESC").
			Limit(10).
			Scan(&devRanking)
	}

	data.DevEngineerRanking = devRanking

	// 最新漏洞（前10）
	var latestVulns []VulnListItem
	db.Table("vulnerabilities").
		Select("vulnerabilities.id, vulnerabilities.title, vulnerabilities.severity, vulnerabilities.status, vulnerabilities.submitted_at, vulnerabilities.fix_deadline, projects.name as project_name, users.real_name as reporter_name").
		Joins("LEFT JOIN projects ON vulnerabilities.project_id = projects.id").
		Joins("LEFT JOIN users ON vulnerabilities.reporter_id = users.id").
		Where("vulnerabilities.deleted_at IS NULL").
		Order("vulnerabilities.submitted_at DESC").
		Limit(10).
		Scan(&latestVulns)
	data.LatestVulns = latestVulns

	return data, nil
}

// getSecurityEngineerDashboard 获取安全工程师仪表板数据
func (s *DashboardService) getSecurityEngineerDashboard(db *gorm.DB, userID uint) (*DashboardData, error) {
	data := &DashboardData{
		VulnStatusStats: make(map[string]int64),
		CurrentUserVulns: &UserVulnStats{
			StatusStats: make(map[string]int64),
		},
	}

	// 当前用户所有提交的漏洞数（用于修复率计算）
	db.Model(&models.Vulnerability{}).
		Where("deleted_at IS NULL").
		Where("reporter_id = ?", userID).
		Count(&data.CurrentUserVulns.TotalCount)

	// 当前用户当月提交的漏洞数
	currentMonth := time.Now().Format("2006-01")
	db.Model(&models.Vulnerability{}).
		Where("deleted_at IS NULL").
		Where("reporter_id = ? AND submitted_at >= ? AND submitted_at < ?",
			userID, currentMonth+"-01", getNextMonthStart(currentMonth)).
		Count(&data.CurrentUserVulns.MonthlyCount)

	// 当前用户漏洞状态统计
	var userStatusStats []struct {
		Status string `json:"status"`
		Count  int64  `json:"count"`
	}
	db.Model(&models.Vulnerability{}).
		Select("status, COUNT(*) as count").
		Where("deleted_at IS NULL").
		Where("reporter_id = ?", userID).
		Group("status").
		Scan(&userStatusStats)

	for _, stat := range userStatusStats {
		data.CurrentUserVulns.StatusStats[stat.Status] = stat.Count
	}

	// 当前用户即将到期漏洞数（今天起7天内）
	now := time.Now()
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)
	sevenDaysLater := startOfToday.AddDate(0, 0, 7)
	db.Model(&models.Vulnerability{}).
		Where("deleted_at IS NULL").
		Where("reporter_id = ? AND fix_deadline IS NOT NULL AND fix_deadline >= ? AND fix_deadline <= ? AND status NOT IN ('fixed', 'completed', 'closed', 'ignored')",
			userID, startOfToday, sevenDaysLater).
		Count(&data.CurrentUserVulns.DueSoonCount)

	// 安全工程师排行榜
	var secRanking []EngineerRankingItem
	db.Table("vulnerabilities").
		Select("users.id as user_id, users.username, users.real_name, COUNT(*) as count").
		Joins("JOIN users ON vulnerabilities.reporter_id = users.id").
		Where("vulnerabilities.deleted_at IS NULL AND vulnerabilities.submitted_at >= ? AND vulnerabilities.submitted_at < ?",
			currentMonth+"-01", getNextMonthStart(currentMonth)).
		Group("users.id").
		Order("count DESC").
		Limit(10).
		Scan(&secRanking)
	data.SecurityEngineerRanking = secRanking

	// 获取当前用户作为团队Leader管理的成员ID
	teamSvc := &TeamService{}
	memberIDs, _ := teamSvc.GetTeamMemberIDsByLeader(userID)

	// 当前用户相关的最新漏洞
	var latestVulns []VulnListItem
	query := db.Table("vulnerabilities").
		Select("vulnerabilities.id, vulnerabilities.title, vulnerabilities.severity, vulnerabilities.status, vulnerabilities.submitted_at, vulnerabilities.fix_deadline, projects.name as project_name, users.real_name as reporter_name").
		Joins("LEFT JOIN projects ON vulnerabilities.project_id = projects.id").
		Joins("LEFT JOIN users ON vulnerabilities.reporter_id = users.id").
		Where("vulnerabilities.deleted_at IS NULL")

	// 显示用户相关的漏洞：自己提交的 + 作为团队Leader时团队成员被指派的漏洞
	if len(memberIDs) > 0 {
		query = query.Where("vulnerabilities.reporter_id = ? OR vulnerabilities.assignee_id IN (?)", userID, memberIDs)
	} else {
		query = query.Where("vulnerabilities.reporter_id = ?", userID)
	}

	query.Order("vulnerabilities.submitted_at DESC").
		Limit(10).
		Scan(&latestVulns)
	data.LatestVulns = latestVulns

	return data, nil
}

// getDevEngineerDashboard 获取研发工程师仪表板数据
func (s *DashboardService) getDevEngineerDashboard(db *gorm.DB, userID uint) (*DashboardData, error) {
	data := &DashboardData{
		VulnStatusStats: make(map[string]int64),
		SeverityStats:   make(map[string]int64),
		CurrentUserVulns: &UserVulnStats{
			StatusStats: make(map[string]int64),
		},
	}

	// 当前用户名下的漏洞数量
	db.Model(&models.Vulnerability{}).
		Where("deleted_at IS NULL").
		Where("assignee_id = ?", userID).
		Count(&data.CurrentUserVulns.TotalCount)

	// 当前用户漏洞状态统计
	var userStatusStats []struct {
		Status string `json:"status"`
		Count  int64  `json:"count"`
	}
	db.Model(&models.Vulnerability{}).
		Select("status, COUNT(*) as count").
		Where("deleted_at IS NULL").
		Where("assignee_id = ?", userID).
		Group("status").
		Scan(&userStatusStats)

	for _, stat := range userStatusStats {
		data.CurrentUserVulns.StatusStats[stat.Status] = stat.Count
	}

	// 当前用户即将到期漏洞数（今天起7天内）
	now := time.Now()
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)
	sevenDaysLater := startOfToday.AddDate(0, 0, 7)
	db.Model(&models.Vulnerability{}).
		Where("deleted_at IS NULL").
		Where("assignee_id = ? AND fix_deadline IS NOT NULL AND fix_deadline >= ? AND fix_deadline <= ? AND status NOT IN ('fixed', 'completed', 'closed', 'ignored')",
			userID, startOfToday, sevenDaysLater).
		Count(&data.CurrentUserVulns.DueSoonCount)

	// 严重程度统计（当前用户指派漏洞，排除已删除）
	var devSeverityStats []struct {
		Severity string `json:"severity"`
		Count    int64  `json:"count"`
	}
	db.Model(&models.Vulnerability{}).
		Select("severity, COUNT(*) as count").
		Where("deleted_at IS NULL AND assignee_id = ?", userID).
		Group("severity").
		Scan(&devSeverityStats)
	for _, stat := range devSeverityStats {
		data.SeverityStats[stat.Severity] = stat.Count
	}

	// 近7天趋势数据（当前用户指派漏洞，排除已删除）
	devTrendData := make([]TrendDataItem, 7)
	for i := 6; i >= 0; i-- {
		dayStart := time.Date(now.Year(), now.Month(), now.Day()-i, 0, 0, 0, 0, time.Local)
		dayEnd := dayStart.Add(24 * time.Hour)
		var newVulns, fixedVulns, pendingVulns int64
		db.Model(&models.Vulnerability{}).
			Where("deleted_at IS NULL AND assignee_id = ? AND submitted_at >= ? AND submitted_at < ?", userID, dayStart, dayEnd).
			Count(&newVulns)
		db.Model(&models.Vulnerability{}).
			Where("deleted_at IS NULL AND assignee_id = ? AND fixed_at >= ? AND fixed_at < ?", userID, dayStart, dayEnd).
			Count(&fixedVulns)
		db.Model(&models.Vulnerability{}).
			Where("deleted_at IS NULL AND assignee_id = ? AND submitted_at >= ? AND submitted_at < ? AND status NOT IN ('fixed', 'completed', 'closed', 'ignored', 'rejected')", userID, dayStart, dayEnd).
			Count(&pendingVulns)
		devTrendData[6-i] = TrendDataItem{
			Date:         dayStart.Format("01-02"),
			NewVulns:     newVulns,
			FixedVulns:   fixedVulns,
			PendingVulns: pendingVulns,
		}
	}
	data.TrendData = devTrendData

	// 研发工程师排行榜（当月修复完成漏洞数）
	currentMonth := time.Now().Format("2006-01")
	var devRanking []EngineerRankingItem

	// 首先尝试基于 fixed_by 和 fixed_at 的查询（标准流程）
	db.Table("vulnerabilities").
		Select("users.id as user_id, users.username, users.real_name, COUNT(*) as count").
		Joins("JOIN users ON vulnerabilities.fixed_by = users.id").
		Where("vulnerabilities.deleted_at IS NULL AND vulnerabilities.fixed_at >= ? AND vulnerabilities.fixed_at < ? AND vulnerabilities.fixed_by IS NOT NULL",
			currentMonth+"-01", getNextMonthStart(currentMonth)).
		Group("users.id").
		Order("count DESC").
		Limit(10).
		Scan(&devRanking)

	// 如果基于 fixed_by 的查询没有结果，使用 assignee_id 和状态的查询（兼容性查询）
	if len(devRanking) == 0 {
		db.Table("vulnerabilities").
			Select("users.id as user_id, users.username, users.real_name, COUNT(*) as count").
			Joins("JOIN users ON vulnerabilities.assignee_id = users.id").
			Where("vulnerabilities.deleted_at IS NULL AND vulnerabilities.status IN ('fixed', 'closed', 'completed') AND vulnerabilities.updated_at >= ? AND vulnerabilities.updated_at < ? AND vulnerabilities.assignee_id IS NOT NULL",
				currentMonth+"-01", getNextMonthStart(currentMonth)).
			Group("users.id").
			Order("count DESC").
			Limit(10).
			Scan(&devRanking)
	}

	data.DevEngineerRanking = devRanking

	// 研发工程师仅能看到指派给自己的漏洞
	var latestVulns []VulnListItem
	db.Table("vulnerabilities").
		Select("vulnerabilities.id, vulnerabilities.title, vulnerabilities.severity, vulnerabilities.status, vulnerabilities.submitted_at, vulnerabilities.fix_deadline, projects.name as project_name, users.real_name as reporter_name").
		Joins("LEFT JOIN projects ON vulnerabilities.project_id = projects.id").
		Joins("LEFT JOIN users ON vulnerabilities.reporter_id = users.id").
		Where("vulnerabilities.deleted_at IS NULL AND vulnerabilities.assignee_id = ?", userID).
		Order("vulnerabilities.submitted_at DESC").
		Limit(10).
		Scan(&latestVulns)
	data.LatestVulns = latestVulns

	return data, nil
}

// getDefaultDashboard 获取默认仪表板数据（普通用户）
func (s *DashboardService) getDefaultDashboard(db *gorm.DB) (*DashboardData, error) {
	data := &DashboardData{
		VulnStatusStats: make(map[string]int64),
		LatestVulns:     []VulnListItem{},
	}
	return data, nil
}

// getNextMonthStart 获取下个月开始时间
func getNextMonthStart(currentMonth string) string {
	t, _ := time.Parse("2006-01", currentMonth)
	nextMonth := t.AddDate(0, 1, 0)
	return nextMonth.Format("2006-01-02")
}
