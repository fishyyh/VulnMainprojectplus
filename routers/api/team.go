// 团队管理API接口
package api

import (
	"net/http"
	"strconv"
	"vulnmain/services"

	"github.com/gin-gonic/gin"
)

var teamService = &services.TeamService{}

// GetTeamList 获取团队列表
func GetTeamList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	keyword := c.Query("keyword")

	userID, _ := c.Get("user_id")
	roleCode := c.GetString("role_code")

	resp, err := teamService.GetTeamList(userID.(uint), roleCode, page, pageSize, keyword)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 200, "msg": "获取成功", "data": resp})
}

// GetTeam 获取团队详情
func GetTeam(c *gin.Context) {
	teamID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "团队ID格式错误"})
		return
	}

	userID, _ := c.Get("user_id")
	roleCode := c.GetString("role_code")

	resp, err := teamService.GetTeamByID(uint(teamID), userID.(uint), roleCode)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 200, "msg": "获取成功", "data": resp})
}

// CreateTeam 创建团队
func CreateTeam(c *gin.Context) {
	var req services.TeamCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误: " + err.Error()})
		return
	}

	resp, err := teamService.CreateTeam(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 200, "msg": "创建成功", "data": resp})
}

// UpdateTeam 更新团队
func UpdateTeam(c *gin.Context) {
	teamID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "团队ID格式错误"})
		return
	}

	var req services.TeamUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误: " + err.Error()})
		return
	}

	resp, err := teamService.UpdateTeam(uint(teamID), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 200, "msg": "更新成功", "data": resp})
}

// DeleteTeam 删除团队
func DeleteTeam(c *gin.Context) {
	teamID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "团队ID格式错误"})
		return
	}

	err = teamService.DeleteTeam(uint(teamID))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 200, "msg": "删除成功"})
}

// GetTeamMembers 获取团队成员列表
func GetTeamMembers(c *gin.Context) {
	teamID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "团队ID格式错误"})
		return
	}

	members, err := teamService.GetTeamMembers(uint(teamID))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 200, "msg": "获取成功", "data": members})
}
