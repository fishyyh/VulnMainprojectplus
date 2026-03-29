package services

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	ldap "github.com/go-ldap/ldap/v3"
	Init "vulnmain/Init"
	"vulnmain/models"
)

// LDAPService 提供LDAP相关能力：连接测试、认证、同步
type LDAPService struct{}

// ldapConfig 保存从系统配置读取的LDAP配置
type ldapConfig struct {
	Enabled            bool
	URL                string
	BaseDN             string
	BindDN             string
	BindPassword       string
	UserFilter         string
	SyncFilter         string
	AttrUsername       string
	AttrEmail          string
	AttrPhone          string
	AttrDepartment     string
	AttrRealName       string
	DefaultEmailDomain string
	DebugLogging       bool
}

// loadConfig 从system_configs读取LDAP配置
func (s *LDAPService) loadConfig() (*ldapConfig, error) {
	db := Init.GetDB()
	cfg := &ldapConfig{
		Enabled: false,
		URL:     "",
	}
	var configs []models.SystemConfig
	if err := db.Where("`group` = ?", "ldap").Find(&configs).Error; err != nil {
		return nil, errors.New("读取LDAP配置失败")
	}
	for _, c := range configs {
		switch c.Key {
		case "ldap.enabled":
			cfg.Enabled = c.Value == "true"
		case "ldap.url":
			cfg.URL = strings.TrimSpace(c.Value)
		case "ldap.base_dn":
			cfg.BaseDN = c.Value
		case "ldap.bind_dn":
			cfg.BindDN = c.Value
		case "ldap.bind_password":
			cfg.BindPassword = c.Value
		case "ldap.user_filter":
			cfg.UserFilter = c.Value
		case "ldap.sync_filter":
			cfg.SyncFilter = c.Value
		case "ldap.attr_username":
			cfg.AttrUsername = c.Value
		case "ldap.attr_email":
			cfg.AttrEmail = c.Value
		case "ldap.attr_phone":
			cfg.AttrPhone = c.Value
		case "ldap.attr_department":
			cfg.AttrDepartment = c.Value
		case "ldap.attr_real_name":
			cfg.AttrRealName = c.Value
		case "ldap.default_email_domain":
			cfg.DefaultEmailDomain = strings.TrimSpace(c.Value)
		case "ldap.debug_logging":
			cfg.DebugLogging = (c.Value == "true")
		}
	}
	// 设置默认值
	if cfg.UserFilter == "" {
		cfg.UserFilter = "(|(uid={username})(sAMAccountName={username})(mail={username}))"
	}
	if cfg.SyncFilter == "" {
		cfg.SyncFilter = "(&(objectClass=person))"
	}
	if cfg.AttrUsername == "" {
		cfg.AttrUsername = "uid"
	}
	if cfg.AttrEmail == "" {
		cfg.AttrEmail = "mail"
	}
	if cfg.AttrPhone == "" {
		cfg.AttrPhone = "mobile"
	}
	if cfg.AttrDepartment == "" {
		cfg.AttrDepartment = "department"
	}
	if cfg.AttrRealName == "" {
		cfg.AttrRealName = "displayName"
	}
	if cfg.DefaultEmailDomain == "" {
		cfg.DefaultEmailDomain = "ldap.local"
	}
	return cfg, nil
}

// TestConnection 测试LDAP连接（使用bind账号）
func (s *LDAPService) TestConnection() error {
	cfg, err := s.loadConfig()
	if err != nil {
		return err
	}
	if !cfg.Enabled {
		return errors.New("LDAP未启用")
	}
	if cfg.URL == "" || cfg.BindDN == "" {
		return errors.New("请完善LDAP服务器地址与绑定账号")
	}
	conn, err := ldap.DialURL(cfg.URL)
	if err != nil {
		return fmt.Errorf("连接LDAP失败: %v", err)
	}
	defer conn.Close()
	if err := conn.Bind(cfg.BindDN, cfg.BindPassword); err != nil {
		return fmt.Errorf("绑定账号失败: %v", err)
	}
	return nil
}

// Authenticate 使用用户名/密码进行LDAP认证
func (s *LDAPService) Authenticate(username, password string) (bool, error) {
	cfg, err := s.loadConfig()
	if err != nil {
		return false, err
	}
	if !cfg.Enabled {
		return false, errors.New("LDAP未启用")
	}
	if password == "" {
		return false, errors.New("密码不能为空")
	}
	conn, err := ldap.DialURL(cfg.URL)
	if err != nil {
		return false, fmt.Errorf("连接LDAP失败: %v", err)
	}
	defer conn.Close()
	// 先使用管理账号绑定
	if cfg.BindDN != "" {
		if err := conn.Bind(cfg.BindDN, cfg.BindPassword); err != nil {
			return false, fmt.Errorf("绑定失败: %v", err)
		}
	}
	// 搜索用户条目
	filter := strings.ReplaceAll(cfg.UserFilter, "{username}", ldap.EscapeFilter(username))
	attrs := []string{"dn"}
	searchReq := ldap.NewSearchRequest(
		cfg.BaseDN,
		ldap.ScopeWholeSubtree, ldap.NeverDerefAliases, 0, 0, false,
		filter,
		attrs,
		nil,
	)
	res, err := conn.Search(searchReq)
	if err != nil || len(res.Entries) == 0 {
		return false, errors.New("未找到用户")
	}
	userDN := res.Entries[0].DN
	// 使用用户DN+密码验证
	if err := conn.Bind(userDN, password); err != nil {
		return false, errors.New("用户名或密码错误")
	}
	return true, nil
}

// SyncUsers 从LDAP同步用户到本地数据库
// 规则：
// - 仅创建/更新users表中的账号（source=ldap）；
// - username必填；email/phone/department如有则同步；
// - 对于缺失email，使用 username@default_domain；
// - 新用户默认角色为 normal_user，状态启用；
func (s *LDAPService) SyncUsers() (int, int, error) {
	cfg, err := s.loadConfig()
	if err != nil {
		return 0, 0, err
	}
	if !cfg.Enabled {
		return 0, 0, errors.New("LDAP未启用")
	}
	if cfg.DebugLogging {
		log.Printf("[LDAP] 开始同步：url=%s base_dn=%s filter=%s attrs=[%s,%s,%s,%s]", cfg.URL, cfg.BaseDN, cfg.SyncFilter, cfg.AttrUsername, cfg.AttrEmail, cfg.AttrPhone, cfg.AttrDepartment)
	}
	conn, err := ldap.DialURL(cfg.URL)
	if err != nil {
		return 0, 0, fmt.Errorf("连接LDAP失败: %v", err)
	}
	defer conn.Close()
	if cfg.BindDN != "" {
		if err := conn.Bind(cfg.BindDN, cfg.BindPassword); err != nil {
			return 0, 0, fmt.Errorf("绑定失败: %v", err)
		}
	}
	attrs := []string{cfg.AttrUsername, cfg.AttrEmail, cfg.AttrPhone, cfg.AttrDepartment, cfg.AttrRealName, "cn"}
	req := ldap.NewSearchRequest(
		cfg.BaseDN,
		ldap.ScopeWholeSubtree, ldap.NeverDerefAliases, 0, 0, false,
		cfg.SyncFilter,
		attrs,
		nil,
	)
	res, err := conn.Search(req)
	if err != nil {
		return 0, 0, fmt.Errorf("搜索失败: %v", err)
	}
	if cfg.DebugLogging {
		log.Printf("[LDAP] 搜索结果：共 %d 条", len(res.Entries))
		for i, e := range res.Entries {
			log.Printf("[LDAP] #%d DN=%s", i+1, e.DN)
		}
	}
	db := Init.GetDB()
	// 获取normal_user角色
	var normalRole models.Role
	db.Where("code = ?", "normal_user").First(&normalRole)
	created := 0
	updated := 0
	for _, e := range res.Entries {
		uname := strings.TrimSpace(e.GetAttributeValue(cfg.AttrUsername))
		if uname == "" {
			if cfg.DebugLogging {
				log.Printf("[LDAP] 跳过条目：DN=%s 缺少用户名属性(%s)", e.DN, cfg.AttrUsername)
			}
			continue
		}
		email := strings.TrimSpace(e.GetAttributeValue(cfg.AttrEmail))
		if email == "" {
			email = fmt.Sprintf("%s@%s", uname, cfg.DefaultEmailDomain)
		}
		phone := strings.TrimSpace(e.GetAttributeValue(cfg.AttrPhone))
		dept := strings.TrimSpace(e.GetAttributeValue(cfg.AttrDepartment))
		realName := strings.TrimSpace(e.GetAttributeValue(cfg.AttrRealName))
		if realName == "" {
			realName = strings.TrimSpace(e.GetAttributeValue("cn"))
		}

		if cfg.DebugLogging {
			log.Printf("[LDAP] 处理用户 uname=%s real_name=%s email=%s phone=%s dept=%s", uname, realName, email, phone, dept)
		}

		var user models.User
		if err := db.Where("username = ?", uname).First(&user).Error; err != nil {
			// 不存在则创建
			u := models.User{
				Username:   uname,
				Email:      email,
				Phone:      phone,
				Department: dept,
				RealName:   realName,
				Status:     1,
				RoleID:     normalRole.ID,
				Source:     "ldap",
			}
			// 为满足非空密码约束，设置随机密码（不会用于登录）
			raw := make([]byte, 12)
			rand.Read(raw)
			u.SetPassword(hex.EncodeToString(raw))
			if err := db.Create(&u).Error; err == nil {
				created++
				if cfg.DebugLogging {
					log.Printf("[LDAP] 新增用户 uname=%s", uname)
				}
			} else if cfg.DebugLogging {
				log.Printf("[LDAP] 新增用户失败 uname=%s err=%v", uname, err)
			}
		} else {
			// 已存在：仅在source为ldap时更新资料字段
			if user.Source == "ldap" {
				changes := map[string]interface{}{}
				if user.Email != email && email != "" {
					changes["email"] = email
				}
				if user.Phone != phone && phone != "" {
					changes["phone"] = phone
				}
				if user.Department != dept && dept != "" {
					changes["department"] = dept
				}
				if user.RealName != realName && realName != "" {
					changes["real_name"] = realName
				}
				if len(changes) > 0 {
					if err := db.Model(&user).Updates(changes).Error; err == nil {
						updated++
						if cfg.DebugLogging {
							log.Printf("[LDAP] 更新用户 uname=%s fields=%v", uname, changes)
						}
					} else if cfg.DebugLogging {
						log.Printf("[LDAP] 更新用户失败 uname=%s err=%v", uname, err)
					}
				} else if cfg.DebugLogging {
					log.Printf("[LDAP] 用户无变更 uname=%s", uname)
				}
			} else if cfg.DebugLogging {
				log.Printf("[LDAP] 本地存在同名本地账户，跳过覆盖 uname=%s", uname)
			}
		}
	}
	if cfg.DebugLogging {
		log.Printf("[LDAP] 同步完成：新增=%d 更新=%d", created, updated)
	}
	return created, updated, nil
}

// UpdateUserLastLogin 更新用户最后登录时间
func UpdateUserLastLogin(user *models.User) {
	db := Init.GetDB()
	now := time.Now().Truncate(time.Second)
	user.LastLoginAt = &now
	db.Save(user)
}

