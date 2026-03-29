'use client';

import { useEffect, useState } from 'react';
import { Button, Input, Toast, Typography } from '@douyinfe/semi-ui';
import { authApi, authUtils } from '@/lib/api';

const { Title, Text } = Typography;

export default function MFALoginPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (authUtils.isLoggedIn()) {
      window.location.href = '/';
      return;
    }

    const mfaToken = authUtils.getPendingMFAToken();
    const pendingUser = authUtils.getPendingMFAUser();
    if (!mfaToken) {
      window.location.href = '/login';
      return;
    }

    if (pendingUser) {
      setUserName(pendingUser.real_name || pendingUser.username || pendingUser.email || '');
    }
  }, []);

  const handleVerify = async () => {
    const mfaToken = authUtils.getPendingMFAToken();
    if (!mfaToken) {
      Toast.error('MFA 会话已失效，请重新登录');
      window.location.href = '/login';
      return;
    }

    if (!code.trim()) {
      Toast.error('请输入 6 位验证码');
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.verifyMFA({
        mfa_token: mfaToken,
        code: code.trim(),
      });

      if (response.code === 200 && response.data) {
        authUtils.saveLoginInfo(response.data);
        Toast.success('验证成功');
        window.location.href = '/';
        return;
      }

      Toast.error(response.msg || '验证失败');
    } catch (error: unknown) {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { msg?: string } } }).response?.data?.msg === 'string'
          ? (error as { response?: { data?: { msg?: string } } }).response?.data?.msg
          : '验证失败';
      Toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    authUtils.clearPendingMFA();
    window.location.href = '/login';
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'rgba(255, 255, 255, 0.96)',
          borderRadius: '20px',
          border: '1px solid rgba(59, 130, 246, 0.12)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.08)',
          padding: '36px 32px',
        }}
      >
        <Title heading={3} style={{ marginTop: 0, marginBottom: '12px', color: '#1e293b' }}>
          二次验证
        </Title>
        <Text style={{ display: 'block', color: '#64748b', marginBottom: '8px', lineHeight: 1.7 }}>
          {userName ? `${userName}，请输入 Google Authenticator 中的 6 位动态验证码。` : '请输入 Google Authenticator 中的 6 位动态验证码。'}
        </Text>
        <Text style={{ display: 'block', color: '#94a3b8', marginBottom: '24px', lineHeight: 1.7 }}>
          验证通过后才会签发正式登录令牌。
        </Text>

        <Input
          value={code}
          onChange={setCode}
          placeholder="请输入 6 位验证码"
          maxLength={6}
          size="large"
          onEnterPress={handleVerify}
          style={{
            marginBottom: '20px',
            letterSpacing: '6px',
            fontSize: '20px',
            textAlign: 'center',
          }}
        />

        <div style={{ display: 'flex', gap: '12px' }}>
          <Button block type="tertiary" size="large" onClick={handleBack}>
            返回登录
          </Button>
          <Button block theme="solid" type="primary" size="large" loading={loading} onClick={handleVerify}>
            验证并登录
          </Button>
        </div>
      </div>
    </div>
  );
}
