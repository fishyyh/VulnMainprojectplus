'use client';

import { useEffect, useState } from 'react';
import { Button, Input, Toast, Typography } from '@douyinfe/semi-ui';
import { authApi, authUtils, type MFASetupResponse } from '@/lib/api';
import Image from 'next/image';
import QRCode from 'qrcode';

const { Title, Text } = Typography;

interface UserInfo {
  username?: string;
  real_name?: string;
  email?: string;
  mfa_enabled?: boolean;
}

export default function MFASetupPage() {
  const [setupInfo, setSetupInfo] = useState<MFASetupResponse | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
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

  useEffect(() => {
    let active = true;

    const renderQRCode = async () => {
      if (!setupInfo?.otpauth_url) {
        setQrCodeUrl('');
        return;
      }

      try {
        const url = await QRCode.toDataURL(setupInfo.otpauth_url, {
          width: 240,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#0f172a',
            light: '#FFFFFFFF',
          },
        });

        if (active) {
          setQrCodeUrl(url);
        }
      } catch (error) {
        console.error('生成MFA二维码失败:', error);
        if (active) {
          setQrCodeUrl('');
        }
      }
    };

    renderQRCode();

    return () => {
      active = false;
    };
  }, [setupInfo]);

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

  const handleCopy = async (label: string, value?: string) => {
    if (!value) {
      Toast.error(`没有可复制的${label}`);
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      Toast.success(`${label}已复制`);
    } catch (error) {
      console.error(`复制${label}失败:`, error);
      Toast.error(`复制${label}失败`);
    }
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
          <div style={{ marginBottom: '18px', display: 'grid', gap: '16px' }}>
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.06), rgba(16, 185, 129, 0.06))',
                border: '1px solid rgba(59, 130, 246, 0.12)',
                borderRadius: '16px',
                padding: '18px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>方式一：扫码绑定</div>
                  <Text style={{ color: '#64748b', lineHeight: 1.7 }}>
                    打开 Google Authenticator，选择“扫描二维码”，扫描下方二维码即可自动导入。
                  </Text>
                </div>
                <Button theme="borderless" type="tertiary" onClick={() => handleCopy('otpauth URL', setupInfo.otpauth_url)}>
                  复制链接
                </Button>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: '272px',
                  borderRadius: '16px',
                  background: '#ffffff',
                  border: '1px dashed rgba(15, 23, 42, 0.12)',
                }}
              >
                {qrCodeUrl ? (
                  <Image
                    src={qrCodeUrl}
                    alt="MFA QR Code"
                    width={240}
                    height={240}
                    unoptimized
                    style={{ display: 'block' }}
                  />
                ) : (
                  <Text style={{ color: '#64748b' }}>二维码生成中...</Text>
                )}
              </div>
            </div>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid rgba(15, 23, 42, 0.08)',
                borderRadius: '16px',
                padding: '18px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>方式二：手动输入密钥</div>
                  <Text style={{ color: '#64748b', lineHeight: 1.7 }}>
                    如果当前设备无法扫码，可以在 Google Authenticator 中选择“输入设置密钥”，按下面信息手动录入。
                  </Text>
                </div>
                <Button theme="borderless" type="tertiary" onClick={() => handleCopy('MFA密钥', setupInfo.secret)}>
                  复制密钥
                </Button>
              </div>

              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <Text type="secondary">账户</Text>
                  <div style={{ marginTop: '6px', color: '#0f172a', fontWeight: 600 }}>{setupInfo.account}</div>
                </div>
                <div>
                  <Text type="secondary">发行方</Text>
                  <div style={{ marginTop: '6px', color: '#0f172a', fontWeight: 600 }}>{setupInfo.issuer}</div>
                </div>
                <div>
                  <Text type="secondary">密钥</Text>
                  <div
                    style={{
                      marginTop: '6px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      background: '#ffffff',
                      border: '1px solid rgba(15, 23, 42, 0.08)',
                      wordBreak: 'break-all',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      letterSpacing: '1px',
                      color: '#0f172a',
                    }}
                  >
                    {setupInfo.secret}
                  </div>
                </div>
              </div>
            </div>
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
