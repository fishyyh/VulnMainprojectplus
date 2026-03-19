'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Toast, Typography } from '@douyinfe/semi-ui';
import { authUtils, systemApi, type SystemInfo } from '@/lib/api';

const { Title, Text } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo>({
    system_name: 'VulnMain',
    company_name: 'VulnMain',
    logo: '',
    version: '1.0.0'
  });

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 768);
      setIsTablet(width > 768 && width <= 1024);
    };

    handleResize(); // 初始检查
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 获取系统信息
  useEffect(() => {
    const fetchSystemInfo = async () => {
      try {
        const response = await systemApi.getPublicInfo();
        if (response.code === 200 && response.data) {
          setSystemInfo(response.data);
        }
      } catch (error) {
        console.error('获取系统信息失败:', error);
      }
    };

    fetchSystemInfo();
  }, []);

  // 处理 Google OAuth 回调参数
  const handleGoogleCallback = useCallback(() => {
    const decodeGoogleAuthPayload = (encoded: string): string => {
      // New format: base64url
      try {
        const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
        return atob(padded);
      } catch {
        // Legacy format: hex
        const pairs = encoded.match(/.{1,2}/g);
        if (!pairs) {
          throw new Error('invalid google_auth payload');
        }
        return new TextDecoder().decode(
          new Uint8Array(pairs.map((b) => parseInt(b, 16)))
        );
      }
    };

    if (typeof window === 'undefined') return;
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const params = new URLSearchParams(hash || window.location.search);

    const clearLoginPayload = () => {
      window.history.replaceState({}, '', '/login');
    };

    const error = params.get('error');
    if (error) {
      Toast.error('Google 登录失败: ' + decodeURIComponent(error));
      clearLoginPayload();
      return;
    }

    const encoded = params.get('google_auth');
    if (encoded) {
      try {
        const json = decodeGoogleAuthPayload(encoded);
        const resp = JSON.parse(json);
        clearLoginPayload();
        if (resp.mfa_required && resp.mfa_token) {
          authUtils.savePendingMFA(resp.mfa_token, resp.user);
          Toast.success('请输入 Google Authenticator 验证码');
          window.location.href = '/login/mfa';
          return;
        }
        authUtils.saveLoginInfo(resp);
        Toast.success('Google 登录成功！');
        window.location.href = '/';
      } catch {
        Toast.error('Google 登录数据解析失败');
        clearLoginPayload();
      }
    }
  }, []);

  // 检查是否已登录 & 处理 Google 回调
  useEffect(() => {
    if (typeof window !== 'undefined' && authUtils.isLoggedIn()) {
      const user = authUtils.getCurrentUser();
      if (user && user.mfa_enabled === false) {
        window.location.href = '/mfa/setup';
        return;
      }
      window.location.href = '/';
      return;
    }
    handleGoogleCallback();
  }, [handleGoogleCallback]);

  return (
    <div style={{ 
      display: 'flex', 
      minHeight: '100vh',
      flexDirection: isMobile ? 'column' : 'row'
    }}>
      {/* 左侧 - 背景图片 */}
      {!isMobile && (
        <div
          style={{
            width: isTablet ? '35%' : '40%',
            backgroundImage: 'url("/login.jpg")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            pointerEvents: 'none',
            minWidth: isTablet ? '250px' : '300px'
          }}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
        />
      )}

      {/* 移动设备顶部背景图片 */}
      {isMobile && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '35vh',
            backgroundImage: 'url("/login.jpg")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            pointerEvents: 'none',
            opacity: 0.3,
            zIndex: 0
          }}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
        />
      )}

      {/* 右侧 - 登录表单 */}
      <div 
        style={{
          width: isMobile ? '100%' : (isTablet ? '65%' : '60%'),
          background: isMobile 
            ? 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' 
            : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isMobile ? '20px' : (isTablet ? '30px' : '40px'),
          position: 'relative',
          overflow: 'hidden',
          minHeight: isMobile ? '100vh' : 'auto',
          zIndex: 1
        }}
      >
        {/* 背景装饰 */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.08) 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, rgba(139, 92, 246, 0.06) 0%, transparent 50%)
          `,
          opacity: 0.4
        }} />
        
        {/* 几何装饰 */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            linear-gradient(rgba(59, 130, 246, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.06) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          opacity: 0.2
        }} />

        <div 
          style={{ 
            width: '100%', 
            maxWidth: isMobile ? '100%' : (isTablet ? '420px' : '480px'), 
            position: 'relative', 
            zIndex: 2,
            background: isMobile ? 'rgba(255, 255, 255, 0.98)' : 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(59, 130, 246, 0.15)',
            borderRadius: isMobile ? '16px' : '20px',
            padding: isMobile ? '32px 24px' : (isTablet ? '36px' : '48px'),
            boxShadow: isMobile 
              ? '0 25px 50px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.1)'
              : '0 20px 40px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(59, 130, 246, 0.08)',
            transition: 'all 0.3s ease',
            margin: isMobile ? '20vh auto 0' : 'auto',
            marginTop: isMobile ? '40vh' : 'auto'
          }}
          onMouseEnter={(e) => {
            if (!isMobile) {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 28px 48px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(59, 130, 246, 0.12)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isMobile) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(59, 130, 246, 0.08)';
            }
          }}
        >
          
          {/* 标题区域 */}
          <div style={{ textAlign: 'center', marginBottom: isMobile ? '32px' : (isTablet ? '36px' : '44px') }}>
            {/* 精致图标 */}
            <div style={{
              width: isMobile ? '60px' : (isTablet ? '66px' : '72px'),
              height: isMobile ? '60px' : (isTablet ? '66px' : '72px'),
              margin: isMobile ? '0 auto 16px' : (isTablet ? '0 auto 20px' : '0 auto 24px'),
              background: 'linear-gradient(135deg, #3b82f6, #10b981)',
              borderRadius: isMobile ? '15px' : (isTablet ? '16px' : '18px'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 12px 40px rgba(59, 130, 246, 0.25), 0 4px 12px rgba(0, 0, 0, 0.1)',
              position: 'relative',
              transform: 'rotate(-2deg)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              if (!isMobile) {
                e.currentTarget.style.transform = 'rotate(0deg) scale(1.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isMobile) {
                e.currentTarget.style.transform = 'rotate(-2deg) scale(1)';
              }
            }}>
              <div style={{
                position: 'absolute',
                inset: '3px',
                background: 'linear-gradient(135deg, #1e40af, #059669)',
                borderRadius: isMobile ? '12px' : (isTablet ? '13px' : '15px'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width={isMobile ? "24" : (isTablet ? "28" : "32")} height={isMobile ? "24" : (isTablet ? "28" : "32")} viewBox="0 0 24 24" fill="none" style={{ color: 'white' }}>
                  <path d="M12 2l2.09 6.26L22 9l-7.91.74L12 16l-2.09-6.26L2 9l7.91-.74L12 2z" fill="currentColor"/>
                  <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.4"/>
                </svg>
            </div>
          </div>
          
            <Title heading={2} style={{ 
              margin: '0 0 12px 0', 
              color: '#1e293b',
              fontSize: isMobile ? '22px' : (isTablet ? '25px' : '28px'),
              fontWeight: '700',
              letterSpacing: '-0.5px',
              lineHeight: 1.2
            }}>
            {systemInfo.company_name}
          </Title>
            <Text style={{ 
              color: '#64748b', 
              fontSize: isMobile ? '13px' : (isTablet ? '14px' : '15px'),
              letterSpacing: '0.3px',
              fontWeight: '500',
              lineHeight: 1.4
            }}>
              漏洞管理平台 · Vulnerability Management Platform
            </Text>
            
            {/* 精致装饰线 */}
            <div style={{
              width: isMobile ? '60px' : (isTablet ? '70px' : '80px'),
              height: isMobile ? '2px' : '3px',
              background: 'linear-gradient(90deg, #3b82f6, #10b981)',
              margin: isMobile ? '16px auto 0' : (isTablet ? '18px auto 0' : '20px auto 0'),
              borderRadius: '2px',
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
            }} />
          </div>
          
          <div style={{ width: '100%' }}>
            <div style={{
              marginBottom: isMobile ? '24px' : '28px',
              padding: isMobile ? '16px' : '18px',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(16, 185, 129, 0.08))',
              border: '1px solid rgba(59, 130, 246, 0.15)',
              borderRadius: isMobile ? '12px' : '14px',
              color: '#475569',
              fontSize: isMobile ? '13px' : '14px',
              lineHeight: 1.7
            }}>
              当前仅开放 Google 单点登录。
            </div>

            <Button
              block
              size="large"
              loading={loading}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: 8 }}>
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              }
              style={{
                height: isMobile ? '48px' : '52px',
                fontSize: '14px',
                fontWeight: '500',
                background: '#ffffff',
                color: '#1e293b',
                border: '1px solid #e2e8f0',
                borderRadius: isMobile ? '10px' : '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                transition: 'all 0.3s ease',
                marginBottom: isMobile ? '16px' : '20px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#4285F4';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(66, 133, 244, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
              }}
              onClick={() => {
                setLoading(true);
                window.location.href = '/api/auth/google';
              }}
            >
              {loading ? '跳转到 Google...' : '使用 Google 账号登录'}
            </Button>

            {/* 底部提示 */}
            <div style={{ textAlign: 'center', marginTop: isMobile ? '28px' : '32px' }}>
              
              
              {/* 底部版权信息 */}
              {!isMobile && (
                <div style={{
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '16px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Text style={{ 
                    color: '#94a3b8', 
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span>💎</span>
                    Powered by VulnMain Management Platform
          </Text>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
