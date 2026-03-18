// 路由配置包
// 该包负责配置所有HTTP路由和中间件，是API接口的统一入口
package routers

import (
	"net/http"             // 导入HTTP包，用于状态码
	"vulnmain/middleware"  // 导入中间件包，使用认证和权限中间件
	"vulnmain/routers/api" // 导入API接口包，注册具体的接口处理函数

	"github.com/gin-gonic/gin" // 导入Gin框架，用于路由配置
)

// CORSMiddleware函数创建跨域资源共享（CORS）中间件
// 允许前端从不同域名访问API接口，解决浏览器同源策略限制
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 设置允许访问的源，"*"表示允许所有域名
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")

		// 允许携带认证信息（如Cookie、Authorization头）
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")

		// 设置允许的请求头，包含常见的HTTP头和自定义认证头
		c.Writer.Header().Set("Access-Control-Allow-Headers",
			"Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, Accept, Origin, Cache-Control, X-Requested-With, Referer, Sec-Ch-Ua, Sec-Ch-Ua-Mobile, Sec-Ch-Ua-Platform, User-Agent")

		// 设置允许的HTTP方法
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		// 设置预检请求的缓存时间为24小时，减少不必要的OPTIONS请求
		c.Writer.Header().Set("Access-Control-Max-Age", "86400")

		// 处理浏览器的预检请求（OPTIONS方法）
		if c.Request.Method == "OPTIONS" {
			// 返回204状态码表示成功，但没有内容返回
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		// 继续处理后续中间件和路由处理器
		c.Next()
	}
}

// InitRouter函数初始化并配置所有HTTP路由
// 该函数是路由配置的核心，定义了API的完整结构和权限控制
// 参数：r - Gin引擎实例
// 返回：配置完成的Gin引擎实例
func InitRouter(r *gin.Engine) *gin.Engine {
	// 添加CORS中间件，允许跨域请求
	r.Use(CORSMiddleware())

	// 静态文件服务 - 提供上传的文件访问
	r.Static("/uploads", "./uploads")

	// 专门为周报PDF文件提供静态访问
	r.Static("/weekly-reports", "./uploads/weekly")

	// 公开API组 - 不需要JWT认证的接口
	// 这些接口可以匿名访问，主要用于用户登录和令牌刷新
	publicAPI := r.Group("/api")
	{
		// 认证相关接口
		publicAPI.POST("/login", api.Login)                      // 用户登录接口
		publicAPI.POST("/refresh", api.RefreshToken)             // JWT令牌刷新接口
		publicAPI.GET("/password/policy", api.GetPasswordPolicy) // 获取密码策略

		// 公开系统信息接口
		publicAPI.GET("/system/info", api.GetPublicSystemInfo) // 获取公开的系统信息（公司名称等）

		// Google OAuth 登录接口
		publicAPI.GET("/auth/google", api.GoogleAuthRedirect)          // 重定向到 Google 授权
		publicAPI.GET("/auth/google/callback", api.GoogleAuthCallback) // Google 授权回调
	}

	// 需要认证的API组 - 通过JWT中间件进行身份验证
	// 所有后续的接口都需要有效的JWT令牌才能访问
	authAPI := r.Group("/api")
	authAPI.Use(middleware.JWTAuthMiddleware()) // 应用JWT认证中间件
	{
		// 用户基础操作接口（不需要额外权限）
		authAPI.POST("/logout", api.Logout)                     // 用户登出接口
		authAPI.GET("/user/info", api.GetUserInfo)              // 获取当前用户信息
		authAPI.PUT("/user/password", api.ChangePassword)       // 修改当前用户密码
		authAPI.PUT("/user/profile", api.UpdateProfile)         // 修改当前用户个人信息
		authAPI.POST("/upload/vuln-image", api.UploadVulnImage) // 上传漏洞相关图片

		// 仪表板模块 - 需要首页查看权限
		dashboardAPI := authAPI.Group("/dashboard")
		dashboardAPI.Use(middleware.PermissionMiddleware("dashboard:view")) // 应用权限检查中间件
		{
			dashboardAPI.GET("/stats", api.GetSystemStats)  // 获取系统统计数据
			dashboardAPI.GET("/data", api.GetDashboardData) // 获取仪表板数据
		}

		// 用户管理模块 - 采用分层权限控制
		userAPI := authAPI.Group("/users")

		// 用户查看权限组 - 可以查看用户信息
		userViewAPI := userAPI.Group("")
		userViewAPI.Use(middleware.PermissionMiddleware("user:view"))
		{
			userViewAPI.GET("", api.GetUserList)                             // 获取用户列表
			userViewAPI.GET("/stats", api.GetUserStats)                      // 获取用户统计信息
			userViewAPI.GET("/:id", api.GetUser)                             // 获取用户详情
			userViewAPI.GET("/security-engineers", api.GetSecurityEngineers) // 获取安全工程师列表
			userViewAPI.GET("/dev-engineers", api.GetDevEngineers)           // 获取研发工程师列表
			userViewAPI.GET("/engineers", api.GetAllEngineers)               // 获取所有工程师列表
		}

		// 用户创建权限组 - 可以创建新用户
		userCreateAPI := userAPI.Group("")
		userCreateAPI.Use(middleware.PermissionMiddleware("user:create"))
		{
			userCreateAPI.POST("", api.CreateUser) // 创建新用户
		}

		// 用户编辑权限组 - 可以修改用户信息
		userEditAPI := userAPI.Group("")
		userEditAPI.Use(middleware.PermissionMiddleware("user:edit"))
		{
			userEditAPI.PUT("/:id", api.UpdateUser)                       // 更新用户信息
			userEditAPI.PUT("/:id/status", api.ToggleUserStatus)          // 切换用户状态
			userEditAPI.PUT("/:id/reset-password", api.ResetUserPassword) // 重置用户密码
		}

		// 用户删除权限组 - 可以删除用户
		userDeleteAPI := userAPI.Group("")
		userDeleteAPI.Use(middleware.PermissionMiddleware("user:delete"))
		{
			userDeleteAPI.DELETE("/:id", api.DeleteUser) // 删除用户
		}

		// 漏洞管理模块 - 采用分层权限控制
		vulnAPI := authAPI.Group("/vulns")

		// 漏洞查看权限组 - 可以查看漏洞信息
		vulnViewAPI := vulnAPI.Group("")
		vulnViewAPI.Use(middleware.PermissionMiddleware("vuln:view"))
		{
			vulnViewAPI.GET("", api.GetVulnList)                  // 获取漏洞列表
			vulnViewAPI.GET("/stats", api.GetVulnStats)           // 获取漏洞统计信息
			vulnViewAPI.GET("/:id", api.GetVuln)                  // 获取漏洞详情
			vulnViewAPI.GET("/:id/timeline", api.GetVulnTimeline) // 获取漏洞时间线
			vulnViewAPI.GET("/:id/watchers", api.GetVulnWatchers) // 获取漏洞关注者列表
			vulnViewAPI.POST("/:id/watchers", api.AddVulnWatcher) // 添加漏洞关注者（有查看权限即可添加）
			vulnViewAPI.POST("/:id/comments", api.AddVulnComment) // 添加漏洞评论（有查看权限即可评论）
		}

		// 漏洞创建权限组 - 可以创建新漏洞
		vulnCreateAPI := vulnAPI.Group("")
		vulnCreateAPI.Use(middleware.PermissionMiddleware("vuln:create"))
		{
			vulnCreateAPI.POST("", api.CreateVuln) // 创建新漏洞
		}

		// 漏洞编辑权限组 - 可以修改漏洞信息
		vulnEditAPI := vulnAPI.Group("")
		vulnEditAPI.Use(middleware.PermissionMiddleware("vuln:edit"))
		{
			vulnEditAPI.PUT("/:id", api.UpdateVuln)                                // 更新漏洞信息
			vulnEditAPI.PUT("/:id/fix", api.FixVuln)                               // 标记漏洞为已修复
			vulnEditAPI.DELETE("/:id/watchers/:watcher_id", api.RemoveVulnWatcher) // 移除漏洞关注者
		}

		// 漏洞状态变更接口 - 复用漏洞编辑权限，兼容现网角色权限
		vulnEditAPI.PUT("/:id/status", api.UpdateVulnStatus) // 更新漏洞状态

		// 漏洞审核权限组 - 可以审核和复测漏洞
		vulnAuditAPI := vulnAPI.Group("")
		vulnAuditAPI.Use(middleware.PermissionMiddleware("vuln:audit"))
		{
			vulnAuditAPI.PUT("/:id/audit", api.AuditVuln)   // 审核漏洞
			vulnAuditAPI.PUT("/:id/retest", api.RetestVuln) // 复测漏洞
		}

		// 漏洞删除权限组 - 可以删除漏洞
		vulnDeleteAPI := vulnAPI.Group("")
		vulnDeleteAPI.Use(middleware.PermissionMiddleware("vuln:delete"))
		{
			vulnDeleteAPI.DELETE("/:id", api.DeleteVuln) // 删除漏洞
		}

		// 资产管理模块 - 采用分层权限控制
		assetAPI := authAPI.Group("/assets")

		// 资产查看权限组 - 可以查看资产信息
		assetViewAPI := assetAPI.Group("")
		assetViewAPI.Use(middleware.PermissionMiddleware("asset:view"))
		{
			assetViewAPI.GET("", api.GetAssetList)                          // 获取资产列表
			assetViewAPI.GET("/stats", api.GetAssetStats)                   // 获取资产统计信息
			assetViewAPI.GET("/:id", api.GetAsset)                          // 获取资产详情
			assetViewAPI.GET("/groups", api.GetAssetGroups)                 // 获取资产组列表
			assetViewAPI.POST("/export", api.ExportAssets)                  // 批量导出资产
			assetViewAPI.GET("/import/template", api.DownloadAssetTemplate) // 下载导入模板
		}

		// 资产创建权限组 - 可以创建新资产
		assetCreateAPI := assetAPI.Group("")
		assetCreateAPI.Use(middleware.PermissionMiddleware("asset:create"))
		{
			assetCreateAPI.POST("", api.CreateAsset)             // 创建新资产
			assetCreateAPI.POST("/groups", api.CreateAssetGroup) // 创建资产组
			assetCreateAPI.POST("/import", api.ImportAssets)     // 批量导入资产
		}

		// 资产编辑权限组 - 可以修改资产信息
		assetEditAPI := assetAPI.Group("")
		assetEditAPI.Use(middleware.PermissionMiddleware("asset:edit"))
		{
			assetEditAPI.PUT("/:id", api.UpdateAsset) // 更新资产信息
		}

		// 资产删除权限组 - 可以删除资产
		assetDeleteAPI := assetAPI.Group("")
		assetDeleteAPI.Use(middleware.PermissionMiddleware("asset:delete"))
		{
			assetDeleteAPI.DELETE("/:id", api.DeleteAsset) // 删除资产
		}

		// 知识库管理模块 - TODO: 实现知识库功能
		// knowledgeAPI := authAPI.Group("/knowledge")
		// knowledgeAPI.Use(middleware.PermissionMiddleware("knowledge:view"))
		// {
		// 	knowledgeAPI.GET("", api.GetKnowledgeList)     // 获取知识库列表
		// 	knowledgeAPI.GET("/:id", api.GetKnowledge)     // 获取知识库详情
		// }

		// 项目管理模块 - 采用分层权限控制
		projectAPI := authAPI.Group("/projects")

		// 项目查看权限组 - 可以查看项目信息
		projectViewAPI := projectAPI.Group("")
		projectViewAPI.Use(middleware.PermissionMiddleware("project:view"))
		{
			projectViewAPI.GET("", api.GetProjectList)                      // 获取项目列表
			projectViewAPI.GET("/:id", api.GetProject)                      // 获取项目详情
			projectViewAPI.GET("/:id/members", api.GetProjectMembers)       // 获取项目成员
			projectViewAPI.GET("/:id/assets", api.GetProjectAssets)         // 获取项目资产
			projectViewAPI.GET("/:id/vulnerabilities", api.GetProjectVulns) // 获取项目漏洞
		}

		// 项目创建权限组 - 可以创建新项目
		projectCreateAPI := projectAPI.Group("")
		projectCreateAPI.Use(middleware.PermissionMiddleware("project:create"))
		{
			projectCreateAPI.POST("", api.CreateProject) // 创建新项目
		}

		// 项目编辑权限组 - 可以修改项目信息
		projectEditAPI := projectAPI.Group("")
		projectEditAPI.Use(middleware.PermissionMiddleware("project:edit"))
		{
			projectEditAPI.PUT("/:id", api.UpdateProject)                  // 更新项目信息
			projectEditAPI.POST("/refresh-stats", api.RefreshProjectStats) // 刷新项目统计数据
		}

		// 项目删除权限组 - 可以删除项目
		projectDeleteAPI := projectAPI.Group("")
		projectDeleteAPI.Use(middleware.PermissionMiddleware("project:delete"))
		{
			projectDeleteAPI.DELETE("/:id", api.DeleteProject) // 删除项目
		}

		// 团队管理模块 - 采用分层权限控制
		teamAPI := authAPI.Group("/teams")

		// 团队查看权限组
		teamViewAPI := teamAPI.Group("")
		teamViewAPI.Use(middleware.PermissionMiddleware("team:view"))
		{
			teamViewAPI.GET("", api.GetTeamList)                // 获取团队列表
			teamViewAPI.GET("/:id", api.GetTeam)                // 获取团队详情
			teamViewAPI.GET("/:id/members", api.GetTeamMembers) // 获取团队成员
		}

		// 团队创建权限组
		teamCreateAPI := teamAPI.Group("")
		teamCreateAPI.Use(middleware.PermissionMiddleware("team:create"))
		{
			teamCreateAPI.POST("", api.CreateTeam) // 创建新团队
		}

		// 团队编辑权限组
		teamEditAPI := teamAPI.Group("")
		teamEditAPI.Use(middleware.PermissionMiddleware("team:edit"))
		{
			teamEditAPI.PUT("/:id", api.UpdateTeam) // 更新团队信息
		}

		// 团队删除权限组
		teamDeleteAPI := teamAPI.Group("")
		teamDeleteAPI.Use(middleware.PermissionMiddleware("team:delete"))
		{
			teamDeleteAPI.DELETE("/:id", api.DeleteTeam) // 删除团队
		}

		// 系统管理模块 - 采用分层权限控制
		systemAPI := authAPI.Group("/system")

		// 系统配置权限组 - 可以管理系统配置
		systemConfigAPI := systemAPI.Group("")
		systemConfigAPI.Use(middleware.PermissionMiddleware("system:config"))
		{
			systemConfigAPI.GET("/configs", api.GetSystemConfigs)           // 获取系统配置列表
			systemConfigAPI.GET("/configs/:key", api.GetSystemConfig)       // 获取单个系统配置
			systemConfigAPI.PUT("/configs/:key", api.UpdateSystemConfig)    // 更新系统配置
			systemConfigAPI.POST("/configs", api.CreateSystemConfig)        // 创建系统配置
			systemConfigAPI.DELETE("/configs/:key", api.DeleteSystemConfig) // 删除系统配置
			systemConfigAPI.POST("/email/test", api.TestEmailConfig)        // 测试邮件配置
			systemConfigAPI.POST("/ldap/test", api.TestLDAPConfig)          // 测试LDAP连接
			systemConfigAPI.POST("/ldap/sync", api.SyncLDAPUsers)           // 手动同步LDAP用户
		}

		// 系统日志权限组 - 可以查看操作日志
		systemLogAPI := systemAPI.Group("")
		systemLogAPI.Use(middleware.PermissionMiddleware("system:log"))
		{
			systemLogAPI.GET("/logs", api.GetOperationLogs) // 获取操作日志列表
		}

		// 系统统计权限组 - 可以查看统计数据
		systemStatsAPI := systemAPI.Group("")
		systemStatsAPI.Use(middleware.PermissionMiddleware("system:stats"))
		{
			systemStatsAPI.GET("/stats", api.GetSystemStats) // 获取系统统计数据
		}

		// 周报管理权限组 - 可以管理周报
		weeklyReportAPI := systemAPI.Group("/weekly-report")
		weeklyReportAPI.Use(middleware.PermissionMiddleware("system:config")) // 使用系统配置权限
		{
			weeklyReportAPI.GET("/data", api.GetWeeklyReportData)               // 获取周报数据
			weeklyReportAPI.GET("/preview", api.PreviewWeeklyReportPDF)         // 预览周报PDF
			weeklyReportAPI.GET("/download", api.DownloadWeeklyReportPDF)       // 下载周报PDF
			weeklyReportAPI.POST("/send", api.SendWeeklyReport)                 // 手动发送周报
			weeklyReportAPI.POST("/generate", api.ManualGenerateWeeklyReport)   // 手动生成并发送周报
			weeklyReportAPI.GET("/scheduler/status", api.GetSchedulerStatus)    // 获取定时任务状态
			weeklyReportAPI.POST("/scheduler/send", api.ManualSendWeeklyReport) // 手动触发定时发送

			// 周报历史记录管理
			weeklyReportAPI.GET("/history", api.GetWeeklyReportHistory)             // 获取周报历史记录
			weeklyReportAPI.GET("/file/:id/preview", api.PreviewWeeklyReportFile)   // 预览历史周报文件
			weeklyReportAPI.GET("/file/:id/download", api.DownloadWeeklyReportFile) // 下载历史周报文件
		}

		// 通知相关接口 - 所有已认证用户都可以访问
		authAPI.GET("/notifications", api.GetNotifications)              // 获取用户通知列表
		authAPI.PUT("/notifications/:id/read", api.MarkNotificationRead) // 标记通知为已读

		// 数据字典接口 - 所有已认证用户都可以访问
		authAPI.GET("/dictionaries", api.GetDictionaries) // 获取数据字典

		authAPI.GET("/roles", api.GetRoles)

		// 用户项目相关接口 - 所有已认证用户都可以访问
		authAPI.GET("/user/projects", api.GetUserProjects) // 获取用户的项目列表
	}

	// 返回配置完成的路由引擎
	return r
}
