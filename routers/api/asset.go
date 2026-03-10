package api

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"vulnmain/services"

	"github.com/gin-gonic/gin"
)

var assetService = &services.AssetService{}

// CreateAsset 创建资产
func CreateAsset(c *gin.Context) {
	var req services.AssetCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "参数错误: " + err.Error(),
		})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"code": 401,
			"msg":  "用户未认证",
		})
		return
	}

	asset, err := assetService.CreateAsset(&req, userID.(uint))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "创建成功",
		"data": asset,
	})
}

// GetAsset 获取资产详情
func GetAsset(c *gin.Context) {
	assetIDStr := c.Param("id")
	assetID, err := strconv.ParseUint(assetIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "资产ID格式错误",
		})
		return
	}

	asset, err := assetService.GetAssetByID(uint(assetID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"code": 404,
			"msg":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "获取成功",
		"data": asset,
	})
}

// UpdateAsset 更新资产
func UpdateAsset(c *gin.Context) {
	assetIDStr := c.Param("id")
	assetID, err := strconv.ParseUint(assetIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "资产ID格式错误",
		})
		return
	}

	var req services.AssetUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "参数错误: " + err.Error(),
		})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"code": 401,
			"msg":  "用户未认证",
		})
		return
	}

	asset, err := assetService.UpdateAsset(uint(assetID), &req, userID.(uint))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "更新成功",
		"data": asset,
	})
}

// DeleteAsset 删除资产
func DeleteAsset(c *gin.Context) {
	assetIDStr := c.Param("id")
	assetID, err := strconv.ParseUint(assetIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "资产ID格式错误",
		})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"code": 401,
			"msg":  "用户未认证",
		})
		return
	}

	roleCode, exists := c.Get("role_code")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"code": 401,
			"msg":  "用户角色信息缺失",
		})
		return
	}

	err = assetService.DeleteAsset(uint(assetID), userID.(uint), roleCode.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "删除成功",
	})
}

// GetAssetList 获取资产列表
func GetAssetList(c *gin.Context) {
	var req services.AssetListRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "参数错误: " + err.Error(),
		})
		return
	}

	// 从上下文获取用户信息，用于权限控制
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"code": 401,
			"msg":  "用户未认证",
		})
		return
	}

	roleCode, exists := c.Get("role_code")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"code": 401,
			"msg":  "用户角色信息缺失",
		})
		return
	}

	// 设置权限控制字段
	req.CurrentUserID = userID.(uint)
	req.CurrentUserRole = roleCode.(string)

	response, err := assetService.GetAssetList(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "获取成功",
		"data": response,
	})
}

// GetAssetStats 获取资产统计
func GetAssetStats(c *gin.Context) {
	stats, err := assetService.GetAssetStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "获取成功",
		"data": stats,
	})
}

// CreateAssetGroup 创建资产组
func CreateAssetGroup(c *gin.Context) {
	type CreateGroupRequest struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
		ParentID    *uint  `json:"parent_id"`
	}

	var req CreateGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "参数错误: " + err.Error(),
		})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"code": 401,
			"msg":  "用户未认证",
		})
		return
	}

	group, err := assetService.CreateAssetGroup(req.Name, req.Description, req.ParentID, userID.(uint))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "创建成功",
		"data": group,
	})
}

// GetAssetGroups 获取资产组列表
func GetAssetGroups(c *gin.Context) {
	groups, err := assetService.GetAssetGroups()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "获取成功",
		"data": groups,
	})
}



// ExportAssets 批量导出资产
func ExportAssets(c *gin.Context) {
	var req struct {
		AssetIDs  []uint `json:"asset_ids"`
		ProjectID uint   `json:"project_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "参数错误: " + err.Error(),
		})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"code": 401,
			"msg":  "用户未认证",
		})
		return
	}

	roleCode, exists := c.Get("role_code")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"code": 401,
			"msg":  "用户角色信息缺失",
		})
		return
	}

	// 调用服务层进行导出
	excelData, err := assetService.ExportAssetsToExcel(req.AssetIDs, req.ProjectID, userID.(uint), roleCode.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  err.Error(),
		})
		return
	}

	// 设置响应头
	filename := fmt.Sprintf("assets_%d.xlsx", req.ProjectID)
	if req.ProjectID == 0 {
		filename = "assets_export.xlsx"
	}

	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Header("Content-Length", fmt.Sprintf("%d", len(excelData)))

	c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", excelData)
}

// ImportAssets 批量导入资产
func ImportAssets(c *gin.Context) {
	// 调试日志
	fmt.Printf("ImportAssets: 接收到导入请求\n")
	fmt.Printf("Content-Type: %s\n", c.GetHeader("Content-Type"))
	fmt.Printf("Content-Length: %s\n", c.GetHeader("Content-Length"))

	// 打印所有表单字段
	if err := c.Request.ParseMultipartForm(32 << 20); err != nil {
		fmt.Printf("解析multipart表单失败: %v\n", err)
	} else {
		fmt.Printf("表单字段:\n")
		for key, values := range c.Request.MultipartForm.Value {
			fmt.Printf("  %s: %v\n", key, values)
		}
		fmt.Printf("文件字段:\n")
		for key, files := range c.Request.MultipartForm.File {
			fmt.Printf("  %s: %d个文件\n", key, len(files))
			for i, file := range files {
				fmt.Printf("    文件%d: %s (大小: %d)\n", i, file.Filename, file.Size)
			}
		}
	}

	// 获取项目ID
	projectIDStr := c.PostForm("project_id")
	fmt.Printf("项目ID字符串: '%s'\n", projectIDStr)
	if projectIDStr == "" {
		fmt.Printf("错误: 项目ID为空\n")
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "项目ID不能为空",
		})
		return
	}

	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "项目ID格式错误",
		})
		return
	}

	// 获取上传的文件
	file, err := c.FormFile("file")
	fmt.Printf("获取文件结果: err=%v\n", err)
	if err != nil {
		fmt.Printf("错误: 无法获取上传文件: %v\n", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "请选择要上传的Excel文件: " + err.Error(),
		})
		return
	}
	fmt.Printf("文件信息: 名称=%s, 大小=%d\n", file.Filename, file.Size)

	// 验证文件类型
	if file.Header.Get("Content-Type") != "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" &&
		file.Header.Get("Content-Type") != "application/vnd.ms-excel" {
		// 也检查文件扩展名
		filename := file.Filename
		if !strings.HasSuffix(strings.ToLower(filename), ".xlsx") && !strings.HasSuffix(strings.ToLower(filename), ".xls") {
			c.JSON(http.StatusBadRequest, gin.H{
				"code": 400,
				"msg":  "请上传Excel文件（.xlsx或.xls格式）",
			})
			return
		}
	}

	// 检查文件大小（限制为10MB）
	if file.Size > 10*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "文件大小不能超过10MB",
		})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"code": 401,
			"msg":  "用户未认证",
		})
		return
	}

	// 调用服务层进行导入
	result, err := assetService.ImportAssetsFromExcel(file, uint(projectID), userID.(uint))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  fmt.Sprintf("导入完成，成功%d条，失败%d条", result.SuccessCount, result.FailureCount),
		"data": result,
	})
}

// DownloadAssetTemplate 下载资产导入模板
func DownloadAssetTemplate(c *gin.Context) {
	// 调用服务层生成模板
	templateData, err := assetService.GenerateAssetImportTemplate()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  err.Error(),
		})
		return
	}

	// 设置响应头
	filename := "asset_import_template.xlsx"
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Header("Content-Length", fmt.Sprintf("%d", len(templateData)))

	c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", templateData)
}
