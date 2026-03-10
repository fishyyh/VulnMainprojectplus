// 数据库初始化包
// 该包负责初始化数据库连接，设置GORM配置，并提供数据库连接池管理
package init

import (
	"fmt" // 导入格式化包，用于构建数据库连接字符串

	_ "github.com/go-sql-driver/mysql" // 导入MySQL驱动程序，使用下划线导入仅执行init函数
	"github.com/gogf/gf/frame/g"       // 导入GoFrame框架的全局对象，用于日志记录
	"github.com/jinzhu/gorm"           // 导入GORM ORM框架，用于数据库操作
	"github.com/spf13/viper"           // 导入Viper配置管理包，用于读取数据库配置
)

// DB是全局数据库连接实例，供整个应用程序使用
var DB *gorm.DB

// Model是基础模型结构体，包含所有数据表的公共字段
// 其他模型可以通过嵌入此结构体来继承ID字段
type Model struct {
	ID int `gorm:"primary_key" json:"id"` // 主键ID，GORM标签指定为主键，JSON标签用于序列化
}

// InitDB函数初始化数据库连接池
// 该函数从配置文件中读取数据库配置，建立连接，并设置GORM相关配置
func InitDB() *gorm.DB {
	// 从配置文件中读取数据库驱动名称（如：mysql）
	driverName := viper.GetString("datasource.driverName")

	// 从配置文件中读取数据库服务器地址
	host := viper.GetString("datasource.host")

	// 从配置文件中读取数据库端口号
	port := viper.GetString("datasource.port")

	// 从配置文件中读取数据库名称
	database := viper.GetString("datasource.database")

	// 从配置文件中读取数据库用户名
	username := viper.GetString("datasource.username")

	// 从配置文件中读取数据库密码
	password := viper.GetString("datasource.password")

	// 从配置文件中读取数据库字符集（如：utf8mb4）
	charset := viper.GetString("datasource.charset")

	// 声明错误变量，用于接收数据库连接错误
	var err error

	// 使用GORM打开数据库连接
	DB, err = gorm.Open(driverName, fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=%s&parseTime=True&loc=Local",
		username, // 数据库用户名
		password, // 数据库密码
		host,     // 数据库主机地址
		port,     // 数据库端口
		database, // 数据库名称
		charset)) // 字符集编码

	// 检查数据库连接是否成功
	if err != nil {
		// 连接失败时记录致命错误并终止程序
		g.Log().Fatalf("数据库连接错误", err)
	} else {
		// 连接成功时记录信息日志
		g.Log().Info("数据连接成功")
	}

	// 设置GORM的表名处理器，返回原始表名（不进行复数化处理）·
	gorm.DefaultTableNameHandler = func(db *gorm.DB, defaultTableName string) string {
		return defaultTableName
	}

	// 设置GORM使用单数表名（如User表而不是users表）
	DB.SingularTable(true)

	// 启用SQL日志模式，在控制台输出执行的SQL语句
	DB.LogMode(true)

	// 返回初始化完成的数据库连接对象
	return DB
}

// GetDB函数返回全局数据库连接实例
// 其他包可以通过调用此函数获取数据库连接进行操作
func GetDB() *gorm.DB {
	return DB
}
