// 邮件通知服务包
// 该包负责处理系统的邮件通知功能，包括SMTP配置管理和邮件发送
package services

import (
	"crypto/tls"
	"fmt"
	"net/smtp"
	"strconv"
	"strings"
	"time"
	Init "vulnmain/Init"
	"vulnmain/models"

	"github.com/jordan-wright/email"
)

// EmailConfig 邮件配置结构体
type EmailConfig struct {
	SMTPHost  string `json:"smtp_host"`  // SMTP服务器地址
	SMTPPort  int    `json:"smtp_port"`  // SMTP服务器端口
	Username  string `json:"username"`   // 邮箱账号
	Password  string `json:"password"`   // 邮箱密码
	UseSSL    bool   `json:"use_ssl"`    // 是否使用SSL加密
	FromName  string `json:"from_name"`  // 发件人名称
	FromEmail string `json:"from_email"` // 发件人邮箱
}

// EmailTemplate 邮件模板结构体
type EmailTemplate struct {
	Subject string // 邮件主题
	Body    string // 邮件内容
}

// GetEmailConfig 从数据库获取邮件配置
func GetEmailConfig() (*EmailConfig, error) {
	db := Init.GetDB()

	config := &EmailConfig{}

	// 获取SMTP配置
	var configs []models.SystemConfig
	err := db.Where("`group` = 'email'").Find(&configs).Error
	if err != nil {
		return nil, fmt.Errorf("获取邮件配置失败: %v", err)
	}

	// 解析配置
	for _, cfg := range configs {
		switch cfg.Key {
		case "email.smtp_host":
			config.SMTPHost = cfg.Value
		case "email.smtp_port":
			if port, err := strconv.Atoi(cfg.Value); err == nil {
				config.SMTPPort = port
			}
		case "email.username":
			config.Username = cfg.Value
		case "email.password":
			config.Password = cfg.Value
		case "email.use_ssl":
			config.UseSSL = cfg.Value == "true"
		case "email.from_name":
			config.FromName = cfg.Value
		case "email.from_email":
			config.FromEmail = cfg.Value
		}
	}

	// 验证必要配置
	if config.SMTPHost == "" || config.SMTPPort == 0 || config.Username == "" || config.Password == "" {
		return nil, fmt.Errorf("邮件配置不完整，请检查SMTP配置")
	}

	// 设置默认值
	if config.FromName == "" {
		config.FromName = "VulnMain系统"
	}
	if config.FromEmail == "" {
		config.FromEmail = config.Username
	}

	return config, nil
}

// SendEmail 发送邮件
func SendEmail(to []string, subject, body string) error {
	config, err := GetEmailConfig()
	if err != nil {
		return fmt.Errorf("获取邮件配置失败: %v", err)
	}

	// 验证收件人
	if len(to) == 0 {
		return fmt.Errorf("收件人列表为空")
	}

	// 创建邮件
	e := email.NewEmail()
	e.From = fmt.Sprintf("%s <%s>", config.FromName, config.FromEmail)
	e.To = to
	e.Subject = subject
	e.HTML = []byte(body)

	// 配置SMTP
	addr := fmt.Sprintf("%s:%d", config.SMTPHost, config.SMTPPort)
	auth := smtp.PlainAuth("", config.Username, config.Password, config.SMTPHost)

	// 发送邮件
	tlsConfig := &tls.Config{
		ServerName: config.SMTPHost,
	}

	if config.UseSSL {
		// 端口465: 直接TLS连接
		err = e.SendWithTLS(addr, auth, tlsConfig)
		if err != nil {
			// 如果直接TLS失败，尝试STARTTLS方式
			if strings.Contains(err.Error(), "tls:") {
				err = e.SendWithStartTLS(addr, auth, tlsConfig)
			}
		}
	} else {
		// 端口587: 使用STARTTLS
		err = e.SendWithStartTLS(addr, auth, tlsConfig)
		if err != nil {
			// 如果STARTTLS失败，尝试普通连接
			if strings.Contains(err.Error(), "tls:") || strings.Contains(err.Error(), "starttls") {
				err = e.Send(addr, auth)
			}
		}
	}

	if err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "550") && strings.Contains(errMsg, "suspended") {
			return fmt.Errorf("邮箱账户被暂停: %v (请检查邮箱状态，重新生成授权码，或联系邮箱服务商)", err)
		} else if strings.Contains(errMsg, "535") {
			return fmt.Errorf("邮箱认证失败: %v (请确认使用授权码而不是登录密码)", err)
		} else if strings.Contains(errMsg, "550") {
			return fmt.Errorf("邮件被拒绝: %v (可能是内容被识别为垃圾邮件或发送频率过高)", err)
		}
		return fmt.Errorf("邮件发送失败: %v (请检查SMTP端口和SSL配置是否匹配: 465端口开启SSL, 587端口关闭SSL)", err)
	}

	return nil
}

// 邮件模板定义

// GetProjectCreatedTemplate 项目创建通知模板
func GetProjectCreatedTemplate(projectName, ownerName string, members []string) EmailTemplate {
	subject := fmt.Sprintf("【VulnMain】您已被添加到项目：%s", projectName)

	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>项目通知</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #007bff; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { padding: 10px; text-align: center; color: #666; font-size: 12px; }
        .highlight { color: #007bff; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>项目通知</h2>
        </div>
        <div class="content">
            <p>您好！</p>
            <p>您已被添加到项目 <span class="highlight">%s</span> 中。</p>
            <p><strong>项目负责人：</strong>%s</p>
            <p><strong>项目成员：</strong>%s</p>
            <p>请登录系统查看项目详情并开始工作。</p>
            <p>如有疑问，请联系项目负责人。</p>
        </div>
        <div class="footer">
            <p>此邮件由VulnMain系统自动发送，请勿回复。</p>
            <p>发送时间：%s</p>
        </div>
    </div>
</body>
</html>
	`, projectName, ownerName, strings.Join(members, "、"), time.Now().Format("2006-01-02 15:04:05"))

	return EmailTemplate{Subject: subject, Body: body}
}

// GetProjectMemberAddedTemplate 项目成员新增通知模板
func GetProjectMemberAddedTemplate(projectName, ownerName string, members []string) EmailTemplate {
	subject := fmt.Sprintf("【VulnMain】您已被添加到项目：%s", projectName)

	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>项目成员新增通知</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #28a745; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { padding: 10px; text-align: center; color: #666; font-size: 12px; }
        .highlight { color: #28a745; font-weight: bold; }
        .welcome { background: #e8f5e8; padding: 15px; border-radius: 6px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>🎉 项目成员新增通知</h2>
        </div>
        <div class="content">
            <div class="welcome">
                <p><strong>欢迎加入项目团队！</strong></p>
            </div>

            <p>您好！</p>
            <p>您已被添加到项目 <span class="highlight">%s</span> 中，成为项目团队的一员。</p>

            <p><strong>项目信息：</strong></p>
            <ul>
                <li><strong>项目名称：</strong>%s</li>
                <li><strong>项目负责人：</strong>%s</li>
                <li><strong>您的角色：</strong>项目成员</li>
            </ul>

            <p><strong>接下来您可以：</strong></p>
            <ul>
                <li>登录系统查看项目详情和任务安排</li>
                <li>查看项目相关的漏洞和资产信息</li>
                <li>与团队成员协作处理安全问题</li>
                <li>参与项目的安全评估和修复工作</li>
            </ul>

            <p>如有任何疑问，请联系项目负责人或系统管理员。</p>
            <p>期待与您的合作！</p>
        </div>
        <div class="footer">
            <p>此邮件由VulnMain系统自动发送，请勿回复。</p>
            <p>发送时间：%s</p>
        </div>
    </div>
</body>
</html>
	`, projectName, projectName, ownerName, time.Now().Format("2006-01-02 15:04:05"))

	return EmailTemplate{Subject: subject, Body: body}
}

// GetVulnAssignedTemplate 漏洞分派通知模板
func GetVulnAssignedTemplate(vulnTitle, projectName, assigneeName, severity string) EmailTemplate {
	subject := fmt.Sprintf("【VulnMain】新漏洞分派：%s", vulnTitle)

	severityColor := "#28a745" // 默认绿色
	switch severity {
	case "critical":
		severityColor = "#dc3545" // 红色
	case "high":
		severityColor = "#fd7e14" // 橙色
	case "medium":
		severityColor = "#ffc107" // 黄色
	case "low":
		severityColor = "#28a745" // 绿色
	}

	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>漏洞分派通知</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { padding: 10px; text-align: center; color: #666; font-size: 12px; }
        .highlight { color: #dc3545; font-weight: bold; }
        .severity { padding: 4px 8px; border-radius: 4px; color: white; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>漏洞分派通知</h2>
        </div>
        <div class="content">
            <p>您好，%s！</p>
            <p>有新的漏洞分派给您处理：</p>
            <p><strong>漏洞标题：</strong><span class="highlight">%s</span></p>
            <p><strong>所属项目：</strong>%s</p>
            <p><strong>严重程度：</strong><span class="severity" style="background-color: %s;">%s</span></p>
            <p>请及时登录系统查看漏洞详情并开始修复工作。</p>
            <p>如有疑问，请联系安全工程师。</p>
        </div>
        <div class="footer">
            <p>此邮件由VulnMain系统自动发送，请勿回复。</p>
            <p>发送时间：%s</p>
        </div>
    </div>
</body>
</html>
	`, assigneeName, vulnTitle, projectName, severityColor, severity, time.Now().Format("2006-01-02 15:04:05"))

	return EmailTemplate{Subject: subject, Body: body}
}

// GetVulnStatusChangedTemplate 漏洞状态变更通知模板
func GetVulnStatusChangedTemplate(vulnTitle, projectName, oldStatus, newStatus, nextUserName string) EmailTemplate {
	subject := fmt.Sprintf("【VulnMain】漏洞状态更新：%s", vulnTitle)

	statusMap := map[string]string{
		"unfixed":   "未修复",
		"fixing":    "修复中",
		"fixed":     "已修复",
		"retesting": "复测中",
		"completed": "已完成",
		"ignored":   "已忽略",
	}

	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>漏洞状态更新通知</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #17a2b8; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { padding: 10px; text-align: center; color: #666; font-size: 12px; }
        .highlight { color: #17a2b8; font-weight: bold; }
        .status { padding: 4px 8px; border-radius: 4px; font-weight: bold; }
        .status-old { background-color: #6c757d; color: white; }
        .status-new { background-color: #28a745; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>漏洞状态更新通知</h2>
        </div>
        <div class="content">
            <p>您好，%s！</p>
            <p>有漏洞状态发生变更，需要您处理：</p>
            <p><strong>漏洞标题：</strong><span class="highlight">%s</span></p>
            <p><strong>所属项目：</strong>%s</p>
            <p><strong>状态变更：</strong>
                <span class="status status-old">%s</span> → 
                <span class="status status-new">%s</span>
            </p>
            <p>请登录系统查看详情并进行相应处理。</p>
        </div>
        <div class="footer">
            <p>此邮件由VulnMain系统自动发送，请勿回复。</p>
            <p>发送时间：%s</p>
        </div>
    </div>
</body>
</html>
	`, nextUserName, vulnTitle, projectName, statusMap[oldStatus], statusMap[newStatus], time.Now().Format("2006-01-02 15:04:05"))

	return EmailTemplate{Subject: subject, Body: body}
}

// GetPasswordResetTemplate 密码重置通知模板
func GetPasswordResetTemplate(userName, newPassword string) EmailTemplate {
	subject := "【VulnMain】密码重置通知"

	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>密码重置通知</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ffc107; color: #212529; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { padding: 10px; text-align: center; color: #666; font-size: 12px; }
        .highlight { color: #ffc107; font-weight: bold; }
        .password { background: #e9ecef; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 16px; }
        .warning { color: #dc3545; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>密码重置通知</h2>
        </div>
        <div class="content">
            <p>您好，%s！</p>
            <p>您的账户密码已被管理员重置。</p>
            <p><strong>新密码：</strong></p>
            <div class="password">%s</div>
            <p class="warning">⚠️ 为了您的账户安全，请在首次登录后立即修改密码。</p>
            <p>如果您没有申请密码重置，请立即联系系统管理员。</p>
        </div>
        <div class="footer">
            <p>此邮件由VulnMain系统自动发送，请勿回复。</p>
            <p>发送时间：%s</p>
        </div>
    </div>
</body>
</html>
	`, userName, newPassword, time.Now().Format("2006-01-02 15:04:05"))

	return EmailTemplate{Subject: subject, Body: body}
}

// GetUserRegisteredTemplate 用户注册成功通知模板
func GetUserRegisteredTemplate(userName, userEmail, initialPassword string) EmailTemplate {
	subject := "【VulnMain】欢迎加入VulnMain系统"
	credentialsExtra := "<p><strong>登录方式：</strong>请使用 Google 账号单点登录</p>"
	securityTip := `<p class="warning">⚠️ 当前系统已启用 Google 登录，请使用已授权邮箱完成登录。</p>`
	if strings.TrimSpace(initialPassword) != "" {
		credentialsExtra = fmt.Sprintf("<p><strong>初始密码：</strong>%s</p>", initialPassword)
		securityTip = `<p class="warning">⚠️ 为了您的账户安全，请在首次登录后立即修改密码。</p>`
	}

	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>欢迎加入VulnMain</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #28a745; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { padding: 10px; text-align: center; color: #666; font-size: 12px; }
        .highlight { color: #28a745; font-weight: bold; }
        .credentials { background: #e9ecef; padding: 15px; border-radius: 4px; margin: 10px 0; }
        .warning { color: #dc3545; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>欢迎加入VulnMain系统</h2>
        </div>
        <div class="content">
            <p>您好，%s！</p>
            <p>欢迎加入VulnMain漏洞管理系统！您的账户已成功创建。</p>

            <div class="credentials">
                <p><strong>登录信息：</strong></p>
                <p><strong>用户名：</strong>%s</p>
                <p><strong>邮箱：</strong>%s</p>
                %s
            </div>

            %s

            <p><strong>系统功能：</strong></p>
            <ul>
                <li>漏洞管理：提交、跟踪、修复漏洞</li>
                <li>项目管理：参与安全项目协作</li>
                <li>资产管理：管理和维护安全资产</li>
                <li>统计分析：查看安全数据统计</li>
            </ul>

            <p>如有任何问题，请联系系统管理员。</p>
        </div>
        <div class="footer">
            <p>此邮件由VulnMain系统自动发送，请勿回复。</p>
            <p>发送时间：%s</p>
        </div>
    </div>
</body>
</html>
	`, userName, userName, userEmail, credentialsExtra, securityTip, time.Now().Format("2006-01-02 15:04:05"))

	return EmailTemplate{Subject: subject, Body: body}
}

// GetVulnDeadlineReminderTemplate 漏洞截止时间提醒模板
func GetVulnDeadlineReminderTemplate(vulnTitle, projectName, assigneeName, severity, status string, daysLeft int, deadline string) EmailTemplate {
	var subject string
	var urgencyClass string
	var urgencyText string

	if daysLeft == 1 {
		subject = fmt.Sprintf("【紧急】漏洞修复截止时间提醒 - %s", vulnTitle)
		urgencyClass = "urgent"
		urgencyText = "紧急提醒"
	} else if daysLeft == 2 {
		subject = fmt.Sprintf("【重要】漏洞修复截止时间提醒 - %s", vulnTitle)
		urgencyClass = "important"
		urgencyText = "重要提醒"
	} else {
		subject = fmt.Sprintf("【提醒】漏洞修复截止时间提醒 - %s", vulnTitle)
		urgencyClass = "normal"
		urgencyText = "友情提醒"
	}

	// 获取严重程度对应的颜色
	severityColor := "#6c757d" // 默认灰色
	switch severity {
	case "critical":
		severityColor = "#dc3545" // 红色
	case "high":
		severityColor = "#fd7e14" // 橙色
	case "medium":
		severityColor = "#ffc107" // 黄色
	case "low":
		severityColor = "#28a745" // 绿色
	}

	// 状态显示名称
	statusMap := map[string]string{
		"pending":   "待处理",
		"confirmed": "已确认",
		"rejected":  "已拒绝",
		"unfixed":   "未修复",
		"fixing":    "修复中",
		"fixed":     "已修复",
		"retesting": "复测中",
		"completed": "已完成",
		"ignored":   "已忽略",
	}
	statusDisplay := statusMap[status]
	if statusDisplay == "" {
		statusDisplay = status
	}

	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        .footer { text-align: center; margin-top: 20px; color: #6c757d; font-size: 12px; }
        .highlight { color: #007bff; font-weight: bold; }
        .severity { color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .status { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; background: #e9ecef; color: #495057; }
        .deadline-warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 6px;
            padding: 15px;
            margin: 15px 0;
            text-align: center;
        }
        .deadline-warning.urgent { background: #f8d7da; border-color: #f5c6cb; }
        .deadline-warning.important { background: #fff3cd; border-color: #ffeaa7; }
        .deadline-warning.normal { background: #d1ecf1; border-color: #bee5eb; }
        .deadline-text { font-size: 18px; font-weight: bold; margin: 10px 0; }
        .deadline-text.urgent { color: #721c24; }
        .deadline-text.important { color: #856404; }
        .deadline-text.normal { color: #0c5460; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>%s</h2>
        </div>
        <div class="content">
            <p>您好，%s！</p>
            <p>您负责的漏洞即将到达修复截止时间，请及时处理：</p>

            <div class="deadline-warning %s">
                <div class="deadline-text %s">⏰ 距离截止时间还有 %d 天</div>
                <p><strong>截止时间：</strong>%s</p>
            </div>

            <p><strong>漏洞标题：</strong><span class="highlight">%s</span></p>
            <p><strong>所属项目：</strong>%s</p>
            <p><strong>严重程度：</strong><span class="severity" style="background-color: %s;">%s</span></p>
            <p><strong>当前状态：</strong><span class="status">%s</span></p>

            <p>请尽快登录系统处理该漏洞，避免超过截止时间。</p>
            <p>如有疑问或需要延期，请及时联系项目负责人或安全工程师。</p>
        </div>
        <div class="footer">
            <p>此邮件由VulnMain系统自动发送，请勿回复。</p>
            <p>发送时间：%s</p>
        </div>
    </div>
</body>
</html>
	`, urgencyText, assigneeName, urgencyClass, urgencyClass, daysLeft, deadline, vulnTitle, projectName, severityColor, severity, statusDisplay, time.Now().Format("2006-01-02 15:04:05"))

	return EmailTemplate{Subject: subject, Body: body}
}

// 邮件发送的便捷方法

// SendProjectCreatedNotification 发送项目创建通知
func SendProjectCreatedNotification(projectName, ownerName string, memberEmails []string) error {
	if len(memberEmails) == 0 {
		return nil // 没有成员邮箱，不发送通知
	}

	template := GetProjectCreatedTemplate(projectName, ownerName, memberEmails)
	return SendEmail(memberEmails, template.Subject, template.Body)
}

// SendProjectMemberAddedNotification 发送项目成员新增通知
func SendProjectMemberAddedNotification(projectName, ownerName string, newMemberEmails []string) error {
	if len(newMemberEmails) == 0 {
		return nil // 没有新成员邮箱，不发送通知
	}

	template := GetProjectMemberAddedTemplate(projectName, ownerName, newMemberEmails)
	return SendEmail(newMemberEmails, template.Subject, template.Body)
}

// SendVulnAssignedNotification 发送漏洞分派通知
func SendVulnAssignedNotification(vulnTitle, projectName, assigneeName, assigneeEmail, severity string) error {
	if assigneeEmail == "" {
		return nil // 没有邮箱，不发送通知
	}

	template := GetVulnAssignedTemplate(vulnTitle, projectName, assigneeName, severity)
	return SendEmail([]string{assigneeEmail}, template.Subject, template.Body)
}

// SendVulnStatusChangedNotification 发送漏洞状态变更通知
func SendVulnStatusChangedNotification(vulnTitle, projectName, oldStatus, newStatus, nextUserName, nextUserEmail string) error {
	if nextUserEmail == "" {
		return nil // 没有邮箱，不发送通知
	}

	template := GetVulnStatusChangedTemplate(vulnTitle, projectName, oldStatus, newStatus, nextUserName)
	return SendEmail([]string{nextUserEmail}, template.Subject, template.Body)
}

// SendPasswordResetNotification 发送密码重置通知
func SendPasswordResetNotification(userName, userEmail, newPassword string) error {
	if userEmail == "" {
		return nil // 没有邮箱，不发送通知
	}

	template := GetPasswordResetTemplate(userName, newPassword)
	return SendEmail([]string{userEmail}, template.Subject, template.Body)
}

// SendUserRegisteredNotification 发送用户注册成功通知
func SendUserRegisteredNotification(userName, userEmail, initialPassword string) error {
	if userEmail == "" {
		return nil // 没有邮箱，不发送通知
	}

	template := GetUserRegisteredTemplate(userName, userEmail, initialPassword)
	return SendEmail([]string{userEmail}, template.Subject, template.Body)
}

// SendVulnDeadlineReminderNotification 发送漏洞截止时间提醒通知
func SendVulnDeadlineReminderNotification(vulnTitle, projectName, assigneeName, assigneeEmail, severity, status string, daysLeft int, deadline string) error {
	if assigneeEmail == "" {
		return nil // 没有邮箱，不发送通知
	}

	template := GetVulnDeadlineReminderTemplate(vulnTitle, projectName, assigneeName, severity, status, daysLeft, deadline)
	return SendEmail([]string{assigneeEmail}, template.Subject, template.Body)
}

// SendEmailWithAttachment 发送带附件的邮件
func SendEmailWithAttachment(to, subject, body, attachmentName string, attachmentData []byte) error {
	config, err := GetEmailConfig()
	if err != nil {
		return fmt.Errorf("获取邮件配置失败: %v", err)
	}

	// 创建邮件
	e := email.NewEmail()
	e.From = fmt.Sprintf("%s <%s>", config.FromName, config.FromEmail)
	e.To = []string{to}
	e.Subject = subject
	e.Text = []byte(body)
	e.HTML = []byte(strings.ReplaceAll(body, "\n", "<br>"))

	// 添加附件
	if attachmentData != nil && attachmentName != "" {
		_, err = e.Attach(strings.NewReader(string(attachmentData)), attachmentName, "application/pdf")
		if err != nil {
			return fmt.Errorf("添加附件失败: %v", err)
		}
	}

	// 发送邮件
	addr := fmt.Sprintf("%s:%d", config.SMTPHost, config.SMTPPort)
	auth := smtp.PlainAuth("", config.Username, config.Password, config.SMTPHost)
	tlsConfig := &tls.Config{
		ServerName: config.SMTPHost,
	}

	var err2 error
	if config.UseSSL {
		err2 = e.SendWithTLS(addr, auth, tlsConfig)
		if err2 != nil && strings.Contains(err2.Error(), "tls:") {
			err2 = e.SendWithStartTLS(addr, auth, tlsConfig)
		}
	} else {
		err2 = e.SendWithStartTLS(addr, auth, tlsConfig)
		if err2 != nil && (strings.Contains(err2.Error(), "tls:") || strings.Contains(err2.Error(), "starttls")) {
			err2 = e.Send(addr, auth)
		}
	}

	if err2 != nil {
		return fmt.Errorf("发送邮件失败: %v", err2)
	}

	return nil
}
