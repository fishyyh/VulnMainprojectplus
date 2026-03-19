// 资产管理服务包
// 该包提供资产的创建、查询、更新、删除等业务逻辑处理
package services

import (
	"errors"             // 导入错误处理包
	"fmt"                // 导入格式化包
	"mime/multipart"     // 导入multipart包，用于处理文件上传
	"strings"            // 导入字符串处理包
	"time"               // 导入时间包，用于项目过期检查
	Init "vulnmain/Init" // 导入初始化包，获取数据库连接
	"vulnmain/models"    // 导入模型包，使用资产相关模型

	"github.com/xuri/excelize/v2" // 导入Excel处理库
)

// AssetService结构体定义资产管理服务
// 提供资产相关的所有业务逻辑处理方法
type AssetService struct{}

// AssetCreateRequest结构体定义创建资产的请求参数
// 包含创建资产时需要的所有必要信息
type AssetCreateRequest struct {
	Name         string `json:"name" binding:"required"` // 资产名称，必填字段
	Type         string `json:"type" binding:"required"` // 资产类型，必填字段，如web应用、数据库等
	Category     string `json:"category"`                // 资产分类，选填字段
	URL          string `json:"url"`                     // 资产URL地址，选填字段
	IP           string `json:"ip"`                      // 资产IP地址，选填字段
	Port         string `json:"port"`                    // 资产端口，选填字段
	Domain       string `json:"domain"`                  // 资产域名，选填字段
	Description  string `json:"description"`             // 资产描述信息，选填字段
	OS           string `json:"os"`                      // 操作系统信息，选填字段
	Importance   string `json:"importance"`              // 重要性级别，选填字段
	Owner        string `json:"owner"`                   // 资产负责人，选填字段
	Department   string `json:"department"`              // 所属部门，选填字段
	Environment  string `json:"environment"`             // 所属环境，选填字段
	ProjectID    *uint  `json:"project_id"`              // 所属项目ID，可为空
	AssetGroupID *uint  `json:"asset_group_id"`          // 所属资产组ID，可为空
	Tags         string `json:"tags"`                    // 资产标签，用逗号分隔
}

// AssetUpdateRequest结构体定义更新资产的请求参数
// 所有字段都是可选的，只更新传入的非空字段
type AssetUpdateRequest struct {
	Name         string `json:"name"`           // 资产名称，选填字段
	Type         string `json:"type"`           // 资产类型，选填字段
	Category     string `json:"category"`       // 资产分类，选填字段
	URL          string `json:"url"`            // 资产URL地址，选填字段
	IP           string `json:"ip"`             // 资产IP地址，选填字段
	Port         string `json:"port"`           // 资产端口，选填字段
	Domain       string `json:"domain"`         // 资产域名，选填字段
	Description  string `json:"description"`    // 资产描述信息，选填字段
	OS           string `json:"os"`             // 操作系统信息，选填字段
	Status       string `json:"status"`         // 资产状态，选填字段
	Importance   string `json:"importance"`     // 重要性级别，选填字段
	Owner        string `json:"owner"`          // 资产负责人，选填字段
	Department   string `json:"department"`     // 所属部门，选填字段
	Environment  string `json:"environment"`    // 所属环境，选填字段
	AssetGroupID *uint  `json:"asset_group_id"` // 所属资产组ID，可为空
	Tags         string `json:"tags"`           // 资产标签，用逗号分隔
}

// AssetListRequest结构体定义获取资产列表的请求参数
// 支持分页、关键词搜索和多种过滤条件
type AssetListRequest struct {
	Page         int    `form:"page" binding:"min=1"`              // 页码，最小值为1
	PageSize     int    `form:"page_size" binding:"min=1,max=100"` // 每页数量，范围1-100
	Keyword      string `form:"keyword"`                           // 关键词搜索，在多个字段中模糊匹配
	Name         string `form:"name"`                              // 按资产名称过滤
	Type         string `form:"type"`                              // 按资产类型过滤
	Category     string `form:"category"`                          // 按资产分类过滤
	Status       string `form:"status"`                            // 按资产状态过滤
	Importance   string `form:"importance"`                        // 按重要性级别过滤
	Owner        string `form:"owner"`                             // 按负责人过滤
	Department   string `form:"department"`                        // 按部门过滤
	ProjectID    *uint  `form:"project_id"`                        // 按项目ID过滤，可为空
	AssetGroupID *uint  `form:"asset_group_id"`                    // 按资产组ID过滤，可为空
	// 权限控制字段
	CurrentUserID   uint   `form:"-"` // 当前用户ID，用于权限控制
	CurrentUserRole string `form:"-"` // 当前用户角色，用于权限控制
}

// AssetListResponse结构体定义资产列表的响应数据
// 包含资产数据和分页信息
type AssetListResponse struct {
	Assets      []models.Asset `json:"assets"`       // 资产列表数据
	Total       int64          `json:"total"`        // 总记录数
	Page        int            `json:"page"`         // 当前页码
	PageSize    int            `json:"page_size"`    // 每页数量
	CurrentPage int            `json:"current_page"` // 当前页码（冗余字段）
	TotalPages  int            `json:"total_pages"`  // 总页数
}

// AssetExportRequest结构体定义批量导出资产的请求参数
type AssetExportRequest struct {
	AssetIDs  []uint `json:"asset_ids"`  // 要导出的资产ID列表
	ProjectID uint   `json:"project_id"` // 项目ID
}

// AssetImportRequest结构体定义批量导入资产的请求参数
type AssetImportRequest struct {
	ProjectID uint `json:"project_id"` // 项目ID
}

// AssetImportResult结构体定义批量导入的结果
type AssetImportResult struct {
	SuccessCount int            `json:"success_count"` // 成功导入的资产数量
	FailureCount int            `json:"failure_count"` // 导入失败的资产数量
	Errors       []string       `json:"errors"`        // 错误信息列表
	Assets       []models.Asset `json:"assets"`        // 成功导入的资产列表
}

// CreateAsset方法创建新的资产记录
// 参数：req - 创建资产的请求参数，createdBy - 创建者用户ID
// 返回：创建的资产对象和可能的错误
func (s *AssetService) CreateAsset(req *AssetCreateRequest, createdBy uint) (*models.Asset, error) {
	// 获取数据库连接
	db := Init.GetDB()

	// 验证资产组是否存在（如果指定了资产组ID）
	if req.AssetGroupID != nil {
		var assetGroup models.AssetGroup
		if err := db.Where("id = ?", *req.AssetGroupID).First(&assetGroup).Error; err != nil {
			return nil, errors.New("资产组不存在")
		}
	}

	// 验证项目是否存在且未过期（如果指定了项目ID）
	if req.ProjectID != nil {
		var project models.Project
		if err := db.Where("id = ?", *req.ProjectID).First(&project).Error; err != nil {
			return nil, errors.New("项目不存在")
		}

		// 检查项目是否过期
		if project.EndDate != nil && time.Now().After(*project.EndDate) {
			return nil, errors.New("项目已过期，无法添加资产")
		}
	}

	// 检查资产名称是否已存在，避免重复创建
	var existAsset models.Asset
	query := db.Where("name = ?", req.Name)
	// 如果指定了项目ID，则在项目范围内检查重名
	if req.ProjectID != nil {
		query = query.Where("project_id = ?", *req.ProjectID)
	}
	if err := query.First(&existAsset).Error; err == nil {
		if req.ProjectID != nil {
			return nil, errors.New("该项目下已存在同名资产")
		} else {
			return nil, errors.New("已存在同名资产")
		}
	}

	// 构建资产对象
	asset := models.Asset{
		Name:         req.Name,         // 资产名称
		Type:         req.Type,         // 资产类型
		IP:           req.IP,           // IP地址
		Port:         req.Port,         // 端口
		Domain:       req.Domain,       // 域名
		Description:  req.Description,  // 描述信息
		OS:           req.OS,           // 操作系统
		Status:       "active",         // 默认状态为活跃
		Importance:   req.Importance,   // 重要性级别
		Owner:        req.Owner,        // 负责人
		Department:   req.Department,   // 所属部门
		Environment:  req.Environment,  // 所属环境
		ProjectID:    0,                // 项目ID，暂时设为0，后续会根据req.ProjectID设置
		AssetGroupID: req.AssetGroupID, // 资产组ID
		CreatedBy:    createdBy,        // 创建者ID
		Tags:         req.Tags,         // 标签
	}

	// 设置项目ID（如果指定）
	if req.ProjectID != nil {
		asset.ProjectID = *req.ProjectID
	}

	// 保存资产到数据库
	if err := db.Create(&asset).Error; err != nil {
		return nil, errors.New("创建资产失败")
	}

	// 记录审计日志，追踪资产创建操作
	s.addAuditLog(asset.ID, "create", "", "", createdBy, "", "")

	// 重新查询资产信息，包含关联的项目、资产组、创建者等数据
	db.Preload("Project").Preload("AssetGroup").Preload("Creator").Where("id = ?", asset.ID).First(&asset)

	// 更新项目统计信息（如果资产属于某个项目）
	if asset.ProjectID != 0 {
		projectService := &ProjectService{}
		if err := projectService.UpdateProjectStats(asset.ProjectID); err != nil {
			// 统计更新失败不影响资产创建，只记录错误
			// 可以考虑添加日志记录
		}
	}

	return &asset, nil
}

// GetAssetByID 根据ID获取资产
func (s *AssetService) GetAssetByID(assetID uint) (*models.Asset, error) {
	db := Init.GetDB()

	var asset models.Asset
	if err := db.Preload("Project").Preload("AssetGroup").Preload("Creator").Where("id = ?", assetID).First(&asset).Error; err != nil {
		return nil, errors.New("资产不存在")
	}

	return &asset, nil
}

// UpdateAsset 更新资产信息
func (s *AssetService) UpdateAsset(assetID uint, req *AssetUpdateRequest, userID uint) (*models.Asset, error) {
	db := Init.GetDB()

	var asset models.Asset
	if err := db.Where("id = ?", assetID).First(&asset).Error; err != nil {
		return nil, errors.New("资产不存在")
	}

	// 记录变更前的数据
	_ = asset // 暂时记录变更前的数据，后续可用于审计日志

	// 检查资产名称是否已被其他资产使用
	if req.Name != "" && req.Name != asset.Name {
		var existAsset models.Asset
		if err := db.Where("name = ? AND id != ?", req.Name, assetID).First(&existAsset).Error; err == nil {
			return nil, errors.New("该项目下已存在同名资产")
		}
		asset.Name = req.Name
	}

	// 验证资产组是否存在(如果指定)
	if req.AssetGroupID != nil && (asset.AssetGroupID == nil || *asset.AssetGroupID != *req.AssetGroupID) {
		if *req.AssetGroupID != 0 {
			var assetGroup models.AssetGroup
			if err := db.Where("id = ?", *req.AssetGroupID).First(&assetGroup).Error; err != nil {
				return nil, errors.New("资产组不存在")
			}
			asset.AssetGroupID = req.AssetGroupID
		} else {
			asset.AssetGroupID = nil
		}
	}

	// 更新其他字段
	if req.Type != "" {
		asset.Type = req.Type
	}

	if req.IP != "" {
		asset.IP = req.IP
	}
	if req.Port != "" {
		asset.Port = req.Port
	}
	if req.Domain != "" {
		asset.Domain = req.Domain
	}
	if req.Description != "" {
		asset.Description = req.Description
	}
	if req.OS != "" {
		asset.OS = req.OS
	}
	if req.Status != "" {
		asset.Status = req.Status
	}
	if req.Importance != "" {
		asset.Importance = req.Importance
	}
	if req.Owner != "" {
		asset.Owner = req.Owner
	}
	if req.Department != "" {
		asset.Department = req.Department
	}
	if req.Environment != "" {
		asset.Environment = req.Environment
	}
	if req.Tags != "" {
		asset.Tags = req.Tags
	}

	if err := db.Save(&asset).Error; err != nil {
		return nil, errors.New("更新资产失败")
	}

	// 记录审计日志
	s.addAuditLog(asset.ID, "update", "", "", userID, "", "")

	// 重新查询资产信息
	db.Preload("Project").Preload("AssetGroup").Preload("Creator").Where("id = ?", asset.ID).First(&asset)

	return &asset, nil
}

// DeleteAsset 删除资产(软删除)
func (s *AssetService) DeleteAsset(assetID uint, userID uint, userRole string) error {
	db := Init.GetDB()

	// 权限检查：安全工程师不能删除资产
	if userRole == "security_engineer" {
		return errors.New("安全工程师无权删除资产")
	}

	var asset models.Asset
	if err := db.Where("id = ?", assetID).First(&asset).Error; err != nil {
		return errors.New("资产不存在")
	}

	// 检查是否有关联的漏洞
	var vulnCount int64
	db.Model(&models.Vulnerability{}).Where("asset_id = ?", assetID).Count(&vulnCount)
	if vulnCount > 0 {
		return errors.New("该资产下存在漏洞，无法删除")
	}

	// 记录项目ID用于后续更新统计
	projectID := asset.ProjectID

	if err := db.Delete(&asset).Error; err != nil {
		return errors.New("删除资产失败")
	}

	// 记录审计日志
	s.addAuditLog(assetID, "delete", "", "", userID, "", "")

	// 更新项目统计信息（如果资产属于某个项目）
	if projectID != 0 {
		projectService := &ProjectService{}
		if err := projectService.UpdateProjectStats(projectID); err != nil {
			// 统计更新失败不影响资产删除，只记录错误
			// 可以考虑添加日志记录
		}
	}

	return nil
}

// GetAssetList 获取资产列表
func (s *AssetService) GetAssetList(req *AssetListRequest) (*AssetListResponse, error) {
	db := Init.GetDB()

	// 设置默认值
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = 10
	}

	query := db.Model(&models.Asset{}).Preload("Project").Preload("AssetGroup").Preload("Creator")

	// 基于角色的权限控制
	// 如果是查询特定项目的资产，需要先检查用户是否有项目权限
	if req.ProjectID != nil {
		// 检查用户是否有项目权限（管理员、项目负责人和项目成员都可以查看）
		if req.CurrentUserRole != "super_admin" && req.CurrentUserRole != "admin" {
			hasAccess := false

			// 检查是否是项目负责人
			var project models.Project
			if err := db.Where("id = ? AND owner_id = ?", *req.ProjectID, req.CurrentUserID).First(&project).Error; err == nil {
				hasAccess = true
			}

			// 如果不是项目负责人，检查是否是项目成员
			if !hasAccess {
				var memberCount int64
				db.Model(&models.ProjectMember{}).Where("project_id = ? AND user_id = ?", *req.ProjectID, req.CurrentUserID).Count(&memberCount)
				if memberCount > 0 {
					hasAccess = true
				}
			}

			if !hasAccess {
				// 用户既不是项目负责人也不是项目成员，不能查看项目资产
				return &AssetListResponse{
					Assets:      []models.Asset{},
					Total:       0,
					Page:        req.Page,
					PageSize:    req.PageSize,
					CurrentPage: req.Page,
					TotalPages:  0,
				}, nil
			}
		}
		// 如果用户是项目负责人、项目成员或管理员，可以查看项目内所有资产，不添加额外的用户限制
	} else {
		// 查询全局资产列表时，应用原有的权限控制
		switch req.CurrentUserRole {
		case "security_engineer":
			// 安全工程师能看到自己创建的资产，以及自己负责的项目的资产
			query = query.Where("created_by = ? OR project_id IN (SELECT id FROM projects WHERE owner_id = ?) OR project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)", req.CurrentUserID, req.CurrentUserID, req.CurrentUserID)
		case "dev_engineer":
			// 研发工程师能看到自己参与项目的资产，以及自己负责的项目的资产
			query = query.Where("project_id IN (SELECT id FROM projects WHERE owner_id = ?) OR project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)", req.CurrentUserID, req.CurrentUserID)
		case "super_admin", "admin":
			// 超级管理员能看到所有资产，不添加额外限制
		default:
			// 其他角色不能查看资产列表
			return &AssetListResponse{
				Assets:      []models.Asset{},
				Total:       0,
				Page:        req.Page,
				PageSize:    req.PageSize,
				CurrentPage: req.Page,
				TotalPages:  0,
			}, nil
		}
	}

	// 添加过滤条件
	if req.Keyword != "" {
		// 支持关键词搜索，在名称、描述、URL、IP、域名中搜索
		query = query.Where("name LIKE ? OR description LIKE ? OR url LIKE ? OR ip LIKE ? OR domain LIKE ?",
			"%"+req.Keyword+"%", "%"+req.Keyword+"%", "%"+req.Keyword+"%", "%"+req.Keyword+"%", "%"+req.Keyword+"%")
	}
	if req.Name != "" {
		query = query.Where("name LIKE ?", "%"+req.Name+"%")
	}
	if req.Type != "" {
		query = query.Where("type = ?", req.Type)
	}
	if req.Category != "" {
		query = query.Where("category = ?", req.Category)
	}
	if req.Status != "" {
		query = query.Where("status = ?", req.Status)
	}
	if req.Importance != "" {
		query = query.Where("importance = ?", req.Importance)
	}
	if req.Owner != "" {
		query = query.Where("owner LIKE ?", "%"+req.Owner+"%")
	}
	if req.Department != "" {
		query = query.Where("department LIKE ?", "%"+req.Department+"%")
	}
	if req.ProjectID != nil {
		query = query.Where("project_id = ?", *req.ProjectID)
	}
	if req.AssetGroupID != nil {
		query = query.Where("asset_group_id = ?", *req.AssetGroupID)
	}

	// 获取总数
	var total int64
	query.Count(&total)

	// 分页查询
	var assets []models.Asset
	offset := (req.Page - 1) * req.PageSize
	if err := query.Offset(offset).Limit(req.PageSize).Order("created_at DESC").Find(&assets).Error; err != nil {
		return nil, errors.New("查询资产列表失败")
	}

	// 计算总页数
	totalPages := int((total + int64(req.PageSize) - 1) / int64(req.PageSize))

	return &AssetListResponse{
		Assets:      assets,
		Total:       total,
		Page:        req.Page,
		PageSize:    req.PageSize,
		CurrentPage: req.Page,
		TotalPages:  totalPages,
	}, nil
}

// GetAssetStats 获取资产统计信息
func (s *AssetService) GetAssetStats() (map[string]interface{}, error) {
	db := Init.GetDB()

	var totalAssets int64
	var activeAssets int64
	var inactiveAssets int64
	var maintenanceAssets int64

	db.Model(&models.Asset{}).Count(&totalAssets)
	db.Model(&models.Asset{}).Where("status = ?", "active").Count(&activeAssets)
	db.Model(&models.Asset{}).Where("status = ?", "inactive").Count(&inactiveAssets)
	db.Model(&models.Asset{}).Where("status = ?", "maintenance").Count(&maintenanceAssets)

	// 按类型统计
	var typeStats []struct {
		Type  string `json:"type"`
		Count int64  `json:"count"`
	}
	db.Model(&models.Asset{}).Select("type, COUNT(*) as count").Group("type").Scan(&typeStats)

	// 按重要性统计
	var importanceStats []struct {
		Importance string `json:"importance"`
		Count      int64  `json:"count"`
	}
	db.Model(&models.Asset{}).Select("importance, COUNT(*) as count").Group("importance").Scan(&importanceStats)

	return map[string]interface{}{
		"total_assets":       totalAssets,
		"active_assets":      activeAssets,
		"inactive_assets":    inactiveAssets,
		"maintenance_assets": maintenanceAssets,
		"type_stats":         typeStats,
		"importance_stats":   importanceStats,
	}, nil
}

// CreateAssetGroup 创建资产组
func (s *AssetService) CreateAssetGroup(name, description string, parentID *uint, createdBy uint) (*models.AssetGroup, error) {
	db := Init.GetDB()

	// 检查名称是否已存在
	var existGroup models.AssetGroup
	if err := db.Where("name = ?", name).First(&existGroup).Error; err == nil {
		return nil, errors.New("资产组名称已存在")
	}

	// 验证父级资产组是否存在(如果指定)
	level := 1
	if parentID != nil {
		var parentGroup models.AssetGroup
		if err := db.Where("id = ?", *parentID).First(&parentGroup).Error; err != nil {
			return nil, errors.New("父级资产组不存在")
		}
		level = parentGroup.Level + 1
	}

	assetGroup := models.AssetGroup{
		Name:        name,
		Description: description,
		ParentID:    parentID,
		Level:       level,
		Status:      1,
		CreatedBy:   createdBy,
	}

	if err := db.Create(&assetGroup).Error; err != nil {
		return nil, errors.New("创建资产组失败")
	}

	return &assetGroup, nil
}

// GetAssetGroups 获取资产组列表
func (s *AssetService) GetAssetGroups() ([]models.AssetGroup, error) {
	db := Init.GetDB()

	var groups []models.AssetGroup
	if err := db.Preload("Parent").Preload("Children").Preload("Creator").Order("level, sort, id").Find(&groups).Error; err != nil {
		return nil, errors.New("查询资产组失败")
	}

	return groups, nil
}

// addAuditLog 添加审计日志
func (s *AssetService) addAuditLog(assetID uint, action, before, after string, userID uint, ip, userAgent string) {
	db := Init.GetDB()

	log := models.AssetAuditLog{
		AssetID:   assetID,
		Action:    action,
		Before:    before,
		After:     after,
		UserID:    userID,
		IP:        ip,
		UserAgent: userAgent,
	}

	db.Create(&log)
}

func sanitizeExcelCellValue(value interface{}) interface{} {
	str, ok := value.(string)
	if !ok || str == "" {
		return value
	}

	switch str[0] {
	case '=', '+', '-', '@':
		return "'" + str
	default:
		return value
	}
}

// ExportAssetsToExcel 批量导出资产到Excel文件
func (s *AssetService) ExportAssetsToExcel(assetIDs []uint, projectID uint, userID uint, userRole string) ([]byte, error) {
	db := Init.GetDB()

	// 构建查询条件
	query := db.Model(&models.Asset{}).Preload("Project").Preload("Creator")

	// 如果指定了资产ID列表，则按ID过滤
	if len(assetIDs) > 0 {
		query = query.Where("id IN (?)", assetIDs)
	}

	// 如果指定了项目ID，则按项目过滤
	if projectID > 0 {
		query = query.Where("project_id = ?", projectID)
	}

	// 权限控制
	switch userRole {
	case "security_engineer":
		// 安全工程师只能导出自己创建的资产，或者自己负责的项目的资产
		query = query.Where("created_by = ? OR project_id IN (SELECT id FROM projects WHERE owner_id = ?) OR project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)", userID, userID, userID)
	case "dev_engineer":
		// 研发工程师只能导出自己参与项目的资产，或者自己负责的项目的资产
		query = query.Where("project_id IN (SELECT id FROM projects WHERE owner_id = ?) OR project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)", userID, userID)
	case "super_admin", "admin":
		// 超级管理员能导出所有资产，不添加额外限制
	default:
		return nil, errors.New("无权限导出资产")
	}

	// 查询资产
	var assets []models.Asset
	if err := query.Find(&assets).Error; err != nil {
		return nil, errors.New("查询资产失败")
	}

	if len(assets) == 0 {
		return nil, errors.New("没有找到要导出的资产")
	}

	// 创建Excel文件
	f := excelize.NewFile()
	defer f.Close()

	// 设置工作表名称
	sheetName := "资产列表"
	f.SetSheetName("Sheet1", sheetName)

	// 设置标题行
	headers := []string{
		"资产名称", "资产类型", "域名", "IP地址", "端口", "操作系统",
		"负责人", "环境", "部门", "重要性", "标签", "描述",
		"状态", "创建时间", "创建者",
	}

	// 写入标题行
	for i, header := range headers {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue(sheetName, cell, header)
	}

	// 设置标题行样式
	style, err := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Bold: true,
		},
		Fill: excelize.Fill{
			Type:    "pattern",
			Color:   []string{"#E6E6FA"},
			Pattern: 1,
		},
	})
	if err == nil {
		f.SetRowStyle(sheetName, 1, 1, style)
	}

	// 写入数据行
	for i, asset := range assets {
		row := i + 2 // 从第2行开始写入数据

		// 转换资产类型显示名称
		typeLabel := asset.Type
		switch asset.Type {
		case "server":
			typeLabel = "服务器"
		case "network_device":
			typeLabel = "网络设备"
		case "database":
			typeLabel = "数据库"
		case "storage_device":
			typeLabel = "存储设备"
		case "custom":
			typeLabel = "自定义类型"
		}

		// 转换环境显示名称
		envLabel := asset.Environment
		switch asset.Environment {
		case "production":
			envLabel = "生产环境"
		case "pre_production":
			envLabel = "准生产环境"
		case "staging":
			envLabel = "预发环境"
		case "testing":
			envLabel = "测试环境"
		case "development":
			envLabel = "开发环境"
		case "disaster_recovery":
			envLabel = "容灾环境"
		}

		// 转换重要性显示名称
		importanceLabel := asset.Importance
		switch asset.Importance {
		case "extremely_high":
			importanceLabel = "极高"
		case "high":
			importanceLabel = "高"
		case "medium":
			importanceLabel = "中"
		case "low":
			importanceLabel = "低"
		}

		// 转换状态显示名称
		statusLabel := asset.Status
		switch asset.Status {
		case "active":
			statusLabel = "活跃"
		case "inactive":
			statusLabel = "非活跃"
		case "maintenance":
			statusLabel = "维护中"
		}

		// 写入数据
		data := []interface{}{
			asset.Name,
			typeLabel,
			asset.Domain,
			asset.IP,
			asset.Port,
			asset.OS,
			asset.Owner,
			envLabel,
			asset.Department,
			importanceLabel,
			asset.Tags,
			asset.Description,
			statusLabel,
			asset.CreatedAt.Format("2006-01-02 15:04:05"),
			asset.Creator.RealName,
		}

		for j, value := range data {
			cell := fmt.Sprintf("%c%d", 'A'+j, row)
			f.SetCellValue(sheetName, cell, sanitizeExcelCellValue(value))
		}
	}

	// 自动调整列宽
	for i := range headers {
		col := fmt.Sprintf("%c", 'A'+i)
		f.SetColWidth(sheetName, col, col, 15)
	}

	// 生成Excel文件字节数组
	buffer, err := f.WriteToBuffer()
	if err != nil {
		return nil, errors.New("生成Excel文件失败")
	}

	return buffer.Bytes(), nil
}

// ImportAssetsFromExcel 从Excel文件批量导入资产
func (s *AssetService) ImportAssetsFromExcel(file *multipart.FileHeader, projectID uint, userID uint) (*AssetImportResult, error) {
	db := Init.GetDB()

	// 验证项目是否存在且未过期
	var project models.Project
	if err := db.Where("id = ?", projectID).First(&project).Error; err != nil {
		return nil, errors.New("项目不存在")
	}

	// 检查项目是否过期
	if project.EndDate != nil && time.Now().After(*project.EndDate) {
		return nil, errors.New("项目已过期，无法导入资产")
	}

	// 打开上传的文件
	src, err := file.Open()
	if err != nil {
		return nil, errors.New("无法打开上传的文件")
	}
	defer src.Close()

	// 直接从文件流打开Excel文件
	f, err := excelize.OpenReader(src)
	if err != nil {
		return nil, errors.New("无法解析Excel文件，请确保文件格式正确")
	}
	defer f.Close()

	// 获取第一个工作表
	sheetName := f.GetSheetName(0)
	if sheetName == "" {
		return nil, errors.New("Excel文件中没有找到工作表")
	}

	// 读取所有行
	rows, err := f.GetRows(sheetName)
	if err != nil {
		return nil, errors.New("读取Excel数据失败")
	}

	if len(rows) < 2 {
		return nil, errors.New("Excel文件中没有数据行（除标题行外）")
	}

	result := &AssetImportResult{
		SuccessCount: 0,
		FailureCount: 0,
		Errors:       []string{},
		Assets:       []models.Asset{},
	}

	// 跳过标题行，从第二行开始处理数据
	for i, row := range rows[1:] {
		rowNum := i + 2 // 实际行号（从2开始）

		// 检查行是否有足够的列
		if len(row) < 6 { // 至少需要6列：名称、类型、IP、端口、重要性、环境
			result.FailureCount++
			result.Errors = append(result.Errors, fmt.Sprintf("第%d行：数据列数不足", rowNum))
			continue
		}

		// 解析行数据
		assetName := strings.TrimSpace(row[0])
		assetType := strings.TrimSpace(row[1])
		domain := strings.TrimSpace(row[2])
		ip := strings.TrimSpace(row[3])
		port := strings.TrimSpace(row[4])
		os := strings.TrimSpace(row[5])
		owner := ""
		environment := ""
		department := ""
		importance := ""
		tags := ""
		description := ""

		// 安全地获取可选列
		if len(row) > 6 {
			owner = strings.TrimSpace(row[6])
		}
		if len(row) > 7 {
			environment = strings.TrimSpace(row[7])
		}
		if len(row) > 8 {
			department = strings.TrimSpace(row[8])
		}
		if len(row) > 9 {
			importance = strings.TrimSpace(row[9])
		}
		if len(row) > 10 {
			tags = strings.TrimSpace(row[10])
		}
		if len(row) > 11 {
			description = strings.TrimSpace(row[11])
		}

		// 验证必填字段
		if assetName == "" {
			result.FailureCount++
			result.Errors = append(result.Errors, fmt.Sprintf("第%d行：资产名称不能为空", rowNum))
			continue
		}

		if assetType == "" {
			result.FailureCount++
			result.Errors = append(result.Errors, fmt.Sprintf("第%d行：资产类型不能为空", rowNum))
			continue
		}

		if ip == "" {
			result.FailureCount++
			result.Errors = append(result.Errors, fmt.Sprintf("第%d行：IP地址不能为空", rowNum))
			continue
		}

		if port == "" {
			result.FailureCount++
			result.Errors = append(result.Errors, fmt.Sprintf("第%d行：端口不能为空", rowNum))
			continue
		}

		// 验证资产类型
		validTypes := []string{"server", "network_device", "database", "storage_device", "custom"}
		if !contains(validTypes, assetType) {
			result.FailureCount++
			result.Errors = append(result.Errors, fmt.Sprintf("第%d行：无效的资产类型 '%s'，有效值：%s", rowNum, assetType, strings.Join(validTypes, ", ")))
			continue
		}

		// 验证环境类型（如果提供）
		if environment != "" {
			validEnvs := []string{"production", "pre_production", "staging", "testing", "development", "disaster_recovery"}
			if !contains(validEnvs, environment) {
				result.FailureCount++
				result.Errors = append(result.Errors, fmt.Sprintf("第%d行：无效的环境类型 '%s'，有效值：%s", rowNum, environment, strings.Join(validEnvs, ", ")))
				continue
			}
		}

		// 验证重要性级别（如果提供）
		if importance != "" {
			validImportance := []string{"extremely_high", "high", "medium", "low"}
			if !contains(validImportance, importance) {
				result.FailureCount++
				result.Errors = append(result.Errors, fmt.Sprintf("第%d行：无效的重要性级别 '%s'，有效值：%s", rowNum, importance, strings.Join(validImportance, ", ")))
				continue
			}
		} else {
			importance = "medium" // 默认中等重要性
		}

		// 检查资产名称是否已存在
		var existAsset models.Asset
		if err := db.Where("name = ? AND project_id = ?", assetName, projectID).First(&existAsset).Error; err == nil {
			result.FailureCount++
			result.Errors = append(result.Errors, fmt.Sprintf("第%d行：资产名称 '%s' 在该项目中已存在", rowNum, assetName))
			continue
		}

		// 创建资产对象
		asset := models.Asset{
			Name:        assetName,
			Type:        assetType,
			Domain:      domain,
			IP:          ip,
			Port:        port,
			OS:          os,
			Owner:       owner,
			Environment: environment,
			Department:  department,
			Importance:  importance,
			ProjectID:   projectID,
			CreatedBy:   userID,
			Tags:        tags,
			Description: description,
			Status:      "active", // 默认状态为活跃
		}

		// 保存资产到数据库
		if err := db.Create(&asset).Error; err != nil {
			result.FailureCount++
			result.Errors = append(result.Errors, fmt.Sprintf("第%d行：保存资产失败 - %s", rowNum, err.Error()))
			continue
		}

		// 记录审计日志
		s.addAuditLog(asset.ID, "import", "", "", userID, "", "")

		// 重新查询资产信息，包含关联数据
		db.Preload("Project").Preload("AssetGroup").Preload("Creator").Where("id = ?", asset.ID).First(&asset)

		result.SuccessCount++
		result.Assets = append(result.Assets, asset)
	}

	// 更新项目统计信息
	if result.SuccessCount > 0 {
		projectService := &ProjectService{}
		if err := projectService.UpdateProjectStats(projectID); err != nil {
			// 统计更新失败不影响导入结果，只记录错误
		}
	}

	return result, nil
}

// contains 检查字符串切片是否包含指定字符串
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// GenerateAssetImportTemplate 生成资产导入Excel模板
func (s *AssetService) GenerateAssetImportTemplate() ([]byte, error) {
	// 创建Excel文件
	f := excelize.NewFile()
	defer f.Close()

	// 设置工作表名称
	sheetName := "资产导入模板"
	f.SetSheetName("Sheet1", sheetName)

	// 设置标题行
	headers := []string{
		"资产名称*", "资产类型*", "域名", "IP地址*", "端口*", "操作系统",
		"负责人", "环境", "部门", "重要性", "标签", "描述",
	}

	// 写入标题行
	for i, header := range headers {
		cell := fmt.Sprintf("%c1", 'A'+i)
		f.SetCellValue(sheetName, cell, header)
	}

	// 设置标题行样式
	style, err := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Bold: true,
		},
		Fill: excelize.Fill{
			Type:    "pattern",
			Color:   []string{"#4472C4"},
			Pattern: 1,
		},
		Alignment: &excelize.Alignment{
			Horizontal: "center",
			Vertical:   "center",
		},
	})
	if err == nil {
		f.SetRowStyle(sheetName, 1, 1, style)
	}

	// 添加示例数据
	exampleData := [][]interface{}{
		{"Web服务器01", "server", "https://example.com", "192.168.1.100", "80,443", "CentOS 7", "张三", "production", "技术部", "high", "web,服务器", "主要的Web服务器"},
		{"数据库服务器", "database", "", "192.168.1.101", "3306", "Ubuntu 20.04", "李四", "production", "技术部", "extremely_high", "数据库,MySQL", "核心业务数据库"},
		{"测试服务器", "server", "", "192.168.1.102", "22,8080", "Windows Server 2019", "王五", "testing", "测试部", "medium", "测试", "用于功能测试的服务器"},
	}

	// 写入示例数据
	for i, row := range exampleData {
		rowNum := i + 2
		for j, value := range row {
			cell := fmt.Sprintf("%c%d", 'A'+j, rowNum)
			f.SetCellValue(sheetName, cell, value)
		}
	}

	// 设置列宽
	columnWidths := []float64{15, 12, 20, 15, 10, 15, 10, 12, 10, 10, 15, 25}
	for i, width := range columnWidths {
		col := fmt.Sprintf("%c", 'A'+i)
		f.SetColWidth(sheetName, col, col, width)
	}

	// 添加说明工作表
	instructionSheet := "导入说明"
	f.NewSheet(instructionSheet)

	// 说明内容
	instructions := [][]interface{}{
		{"资产批量导入说明"},
		{""},
		{"1. 必填字段（标记*的列）："},
		{"   - 资产名称：不能为空，在同一项目中不能重复"},
		{"   - 资产类型：必须是以下值之一："},
		{"     * server（服务器）"},
		{"     * network_device（网络设备）"},
		{"     * database（数据库）"},
		{"     * storage_device（存储设备）"},
		{"     * custom（自定义类型）"},
		{"   - IP地址：不能为空"},
		{"   - 端口：不能为空，多个端口用逗号分隔"},
		{""},
		{"2. 可选字段："},
		{"   - 域名：如果填写，必须包含http://或https://"},
		{"   - 操作系统：如CentOS、Windows、Ubuntu等"},
		{"   - 负责人：资产负责人姓名"},
		{"   - 环境：必须是以下值之一（如果填写）："},
		{"     * production（生产环境）"},
		{"     * pre_production（准生产环境）"},
		{"     * staging（预发环境）"},
		{"     * testing（测试环境）"},
		{"     * development（开发环境）"},
		{"     * disaster_recovery（容灾环境）"},
		{"   - 部门：资产所属部门"},
		{"   - 重要性：必须是以下值之一（如果填写，默认为medium）："},
		{"     * extremely_high（极高）"},
		{"     * high（高）"},
		{"     * medium（中）"},
		{"     * low（低）"},
		{"   - 标签：多个标签用逗号分隔"},
		{"   - 描述：资产的详细描述"},
		{""},
		{"3. 注意事项："},
		{"   - 请不要修改标题行"},
		{"   - 导入时会跳过空行"},
		{"   - 如果资产名称已存在，该行会导入失败"},
		{"   - 建议先下载模板，在模板基础上填写数据"},
	}

	// 写入说明内容
	for i, row := range instructions {
		rowNum := i + 1
		if len(row) > 0 {
			f.SetCellValue(instructionSheet, fmt.Sprintf("A%d", rowNum), row[0])
		}
	}

	// 设置说明工作表的标题样式
	titleStyle, err := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Bold: true,
			Size: 14,
		},
		Fill: excelize.Fill{
			Type:    "pattern",
			Color:   []string{"#D9E1F2"},
			Pattern: 1,
		},
	})
	if err == nil {
		f.SetCellStyle(instructionSheet, "A1", "A1", titleStyle)
	}

	// 设置说明工作表列宽
	f.SetColWidth(instructionSheet, "A", "A", 50)

	// 生成Excel文件字节数组
	buffer, err := f.WriteToBuffer()
	if err != nil {
		return nil, errors.New("生成Excel模板失败")
	}

	return buffer.Bytes(), nil
}
