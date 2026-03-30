// 周报服务包
// 该包提供周报生成、数据统计、PDF生成和邮件发送功能
package services

import (
	"archive/zip"
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/xml"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
	Init "vulnmain/Init"
	"vulnmain/models"

	"github.com/signintech/gopdf"
	"github.com/xuri/excelize/v2"
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

// GenerateWeeklyReport 生成周报数据，refDate 为周内任意一天，传零值则使用当前时间
func (s *WeeklyReportService) GenerateWeeklyReport(refDate time.Time) (*WeeklyReportData, error) {
	if refDate.IsZero() {
		refDate = time.Now()
	}
	weekStart := getWeekStart(refDate)
	weekEnd := getWeekEnd(refDate)
	return s.generateReportForRange(weekStart, weekEnd)
}

// GenerateWeeklyReportByRange 生成指定日期范围的周报数据
func (s *WeeklyReportService) GenerateWeeklyReportByRange(startDate, endDate time.Time) (*WeeklyReportData, error) {
	endDate = endDate.Truncate(24 * time.Hour).Add(23*time.Hour + 59*time.Minute + 59*time.Second)
	return s.generateReportForRange(startDate, endDate)
}

// generateReportForRange 按指定时间段生成周报数据（内部方法）
func (s *WeeklyReportService) generateReportForRange(weekStart, weekEnd time.Time) (*WeeklyReportData, error) {
	db := Init.GetDB()

	report := &WeeklyReportData{
		WeekStart:     weekStart.Format("2006-01-02"),
		WeekEnd:       weekEnd.Format("2006-01-02"),
		SeverityStats: make(map[string]int64),
		StatusStats:   make(map[string]int64),
		GeneratedAt:   time.Now(),
	}
	
	// 统计本周提交的漏洞数量
	db.Model(&models.Vulnerability{}).
		Where("deleted_at IS NULL AND submitted_at >= ? AND submitted_at <= ?", weekStart, weekEnd).
		Count(&report.TotalSubmitted)

	// 统计本周修复的漏洞数量
	db.Model(&models.Vulnerability{}).
		Where("deleted_at IS NULL AND fixed_at >= ? AND fixed_at <= ? AND fixed_at IS NOT NULL", weekStart, weekEnd).
		Count(&report.TotalFixed)

	// 统计当前修复中的漏洞数量
	db.Model(&models.Vulnerability{}).
		Where("deleted_at IS NULL AND status = ?", "fixing").
		Count(&report.TotalFixing)

	// 统计当前待复测的漏洞数量
	db.Model(&models.Vulnerability{}).
		Where("deleted_at IS NULL AND status = ?", "retesting").
		Count(&report.TotalRetesting)
	
	// 安全工程师排名（本周提交漏洞数）
	var secRanking []EngineerWeeklyRanking
	db.Table("vulnerabilities").
		Select("users.id as user_id, users.username, users.real_name, users.department, COUNT(*) as count").
		Joins("JOIN users ON vulnerabilities.reporter_id = users.id").
		Where("vulnerabilities.deleted_at IS NULL AND vulnerabilities.submitted_at >= ? AND vulnerabilities.submitted_at <= ?", weekStart, weekEnd).
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
		Where("vulnerabilities.deleted_at IS NULL AND vulnerabilities.fixed_at >= ? AND vulnerabilities.fixed_at <= ? AND vulnerabilities.fixed_by IS NOT NULL", weekStart, weekEnd).
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
		Where("vulnerabilities.deleted_at IS NULL AND vulnerabilities.submitted_at >= ? AND vulnerabilities.submitted_at <= ?", weekStart, weekEnd).
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
		Where("deleted_at IS NULL AND submitted_at >= ? AND submitted_at <= ?", weekStart, weekEnd).
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
		Where("deleted_at IS NULL AND submitted_at >= ? AND submitted_at <= ?", weekStart, weekEnd).
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
	fontErr := pdf.AddTTFFont("chinese", "fonts/SimHei.ttf")
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

// SendWeeklyReport 生成周报并保存，配置了管理员邮箱时自动发送；refDate 为零值时使用当前时间
func (s *WeeklyReportService) SendWeeklyReport(refDate time.Time) error {
	data, err := s.GenerateWeeklyReport(refDate)
	if err != nil {
		return fmt.Errorf("生成周报数据失败: %v", err)
	}
	pdfData, err := s.GenerateWeeklyReportPDF(data)
	if err != nil {
		return fmt.Errorf("生成PDF失败: %v", err)
	}
	return s.saveAndSendReport(data, pdfData)
}

// SendWeeklyReportByRange 生成并发送指定日期范围的周报
func (s *WeeklyReportService) SendWeeklyReportByRange(startDate, endDate time.Time) error {
	data, err := s.GenerateWeeklyReportByRange(startDate, endDate)
	if err != nil {
		return fmt.Errorf("生成周报数据失败: %v", err)
	}
	pdfData, err := s.GenerateWeeklyReportPDF(data)
	if err != nil {
		return fmt.Errorf("生成PDF失败: %v", err)
	}
	return s.saveAndSendReport(data, pdfData)
}

// saveAndSendReport 保存周报记录并发送邮件（内部方法）
func (s *WeeklyReportService) saveAndSendReport(data *WeeklyReportData, pdfData []byte) error {
	db := Init.GetDB()

	weekStartFormatted := data.WeekStart
	weekStartFormatted = weekStartFormatted[:4] + weekStartFormatted[5:7] + weekStartFormatted[8:10]
	fileName := generateFileName(weekStartFormatted)

	filePath, err := s.savePDFFile(pdfData, fileName)
	if err != nil {
		return fmt.Errorf("保存PDF文件失败: %v", err)
	}

	adminEmail, _ := s.getAdminEmail()

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
		GeneratedBy:     1,
		GeneratedByName: "系统自动",
		SentTo:          adminEmail,
		Status:          "generated",
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	if err := db.Create(weeklyReport).Error; err != nil {
		return fmt.Errorf("保存周报记录失败: %v", err)
	}

	if adminEmail == "" {
		return nil
	}

	subject := fmt.Sprintf("周报 - 漏洞管理系统 (%s - %s)", data.WeekStart, data.WeekEnd)
	body := s.generateEmailBody(data)

	err = SendEmailWithAttachment(adminEmail, subject, body, fileName, pdfData)
	if err != nil {
		weeklyReport.Status = "failed"
		db.Save(weeklyReport)
		return fmt.Errorf("周报已生成，但邮件发送失败: %v", err)
	}

	now := time.Now()
	weeklyReport.Status = "sent"
	weeklyReport.SentAt = &now
	weeklyReport.UpdatedAt = now
	db.Save(weeklyReport)

	return nil
}

// getAdminEmail 获取系统管理员邮箱，未配置时返回空字符串
func (s *WeeklyReportService) getAdminEmail() (string, error) {
	db := Init.GetDB()
	var user models.User
	err := db.Where("role_id = ? AND email != ''", 1).First(&user).Error
	if err != nil {
		// 没有配置管理员邮箱，不视为错误
		return "", nil
	}
	return user.Email, nil
}

// GenerateWeeklyReportExcel 生成周报 Excel
func (s *WeeklyReportService) GenerateWeeklyReportExcel(data *WeeklyReportData) ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()

	// ── Sheet1: 概览统计 ──────────────────────────────────────
	const overview = "概览统计"
	f.SetSheetName("Sheet1", overview)

	titleStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 13},
		Alignment: &excelize.Alignment{Horizontal: "center"},
	})
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font:   &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill:   excelize.Fill{Type: "pattern", Color: []string{"#4472C4"}, Pattern: 1},
		Border: []excelize.Border{{Type: "thin", Color: "000000", Style: 1}},
	})
	cellStyle, _ := f.NewStyle(&excelize.Style{
		Border: []excelize.Border{{Type: "thin", Color: "CCCCCC", Style: 1}},
	})

	f.MergeCell(overview, "A1", "B1")
	f.SetCellValue(overview, "A1", fmt.Sprintf("安全漏洞周报  %s ~ %s", data.WeekStart, data.WeekEnd))
	f.SetCellStyle(overview, "A1", "B1", titleStyle)

	overviewHeaders := []string{"指标", "数量"}
	for i, h := range overviewHeaders {
		cell, _ := excelize.CoordinatesToCellName(i+1, 2)
		f.SetCellValue(overview, cell, h)
		f.SetCellStyle(overview, cell, cell, headerStyle)
	}
	overviewRows := [][]interface{}{
		{"本周提交漏洞", data.TotalSubmitted},
		{"本周修复漏洞", data.TotalFixed},
		{"修复中漏洞", data.TotalFixing},
		{"待复测漏洞", data.TotalRetesting},
	}
	for ri, row := range overviewRows {
		for ci, val := range row {
			cell, _ := excelize.CoordinatesToCellName(ci+1, ri+3)
			f.SetCellValue(overview, cell, val)
			f.SetCellStyle(overview, cell, cell, cellStyle)
		}
	}
	f.SetColWidth(overview, "A", "A", 22)
	f.SetColWidth(overview, "B", "B", 14)

	// ── Sheet2: 严重程度统计 ──────────────────────────────────
	const sevSheet = "严重程度统计"
	f.NewSheet(sevSheet)
	sevHeaders := []string{"严重程度", "数量", "占比(%)"}
	for i, h := range sevHeaders {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sevSheet, cell, h)
		f.SetCellStyle(sevSheet, cell, cell, headerStyle)
	}
	var sevTotal int64
	for _, c := range data.SeverityStats {
		sevTotal += c
	}
	sevOrder := []string{"critical", "high", "medium", "low", "info"}
	rowIdx := 2
	for _, sev := range sevOrder {
		if c, ok := data.SeverityStats[sev]; ok {
			pct := float64(0)
			if sevTotal > 0 {
				pct = float64(c) / float64(sevTotal) * 100
			}
			f.SetCellValue(sevSheet, fmt.Sprintf("A%d", rowIdx), sev)
			f.SetCellValue(sevSheet, fmt.Sprintf("B%d", rowIdx), c)
			f.SetCellValue(sevSheet, fmt.Sprintf("C%d", rowIdx), fmt.Sprintf("%.1f", pct))
			for ci := 1; ci <= 3; ci++ {
				cell, _ := excelize.CoordinatesToCellName(ci, rowIdx)
				f.SetCellStyle(sevSheet, cell, cell, cellStyle)
			}
			rowIdx++
		}
	}
	f.SetColWidth(sevSheet, "A", "A", 16)
	f.SetColWidth(sevSheet, "B", "C", 12)

	// ── Sheet3: 安全工程师排名 ───────────────────────────────
	const secSheet = "安全工程师排名"
	f.NewSheet(secSheet)
	secHeaders := []string{"排名", "姓名", "用户名", "本周提交数", "部门"}
	for i, h := range secHeaders {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(secSheet, cell, h)
		f.SetCellStyle(secSheet, cell, cell, headerStyle)
	}
	for i, eng := range data.SecurityEngineerRanking {
		row := i + 2
		f.SetCellValue(secSheet, fmt.Sprintf("A%d", row), i+1)
		f.SetCellValue(secSheet, fmt.Sprintf("B%d", row), eng.RealName)
		f.SetCellValue(secSheet, fmt.Sprintf("C%d", row), eng.Username)
		f.SetCellValue(secSheet, fmt.Sprintf("D%d", row), eng.Count)
		f.SetCellValue(secSheet, fmt.Sprintf("E%d", row), eng.Department)
		for ci := 1; ci <= 5; ci++ {
			cell, _ := excelize.CoordinatesToCellName(ci, row)
			f.SetCellStyle(secSheet, cell, cell, cellStyle)
		}
	}
	f.SetColWidth(secSheet, "A", "A", 8)
	f.SetColWidth(secSheet, "B", "C", 16)
	f.SetColWidth(secSheet, "D", "D", 12)
	f.SetColWidth(secSheet, "E", "E", 20)

	// ── Sheet4: 研发工程师排名 ───────────────────────────────
	const devSheet = "研发工程师排名"
	f.NewSheet(devSheet)
	devHeaders := []string{"排名", "姓名", "用户名", "本周修复数", "部门"}
	for i, h := range devHeaders {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(devSheet, cell, h)
		f.SetCellStyle(devSheet, cell, cell, headerStyle)
	}
	for i, eng := range data.DevEngineerRanking {
		row := i + 2
		f.SetCellValue(devSheet, fmt.Sprintf("A%d", row), i+1)
		f.SetCellValue(devSheet, fmt.Sprintf("B%d", row), eng.RealName)
		f.SetCellValue(devSheet, fmt.Sprintf("C%d", row), eng.Username)
		f.SetCellValue(devSheet, fmt.Sprintf("D%d", row), eng.Count)
		f.SetCellValue(devSheet, fmt.Sprintf("E%d", row), eng.Department)
		for ci := 1; ci <= 5; ci++ {
			cell, _ := excelize.CoordinatesToCellName(ci, row)
			f.SetCellStyle(devSheet, cell, cell, cellStyle)
		}
	}
	f.SetColWidth(devSheet, "A", "A", 8)
	f.SetColWidth(devSheet, "B", "C", 16)
	f.SetColWidth(devSheet, "D", "D", 12)
	f.SetColWidth(devSheet, "E", "E", 20)

	// ── Sheet5: 项目漏洞排名 ─────────────────────────────────
	const projSheet = "项目漏洞排名"
	f.NewSheet(projSheet)
	projHeaders := []string{"排名", "项目名称", "负责人", "本周新增漏洞数"}
	for i, h := range projHeaders {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(projSheet, cell, h)
		f.SetCellStyle(projSheet, cell, cell, headerStyle)
	}
	for i, proj := range data.ProjectVulnRanking {
		row := i + 2
		f.SetCellValue(projSheet, fmt.Sprintf("A%d", row), i+1)
		f.SetCellValue(projSheet, fmt.Sprintf("B%d", row), proj.ProjectName)
		f.SetCellValue(projSheet, fmt.Sprintf("C%d", row), proj.OwnerName)
		f.SetCellValue(projSheet, fmt.Sprintf("D%d", row), proj.VulnCount)
		for ci := 1; ci <= 4; ci++ {
			cell, _ := excelize.CoordinatesToCellName(ci, row)
			f.SetCellStyle(projSheet, cell, cell, cellStyle)
		}
	}
	f.SetColWidth(projSheet, "A", "A", 8)
	f.SetColWidth(projSheet, "B", "B", 30)
	f.SetColWidth(projSheet, "C", "C", 16)
	f.SetColWidth(projSheet, "D", "D", 16)

	// 设置活动 Sheet
	f.SetActiveSheet(0)

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, fmt.Errorf("生成Excel失败: %v", err)
	}
	return buf.Bytes(), nil
}

// xmlEscape 转义 XML 特殊字符
func xmlEscape(s string) string {
	var buf bytes.Buffer
	xml.EscapeText(&buf, []byte(s))
	return buf.String()
}

// GenerateWeeklyReportWord 生成周报 Word（docx）
func (s *WeeklyReportService) GenerateWeeklyReportWord(data *WeeklyReportData) ([]byte, error) {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	// 写入 ZIP 条目的辅助函数
	writeEntry := func(name, content string) error {
		w, err := zw.Create(name)
		if err != nil {
			return err
		}
		_, err = w.Write([]byte(content))
		return err
	}

	// [Content_Types].xml
	if err := writeEntry("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`); err != nil {
		return nil, err
	}

	// _rels/.rels
	if err := writeEntry("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`); err != nil {
		return nil, err
	}

	// word/_rels/document.xml.rels
	if err := writeEntry("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`); err != nil {
		return nil, err
	}

	// word/document.xml
	doc := buildWordDocument(data)
	if err := writeEntry("word/document.xml", doc); err != nil {
		return nil, err
	}

	if err := zw.Close(); err != nil {
		return nil, fmt.Errorf("生成Word失败: %v", err)
	}
	return buf.Bytes(), nil
}

// buildWordDocument 构建 word/document.xml 内容
func buildWordDocument(data *WeeklyReportData) string {
	var sb strings.Builder

	wPara := func(text, size, bold string) string {
		b := ""
		if bold == "1" {
			b = "<w:b/>"
		}
		return fmt.Sprintf(`<w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:rPr>%s<w:sz w:val="%s"/><w:szCs w:val="%s"/></w:rPr><w:t xml:space="preserve">%s</w:t></w:r></w:p>`, b, size, size, xmlEscape(text))
	}

	wTitle := func(text string) string {
		return fmt.Sprintf(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr><w:t>%s</w:t></w:r></w:p>`, xmlEscape(text))
	}

	wHeading := func(text string) string {
		return fmt.Sprintf(`<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t>%s</w:t></w:r></w:p>`, xmlEscape(text))
	}

	// 表格行辅助
	wTableRow := func(cells []string, isHeader bool) string {
		var row strings.Builder
		row.WriteString("<w:tr>")
		for _, cell := range cells {
			shading := ""
			boldTag := ""
			if isHeader {
				shading = `<w:shd w:val="clear" w:color="auto" w:fill="4472C4"/>`
				boldTag = "<w:b/><w:color w:val=\"FFFFFF\"/>"
			}
			row.WriteString(fmt.Sprintf(`<w:tc><w:tcPr>%s<w:tcW w:w="0" w:type="auto"/></w:tcPr><w:p><w:r><w:rPr>%s<w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t xml:space="preserve">%s</w:t></w:r></w:p></w:tc>`, shading, boldTag, xmlEscape(cell)))
		}
		row.WriteString("</w:tr>")
		return row.String()
	}

	wTable := func(headers []string, rows [][]string) string {
		var tbl strings.Builder
		tbl.WriteString(`<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/><w:left w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/><w:right w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/></w:tblBorders></w:tblPr>`)
		tbl.WriteString(wTableRow(headers, true))
		for _, row := range rows {
			tbl.WriteString(wTableRow(row, false))
		}
		tbl.WriteString("</w:tbl>")
		return tbl.String()
	}

	wEmpty := `<w:p/>`

	sb.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`)
	sb.WriteString(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">`)
	sb.WriteString(`<w:body>`)

	// 标题
	sb.WriteString(wTitle(fmt.Sprintf("安全漏洞周报 (%s ~ %s)", data.WeekStart, data.WeekEnd)))
	sb.WriteString(wPara(fmt.Sprintf("生成时间：%s", data.GeneratedAt.Format("2006-01-02 15:04:05")), "20", "0"))
	sb.WriteString(wEmpty)

	// 概览统计
	sb.WriteString(wHeading("概览统计"))
	overviewRows := [][]string{
		{"本周提交漏洞", fmt.Sprintf("%d", data.TotalSubmitted)},
		{"本周修复漏洞", fmt.Sprintf("%d", data.TotalFixed)},
		{"修复中漏洞", fmt.Sprintf("%d", data.TotalFixing)},
		{"待复测漏洞", fmt.Sprintf("%d", data.TotalRetesting)},
	}
	sb.WriteString(wTable([]string{"指标", "数量"}, overviewRows))
	sb.WriteString(wEmpty)

	// 严重程度统计
	if len(data.SeverityStats) > 0 {
		sb.WriteString(wHeading("漏洞严重程度分布"))
		var sevTotal int64
		for _, c := range data.SeverityStats {
			sevTotal += c
		}
		sevOrder := []string{"critical", "high", "medium", "low", "info"}
		var sevRows [][]string
		for _, sev := range sevOrder {
			if c, ok := data.SeverityStats[sev]; ok {
				pct := float64(0)
				if sevTotal > 0 {
					pct = float64(c) / float64(sevTotal) * 100
				}
				sevRows = append(sevRows, []string{sev, fmt.Sprintf("%d", c), fmt.Sprintf("%.1f%%", pct)})
			}
		}
		sb.WriteString(wTable([]string{"严重程度", "数量", "占比"}, sevRows))
		sb.WriteString(wEmpty)
	}

	// 安全工程师排名
	sb.WriteString(wHeading("安全工程师排名（本周提交）"))
	if len(data.SecurityEngineerRanking) > 0 {
		var secRows [][]string
		for i, eng := range data.SecurityEngineerRanking {
			secRows = append(secRows, []string{fmt.Sprintf("#%d", i+1), eng.RealName, eng.Username, fmt.Sprintf("%d", eng.Count), eng.Department})
		}
		sb.WriteString(wTable([]string{"排名", "姓名", "用户名", "提交数", "部门"}, secRows))
	} else {
		sb.WriteString(wPara("暂无数据", "20", "0"))
	}
	sb.WriteString(wEmpty)

	// 研发工程师排名
	sb.WriteString(wHeading("研发工程师排名（本周修复）"))
	if len(data.DevEngineerRanking) > 0 {
		var devRows [][]string
		for i, eng := range data.DevEngineerRanking {
			devRows = append(devRows, []string{fmt.Sprintf("#%d", i+1), eng.RealName, eng.Username, fmt.Sprintf("%d", eng.Count), eng.Department})
		}
		sb.WriteString(wTable([]string{"排名", "姓名", "用户名", "修复数", "部门"}, devRows))
	} else {
		sb.WriteString(wPara("暂无数据", "20", "0"))
	}
	sb.WriteString(wEmpty)

	// 项目漏洞排名
	sb.WriteString(wHeading("项目漏洞排名（本周新增）"))
	if len(data.ProjectVulnRanking) > 0 {
		var projRows [][]string
		for i, proj := range data.ProjectVulnRanking {
			projRows = append(projRows, []string{fmt.Sprintf("#%d", i+1), proj.ProjectName, proj.OwnerName, fmt.Sprintf("%d", proj.VulnCount)})
		}
		sb.WriteString(wTable([]string{"排名", "项目名称", "负责人", "新增漏洞数"}, projRows))
	} else {
		sb.WriteString(wPara("暂无数据", "20", "0"))
	}

	sb.WriteString(`<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`)
	sb.WriteString(`</w:body></w:document>`)

	return sb.String()
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
