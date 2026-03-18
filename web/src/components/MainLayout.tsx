'use client';

import Sidebar from '@/components/Sidebar';
import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button, Avatar, Dropdown, Modal, Form, Input, Toast, Spin } from '@douyinfe/semi-ui';
import { IconUser, IconExit, IconShield, IconEdit } from '@douyinfe/semi-icons';
import { authApi, authUtils, userApi, type MFASetupResponse } from '@/lib/api';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';
import type { PasswordValidationResult } from '@/utils/password';
import { useSystem } from '@/contexts/SystemContext';

interface User {
  id: number;
  ID?: number;
  username: string;
  email: string;
  real_name: string;
  phone: string;
  department: string;
  status: number;
  last_login_at: string;
  mfa_enabled?: boolean;
  role_id: number;
  role?: {
    code?: string;
    name?: string;
  };
  role_code?: string;
}

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [selectedKey, setSelectedKey] = useState('home');
  const [user, setUser] = useState<User | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    real_name: '',
    email: '',
    phone: '',
    department: '',
  });
  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [passwordValidation, setPasswordValidation] = useState<PasswordValidationResult | null>(null);
  const [mfaSetup, setMFASetup] = useState<MFASetupResponse | null>(null);
  const [mfaCode, setMFACode] = useState('');
  const [mfaLoading, setMFALoading] = useState(false);
  const { systemInfo } = useSystem();
  const router = useRouter();
  const pathname = usePathname();

  // 获取角色显示名称（优先使用后端返回的role信息）
  const getRoleDisplayName = (current: User): string => {
    return authUtils.getRoleDisplayNameFromUser(current);
  };

  useEffect(() => {
    // 获取用户信息
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        setUser(userData);
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, []);



  // 根据当前路径设置选中的菜单项
  useEffect(() => {
    if (pathname === '/dashboard') {

      setSelectedKey('home');
    } else if (pathname.startsWith('/projects')) {
      // 匹配 /projects 和 /projects/* 路径
      setSelectedKey('projects');
    } else if (pathname.startsWith('/teams')) {
      setSelectedKey('teams');
    } else if (pathname.startsWith('/users')) {
      setSelectedKey('users');
    } else if (pathname.startsWith('/settings')) {
      // 匹配 /settings 和 /settings/* 路径
      setSelectedKey('settings');
    } else {
      // 默认选中首页
      setSelectedKey('home');
    }
  }, [pathname]);

  const handleNavSelect = (data: any) => {
    const selectedKey = data.selectedKeys[0];
    setSelectedKey(selectedKey);
    
    // 根据选中的菜单项跳转到对应页面
    switch (selectedKey) {
      case 'home':
        router.push('/dashboard');
        break;
      case 'projects':
        router.push('/projects');
        break;
      case 'teams':
        router.push('/teams');
        break;
      case 'users':
        router.push('/users');
        break;
      case 'settings':
        router.push('/settings');
        break;
      default:
        break;
    }
  };

  // 退出登录
  const handleLogout = () => {
    authUtils.clearLoginInfo();
    window.location.href = '/login';
  };

  // 打开个人信息编辑弹窗
  const handleOpenProfile = () => {
    if (user) {
      // 设置初始表单数据
      setProfileData({
        real_name: user.real_name || '',
        email: user.email || '',
        phone: user.phone || '',
        department: user.department || '',
      });
      setPasswordData({
        old_password: '',
        new_password: '',
        confirm_password: '',
      });
      setMFASetup(null);
      setMFACode('');
      setProfileModalVisible(true);
    }
  };

  const handleSetupMFA = async () => {
    setMFALoading(true);
    try {
      const response = await authApi.setupMFA();
      if (response.code === 200 && response.data) {
        setMFASetup(response.data);
        Toast.success('MFA密钥已生成，请在 Google Authenticator 中完成绑定');
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
      setMFALoading(false);
    }
  };

  const handleEnableMFA = async () => {
    if (!mfaCode.trim()) {
      Toast.error('请输入 Google Authenticator 验证码');
      return;
    }

    setMFALoading(true);
    try {
      const response = await authApi.enableMFA(mfaCode.trim());
      if (response.code === 200) {
        const updatedUser = { ...user!, mfa_enabled: true };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setMFASetup(null);
        setMFACode('');
        Toast.success('MFA启用成功');
      } else {
        Toast.error(response.msg || 'MFA启用失败');
      }
    } catch (error: unknown) {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { msg?: string } } }).response?.data?.msg === 'string'
          ? (error as { response?: { data?: { msg?: string } } }).response?.data?.msg
          : 'MFA启用失败';
      Toast.error(message);
    } finally {
      setMFALoading(false);
    }
  };

  // 保存个人信息
  const handleSaveProfile = async (values: any) => {
    setLoading(true);
    try {
      // 如果要修改密码，先验证密码一致性和复杂度
      if (values.old_password && values.new_password) {
        if (values.new_password !== values.confirm_password) {
          Toast.error('两次输入的密码不一致');
          return;
        }

        // 检查密码复杂度
        if (!passwordValidation || !passwordValidation.isValid) {
          Toast.error('新密码不符合安全要求，请检查密码强度提示');
          return;
        }
      }

      // 更新基本信息
      const profileUpdateData = {
        real_name: values.real_name,
        email: values.email,
        phone: values.phone,
        department: values.department,
      };

      const response = await userApi.updateProfile(profileUpdateData);
      if (response.code === 200) {
        const updatedUser = { ...user!, ...profileUpdateData };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        // 如果有密码修改
        if (values.old_password && values.new_password) {
          const passwordChangeData = {
            old_password: values.old_password,
            new_password: values.new_password,
          };
          
          const passwordResponse = await userApi.changePassword(passwordChangeData);
          if (passwordResponse.code === 200) {
            Toast.success('个人信息和密码修改成功');
            setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
          } else {
            Toast.error(passwordResponse.msg || '密码修改失败');
            return;
          }
        } else {
          Toast.success('个人信息修改成功');
        }
        
        setProfileModalVisible(false);
      } else {
        Toast.error(response.msg || '修改失败');
      }
    } catch (error: any) {
      console.error('修改个人信息失败:', error);
      Toast.error(error?.response?.data?.msg || '修改失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      height: '100vh',
      backgroundColor: 'var(--semi-color-bg-0)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 顶部导航栏 */}
      <div style={{
        height: '60px',
        backgroundColor: 'var(--semi-color-bg-0)',
        borderBottom: '1px solid var(--semi-color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        zIndex: 1000
      }}>
        {/* 左侧Logo */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <IconShield size="large" style={{ color: 'var(--semi-color-primary)' }} />
          <h1 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: '300',
            color: 'var(--semi-color-text-0)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            letterSpacing: '0.5px'
          }}>
            {systemInfo?.system_name || 'VulnMain'}
          </h1>
        </div>

        {/* 右侧用户信息 */}
        {user && (
          <Dropdown
            trigger="click"
            position="bottomRight"
            content={
              <div style={{ padding: '8px 0' }}>
                <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--semi-color-border)' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    {user.real_name || user.username}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--semi-color-text-2)', marginTop: '2px' }}>
                    {getRoleDisplayName(user)}
                  </div>
                </div>
                <Button
                  type="tertiary"
                  theme="borderless"
                  icon={<IconEdit />}
                  onClick={handleOpenProfile}
                  style={{ 
                    width: '100%', 
                    justifyContent: 'flex-start',
                    margin: '4px 0'
                  }}
                >
                  修改个人信息
                </Button>
                <Button
                  type="tertiary"
                  theme="borderless"
                  icon={<IconExit />}
                  onClick={handleLogout}
                  style={{ 
                    width: '100%', 
                    justifyContent: 'flex-start',
                    margin: '4px 0'
                  }}
                >
                  退出登录
                </Button>
              </div>
            }
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: '6px',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--semi-color-fill-0)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            >
              <Avatar 
                size="small" 
                style={{ backgroundColor: 'var(--semi-color-primary)' }}
              >
                <IconUser />
              </Avatar>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', lineHeight: '1.2' }}>
                  {user.real_name || user.username}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--semi-color-text-2)', lineHeight: '1.2' }}>
                  {getRoleDisplayName(user)}
                </div>
              </div>
            </div>
          </Dropdown>
        )}
      </div>

      {/* 主体内容区域 */}
      <div style={{ 
        display: 'flex', 
        flex: 1,
        overflow: 'hidden'
      }}>
        {/* 侧边导航栏 */}
        <Sidebar 
          selectedKey={selectedKey} 
          onSelect={handleNavSelect} 
        />
        
        {/* 主内容区域 */}
        <div style={{ 
          flex: 1, 
          overflow: 'auto',
          backgroundColor: 'var(--semi-color-bg-1)'
        }}>
          {children}
        </div>
      </div>

      {/* 个人信息编辑弹窗 */}
      <Modal
        title="修改个人信息"
        visible={profileModalVisible}
        onCancel={() => setProfileModalVisible(false)}
        onOk={() => {
          const allValues = { ...profileData, ...passwordData };
          handleSaveProfile(allValues);
        }}
        confirmLoading={loading}
        width={600}
        bodyStyle={{ maxHeight: '70vh', overflow: 'auto' }}
      >
        <div style={{ padding: '16px 0' }}>
          {/* 基本信息表单 */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', marginBottom: '16px' }}>
              <div style={{ width: '80px', textAlign: 'right', paddingRight: '12px', lineHeight: '32px' }}>姓名:</div>
              <Input
                value={profileData.real_name}
                onChange={(value) => setProfileData(prev => ({ ...prev, real_name: value }))}
                placeholder="请输入姓名"
                style={{ flex: 1 }}
              />
            </div>
            <div style={{ display: 'flex', marginBottom: '16px' }}>
              <div style={{ width: '80px', textAlign: 'right', paddingRight: '12px', lineHeight: '32px' }}>邮箱:</div>
              <Input
                value={profileData.email}
                onChange={(value) => setProfileData(prev => ({ ...prev, email: value }))}
                placeholder="请输入邮箱"
                style={{ flex: 1 }}
              />
            </div>
            <div style={{ display: 'flex', marginBottom: '16px' }}>
              <div style={{ width: '80px', textAlign: 'right', paddingRight: '12px', lineHeight: '32px' }}>手机号:</div>
              <Input
                value={profileData.phone}
                onChange={(value) => setProfileData(prev => ({ ...prev, phone: value }))}
                placeholder="请输入手机号"
                style={{ flex: 1 }}
              />
            </div>
            <div style={{ display: 'flex', marginBottom: '16px' }}>
              <div style={{ width: '80px', textAlign: 'right', paddingRight: '12px', lineHeight: '32px' }}>部门:</div>
              <Input
                value={profileData.department}
                onChange={(value) => setProfileData(prev => ({ ...prev, department: value }))}
                placeholder="请输入部门"
                style={{ flex: 1 }}
              />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--semi-color-border)', paddingTop: '24px', marginBottom: '24px' }}>
            <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '12px' }}>
              多因素认证
            </div>
            <div style={{ color: 'var(--semi-color-text-1)', lineHeight: '1.8', marginBottom: '16px' }}>
              {user?.mfa_enabled
                ? '当前账号已启用 Google Authenticator 二次验证。如需关闭，请联系管理员在系统设置中操作。'
                : '启用后，登录时需要额外输入 Google Authenticator 动态验证码。'}
            </div>

            {!user?.mfa_enabled && !mfaSetup && (
              <Button theme="solid" type="primary" loading={mfaLoading} onClick={handleSetupMFA}>
                开始绑定 Google Authenticator
              </Button>
            )}

            {!user?.mfa_enabled && mfaSetup && (
              <div style={{
                background: 'var(--semi-color-fill-0)',
                border: '1px solid var(--semi-color-border)',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <div style={{ marginBottom: '12px', color: 'var(--semi-color-text-0)' }}>
                  请在 Google Authenticator 中选择“输入设置密钥”，然后录入以下信息：
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>账户：</strong>{mfaSetup.account}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>发行方：</strong>{mfaSetup.issuer}
                </div>
                <div style={{ marginBottom: '12px', wordBreak: 'break-all' }}>
                  <strong>密钥：</strong>{mfaSetup.secret}
                </div>
                <div style={{ marginBottom: '16px', color: 'var(--semi-color-text-2)', wordBreak: 'break-all' }}>
                  otpauth URL: {mfaSetup.otpauth_url}
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <Input
                    value={mfaCode}
                    onChange={setMFACode}
                    placeholder="输入 6 位验证码完成绑定"
                    maxLength={6}
                    style={{ flex: 1 }}
                  />
                  <Button theme="solid" type="primary" loading={mfaLoading} onClick={handleEnableMFA}>
                    确认启用
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* 密码修改表单 */}
          <div style={{ borderTop: '1px solid var(--semi-color-border)', paddingTop: '24px' }}>
            <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '16px' }}>
              修改密码 (可选)
            </div>
            <div>
              <div style={{ display: 'flex', marginBottom: '16px' }}>
                <div style={{ width: '80px', textAlign: 'right', paddingRight: '12px', lineHeight: '32px' }}>原密码:</div>
                <Input
                  mode="password"
                  value={passwordData.old_password}
                  onChange={(value) => setPasswordData(prev => ({ ...prev, old_password: value }))}
                  placeholder="请输入原密码"
                  style={{ flex: 1 }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', marginBottom: '8px' }}>
                  <div style={{ width: '80px', textAlign: 'right', paddingRight: '12px', lineHeight: '32px' }}>新密码:</div>
                  <Input
                    mode="password"
                    value={passwordData.new_password}
                    onChange={(value) => setPasswordData(prev => ({ ...prev, new_password: value }))}
                    placeholder="请输入新密码"
                    style={{ flex: 1 }}
                  />
                </div>
                {/* 密码强度指示器 */}
                <div style={{ marginLeft: '92px' }}>
                  <PasswordStrengthIndicator
                    password={passwordData.new_password}
                    onValidationChange={setPasswordValidation}
                    showRequirements={true}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', marginBottom: '16px' }}>
                <div style={{ width: '80px', textAlign: 'right', paddingRight: '12px', lineHeight: '32px' }}>确认密码:</div>
                <Input
                  mode="password"
                  value={passwordData.confirm_password}
                  onChange={(value) => setPasswordData(prev => ({ ...prev, confirm_password: value }))}
                  placeholder="请再次输入新密码"
                  style={{ flex: 1 }}
                />
              </div>
              {passwordData.confirm_password && passwordData.new_password && passwordData.confirm_password !== passwordData.new_password && (
                <div style={{ color: 'var(--semi-color-danger)', fontSize: '12px', marginLeft: '92px', marginTop: '-12px', marginBottom: '16px' }}>
                  两次输入的密码不一致
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
} 
