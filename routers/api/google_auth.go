package api

import (
	"crypto/rand"
	"encoding/hex"
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
	state := hex.EncodeToString(stateBytes)

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

	// 将登录信息编码后通过 URL 传给前端
	respJSON, _ := json.Marshal(resp)
	encodedResp := hex.EncodeToString(respJSON)
	c.Redirect(http.StatusTemporaryRedirect, "/login/?google_auth="+encodedResp)
}
