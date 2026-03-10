// 团队管理服务包
// 该包提供团队管理相关的业务逻辑服务，包括团队创建、编辑、删除、成员管理等
package services

import (
	"errors"
	"fmt"
	"time"
	Init "vulnmain/Init"
	"vulnmain/models"
)

// TeamService团队服务结构体
type TeamService struct{}

// 团队请求和响应结构体

// TeamCreateRequest创建团队请求结构体
type TeamCreateRequest struct {
	Name        string `json:"name" binding:"required"`      // 团队名称，必填
	Description string `json:"description"`                  // 团队描述
	LeaderID    uint   `json:"leader_id" binding:"required"` // 团队负责人ID，必填
	MemberIDs   []uint `json:"member_ids"`                   // 团队成员ID列表
}

// TeamUpdateRequest更新团队请求结构体
type TeamUpdateRequest struct {
	Name        string `json:"name"`        // 团队名称
	Description string `json:"description"` // 团队描述
	LeaderID    uint   `json:"leader_id"`   // 团队负责人ID
	MemberIDs   []uint `json:"member_ids"`  // 团队成员ID列表
}

// TeamListResponse团队列表响应结构体
type TeamListResponse struct {
	Teams    []models.Team `json:"teams"`     // 团队列表
	Total    int64         `json:"total"`     // 总数
	Page     int           `json:"page"`      // 当前页码
	PageSize int           `json:"page_size"` // 每页数量
}

// CreateTeam创建团队
func (s *TeamService) CreateTeam(req *TeamCreateRequest) (*models.Team, error) {
	db := Init.GetDB()

	// 验证团队负责人是否存在且角色合法
	var leader models.User
	if err := db.Preload("Role").First(&leader, req.LeaderID).Error; err != nil {
		return nil, errors.New("团队负责人不存在")
	}

	// 创建团队
	team := &models.Team{
		Name:        req.Name,
		Description: req.Description,
		LeaderID:    req.LeaderID,
		Status:      1,
	}

	// 开始事务
	tx := db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 保存团队
	if err := tx.Create(team).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("创建团队失败: %v", err)
	}

	// 确保负责人也在成员列表中
	memberIDSet := make(map[uint]bool)
	memberIDSet[req.LeaderID] = true
	for _, id := range req.MemberIDs {
		memberIDSet[id] = true
	}

	// 添加团队成员
	for memberID := range memberIDSet {
		// 验证成员是否存在
		var member models.User
		if memberID != req.LeaderID {
			if err := tx.First(&member, memberID).Error; err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("成员ID %d 不存在", memberID)
			}
		}

		teamMember := &models.TeamMember{
			TeamID:   team.ID,
			UserID:   memberID,
			JoinedAt: time.Now().Truncate(time.Second),
		}

		if err := tx.Create(teamMember).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("添加团队成员失败: %v", err)
		}
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("提交事务失败: %v", err)
	}

	// 重新查询团队信息（包含关联数据）
	var result models.Team
	if err := db.Preload("Leader").Preload("Members").Preload("Members.User").First(&result, team.ID).Error; err != nil {
		return nil, fmt.Errorf("查询团队信息失败: %v", err)
	}

	return &result, nil
}

// UpdateTeam更新团队
func (s *TeamService) UpdateTeam(teamID uint, req *TeamUpdateRequest) (*models.Team, error) {
	db := Init.GetDB()

	// 检查团队是否存在
	var team models.Team
	if err := db.Preload("Members").First(&team, teamID).Error; err != nil {
		return nil, errors.New("团队不存在")
	}

	// 开始事务
	tx := db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 更新团队信息
	updates := make(map[string]interface{})
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.LeaderID != 0 {
		// 验证新负责人是否存在且角色合法
		var leader models.User
		if err := tx.Preload("Role").First(&leader, req.LeaderID).Error; err != nil {
			tx.Rollback()
			return nil, errors.New("团队负责人不存在")
		}
		updates["leader_id"] = req.LeaderID
	}

	if len(updates) > 0 {
		if err := tx.Model(&team).Updates(updates).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("更新团队失败: %v", err)
		}
	}

	// 更新团队成员
	if req.MemberIDs != nil {
		// 确定实际的负责人ID
		leaderID := team.LeaderID
		if req.LeaderID != 0 {
			leaderID = req.LeaderID
		}

		// 确保负责人在成员列表中
		memberIDSet := make(map[uint]bool)
		memberIDSet[leaderID] = true
		for _, id := range req.MemberIDs {
			memberIDSet[id] = true
		}

		// 删除现有成员
		if err := tx.Where("team_id = ?", teamID).Delete(&models.TeamMember{}).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("删除现有成员失败: %v", err)
		}

		// 添加新成员
		for memberID := range memberIDSet {
			// 验证成员是否存在
			var member models.User
			if err := tx.First(&member, memberID).Error; err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("成员ID %d 不存在", memberID)
			}

			teamMember := &models.TeamMember{
				TeamID:   teamID,
				UserID:   memberID,
				JoinedAt: time.Now().Truncate(time.Second),
			}

			if err := tx.Create(teamMember).Error; err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("添加团队成员失败: %v", err)
			}
		}
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("提交事务失败: %v", err)
	}

	// 重新查询团队信息（包含关联数据）
	var result models.Team
	if err := db.Preload("Leader").Preload("Members").Preload("Members.User").First(&result, teamID).Error; err != nil {
		return nil, fmt.Errorf("查询团队信息失败: %v", err)
	}

	return &result, nil
}

// DeleteTeam删除团队(软删除)
func (s *TeamService) DeleteTeam(teamID uint) error {
	db := Init.GetDB()

	var team models.Team
	if err := db.First(&team, teamID).Error; err != nil {
		return errors.New("团队不存在")
	}

	// 开始事务
	tx := db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 删除团队成员
	if err := tx.Where("team_id = ?", teamID).Delete(&models.TeamMember{}).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("删除团队成员失败: %v", err)
	}

	// 软删除团队
	if err := tx.Delete(&team).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("删除团队失败: %v", err)
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("提交事务失败: %v", err)
	}

	return nil
}

// GetTeamList获取团队列表
func (s *TeamService) GetTeamList(userID uint, roleCode string, page, pageSize int, keyword string) (*TeamListResponse, error) {
	db := Init.GetDB()

	// 设置默认分页参数
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 10
	}

	query := db.Model(&models.Team{}).Preload("Leader").Preload("Members").Preload("Members.User")

	// 如果不是超级管理员/管理员，只能看到自己所在的团队
	if roleCode != "super_admin" && roleCode != "admin" && roleCode != "security_engineer" {
		query = query.Where("leader_id = ? OR id IN (SELECT team_id FROM team_members WHERE user_id = ?)",
			userID, userID)
	}

	// 关键词搜索
	if keyword != "" {
		query = query.Where("name LIKE ?", "%"+keyword+"%")
	}

	// 获取总数
	var total int64
	query.Count(&total)

	// 分页查询
	var teams []models.Team
	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&teams).Error; err != nil {
		return nil, fmt.Errorf("查询团队列表失败: %v", err)
	}

	// 填充每个团队的未关闭漏洞数量（排除已关闭和已完成的漏洞）
	for i := range teams {
		var vulnCount int64
		db.Model(&models.Vulnerability{}).
			Where("team_id = ? AND status NOT IN (?)", teams[i].ID, []string{"closed", "completed"}).
			Count(&vulnCount)
		teams[i].VulnCount = vulnCount
	}

	return &TeamListResponse{
		Teams:    teams,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

// GetTeamByID获取团队详情
func (s *TeamService) GetTeamByID(teamID, userID uint, roleCode string) (*models.Team, error) {
	db := Init.GetDB()

	var team models.Team
	query := db.Preload("Leader").Preload("Members").Preload("Members.User")

	// 如果不是超级管理员/管理员，需要检查权限
	if roleCode != "super_admin" && roleCode != "admin" && roleCode != "security_engineer" {
		query = query.Where("id = ? AND (leader_id = ? OR id IN (SELECT team_id FROM team_members WHERE user_id = ?))",
			teamID, userID, userID)
	}

	if err := query.First(&team, teamID).Error; err != nil {
		return nil, errors.New("团队不存在或无权限访问")
	}

	// 填充未关闭漏洞数量（排除已关闭和已完成的漏洞）
	var vulnCount int64
	db.Model(&models.Vulnerability{}).
		Where("team_id = ? AND status NOT IN (?)", team.ID, []string{"closed", "completed"}).
		Count(&vulnCount)
	team.VulnCount = vulnCount

	return &team, nil
}

// GetTeamMembers获取团队成员列表
func (s *TeamService) GetTeamMembers(teamID uint) ([]models.TeamMember, error) {
	db := Init.GetDB()

	var members []models.TeamMember
	if err := db.Where("team_id = ?", teamID).Preload("User").Preload("User.Role").Find(&members).Error; err != nil {
		return nil, fmt.Errorf("获取团队成员失败: %v", err)
	}

	return members, nil
}

// GetUserTeamMemberIDs获取与指定用户同团队的所有成员用户ID
// 用于漏洞可见性控制：团队负责人可以查看分配给任何团队成员的漏洞
func (s *TeamService) GetUserTeamMemberIDs(userID uint) ([]uint, error) {
	db := Init.GetDB()

	// 获取用户所在的所有团队ID
	var teamIDs []uint
	if err := db.Model(&models.TeamMember{}).Where("user_id = ?", userID).Pluck("team_id", &teamIDs).Error; err != nil {
		return nil, fmt.Errorf("查询用户团队失败: %v", err)
	}

	// 同时包含用户作为负责人的团队
	var leaderTeamIDs []uint
	if err := db.Model(&models.Team{}).Where("leader_id = ?", userID).Pluck("id", &leaderTeamIDs).Error; err != nil {
		return nil, fmt.Errorf("查询负责团队失败: %v", err)
	}

	// 合并团队ID
	teamIDSet := make(map[uint]bool)
	for _, id := range teamIDs {
		teamIDSet[id] = true
	}
	for _, id := range leaderTeamIDs {
		teamIDSet[id] = true
	}

	if len(teamIDSet) == 0 {
		return []uint{}, nil
	}

	// 收集所有唯一的团队ID
	var allTeamIDs []uint
	for id := range teamIDSet {
		allTeamIDs = append(allTeamIDs, id)
	}

	// 获取这些团队中的所有成员用户ID
	var memberIDs []uint
	if err := db.Model(&models.TeamMember{}).Where("team_id IN (?)", allTeamIDs).Pluck("user_id", &memberIDs).Error; err != nil {
		return nil, fmt.Errorf("查询团队成员失败: %v", err)
	}

	// 去重
	memberIDSet := make(map[uint]bool)
	for _, id := range memberIDs {
		memberIDSet[id] = true
	}

	var uniqueIDs []uint
	for id := range memberIDSet {
		uniqueIDs = append(uniqueIDs, id)
	}

	return uniqueIDs, nil
}

// IsTeamLeader检查用户是否是任何团队的负责人
func (s *TeamService) IsTeamLeader(userID uint) (bool, error) {
	db := Init.GetDB()

	var count int64
	if err := db.Model(&models.Team{}).Where("leader_id = ?", userID).Count(&count).Error; err != nil {
		return false, fmt.Errorf("查询团队负责人失败: %v", err)
	}

	return count > 0, nil
}

// GetTeamMemberIDsByLeader获取指定负责人所管理团队的所有成员用户ID
// 用于负责人可见性控制
func (s *TeamService) GetTeamMemberIDsByLeader(leaderID uint) ([]uint, error) {
	db := Init.GetDB()

	// 获取该用户作为负责人的所有团队ID
	var teamIDs []uint
	if err := db.Model(&models.Team{}).Where("leader_id = ?", leaderID).Pluck("id", &teamIDs).Error; err != nil {
		return nil, fmt.Errorf("查询负责团队失败: %v", err)
	}

	if len(teamIDs) == 0 {
		return []uint{}, nil
	}

	// 获取这些团队中的所有成员用户ID
	var memberIDs []uint
	if err := db.Model(&models.TeamMember{}).Where("team_id IN (?)", teamIDs).Pluck("user_id", &memberIDs).Error; err != nil {
		return nil, fmt.Errorf("查询团队成员失败: %v", err)
	}

	// 去重
	memberIDSet := make(map[uint]bool)
	for _, id := range memberIDs {
		memberIDSet[id] = true
	}

	var uniqueIDs []uint
	for id := range memberIDSet {
		uniqueIDs = append(uniqueIDs, id)
	}

	return uniqueIDs, nil
}
