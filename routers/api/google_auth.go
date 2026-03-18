package api

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/url"
	"vulnmain/services"

	"github.com/gin-gonic/gin"
)

var googleAuthService = &services.GoogleAuthService{}

// GoogleAuthRedirect 重定向到 Google 登录
// GET /api/auth/google
func GoogleAuthRedirect(c *gin.Context) {
	// 生成随机 state 防止 CSRF
	stateBytes := make([]byte, 16)
	rand.Read(stateBytes)
	state := base64.RawURLEncoding.EncodeToString(stateBytes)

	// 将 state 存到 cookie
	c.SetCookie("oauth_state", state, 600, "/", "", false, true)

	authURL, err := googleAuthService.GetAuthURL(state)
	if err != nil {
		c.Redirect(http.StatusTemporaryRedirect, "/login/?error="+url.QueryEscape(err.Error()))
		return
	}

	c.Redirect(http.StatusTemporaryRedirect, authURL)
}

// GoogleAuthCallback 处理 Google OAuth 回调
// GET /api/auth/google/callback
func GoogleAuthCallback(c *gin.Context) {
	// 验证 state
	state := c.Query("state")
	cookieState, err := c.Cookie("oauth_state")
	if err != nil || state != cookieState {
		c.Redirect(http.StatusTemporaryRedirect, "/login/?error="+url.QueryEscape("无效的请求状态"))
		return
	}
	// 清除 state cookie
	c.SetCookie("oauth_state", "", -1, "/", "", false, true)

	code := c.Query("code")
	if code == "" {
		errorMsg := c.Query("error")
		if errorMsg == "" {
			errorMsg = "授权失败"
		}
		c.Redirect(http.StatusTemporaryRedirect, "/login/?error="+url.QueryEscape(errorMsg))
		return
	}

	resp, err := googleAuthService.HandleCallback(code)
	if err != nil {
		c.Redirect(http.StatusTemporaryRedirect, "/login/?error="+url.QueryEscape(err.Error()))
		return
	}

	// 仅传前端登录必需字段，减少URL长度，避免网关头部过大导致502
	userPayload := map[string]interface{}{
		"id":            resp.User.ID,
		"ID":            resp.User.ID, // 兼容前端历史字段
		"username":      resp.User.Username,
		"email":         resp.User.Email,
		"real_name":     resp.User.RealName,
		"phone":         resp.User.Phone,
		"department":    resp.User.Department,
		"source":        resp.User.Source,
		"status":        resp.User.Status,
		"last_login_at": resp.User.LastLoginAt,
		"mfa_enabled":   resp.User.MFAEnabled,
		"role_id":       resp.User.RoleID,
		"role": map[string]interface{}{
			"id":          resp.User.Role.ID,
			"name":        resp.User.Role.Name,
			"code":        resp.User.Role.Code,
			"description": resp.User.Role.Description,
		},
	}

	frontendResp := map[string]interface{}{
		"token":         resp.Token,
		"refresh_token": resp.RefreshToken,
		"mfa_required":  resp.MFARequired,
		"mfa_token":     resp.MFAToken,
		"user":          userPayload,
	}
	respJSON, _ := json.Marshal(frontendResp)
	encodedResp := base64.RawURLEncoding.EncodeToString(respJSON)
	c.Redirect(http.StatusTemporaryRedirect, "/login/?google_auth="+encodedResp)
}
