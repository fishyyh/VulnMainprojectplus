// 漏洞管理系统主程序入口文件
// 该文件负责启动整个Web应用程序，包括配置初始化、数据库连接、路由设置等
package main

import (
	Init "vulnmain/Init" // 导入项目初始化包，包含配置和数据库初始化功能
	"vulnmain/models"    // 导入数据模型包，包含数据表结构定义
	"vulnmain/routers"   // 导入路由包，包含API路由配置
	"vulnmain/services"  // 导入服务包，包含业务逻辑服务

	"github.com/gin-gonic/gin"   // 导入Gin Web框架，用于构建HTTP服务
	"github.com/gogf/gf/frame/g" // 导入GoFrame框架的全局对象，主要用于日志记录
	"github.com/spf13/viper"     // 导入Viper配置管理包，用于读取配置文件
)

// main函数是程序的主入口点
// 负责按顺序执行：配置初始化 -> 数据库初始化 -> 数据表迁移 -> 路由设置 -> 服务启动
func main() {
	//初始化配置文件（config.yml），加载应用程序配置参数
	Init.InitConfig()

	//初始化数据库连接，返回数据库连接对象
	db := Init.InitDB()

	//使用defer确保在程序结束时关闭数据库连接，防止连接泄漏
	defer db.Close()

	// 自动迁移数据表结构，根据models中定义的结构体创建或更新数据表
	if err := models.AutoMigrate(); err != nil {
		// 如果数据表迁移失败，记录致命错误并终止程序
		g.Log().Fatalf("数据表迁移失败: %v", err)
	}

	// 初始化默认数据，如管理员账户、默认配置等
	if err := models.InitDefaultData(); err != nil {
		// 如果初始化默认数据失败，记录致命错误并终止程序
		g.Log().Fatalf("初始化默认数据失败: %v", err)
	}

	// 创建Gin框架的默认路由引擎实例
	r := gin.Default()

	// 初始化应用程序的所有路由规则，包括API接口路由
	routers.InitRouter(r)

	// 初始化定时任务服务
	if err := services.InitScheduler(); err != nil {
		g.Log().Errorf("初始化定时任务服务失败: %v", err)
	} else {
		g.Log().Info("定时任务服务初始化成功")
		// 确保在程序退出时停止定时任务
		defer services.StopScheduler()
	}

	//从配置文件中读取服务器端口配置
	port := viper.GetString("server.port")

	//如果配置文件中指定了端口，则使用指定端口启动HTTP服务器
	if port != "" {
		// 在指定端口上启动服务器，如果启动失败则触发panic
		panic(r.Run(":" + port))
	}

	//如果配置文件中没有指定端口，则使用默认的8080端口启动HTTP服务器
	panic(r.Run())
}
