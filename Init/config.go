// 配置文件初始化包
// 该包负责加载和配置应用程序的配置文件（config.yml）
package init

import (
	"os" // 导入操作系统相关包，用于获取当前工作目录

	"github.com/spf13/viper" // 导入Viper配置管理包，用于处理配置文件
)

// InitConfig函数负责初始化配置文件
// 该函数会在应用程序启动时被调用，加载config.yml配置文件
func InitConfig() {
	// 获取当前工作目录路径，用于定位配置文件
	// 忽略错误返回值，因为通常情况下获取工作目录不会失败
	workdir, _ := os.Getwd()

	// 设置配置文件名称，不包含文件扩展名
	viper.SetConfigName("config")

	// 设置配置文件类型为YAML格式
	viper.SetConfigType("yml")

	// 添加配置文件搜索路径，在当前工作目录中查找配置文件
	viper.AddConfigPath(workdir)

	// 读取并解析配置文件
	err := viper.ReadInConfig()

	// 如果读取配置文件失败，直接返回
	// 这里没有处理错误，可能会导致程序使用默认值运行
	if err != nil {
		return
	}
}
