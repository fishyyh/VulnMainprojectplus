// 周报服务包
// 该包提供周报生成、数据统计、PDF生成和邮件发送功能
package services

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"time"
	Init "vulnmain/Init"
	"vulnmain/models"

	"github.com/signintech/gopdf"
)

// WeeklyReportService 周报服务
type WeeklyReportService struct{}

// WeeklyReportData 周报数据结构
type WeeklyReportData struct {
	WeekStart                string                    `json:"week_start"`                 // 周开始日期
	WeekEnd                  string                    `json:"week_end"`                   // 周结束日期
	TotalSubmitted           int64                     `json:"total_submitted"`            // 本周提交漏洞总数
	TotalFixed               int64                     `json:"total_fixed"`                // 本周修复漏洞总数
	TotalFixing              int64                     `json:"total_fixing"`               // 修复中漏洞数
	TotalRetesting           int64                     `json:"total_retesting"`            // 待复测漏洞数
	SecurityEngineerRanking  []EngineerWeeklyRanking   `json:"security_engineer_ranking"`  // 安全工程师排名
	DevEngineerRanking       []EngineerWeeklyRanking   `json:"dev_engineer_ranking"`       // 研发工程师排名
	ProjectVulnRanking       []ProjectWeeklyRanking    `json:"project_vuln_ranking"`       // 项目漏洞排名
	SeverityStats            map[string]int64          `json:"severity_stats"`             // 严重程度统计
	StatusStats              map[string]int64          `json:"status_stats"`               // 状态统计
	GeneratedAt              time.Time                 `json:"generated_at"`               // 生成时间
}

// EngineerWeeklyRanking 工程师周报排名
type EngineerWeeklyRanking struct {
	UserID       uint   `json:"user_id"`
	Username     string `json:"username"`
	RealName     string `json:"real_name"`
	Count        int64  `json:"count"`
	Department   string `json:"department"`
}

// ProjectWeeklyRanking 项目周报排名
type ProjectWeeklyRanking struct {
	ProjectID   uint   `json:"project_id"`
	ProjectName string `json:"project_name"`
	VulnCount   int64  `json:"vuln_count"`
	OwnerName   string `json:"owner_name"`
}

// GenerateWeeklyReport 生成周报数据
func (s *WeeklyReportService) GenerateWeeklyReport() (*WeeklyReportData, error) {
	db := Init.GetDB()
	
	// 计算本周的开始和结束时间
	now := time.Now()
	weekStart := getWeekStart(now)
	weekEnd := getWeekEnd(now)
	
	report := &WeeklyReportData{
		WeekStart:     weekStart.Format("2006-01-02"),
		WeekEnd:       weekEnd.Format("2006-01-02"),
		SeverityStats: make(map[string]int64),
		StatusStats:   make(map[string]int64),
		GeneratedAt:   now,
	}
	
	// 统计本周提交的漏洞数量
	db.Model(&models.Vulnerability{}).
		Where("submitted_at >= ? AND submitted_at <= ?", weekStart, weekEnd).
		Count(&report.TotalSubmitted)
	
	// 统计本周修复的漏洞数量
	db.Model(&models.Vulnerability{}).
		Where("fixed_at >= ? AND fixed_at <= ? AND fixed_at IS NOT NULL", weekStart, weekEnd).
		Count(&report.TotalFixed)
	
	// 统计当前修复中的漏洞数量
	db.Model(&models.Vulnerability{}).
		Where("status = ?", "fixing").
		Count(&report.TotalFixing)
	
	// 统计当前待复测的漏洞数量
	db.Model(&models.Vulnerability{}).
		Where("status = ?", "retesting").
		Count(&report.TotalRetesting)
	
	// 安全工程师排名（本周提交漏洞数）
	var secRanking []EngineerWeeklyRanking
	db.Table("vulnerabilities").
		Select("users.id as user_id, users.username, users.real_name, users.department, COUNT(*) as count").
		Joins("JOIN users ON vulnerabilities.reporter_id = users.id").
		Where("vulnerabilities.submitted_at >= ? AND vulnerabilities.submitted_at <= ?", weekStart, weekEnd).
		Group("users.id").
		Order("count DESC").
		Limit(10).
		Scan(&secRanking)
	report.SecurityEngineerRanking = secRanking
	
	// 研发工程师排名（本周修复漏洞数）
	var devRanking []EngineerWeeklyRanking
	db.Table("vulnerabilities").
		Select("users.id as user_id, users.username, users.real_name, users.department, COUNT(*) as count").
		Joins("JOIN users ON vulnerabilities.fixed_by = users.id").
		Where("vulnerabilities.fixed_at >= ? AND vulnerabilities.fixed_at <= ? AND vulnerabilities.fixed_by IS NOT NULL", weekStart, weekEnd).
		Group("users.id").
		Order("count DESC").
		Limit(10).
		Scan(&devRanking)
	report.DevEngineerRanking = devRanking
	
	// 项目漏洞排名（本周新增漏洞数）
	var projectRanking []ProjectWeeklyRanking
	db.Table("vulnerabilities").
		Select("projects.id as project_id, projects.name as project_name, users.real_name as owner_name, COUNT(*) as vuln_count").
		Joins("JOIN projects ON vulnerabilities.project_id = projects.id").
		Joins("JOIN users ON projects.owner_id = users.id").
		Where("vulnerabilities.submitted_at >= ? AND vulnerabilities.submitted_at <= ?", weekStart, weekEnd).
		Group("projects.id").
		Order("vuln_count DESC").
		Limit(10).
		Scan(&projectRanking)
	report.ProjectVulnRanking = projectRanking
	
	// 严重程度统计
	var severityStats []struct {
		Severity string `json:"severity"`
		Count    int64  `json:"count"`
	}
	db.Model(&models.Vulnerability{}).
		Select("severity, COUNT(*) as count").
		Where("submitted_at >= ? AND submitted_at <= ?", weekStart, weekEnd).
		Group("severity").
		Scan(&severityStats)
	
	for _, stat := range severityStats {
		report.SeverityStats[stat.Severity] = stat.Count
	}
	
	// 状态统计
	var statusStats []struct {
		Status string `json:"status"`
		Count  int64  `json:"count"`
	}
	db.Model(&models.Vulnerability{}).
		Select("status, COUNT(*) as count").
		Where("submitted_at >= ? AND submitted_at <= ?", weekStart, weekEnd).
		Group("status").
		Scan(&statusStats)
	
	for _, stat := range statusStats {
		report.StatusStats[stat.Status] = stat.Count
	}
	
	return report, nil
}

// GenerateWeeklyReportPDF 生成周报PDF
func (s *WeeklyReportService) GenerateWeeklyReportPDF(data *WeeklyReportData) ([]byte, error) {
	pdf := &gopdf.GoPdf{}
	pdf.Start(gopdf.Config{PageSize: *gopdf.PageSizeA4})
	pdf.AddPage()

	// 尝试添加中文字体支持
	var useChineseFont bool
	fontErr := pdf.AddTTFFont("chinese", "fonts/simhei.ttf")
	if fontErr != nil {
		// 尝试其他常见的中文字体路径
		fontErr = pdf.AddTTFFont("chinese", "/System/Library/Fonts/PingFang.ttc")
		if fontErr != nil {
			// 如果都没有，使用内置字体但支持UTF-8
			fontErr = pdf.AddTTFFont("default", "")
			if fontErr != nil {
				return nil, fmt.Errorf("添加字体失败: %v", fontErr)
			}
			pdf.SetFont("default", "", 14)
			useChineseFont = false
		} else {
			pdf.SetFont("chinese", "", 14)
			useChineseFont = true
		}
	} else {
		pdf.SetFont("chinese", "", 14)
		useChineseFont = true
	}

	currentY := 40.0

	// 标题
	title := fmt.Sprintf("安全漏洞周报 (%s - %s)", data.WeekStart, data.WeekEnd)
	fontName := "chinese"
	if !useChineseFont {
		fontName = "default"
	}
	pdf.SetFont(fontName, "", 18)
	pdf.SetX(150)
	pdf.SetY(currentY)
	pdf.Cell(nil, title)
	currentY += 40

	// 概览统计
	pdf.SetFont(fontName, "", 14)
	pdf.SetX(50)
	pdf.SetY(currentY)
	pdf.Cell(nil, "概览统计")
	currentY += 25

	// 统计数据
	pdf.SetFont(fontName, "", 12)
	metrics := []struct {
		name  string
		count int64
		desc  string
	}{
		{"本周提交", data.TotalSubmitted, "本周新发现的漏洞数量"},
		{"本周修复", data.TotalFixed, "本周已修复的漏洞数量"},
		{"修复中", data.TotalFixing, "正在修复中的漏洞数量"},
		{"待复测", data.TotalRetesting, "等待复测验证的漏洞数量"},
	}

	for _, metric := range metrics {
		pdf.SetX(60)
		pdf.SetY(currentY)
		text := fmt.Sprintf("%s: %d (%s)", metric.name, metric.count, metric.desc)
		pdf.Cell(nil, text)
		currentY += 20
	}
	currentY += 20

	// 安全工程师排名
	pdf.SetFont(fontName, "", 14)
	pdf.SetX(50)
	pdf.SetY(currentY)
	pdf.Cell(nil, "安全工程师排名（本周提交）")
	currentY += 25

	if len(data.SecurityEngineerRanking) > 0 {
		pdf.SetFont(fontName, "", 10)
		// 表头
		pdf.SetX(60)
		pdf.SetY(currentY)
		pdf.Cell(nil, "排名    姓名              用户名            数量    部门")
		currentY += 15

		// 数据行
		for i, engineer := range data.SecurityEngineerRanking {
			if i >= 10 { // 只显示前10名
				break
			}
			pdf.SetX(60)
			pdf.SetY(currentY)
			text := fmt.Sprintf("#%-3d  %-12s  %-12s  %-6d  %s",
				i+1, engineer.RealName, engineer.Username, engineer.Count, engineer.Department)
			pdf.Cell(nil, text)
			currentY += 12
		}
	} else {
		pdf.SetFont(fontName, "", 10)
		pdf.SetX(60)
		pdf.SetY(currentY)
		pdf.Cell(nil, "暂无数据")
		currentY += 15
	}
	currentY += 20

	// 检查是否需要新页面
	if currentY > 700 {
		pdf.AddPage()
		currentY = 40
	}

	// 研发工程师排名
	pdf.SetFont(fontName, "", 14)
	pdf.SetX(50)
	pdf.SetY(currentY)
	pdf.Cell(nil, "研发工程师排名（本周修复）")
	currentY += 25

	if len(data.DevEngineerRanking) > 0 {
		pdf.SetFont(fontName, "", 10)
		// 表头
		pdf.SetX(60)
		pdf.SetY(currentY)
		pdf.Cell(nil, "排名    姓名              用户名            数量    部门")
		currentY += 15

		// 数据行
		for i, engineer := range data.DevEngineerRanking {
			if i >= 10 { // 只显示前10名
				break
			}
			pdf.SetX(60)
			pdf.SetY(currentY)
			text := fmt.Sprintf("#%-3d  %-12s  %-12s  %-6d  %s",
				i+1, engineer.RealName, engineer.Username, engineer.Count, engineer.Department)
			pdf.Cell(nil, text)
			currentY += 12
		}
	} else {
		pdf.SetFont(fontName, "", 10)
		pdf.SetX(60)
		pdf.SetY(currentY)
		pdf.Cell(nil, "暂无数据")
		currentY += 15
	}
	currentY += 20

	// 项目漏洞排名
	pdf.SetFont(fontName, "", 14)
	pdf.SetX(50)
	pdf.SetY(currentY)
	pdf.Cell(nil, "项目漏洞排名（本周新增）")
	currentY += 25

	if len(data.ProjectVulnRanking) > 0 {
		pdf.SetFont(fontName, "", 10)
		// 表头
		pdf.SetX(60)
		pdf.SetY(currentY)
		pdf.Cell(nil, "排名    项目名称                    负责人            数量")
		currentY += 15

		// 数据行
		for i, project := range data.ProjectVulnRanking {
			if i >= 10 { // 只显示前10名
				break
			}
			pdf.SetX(60)
			pdf.SetY(currentY)
			text := fmt.Sprintf("#%-3d  %-20s  %-12s  %d",
				i+1, project.ProjectName, project.OwnerName, project.VulnCount)
			pdf.Cell(nil, text)
			currentY += 12
		}
	} else {
		pdf.SetFont(fontName, "", 10)
		pdf.SetX(60)
		pdf.SetY(currentY)
		pdf.Cell(nil, "暂无数据")
		currentY += 15
	}
	currentY += 20

	// 严重程度统计
	if len(data.SeverityStats) > 0 {
		pdf.SetFont(fontName, "", 14)
		pdf.SetX(50)
		pdf.SetY(currentY)
		pdf.Cell(nil, "漏洞严重程度分布")
		currentY += 25

		pdf.SetFont(fontName, "", 10)
		// 表头
		pdf.SetX(60)
		pdf.SetY(currentY)
		pdf.Cell(nil, "严重程度        数量      占比")
		currentY += 15

		total := int64(0)
		for _, count := range data.SeverityStats {
			total += count
		}

		// 数据行
		for severity, count := range data.SeverityStats {
			percentage := float64(0)
			if total > 0 {
				percentage = float64(count) / float64(total) * 100
			}
			pdf.SetX(60)
			pdf.SetY(currentY)
			text := fmt.Sprintf("%-12s  %-8d  %.1f%%", severity, count, percentage)
			pdf.Cell(nil, text)
			currentY += 12
		}
		currentY += 20
	}

	// 页脚
	pdf.SetFont(fontName, "", 8)
	pdf.SetX(50)
	pdf.SetY(750)
	footerText := fmt.Sprintf("生成时间: %s | 漏洞管理系统",
		data.GeneratedAt.Format("2006-01-02 15:04:05"))
	pdf.Cell(nil, footerText)

	// 生成PDF字节数组
	var buf bytes.Buffer
	_, err := pdf.WriteTo(&buf)
	if err != nil {
		return nil, fmt.Errorf("生成PDF失败: %v", err)
	}

	return buf.Bytes(), nil
}

// SendWeeklyReport 发送周报邮件
func (s *WeeklyReportService) SendWeeklyReport() error {
	db := Init.GetDB()

	// 生成周报数据
	data, err := s.GenerateWeeklyReport()
	if err != nil {
		return fmt.Errorf("生成周报数据失败: %v", err)
	}

	// 生成PDF
	pdfData, err := s.GenerateWeeklyReportPDF(data)
	if err != nil {
		return fmt.Errorf("生成PDF失败: %v", err)
	}

	// 生成文件名
	weekStartFormatted := data.WeekStart // 格式：2006-01-02
	weekStartFormatted = weekStartFormatted[:4] + weekStartFormatted[5:7] + weekStartFormatted[8:10] // 转换为：20060102
	fileName := generateFileName(weekStartFormatted)

	// 保存PDF文件
	filePath, err := s.savePDFFile(pdfData, fileName)
	if err != nil {
		return fmt.Errorf("保存PDF文件失败: %v", err)
	}

	// 获取系统管理员邮箱
	adminEmail, err := s.getAdminEmail()
	if err != nil {
		return fmt.Errorf("获取管理员邮箱失败: %v", err)
	}

	// 创建周报记录
	weeklyReport := &models.WeeklyReport{
		WeekStart:       data.WeekStart,
		WeekEnd:         data.WeekEnd,
		FileName:        fileName,
		FilePath:        filePath,
		FileSize:        int64(len(pdfData)),
		TotalSubmitted:  data.TotalSubmitted,
		TotalFixed:      data.TotalFixed,
		TotalFixing:     data.TotalFixing,
		TotalRetesting:  data.TotalRetesting,
		GeneratedBy:     1, // 系统自动生成
		GeneratedByName: "系统自动",
		SentTo:          adminEmail,
		Status:          "generated",
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	// 保存到数据库
	if err := db.Create(weeklyReport).Error; err != nil {
		return fmt.Errorf("保存周报记录失败: %v", err)
	}

	// 发送邮件
	subject := fmt.Sprintf("周报 - 漏洞管理系统 (%s - %s)", data.WeekStart, data.WeekEnd)
	body := s.generateEmailBody(data)

	err = SendEmailWithAttachment(adminEmail, subject, body, fileName, pdfData)
	if err != nil {
		// 更新状态为发送失败
		weeklyReport.Status = "failed"
		db.Save(weeklyReport)
		return fmt.Errorf("发送邮件失败: %v", err)
	}

	// 更新状态为已发送
	now := time.Now()
	weeklyReport.Status = "sent"
	weeklyReport.SentAt = &now
	weeklyReport.UpdatedAt = now
	db.Save(weeklyReport)

	return nil
}

// getAdminEmail 获取系统管理员邮箱
func (s *WeeklyReportService) getAdminEmail() (string, error) {
	db := Init.GetDB()
	var user models.User
	err := db.Where("role_id = ?", 1).First(&user).Error
	if err != nil {
		return "", err
	}
	return user.Email, nil
}

// generateEmailBody 生成邮件正文
func (s *WeeklyReportService) generateEmailBody(data *WeeklyReportData) string {
	return fmt.Sprintf(`
亲爱的管理员，

本周（%s - %s）漏洞管理系统周报已生成，详细信息请查看附件PDF。

本周概览：
- 新提交漏洞：%d 个
- 已修复漏洞：%d 个
- 修复中漏洞：%d 个
- 待复测漏洞：%d 个

此邮件由系统自动发送，请勿回复。

漏洞管理系统
%s
`, data.WeekStart, data.WeekEnd, data.TotalSubmitted, data.TotalFixed, 
   data.TotalFixing, data.TotalRetesting, data.GeneratedAt.Format("2006-01-02 15:04:05"))
}

// 辅助函数
func getWeekStart(t time.Time) time.Time {
	weekday := int(t.Weekday())
	if weekday == 0 {
		weekday = 7 // 将周日设为7
	}
	return t.AddDate(0, 0, -(weekday-1)).Truncate(24 * time.Hour)
}

func getWeekEnd(t time.Time) time.Time {
	return getWeekStart(t).AddDate(0, 0, 6).Add(23*time.Hour + 59*time.Minute + 59*time.Second)
}

// generateRandomString 生成指定长度的随机字符串
func generateRandomString(length int) string {
	bytes := make([]byte, length/2)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// ensureWeeklyDir 确保weekly目录存在
func ensureWeeklyDir() error {
	weeklyDir := filepath.Join("uploads", "weekly")
	return os.MkdirAll(weeklyDir, 0755)
}

// generateFileName 生成周报文件名
func generateFileName(weekStart string) string {
	// 格式：YYYYMMDD_weekly_随机字符串18位.pdf
	randomStr := generateRandomString(18)
	return fmt.Sprintf("%s_weekly_%s.pdf", weekStart, randomStr)
}

// savePDFFile 保存PDF文件到uploads/weekly目录
func (s *WeeklyReportService) savePDFFile(pdfData []byte, fileName string) (string, error) {
	// 确保目录存在
	if err := ensureWeeklyDir(); err != nil {
		return "", fmt.Errorf("创建weekly目录失败: %v", err)
	}

	// 构建完整文件路径
	filePath := filepath.Join("uploads", "weekly", fileName)

	// 写入文件
	if err := os.WriteFile(filePath, pdfData, 0644); err != nil {
		return "", fmt.Errorf("保存PDF文件失败: %v", err)
	}

	return filePath, nil
}
