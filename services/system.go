package services

import (
	"errors"
	"fmt"
	"time"
	Init "vulnmain/Init"
	"vulnmain/models"
)

type SystemService struct{}

type ConfigUpdateRequest struct {
	Value string `json:"value" binding:"required"`
}

type LogListRequest struct {
	Page     int    `form:"page" binding:"min=1"`
	PageSize int    `form:"page_size" binding:"min=1,max=100"`
	Module   string `form:"module"`
	Action   string `form:"action"`
	UserID   *uint  `form:"user_id"`
	Status   string `form:"status"`
}

type LogListResponse struct {
	Logs     []models.OperationLog `json:"logs"`
	Total    int64                 `json:"total"`
	Page     int                   `json:"page"`
	PageSize int                   `json:"page_size"`
}

// GetSystemConfigs 获取系统配置列表
func (s *SystemService) GetSystemConfigs(group string, isPublic bool) ([]models.SystemConfig, error) {
	db := Init.GetDB()

	query := db.Model(&models.SystemConfig{})

	if group != "" {
		query = query.Where("`group` = ?", group)
	}

	if isPublic {
		query = query.Where("is_public = ?", true)
	}

	var configs []models.SystemConfig
	if err := query.Order("`group`, `key`").Find(&configs).Error; err != nil {
		return nil, errors.New("查询系统配置失败")
	}

	return configs, nil
}

// GetSystemConfig 获取系统配置
func (s *SystemService) GetSystemConfig(key string) (*models.SystemConfig, error) {
	db := Init.GetDB()
	var config models.SystemConfig
	if err := db.Where("`key` = ?", key).First(&config).Error; err != nil {
		return nil, err
	}
	return &config, nil
}

// UpdateSystemConfig 更新系统配置
func (s *SystemService) UpdateSystemConfig(key string, value string, description string) error {
	db := Init.GetDB()
	var config models.SystemConfig
	if err := db.Where("`key` = ?", key).First(&config).Error; err != nil {
		return err
	}

	updates := map[string]interface{}{
		"value":      value,
		"updated_at": time.Now().Truncate(time.Second),
	}
	if description != "" {
		updates["description"] = description
	}

	return db.Model(&config).Updates(updates).Error
}

// CreateSystemConfig 创建系统配置
func (s *SystemService) CreateSystemConfig(config *models.SystemConfig) error {
	db := Init.GetDB()

	// 检查key是否已存在
	var existConfig models.SystemConfig
	if err := db.Where("`key` = ?", config.Key).First(&existConfig).Error; err == nil {
		return fmt.Errorf("配置key %s 已存在", config.Key)
	}

	config.CreatedAt = time.Now().Truncate(time.Second)
	config.UpdatedAt = time.Now().Truncate(time.Second)
	return db.Create(config).Error
}

// DeleteSystemConfig 删除系统配置
func (s *SystemService) DeleteSystemConfig(key string) error {
	db := Init.GetDB()
	var config models.SystemConfig
	if err := db.Where("`key` = ?", key).First(&config).Error; err != nil {
		return err
	}
	return db.Delete(&config).Error
}

// GetOperationLogs 获取操作日志列表
func (s *SystemService) GetOperationLogs(req *LogListRequest) (*LogListResponse, error) {
	db := Init.GetDB()

	// 设置默认值
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = 20
	}

	query := db.Model(&models.OperationLog{}).Preload("User")

	// 添加过滤条件
	if req.Module != "" {
		query = query.Where("module = ?", req.Module)
	}
	if req.Action != "" {
		query = query.Where("action = ?", req.Action)
	}
	if req.UserID != nil {
		query = query.Where("user_id = ?", *req.UserID)
	}
	if req.Status != "" {
		query = query.Where("status = ?", req.Status)
	}

	// 获取总数
	var total int64
	query.Count(&total)

	// 分页查询
	var logs []models.OperationLog
	offset := (req.Page - 1) * req.PageSize
	if err := query.Offset(offset).Limit(req.PageSize).Order("created_at DESC").Find(&logs).Error; err != nil {
		return nil, errors.New("查询操作日志失败")
	}

	return &LogListResponse{
		Logs:     logs,
		Total:    total,
		Page:     req.Page,
		PageSize: req.PageSize,
	}, nil
}

// GetSystemStats 获取系统统计信息
func (s *SystemService) GetSystemStats() (map[string]interface{}, error) {
	db := Init.GetDB()

	// 用户统计
	var totalUsers, activeUsers int64
	db.Model(&models.User{}).Count(&totalUsers)
	db.Model(&models.User{}).Where("status = ?", 1).Count(&activeUsers)

	// 资产统计
	var totalAssets, activeAssets int64
	db.Model(&models.Asset{}).Count(&totalAssets)
	db.Model(&models.Asset{}).Where("status = ?", "active").Count(&activeAssets)

	// 漏洞统计
	var totalVulns, criticalVulns, highVulns, pendingVulns int64
	db.Model(&models.Vulnerability{}).Count(&totalVulns)
	db.Model(&models.Vulnerability{}).Where("severity = ?", "critical").Count(&criticalVulns)
	db.Model(&models.Vulnerability{}).Where("severity = ?", "high").Count(&highVulns)
	db.Model(&models.Vulnerability{}).Where("status = ?", "pending").Count(&pendingVulns)

	// 近期活动统计
	var recentLogs int64
	db.Model(&models.OperationLog{}).Where("created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)").Count(&recentLogs)

	return map[string]interface{}{
		"users": map[string]interface{}{
			"total":  totalUsers,
			"active": activeUsers,
		},
		"assets": map[string]interface{}{
			"total":  totalAssets,
			"active": activeAssets,
		},
		"vulns": map[string]interface{}{
			"total":    totalVulns,
			"critical": criticalVulns,
			"high":     highVulns,
			"pending":  pendingVulns,
		},
		"recent_activities": recentLogs,
	}, nil
}

// GetNotifications 获取用户通知
func (s *SystemService) GetNotifications(userID uint, page, pageSize int) ([]models.Notification, int64, error) {
	db := Init.GetDB()

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}

	var total int64
	db.Model(&models.Notification{}).Where("user_id = ?", userID).Count(&total)

	var notifications []models.Notification
	offset := (page - 1) * pageSize
	if err := db.Where("user_id = ?", userID).Offset(offset).Limit(pageSize).
		Order("created_at DESC").Find(&notifications).Error; err != nil {
		return nil, 0, errors.New("查询通知失败")
	}

	return notifications, total, nil
}

// MarkNotificationRead 标记通知为已读
func (s *SystemService) MarkNotificationRead(notificationID uint, userID uint) error {
	db := Init.GetDB()

	var notification models.Notification
	if err := db.Where("id = ? AND user_id = ?", notificationID, userID).First(&notification).Error; err != nil {
		return errors.New("通知不存在")
	}

	if !notification.IsRead {
		notification.IsRead = true
		if err := db.Save(&notification).Error; err != nil {
			return errors.New("标记通知失败")
		}
	}

	return nil
}

// CreateNotification 创建通知
func (s *SystemService) CreateNotification(userID uint, notificationType, title, content, data string) error {
	db := Init.GetDB()

	notification := models.Notification{
		UserID:  userID,
		Type:    notificationType,
		Title:   title,
		Content: content,
		Data:    data,
		IsRead:  false,
	}

	if err := db.Create(&notification).Error; err != nil {
		return errors.New("创建通知失败")
	}

	return nil
}

// GetDictionaries 获取数据字典
func (s *SystemService) GetDictionaries(dictType string) ([]models.Dictionary, error) {
	db := Init.GetDB()

	query := db.Model(&models.Dictionary{}).Where("status = ?", 1)

	if dictType != "" {
		query = query.Where("type = ?", dictType)
	}

	var dictionaries []models.Dictionary
	if err := query.Order("type, sort, id").Find(&dictionaries).Error; err != nil {
		return nil, errors.New("查询数据字典失败")
	}

	return dictionaries, nil
}

// addOperationLog 添加操作日志
func (s *SystemService) addOperationLog(userID uint, module, action, resource, details, status, ip, userAgent string) {
	db := Init.GetDB()

	log := models.OperationLog{
		UserID:    userID,
		Module:    module,
		Action:    action,
		Resource:  resource,
		Details:   details,
		Status:    status,
		IP:        ip,
		UserAgent: userAgent,
	}

	db.Create(&log)
}
