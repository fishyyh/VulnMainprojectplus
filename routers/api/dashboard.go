package api

import (
	"net/http"
	"vulnmain/services"

	"github.com/gin-gonic/gin"
)

var dashboardService = &services.DashboardService{}

// GetDashboardData 获取仪表板数据
func GetDashboardData(c *gin.Context) {
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

	// 调用服务层获取仪表板数据
	data, err := dashboardService.GetDashboardData(userID.(uint), roleCode.(string))
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
		"data": data,
	})
}
