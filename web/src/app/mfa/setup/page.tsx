'use client';

import { useEffect, useState } from 'react';
import { Button, Input, Toast, Typography } from '@douyinfe/semi-ui';
import { authApi, authUtils, type MFASetupResponse } from '@/lib/api';

const { Title, Text } = Typography;

interface UserInfo {
  username?: string;
  real_name?: string;
  email?: string;
  mfa_enabled?: boolean;
}

export default function MFASetupPage() {
  const [setupInfo, setSetupInfo] = useState<MFASetupResponse | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!authUtils.isLoggedIn()) {
      window.location.href = '/login';
      return;
    }

    const currentUser = authUtils.getCurrentUser() as UserInfo | null;
    setUser(currentUser);
    if (currentUser?.mfa_enabled) {
      window.location.href = '/';
      return;
    }

    loadSetupInfo();
  }, []);

  const loadSetupInfo = async () => {
    setLoading(true);
    try {
      const response = await authApi.setupMFA();
      if (response.code === 200 && response.data) {
        setSetupInfo(response.data);
      } else {
        Toast.error(response.msg || '生成MFA密钥失败');
      }
    } catch (error: unknown) {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { msg?: string } } }).response?.data?.msg === 'string'
          ? (error as { response?: { data?: { msg?: string } } }).response?.data?.msg
          : '生成MFA密钥失败';
      Toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async () => {
    if (!code.trim()) {
      Toast.error('请输入 Google Authenticator 验证码');
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.enableMFA(code.trim());
      if (response.code === 200) {
        const updatedUser = { ...(authUtils.getCurrentUser() || {}), mfa_enabled: true };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        Toast.success('MFA 启用成功');
        window.location.href = '/';
      } else {
        Toast.error(response.msg || 'MFA 启用失败');
      }
    } catch (error: unknown) {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { msg?: string } } }).response?.data?.msg === 'string'
          ? (error as { response?: { data?: { msg?: string } } }).response?.data?.msg
          : 'MFA 启用失败';
      Toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    authUtils.clearLoginInfo();
    window.location.href = '/login';
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f8fafc 0%, #dbeafe 100%)',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'rgba(255, 255, 255, 0.96)',
          borderRadius: '24px',
          border: '1px solid rgba(59, 130, 246, 0.12)',
          boxShadow: '0 24px 48px rgba(15, 23, 42, 0.10)',
          padding: '40px 36px',
        }}
      >
        <Title heading={3} style={{ marginTop: 0, marginBottom: '10px', color: '#0f172a' }}>
          启用多因素认证
        </Title>
        <Text style={{ display: 'block', color: '#475569', lineHeight: 1.8, marginBottom: '20px' }}>
          {user?.real_name || user?.username || user?.email || '当前账号'} 需要先绑定 Google Authenticator，完成后才能继续使用系统。
        </Text>

        {setupInfo && (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.06), rgba(16, 185, 129, 0.06))',
              border: '1px solid rgba(59, 130, 246, 0.12)',
              borderRadius: '16px',
              padding: '18px 18px 6px',
              marginBottom: '18px',
            }}
          >
            <div style={{ marginBottom: '10px' }}>
              <strong>账户：</strong>{setupInfo.account}
            </div>
            <div style={{ marginBottom: '10px' }}>
              <strong>发行方：</strong>{setupInfo.issuer}
            </div>
            <div style={{ marginBottom: '10px', wordBreak: 'break-all' }}>
              <strong>密钥：</strong>{setupInfo.secret}
            </div>
            <div style={{ marginBottom: '12px', wordBreak: 'break-all', color: '#64748b' }}>
              otpauth URL: {setupInfo.otpauth_url}
            </div>
            <Text style={{ color: '#64748b', lineHeight: 1.8 }}>
              请在 Google Authenticator 中选择“输入设置密钥”，录入上面的账户、发行方和密钥，然后输入当前 6 位动态验证码完成绑定。
            </Text>
          </div>
        )}

        <Input
          value={code}
          onChange={setCode}
          placeholder="请输入 6 位验证码"
          maxLength={6}
          size="large"
          onEnterPress={handleEnable}
          style={{
            marginBottom: '18px',
            letterSpacing: '6px',
            fontSize: '20px',
            textAlign: 'center',
          }}
        />

        <div style={{ display: 'flex', gap: '12px' }}>
          <Button block type="tertiary" size="large" onClick={handleLogout}>
            退出登录
          </Button>
          <Button block theme="solid" type="primary" size="large" loading={loading} onClick={handleEnable}>
            启用并继续
          </Button>
        </div>
      </div>
    </div>
  );
}
