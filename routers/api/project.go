// 项目管理API接口包
// 该包提供项目管理相关的HTTP接口，包括项目创建、编辑、删除、成员管理等功能
package api

import (
	"net/http"
	"strconv"
	Init "vulnmain/Init"
	"vulnmain/models"
	"vulnmain/services"

	"github.com/gin-gonic/gin"
)

// projectService是项目服务的实例，用于处理项目相关的业务逻辑
var projectService = &services.ProjectService{}

// GetProjectList获取项目列表
// GET /api/projects
func GetProjectList(c *gin.Context) {
	// 从上下文获取用户信息
	userID, _ := c.Get("user_id")
	roleCode, _ := c.Get("role_code")

	// 绑定查询参数
	var req services.ProjectListRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "参数错误: " + err.Error(),
		})
		return
	}

	// 设置用户信息用于权限过滤
	req.UserID = userID.(uint)
	req.RoleCode = roleCode.(string)

	// 调用服务层获取项目列表
	resp, err := projectService.GetProjectList(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "获取项目列表成功",
		"data": resp,
	})
}

// GetProject获取项目详情
// GET /api/projects/:id
func GetProject(c *gin.Context) {
	// 获取项目ID
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "项目ID格式错误",
		})
		return
	}

	// 从上下文获取用户信息
	userID, _ := c.Get("user_id")
	roleCode, _ := c.Get("role_code")

	// 调用服务层获取项目详情
	resp, err := projectService.GetProject(uint(projectID), userID.(uint), roleCode.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "获取项目详情成功",
		"data": resp,
	})
}

// CreateProject创建项目
// POST /api/projects
func CreateProject(c *gin.Context) {
	// 绑定请求体
	var req services.CreateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "参数错误: " + err.Error(),
		})
		return
	}

	// 从上下文获取用户信息
	userID, _ := c.Get("user_id")

	// 调用服务层创建项目
	resp, err := projectService.CreateProject(&req, userID.(uint))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "创建项目成功",
		"data": resp,
	})
}

// UpdateProject更新项目
// PUT /api/projects/:id
func UpdateProject(c *gin.Context) {
	// 获取项目ID
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "项目ID格式错误",
		})
		return
	}

	// 绑定请求体
	var req services.UpdateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "参数错误: " + err.Error(),
		})
		return
	}

	// 从上下文获取用户信息
	userID, _ := c.Get("user_id")
	roleCode, _ := c.Get("role_code")

	// 调用服务层更新项目
	resp, err := projectService.UpdateProject(uint(projectID), &req, userID.(uint), roleCode.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "更新项目成功",
		"data": resp,
	})
}

// DeleteProject删除项目
// DELETE /api/projects/:id
func DeleteProject(c *gin.Context) {
	// 获取项目ID
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "项目ID格式错误",
		})
		return
	}

	// 从上下文获取用户信息
	userID, _ := c.Get("user_id")
	roleCode, _ := c.Get("role_code")

	// 调用服务层删除项目
	err = projectService.DeleteProject(uint(projectID), userID.(uint), roleCode.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "删除项目成功",
	})
}

// GetProjectMembers获取项目成员列表
// GET /api/projects/:id/members
func GetProjectMembers(c *gin.Context) {
	// 获取项目ID
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "项目ID格式错误",
		})
		return
	}

	// 从上下文获取用户信息
	userID, _ := c.Get("user_id")
	roleCode, _ := c.Get("role_code")

	// 调用服务层获取项目成员
	members, err := projectService.GetProjectMembers(uint(projectID), userID.(uint), roleCode.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "获取项目成员成功",
		"data": members,
	})
}

// GetUserProjects获取用户的项目列表
// GET /api/user/projects
func GetUserProjects(c *gin.Context) {
	// 从上下文获取用户信息
	userID, _ := c.Get("user_id")
	roleCode, _ := c.Get("role_code")

	// 调用服务层获取用户项目
	projects, err := projectService.GetUserProjects(userID.(uint), roleCode.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "获取用户项目成功",
		"data": projects,
	})
}

// GetProjectAssets获取项目资产列表
// GET /api/projects/:id/assets
func GetProjectAssets(c *gin.Context) {
	// 获取项目ID
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "项目ID格式错误",
		})
		return
	}

	// 从上下文获取用户信息
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

	// 调用资产服务获取项目下的资产列表
	assetService := &services.AssetService{}
	projectIDUint := uint(projectID)
	assetListReq := &services.AssetListRequest{
		Page:            1,
		PageSize:        1000, // 获取项目下所有资产
		ProjectID:       &projectIDUint,
		CurrentUserID:   userID.(uint),
		CurrentUserRole: roleCode.(string),
	}

	assetResponse, err := assetService.GetAssetList(assetListReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "获取项目资产失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "获取项目资产成功",
		"data": assetResponse.Assets,
	})
}

// GetProjectVulns获取项目漏洞列表
// GET /api/projects/:id/vulnerabilities
func GetProjectVulns(c *gin.Context) {
	// 获取项目ID
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code": 400,
			"msg":  "项目ID格式错误",
		})
		return
	}

	// 从上下文获取用户信息
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

	// 调用漏洞服务获取项目下的漏洞列表
	vulnService := &services.VulnService{}
	projectIDUint := uint(projectID)
	vulnListReq := &services.VulnListRequest{
		Page:            1,
		PageSize:        1000, // 获取项目下所有漏洞
		ProjectID:       &projectIDUint,
		CurrentUserID:   userID.(uint),
		CurrentUserRole: roleCode.(string),
	}

	vulnResponse, err := vulnService.GetVulnList(vulnListReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "获取项目漏洞失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "获取项目漏洞成功",
		"data": vulnResponse.Vulnerabilities,
	})
}

// RefreshProjectStats刷新项目统计数据
// POST /api/projects/refresh-stats
func RefreshProjectStats(c *gin.Context) {
	// 从上下文获取用户信息
	_, _ = c.Get("user_id")
	roleCode, _ := c.Get("role_code")

	// 只有超级管理员可以执行此操作
	if roleCode.(string) != "super_admin" && roleCode.(string) != "admin" {
		c.JSON(http.StatusForbidden, gin.H{
			"code": 403,
			"msg":  "只有超级管理员可以刷新统计数据",
		})
		return
	}

	// 获取所有项目
	db := Init.GetDB()
	var projects []models.Project
	if err := db.Find(&projects).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code": 500,
			"msg":  "获取项目列表失败",
		})
		return
	}

	// 逐一更新每个项目的统计数据
	var updatedCount int
	var failedCount int

	for _, project := range projects {
		if err := projectService.UpdateProjectStats(project.ID); err != nil {
			failedCount++
		} else {
			updatedCount++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "统计数据刷新完成",
		"data": gin.H{
			"total_projects": len(projects),
			"updated_count":  updatedCount,
			"failed_count":   failedCount,
		},
	})
}
