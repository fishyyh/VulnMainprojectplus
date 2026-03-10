// 项目管理服务包
// 该包提供项目管理相关的业务逻辑服务，包括项目创建、编辑、删除、成员管理等
package services

import (
	"errors"
	"fmt"
	"time"
	Init "vulnmain/Init"
	"vulnmain/models"
)

// ProjectService项目服务结构体
type ProjectService struct{}

// parseDate解析日期字符串为*time.Time
func parseDate(dateStr string) (*time.Time, error) {
	if dateStr == "" {
		return nil, nil
	}

	parsedTime, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return nil, fmt.Errorf("日期格式错误: %v", err)
	}

	// 确保时间精确到秒（移除纳秒部分）
	parsedTime = parsedTime.Truncate(time.Second)

	return &parsedTime, nil
}

// 项目请求和响应结构体

// CreateProjectRequest创建项目请求结构体
type CreateProjectRequest struct {
	Name        string `json:"name" binding:"required"`     // 项目名称，必填
	Type        string `json:"type" binding:"required"`     // 项目类型，必填
	Priority    string `json:"priority" binding:"required"` // 优先级，必填
	Description string `json:"description"`                 // 项目描述
	OwnerID     uint   `json:"owner_id" binding:"required"` // 项目负责人ID，必填
	StartDate   string `json:"start_date"`                  // 项目开始日期（字符串格式："2006-01-02"）
	EndDate     string `json:"end_date"`                    // 项目结束日期（字符串格式："2006-01-02"）
	IsPublic    bool   `json:"is_public"`                   // 是否公开
	MemberIDs   []uint `json:"member_ids"`                  // 项目成员ID列表
}

// UpdateProjectRequest更新项目请求结构体
type UpdateProjectRequest struct {
	Name        string `json:"name"`        // 项目名称
	Type        string `json:"type"`        // 项目类型
	Priority    string `json:"priority"`    // 优先级
	Description string `json:"description"` // 项目描述
	OwnerID     uint   `json:"owner_id"`    // 项目负责人ID
	StartDate   string `json:"start_date"`  // 项目开始日期（字符串格式："2006-01-02"）
	EndDate     string `json:"end_date"`    // 项目结束日期（字符串格式："2006-01-02"）
	IsPublic    bool   `json:"is_public"`   // 是否公开
	Status      string `json:"status"`      // 项目状态
	MemberIDs   []uint `json:"member_ids"`  // 项目成员ID列表
}

// ProjectListRequest项目列表查询请求结构体
type ProjectListRequest struct {
	Page     int    `json:"page" form:"page"`           // 页码
	PageSize int    `json:"page_size" form:"page_size"` // 每页数量
	Keyword  string `json:"keyword" form:"keyword"`     // 搜索关键词
	Type     string `json:"type" form:"type"`           // 项目类型过滤
	Status   string `json:"status" form:"status"`       // 项目状态过滤
	UserID   uint   `json:"user_id"`                    // 用户ID（用于权限过滤）
	RoleCode string `json:"role_code"`                  // 用户角色代码
}

// ProjectResponse项目响应结构体
type ProjectResponse struct {
	*models.Project
	CanSubmitVulns bool                 `json:"can_submit_vulns"` // 是否可以提交漏洞
	MemberCount    int                  `json:"member_count"`     // 成员数量
	AssetCount     int                  `json:"asset_count"`      // 资产数量
	VulnCount      int                  `json:"vuln_count"`       // 漏洞数量
	Stats          *models.ProjectStats `json:"stats,omitempty"`  // 项目统计信息
}

// ProjectListResponse项目列表响应结构体
type ProjectListResponse struct {
	Projects []*ProjectResponse `json:"projects"`  // 项目列表
	Total    int64              `json:"total"`     // 总数
	Page     int                `json:"page"`      // 当前页码
	PageSize int                `json:"page_size"` // 每页数量
}

// CreateProject创建项目
func (s *ProjectService) CreateProject(req *CreateProjectRequest, creatorID uint) (*ProjectResponse, error) {
	db := Init.GetDB()

	// 验证项目负责人是否存在
	var owner models.User
	if err := db.First(&owner, req.OwnerID).Error; err != nil {
		return nil, errors.New("项目负责人不存在")
	}

	// 解析日期
	startDate, err := parseDate(req.StartDate)
	if err != nil {
		return nil, err
	}

	endDate, err := parseDate(req.EndDate)
	if err != nil {
		return nil, err
	}

	// 创建项目
	project := &models.Project{
		Name:        req.Name,
		Type:        req.Type,
		Priority:    req.Priority,
		Description: req.Description,
		OwnerID:     req.OwnerID,
		StartDate:   startDate,
		EndDate:     endDate,
		IsPublic:    req.IsPublic,
		Status:      "active",
		CreatedBy:   creatorID,
	}

	// 开始事务
	tx := db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 保存项目
	if err := tx.Create(project).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("创建项目失败: %v", err)
	}

	// 添加项目成员
	if len(req.MemberIDs) > 0 {
		for _, memberID := range req.MemberIDs {
			// 验证成员是否存在
			var member models.User
			if err := tx.First(&member, memberID).Error; err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("成员ID %d 不存在", memberID)
			}

			// 根据用户角色确定项目中的角色
			memberRole := "dev_engineer" // 默认为研发工程师
			if member.Role.Code == "security_engineer" {
				memberRole = "security_engineer"
			}

			projectMember := &models.ProjectMember{
				ProjectID: project.ID,
				UserID:    memberID,
				Role:      memberRole,
				JoinedAt:  time.Now().Truncate(time.Second),
			}

			if err := tx.Create(projectMember).Error; err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("添加项目成员失败: %v", err)
			}
		}
	}

	// 创建项目统计记录
	stats := &models.ProjectStats{
		ProjectID:   project.ID,
		LastUpdated: time.Now().Truncate(time.Second),
	}
	if err := tx.Create(stats).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("创建项目统计失败: %v", err)
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("提交事务失败: %v", err)
	}

	// 发送邮件通知给项目成员
	go func() {
		// 获取项目成员邮箱列表
		var memberEmails []string
		var memberNames []string

		for _, memberID := range req.MemberIDs {
			var member models.User
			if err := db.First(&member, memberID).Error; err == nil && member.Email != "" {
				memberEmails = append(memberEmails, member.Email)
				if member.RealName != "" {
					memberNames = append(memberNames, member.RealName)
				} else {
					memberNames = append(memberNames, member.Username)
				}
			}
		}

		// 发送项目创建通知
		if len(memberEmails) > 0 {
			ownerName := owner.RealName
			if ownerName == "" {
				ownerName = owner.Username
			}

			if err := SendProjectCreatedNotification(req.Name, ownerName, memberEmails); err != nil {
				// 记录邮件发送失败的日志，但不影响项目创建
				fmt.Printf("发送项目创建通知邮件失败: %v\n", err)
			}
		}
	}()

	// 返回项目信息
	return s.GetProject(project.ID, creatorID, "super_admin")
}

// GetProject获取项目详情
func (s *ProjectService) GetProject(projectID, userID uint, roleCode string) (*ProjectResponse, error) {
	db := Init.GetDB()

	var project models.Project
	query := db.Preload("Owner").Preload("Members").Preload("Members.User").Preload("Creator")

	// 如果不是超级管理员，需要检查权限
	if roleCode != "super_admin" && roleCode != "admin" && roleCode != "security_engineer" {
		query = query.Where("id = ? AND (is_public = ? OR owner_id = ? OR id IN (SELECT project_id FROM project_members WHERE user_id = ?))",
			projectID, true, userID, userID)
	}

	if err := query.First(&project, projectID).Error; err != nil {
		return nil, errors.New("项目不存在或无权限访问")
	}

	// 手动查询项目资产（基于权限控制）
	var assets []models.Asset
	assetQuery := db.Preload("Project").Preload("AssetGroup").Preload("Creator").Where("project_id = ?", projectID)

	// 如果不是超级管理员，需要检查用户是否有项目权限
	if roleCode != "super_admin" && roleCode != "admin" && roleCode != "security_engineer" {
		hasAccess := false

		// 检查是否是项目负责人
		if project.OwnerID == userID {
			hasAccess = true
		}

		// 如果不是项目负责人，检查是否是项目成员
		if !hasAccess {
			var memberCount int64
			db.Model(&models.ProjectMember{}).Where("project_id = ? AND user_id = ?", projectID, userID).Count(&memberCount)
			if memberCount > 0 {
				hasAccess = true
			}
		}

		if hasAccess {
			// 用户是项目负责人或项目成员，可以查看项目内所有资产
			assetQuery.Find(&assets)
		} else {
			// 用户既不是项目负责人也不是项目成员，不能查看项目资产
			assets = []models.Asset{}
		}
	} else {
		// 超级管理员可以查看所有资产
		assetQuery.Find(&assets)
	}

	// 将资产赋值给项目
	project.Assets = assets

	// 手动查询项目漏洞（基于权限控制）
	var vulns []models.Vulnerability
	vulnQuery := db.Preload("Asset").Preload("Project").Preload("Reporter").Preload("Assignee").Where("project_id = ?", projectID)

	// 应用相同的权限控制逻辑
	if roleCode != "super_admin" && roleCode != "admin" && roleCode != "security_engineer" {
		hasAccess := false

		// 检查是否是项目负责人
		if project.OwnerID == userID {
			hasAccess = true
		}

		// 如果不是项目负责人，检查是否是项目成员
		if !hasAccess {
			var memberCount int64
			db.Model(&models.ProjectMember{}).Where("project_id = ? AND user_id = ?", projectID, userID).Count(&memberCount)
			if memberCount > 0 {
				hasAccess = true
			}
		}

		if hasAccess {
			// 用户是项目负责人或项目成员，可以查看项目内所有漏洞
			vulnQuery.Find(&vulns)
		} else {
			// 用户既不是项目负责人也不是项目成员，不能查看项目漏洞
			vulns = []models.Vulnerability{}
		}
	} else {
		// 超级管理员可以查看所有漏洞
		vulnQuery.Find(&vulns)
	}

	// 将漏洞赋值给项目
	project.Vulns = vulns

	// 获取项目统计信息
	var stats models.ProjectStats
	db.Where("project_id = ?", projectID).First(&stats)

	// 构建响应
	response := &ProjectResponse{
		Project:        &project,
		CanSubmitVulns: project.CanSubmitVulns(),
		MemberCount:    len(project.Members),
		AssetCount:     stats.TotalAssets,
		VulnCount:      stats.TotalVulns,
		Stats:          &stats,
	}

	return response, nil
}

// GetProjectList获取项目列表
func (s *ProjectService) GetProjectList(req *ProjectListRequest) (*ProjectListResponse, error) {
	db := Init.GetDB()

	// 设置默认分页参数
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = 10
	}

	query := db.Model(&models.Project{}).Preload("Owner").Preload("Creator").Preload("Members").Preload("Members.User")

	// 如果不是超级管理员，需要过滤项目
	if req.RoleCode != "super_admin" && req.RoleCode != "admin" && req.RoleCode != "security_engineer" {
		query = query.Where("is_public = ? OR owner_id = ? OR id IN (SELECT project_id FROM project_members WHERE user_id = ?)",
			true, req.UserID, req.UserID)
	}

	// 关键词搜索
	if req.Keyword != "" {
		query = query.Where("name LIKE ? OR description LIKE ?", "%"+req.Keyword+"%", "%"+req.Keyword+"%")
	}

	// 类型过滤
	if req.Type != "" {
		query = query.Where("type = ?", req.Type)
	}

	// 状态过滤
	if req.Status != "" {
		query = query.Where("status = ?", req.Status)
	}

	// 获取总数
	var total int64
	query.Count(&total)

	// 分页查询
	var projects []models.Project
	offset := (req.Page - 1) * req.PageSize
	if err := query.Offset(offset).Limit(req.PageSize).Order("created_at DESC").Find(&projects).Error; err != nil {
		return nil, fmt.Errorf("查询项目列表失败: %v", err)
	}

	// 构建响应列表
	var responses []*ProjectResponse
	for _, project := range projects {
		// 获取项目统计信息
		var stats models.ProjectStats
		db.Where("project_id = ?", project.ID).First(&stats)

		response := &ProjectResponse{
			Project:        &project,
			CanSubmitVulns: project.CanSubmitVulns(),
			MemberCount:    0, // 这里可以优化为批量查询
			AssetCount:     stats.TotalAssets,
			VulnCount:      stats.TotalVulns,
			Stats:          &stats,
		}

		// 获取成员数量
		var memberCount int64
		db.Model(&models.ProjectMember{}).Where("project_id = ?", project.ID).Count(&memberCount)
		response.MemberCount = int(memberCount)

		responses = append(responses, response)
	}

	return &ProjectListResponse{
		Projects: responses,
		Total:    total,
		Page:     req.Page,
		PageSize: req.PageSize,
	}, nil
}

// UpdateProject更新项目
func (s *ProjectService) UpdateProject(projectID uint, req *UpdateProjectRequest, userID uint, roleCode string) (*ProjectResponse, error) {
	db := Init.GetDB()

	// 检查项目是否存在和权限
	var project models.Project
	query := db.Preload("Members")
	if roleCode != "super_admin" && roleCode != "admin" && roleCode != "security_engineer" {
		query = query.Where("id = ? AND (owner_id = ? OR created_by = ?)", projectID, userID, userID)
	}

	if err := query.First(&project, projectID).Error; err != nil {
		return nil, errors.New("项目不存在或无权限修改")
	}

	// 开始事务
	tx := db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 更新项目信息
	updates := make(map[string]interface{})
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Type != "" {
		updates["type"] = req.Type
	}
	if req.Priority != "" {
		updates["priority"] = req.Priority
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.OwnerID != 0 {
		// 验证新负责人是否存在
		var owner models.User
		if err := tx.First(&owner, req.OwnerID).Error; err != nil {
			tx.Rollback()
			return nil, errors.New("项目负责人不存在")
		}
		updates["owner_id"] = req.OwnerID
	}
	if req.StartDate != "" {
		startDate, err := parseDate(req.StartDate)
		if err != nil {
			tx.Rollback()
			return nil, err
		}
		updates["start_date"] = startDate
	}
	if req.EndDate != "" {
		endDate, err := parseDate(req.EndDate)
		if err != nil {
			tx.Rollback()
			return nil, err
		}
		updates["end_date"] = endDate
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}
	updates["is_public"] = req.IsPublic

	if err := tx.Model(&project).Updates(updates).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("更新项目失败: %v", err)
	}

	// 更新项目成员
	var newMemberIDs []uint // 存储新增的成员ID
	if req.MemberIDs != nil {
		// 获取现有成员ID列表
		var existingMemberIDs []uint
		for _, member := range project.Members {
			existingMemberIDs = append(existingMemberIDs, member.UserID)
		}

		// 找出新增的成员
		for _, memberID := range req.MemberIDs {
			isExisting := false
			for _, existingID := range existingMemberIDs {
				if memberID == existingID {
					isExisting = true
					break
				}
			}
			if !isExisting {
				newMemberIDs = append(newMemberIDs, memberID)
			}
		}

		// 删除现有成员
		if err := tx.Where("project_id = ?", projectID).Delete(&models.ProjectMember{}).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("删除现有成员失败: %v", err)
		}

		// 添加新成员
		for _, memberID := range req.MemberIDs {
			// 验证成员是否存在
			var member models.User
			if err := tx.Preload("Role").First(&member, memberID).Error; err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("成员ID %d 不存在", memberID)
			}

			// 根据用户角色确定项目中的角色
			memberRole := "dev_engineer"
			if member.Role.Code == "security_engineer" {
				memberRole = "security_engineer"
			}

			projectMember := &models.ProjectMember{
				ProjectID: projectID,
				UserID:    memberID,
				Role:      memberRole,
				JoinedAt:  time.Now().Truncate(time.Second),
			}

			if err := tx.Create(projectMember).Error; err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("添加项目成员失败: %v", err)
			}
		}
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("提交事务失败: %v", err)
	}

	// 发送邮件通知给新增的项目成员
	if len(newMemberIDs) > 0 {
		go func() {
			// 获取项目信息
			var updatedProject models.Project
			if err := db.Preload("Owner").First(&updatedProject, projectID).Error; err != nil {
				fmt.Printf("获取项目信息失败，无法发送邮件通知: %v\n", err)
				return
			}

			// 获取新增成员的邮箱列表
			var newMemberEmails []string
			var newMemberNames []string

			for _, memberID := range newMemberIDs {
				var member models.User
				if err := db.First(&member, memberID).Error; err == nil && member.Email != "" {
					newMemberEmails = append(newMemberEmails, member.Email)
					if member.RealName != "" {
						newMemberNames = append(newMemberNames, member.RealName)
					} else {
						newMemberNames = append(newMemberNames, member.Username)
					}
				}
			}

			// 发送项目成员新增通知
			if len(newMemberEmails) > 0 {
				ownerName := updatedProject.Owner.RealName
				if ownerName == "" {
					ownerName = updatedProject.Owner.Username
				}

				// 使用项目新增成员通知模板
				if err := SendProjectMemberAddedNotification(updatedProject.Name, ownerName, newMemberEmails); err != nil {
					// 记录邮件发送失败的日志，但不影响项目更新
					fmt.Printf("发送项目成员新增通知邮件失败: %v\n", err)
				}
			}
		}()
	}

	// 返回更新后的项目信息
	return s.GetProject(projectID, userID, roleCode)
}

// DeleteProject删除项目
func (s *ProjectService) DeleteProject(projectID, userID uint, roleCode string) error {
	db := Init.GetDB()

	// 检查项目是否存在和权限（只有超级管理员可以删除项目）
	if roleCode != "super_admin" && roleCode != "admin" && roleCode != "security_engineer" {
		return errors.New("只有超级管理员可以删除项目")
	}

	var project models.Project
	if err := db.First(&project, projectID).Error; err != nil {
		return errors.New("项目不存在")
	}

	// 检查项目下是否还有漏洞（未完成的漏洞不允许删除项目）
	var vulnCount int64
	db.Model(&models.Vulnerability{}).Where("project_id = ? AND status NOT IN (?)", projectID, []string{"completed", "ignored"}).Count(&vulnCount)
	if vulnCount > 0 {
		return errors.New("项目下还有未完成的漏洞，无法删除")
	}

	// 开始事务
	tx := db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 删除项目成员
	if err := tx.Where("project_id = ?", projectID).Delete(&models.ProjectMember{}).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("删除项目成员失败: %v", err)
	}

	// 删除项目统计
	if err := tx.Where("project_id = ?", projectID).Delete(&models.ProjectStats{}).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("删除项目统计失败: %v", err)
	}

	// 软删除项目
	if err := tx.Delete(&project).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("删除项目失败: %v", err)
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("提交事务失败: %v", err)
	}

	return nil
}

// GetProjectMembers获取项目成员列表
func (s *ProjectService) GetProjectMembers(projectID, userID uint, roleCode string) ([]models.ProjectMember, error) {
	db := Init.GetDB()

	// 检查项目权限
	var project models.Project
	query := db
	if roleCode != "super_admin" && roleCode != "admin" && roleCode != "security_engineer" {
		query = query.Where("id = ? AND (is_public = ? OR owner_id = ? OR id IN (SELECT project_id FROM project_members WHERE user_id = ?))",
			projectID, true, userID, userID)
	}

	if err := query.First(&project, projectID).Error; err != nil {
		return nil, errors.New("项目不存在或无权限访问")
	}

	// 获取项目成员
	var members []models.ProjectMember
	if err := db.Where("project_id = ?", projectID).Preload("User").Preload("User.Role").Find(&members).Error; err != nil {
		return nil, fmt.Errorf("获取项目成员失败: %v", err)
	}

	return members, nil
}

// GetUserProjects获取用户的项目列表
func (s *ProjectService) GetUserProjects(userID uint, roleCode string) ([]*ProjectResponse, error) {
	db := Init.GetDB()

	var projects []models.Project
	query := db.Preload("Owner").Preload("Creator").Preload("Members").Preload("Members.User")

	if roleCode == "super_admin" || roleCode == "admin" || roleCode == "security_engineer" {
		// 超级管理员可以看到所有项目
		query = query.Order("created_at DESC").Find(&projects)
	} else {
		// 其他角色只能看到自己相关的项目
		query = query.Where("is_public = ? OR owner_id = ? OR id IN (SELECT project_id FROM project_members WHERE user_id = ?)",
			true, userID, userID).Order("created_at DESC").Find(&projects)
	}

	if err := query.Error; err != nil {
		return nil, fmt.Errorf("获取用户项目列表失败: %v", err)
	}

	// 构建响应列表
	var responses []*ProjectResponse
	for _, project := range projects {
		// 获取项目统计信息
		var stats models.ProjectStats
		db.Where("project_id = ?", project.ID).First(&stats)

		response := &ProjectResponse{
			Project:        &project,
			CanSubmitVulns: project.CanSubmitVulns(),
			MemberCount:    0,
			AssetCount:     stats.TotalAssets,
			VulnCount:      stats.TotalVulns,
			Stats:          &stats,
		}

		// 获取成员数量
		var memberCount int64
		db.Model(&models.ProjectMember{}).Where("project_id = ?", project.ID).Count(&memberCount)
		response.MemberCount = int(memberCount)

		responses = append(responses, response)
	}

	return responses, nil
}

// UpdateProjectStats更新项目统计信息
func (s *ProjectService) UpdateProjectStats(projectID uint) error {
	db := Init.GetDB()

	// 统计资产数量
	var assetCount int64
	db.Model(&models.Asset{}).Where("project_id = ?", projectID).Count(&assetCount)

	// 统计漏洞数量和状态分布
	var totalVulns int64
	var unfixedVulns int64
	var fixingVulns int64
	var fixedVulns int64
	var retestingVulns int64
	var completedVulns int64
	var ignoredVulns int64

	db.Model(&models.Vulnerability{}).Where("project_id = ?", projectID).Count(&totalVulns)
	db.Model(&models.Vulnerability{}).Where("project_id = ? AND status = ?", projectID, "unfixed").Count(&unfixedVulns)
	db.Model(&models.Vulnerability{}).Where("project_id = ? AND status = ?", projectID, "fixing").Count(&fixingVulns)
	db.Model(&models.Vulnerability{}).Where("project_id = ? AND status = ?", projectID, "fixed").Count(&fixedVulns)
	db.Model(&models.Vulnerability{}).Where("project_id = ? AND status = ?", projectID, "retesting").Count(&retestingVulns)
	db.Model(&models.Vulnerability{}).Where("project_id = ? AND status = ?", projectID, "completed").Count(&completedVulns)
	db.Model(&models.Vulnerability{}).Where("project_id = ? AND status = ?", projectID, "ignored").Count(&ignoredVulns)

	// 统计漏洞严重程度分布
	var criticalVulns int64
	var highVulns int64
	var mediumVulns int64
	var lowVulns int64
	var infoVulns int64

	db.Model(&models.Vulnerability{}).Where("project_id = ? AND severity = ?", projectID, "critical").Count(&criticalVulns)
	db.Model(&models.Vulnerability{}).Where("project_id = ? AND severity = ?", projectID, "high").Count(&highVulns)
	db.Model(&models.Vulnerability{}).Where("project_id = ? AND severity = ?", projectID, "medium").Count(&mediumVulns)
	db.Model(&models.Vulnerability{}).Where("project_id = ? AND severity = ?", projectID, "low").Count(&lowVulns)
	db.Model(&models.Vulnerability{}).Where("project_id = ? AND severity = ?", projectID, "info").Count(&infoVulns)

	// 更新或创建统计记录
	stats := models.ProjectStats{
		ProjectID:      projectID,
		TotalAssets:    int(assetCount),
		TotalVulns:     int(totalVulns),
		UnfixedVulns:   int(unfixedVulns),
		FixingVulns:    int(fixingVulns),
		FixedVulns:     int(fixedVulns),
		RetestingVulns: int(retestingVulns),
		CompletedVulns: int(completedVulns),
		IgnoredVulns:   int(ignoredVulns),
		CriticalVulns:  int(criticalVulns),
		HighVulns:      int(highVulns),
		MediumVulns:    int(mediumVulns),
		LowVulns:       int(lowVulns),
		InfoVulns:      int(infoVulns),
		LastUpdated:    time.Now().Truncate(time.Second),
	}

	// 使用ON DUPLICATE KEY UPDATE或UPSERT逻辑
	var existingStats models.ProjectStats
	if err := db.Where("project_id = ?", projectID).First(&existingStats).Error; err != nil {
		// 记录不存在，创建新记录
		if err := db.Create(&stats).Error; err != nil {
			return fmt.Errorf("创建项目统计失败: %v", err)
		}
	} else {
		// 记录存在，更新现有记录
		if err := db.Model(&existingStats).Updates(&stats).Error; err != nil {
			return fmt.Errorf("更新项目统计失败: %v", err)
		}
	}

	return nil
}
