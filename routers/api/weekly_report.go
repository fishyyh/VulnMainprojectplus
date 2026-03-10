// 周报API接口包
// 该包提供周报相关的HTTP接口，包括生成、预览、发送等功能
package api

import (
	"net/http"
	"os"
	"strconv"
	"vulnmain/models"
	"vulnmain/services"
	Init "vulnmain/Init"

	"github.com/gin-gonic/gin"
)

// weeklyReportService是周报服务的实例
var weeklyReportService = &services.WeeklyReportService{}

// GetWeeklyReportData 获取周报数据
func GetWeeklyReportData(c *gin.Context) {
	data, err := weeklyReportService.GenerateWeeklyReport()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "生成周报数据失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "获取成功",
		"data": data,
	})
}

// PreviewWeeklyReportPDF 预览周报PDF
func PreviewWeeklyReportPDF(c *gin.Context) {
	// 生成周报数据
	data, err := weeklyReportService.GenerateWeeklyReport()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "生成周报数据失败: " + err.Error(),
		})
		return
	}

	// 生成PDF
	pdfData, err := weeklyReportService.GenerateWeeklyReportPDF(data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "生成PDF失败: " + err.Error(),
		})
		return
	}

	// 设置响应头
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", "inline; filename=weekly_report.pdf")
	c.Header("Content-Length", strconv.Itoa(len(pdfData)))

	// 返回PDF数据
	c.Data(http.StatusOK, "application/pdf", pdfData)
}

// DownloadWeeklyReportPDF 下载周报PDF
func DownloadWeeklyReportPDF(c *gin.Context) {
	// 生成周报数据
	data, err := weeklyReportService.GenerateWeeklyReport()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "生成周报数据失败: " + err.Error(),
		})
		return
	}

	// 生成PDF
	pdfData, err := weeklyReportService.GenerateWeeklyReportPDF(data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "生成PDF失败: " + err.Error(),
		})
		return
	}

	// 设置下载响应头
	filename := "weekly_report_" + data.WeekStart + "_" + data.WeekEnd + ".pdf"
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Header("Content-Length", strconv.Itoa(len(pdfData)))

	// 返回PDF数据
	c.Data(http.StatusOK, "application/pdf", pdfData)
}

// SendWeeklyReport 手动发送周报
func SendWeeklyReport(c *gin.Context) {
	err := weeklyReportService.SendWeeklyReport()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "发送周报失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "周报发送成功",
	})
}

// GetSchedulerStatus 获取定时任务状态
func GetSchedulerStatus(c *gin.Context) {
	scheduler := services.GetGlobalScheduler()
	if scheduler == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "定时任务服务未启动",
		})
		return
	}

	status := scheduler.GetSchedulerStatus()
	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "获取成功",
		"data": status,
	})
}

// ManualSendWeeklyReport 手动触发周报发送（管理员功能）
func ManualSendWeeklyReport(c *gin.Context) {
	scheduler := services.GetGlobalScheduler()
	if scheduler == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "定时任务服务未启动",
		})
		return
	}

	err := scheduler.ManualSendWeeklyReport()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "手动发送周报失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "周报已手动发送成功",
	})
}

// ManualGenerateWeeklyReport 手动生成并发送周报
func ManualGenerateWeeklyReport(c *gin.Context) {
	// 直接调用周报服务生成并发送周报
	weeklyReportService := &services.WeeklyReportService{}

	err := weeklyReportService.SendWeeklyReport()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "生成周报失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "周报生成并发送成功",
	})
}

// GetWeeklyReportHistory 获取周报历史记录
func GetWeeklyReportHistory(c *gin.Context) {
	db := Init.GetDB()

	// 获取分页参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	// 计算偏移量
	offset := (page - 1) * pageSize

	// 查询总数
	var total int64
	db.Model(&models.WeeklyReport{}).Count(&total)

	// 查询数据
	var reports []models.WeeklyReport
	err := db.Order("created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&reports).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "查询周报历史失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "获取成功",
		"data": gin.H{
			"list":     reports,
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
		},
	})
}

// PreviewWeeklyReportFile 预览周报PDF文件
func PreviewWeeklyReportFile(c *gin.Context) {
	reportID := c.Param("id")
	if reportID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "周报ID不能为空",
		})
		return
	}

	db := Init.GetDB()
	var report models.WeeklyReport
	err := db.Where("id = ?", reportID).First(&report).Error
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"code": 404,
			"msg":  "周报记录不存在",
		})
		return
	}

	// 检查文件是否存在
	if _, err := os.Stat(report.FilePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{
			"code": 404,
			"msg":  "PDF文件不存在",
		})
		return
	}

	// 读取文件
	fileData, err := os.ReadFile(report.FilePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "读取PDF文件失败: " + err.Error(),
		})
		return
	}

	// 设置响应头
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", "inline; filename="+report.FileName)
	c.Header("Content-Length", strconv.Itoa(len(fileData)))

	// 返回PDF数据
	c.Data(http.StatusOK, "application/pdf", fileData)
}

// DownloadWeeklyReportFile 下载周报PDF文件
func DownloadWeeklyReportFile(c *gin.Context) {
	reportID := c.Param("id")
	if reportID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "周报ID不能为空",
		})
		return
	}

	db := Init.GetDB()
	var report models.WeeklyReport
	err := db.Where("id = ?", reportID).First(&report).Error
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"code": 404,
			"msg":  "周报记录不存在",
		})
		return
	}

	// 检查文件是否存在
	if _, err := os.Stat(report.FilePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{
			"code": 404,
			"msg":  "PDF文件不存在",
		})
		return
	}

	// 读取文件
	fileData, err := os.ReadFile(report.FilePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "读取PDF文件失败: " + err.Error(),
		})
		return
	}

	// 设置下载响应头
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", "attachment; filename="+report.FileName)
	c.Header("Content-Length", strconv.Itoa(len(fileData)))

	// 返回PDF数据
	c.Data(http.StatusOK, "application/pdf", fileData)
}
