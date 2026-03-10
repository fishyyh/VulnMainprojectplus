'use client';

import { useState, useEffect, useCallback } from 'react';
import { Form, Button, Toast, Typography, Divider } from '@douyinfe/semi-ui';
import { IconUser, IconLock, IconEyeOpened, IconEyeClosed } from '@douyinfe/semi-icons';
import { authApi, authUtils, systemApi, type LoginRequest, type SystemInfo } from '@/lib/api';

const { Title, Text } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);

    const error = params.get('error');
    if (error) {
      Toast.error('Google 登录失败: ' + decodeURIComponent(error));
      window.history.replaceState({}, '', '/login/');
      return;
    }

    const encoded = params.get('google_auth');
    if (encoded) {
      try {
        // hex decode
        const json = new TextDecoder().decode(
          new Uint8Array(encoded.match(/.{1,2}/g)!.map(b => parseInt(b, 16)))
        );
        const resp = JSON.parse(json);
        authUtils.saveLoginInfo(resp);
        Toast.success('Google 登录成功！');
        setTimeout(() => { window.location.href = '/dashboard'; }, 500);
      } catch (e) {
        Toast.error('Google 登录数据解析失败');
        window.history.replaceState({}, '', '/login/');
      }
    }
  }, []);

  // 检查是否已登录 & 处理 Google 回调
  useEffect(() => {
    if (typeof window !== 'undefined' && authUtils.isLoggedIn()) {
      window.location.href = '/dashboard';
      return;
    }
    handleGoogleCallback();
  }, [handleGoogleCallback]);

  // 处理登录提交
  const handleSubmit = async (values: any) => {
    if (!values.UserName || !values.UserName) {
      Toast.error('请输入用户名和密码');
      return;
    }

    setLoading(true);
    try {
      const loginData: LoginRequest = {
        username: values.UserName.trim(),
        password: values.PassWord
      };

      const response = await authApi.login(loginData);
      
      if (response.code === 200 && response.data) {
        authUtils.saveLoginInfo(response.data);
        Toast.success('登录成功！');
        
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);
      } else {
        Toast.error(response.msg || '登录失败');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      
      let errorMessage = '登录失败，请重试';
      if (err.response?.data?.msg) {
        errorMessage = err.response.data.msg;
      } else if (err.response?.status === 401) {
        errorMessage = '用户名或密码错误';
      }
      
      Toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

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
          
          {/* 登录表单 */}
          <Form onSubmit={handleSubmit} style={{ width: '100%' }}>
            
          {/* 用户名输入框 */}
            <div style={{ marginBottom: isMobile ? '24px' : (isTablet ? '26px' : '28px'), position: 'relative' }}>
            <Form.Input
                field="UserName"  
                placeholder="请输入用户名"
                prefix={<IconUser style={{ color: '#3b82f6', fontSize: isMobile ? '14px' : '16px' }} />}
              size="large"
                rules={[{ required: true, message: '请输入用户名' }]}
              style={{
                  height: isMobile ? '52px' : (isTablet ? '54px' : '56px'),
                  border: '1px solid #e2e8f0',
                  borderRadius: isMobile ? '10px' : '12px',
                  backgroundColor: '#ffffff',
                  fontSize: isMobile ? '14px' : '15px',
                  color: '#1e293b',
                  fontWeight: '500',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                  '--semi-color-fill-0': '#ffffff',
                  '--semi-color-fill-1': '#f8fafc',
                  '--semi-color-border': '#e2e8f0',
                  '--semi-color-border-hover': '#3b82f6',
                  '--semi-color-border-focus': '#3b82f6',
                  '--semi-color-focus-border': '#3b82f6',
                  '--semi-color-text-0': '#1e293b',
                  '--semi-color-text-1': '#334155',
                  '--semi-color-text-2': '#64748b'
                } as any}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1), 0 4px 12px rgba(0, 0, 0, 0.08)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04)';
              }}
            />
          </div>

          {/* 密码输入框 */}
            <div style={{ marginBottom: isMobile ? '32px' : (isTablet ? '34px' : '36px'), position: 'relative' }}>
              <Form.Input
                field="PassWord"
                type={showPassword ? 'text' : 'PassWord'}
                placeholder="请输入密码"
                prefix={<IconLock style={{ color: '#3b82f6', fontSize: isMobile ? '14px' : '16px' }} />}
                suffix={
                  <button
                    type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ 
                      background: 'none',
                  border: 'none',
                      cursor: 'pointer',
                      padding: isMobile ? '6px' : '8px',
                      color: '#64748b',
                      borderRadius: '6px',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f1f5f9';
                      e.currentTarget.style.color = '#3b82f6';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#64748b';
                    }}
                  >
                    {showPassword ? <IconEyeClosed /> : <IconEyeOpened />}
                  </button>
                }
              size="large"
              rules={[{ required: true, message: '请输入密码' }]}
              style={{
                  height: isMobile ? '52px' : (isTablet ? '54px' : '56px'),
                  border: '1px solid #e2e8f0',
                  borderRadius: isMobile ? '10px' : '12px',
                  backgroundColor: '#ffffff',
                  fontSize: isMobile ? '14px' : '15px',
                  color: '#1e293b',
                  fontWeight: '500',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                  '--semi-color-fill-0': '#ffffff',
                  '--semi-color-fill-1': '#f8fafc',
                  '--semi-color-border': '#e2e8f0',
                  '--semi-color-border-hover': '#3b82f6',
                  '--semi-color-border-focus': '#3b82f6',
                  '--semi-color-focus-border': '#3b82f6',
                  '--semi-color-text-0': '#1e293b',
                  '--semi-color-text-1': '#334155',
                  '--semi-color-text-2': '#64748b'
                } as any}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1), 0 4px 12px rgba(0, 0, 0, 0.08)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04)';
              }}
            />
          </div>

          {/* 登录按钮 */}
          <Button
            theme="solid"
            type="primary"
            htmlType="submit"
            loading={loading}
            block
              size="large"
            style={{
                height: isMobile ? '52px' : (isTablet ? '55px' : '58px'),
                fontSize: isMobile ? '15px' : '16px',
                fontWeight: '600',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 50%, #10b981 100%)',
              border: 'none',
                borderRadius: isMobile ? '12px' : '14px',
                boxShadow: '0 8px 24px rgba(59, 130, 246, 0.25), 0 2px 8px rgba(0, 0, 0, 0.08)',
                transition: 'all 0.3s ease',
                letterSpacing: '0.5px',
                position: 'relative',
                overflow: 'hidden',
                color: '#ffffff'
            }}
            onMouseEnter={(e) => {
                if (!isMobile) {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(59, 130, 246, 0.35), 0 4px 12px rgba(0, 0, 0, 0.12)';
                }
            }}
            onMouseLeave={(e) => {
                if (!isMobile) {
              e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.25), 0 2px 8px rgba(0, 0, 0, 0.08)';
                }
              }}
            >
              <span style={{ position: 'relative', zIndex: 1 }}>
                {loading ? '登录中...' : '立即登录'}
              </span>
              {/* 按钮光效 */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
                transition: 'left 0.8s',
                zIndex: 0
              }} />
          </Button>

            {/* 记住我选项 */}
            <div style={{ 
              textAlign: 'left', 
              marginTop: isMobile ? '16px' : '20px',
              marginBottom: isMobile ? '24px' : '28px'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: isMobile ? '13px' : '14px',
                color: '#64748b',
                fontWeight: '500'
              }}>
                <input 
                  type="checkbox" 
                  style={{
                    marginRight: isMobile ? '6px' : '8px',
                    accentColor: '#3b82f6',
                    transform: isMobile ? 'scale(1)' : 'scale(1.1)'
                  }}
                />
                记住登录状态
              </label>
            </div>

            {/* Google 登录 */}
            <Divider style={{ margin: isMobile ? '0 0 20px' : '0 0 24px', color: '#94a3b8', fontSize: '13px' }}>
              或使用其他方式登录
            </Divider>
            <Button
              block
              size="large"
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
              onMouseEnter={(e: any) => {
                e.currentTarget.style.borderColor = '#4285F4';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(66, 133, 244, 0.15)';
              }}
              onMouseLeave={(e: any) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
              }}
              onClick={() => {
                window.location.href = '/api/auth/google';
              }}
            >
              使用 Google 账号登录
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

          </Form>
        </div>
      </div>
    </div>
  );
}
