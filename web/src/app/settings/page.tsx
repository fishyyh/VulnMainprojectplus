'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Typography,
  Button,
  Form,
  Input,
  Space,
  Divider,
  Toast,
  Spin,
  Tabs,
  TabPane,
  Table,
  Tag,
  Modal,
  Select
} from '@douyinfe/semi-ui';
import {
  IconSave,
  IconRefresh,
  IconLoading,
  IconSetting,
  IconCalendar,
  IconMail,
  IconLock,
  IconUpload,
  IconUser,
  IconShield
} from '@douyinfe/semi-icons';
import { systemApi, SystemConfig, ConfigUpdateRequest, weeklyReportApi, resolveImageUrl, mfaAdminApi, User } from '@/lib/api';
import { notifyPasswordPolicyUpdated } from '@/utils/password';
import { notifySystemInfoUpdated } from '@/utils/system';

const { Title, Text } = Typography;

// 配置组映射
const CONFIG_GROUPS = {
  system: {
    title: '基本设置',
    description: '系统基本信息配置',
    icon: <IconSetting />,
    key: 'system'
  },
  auth: {
    title: '认证设置',
    description: '用户认证和安全策略配置',
    icon: <IconUser />,
    key: 'auth'
  },
  email: {
    title: '邮件设置',
    description: '邮件服务器和通知配置',
    icon: <IconMail />,
    key: 'email'
  },
  password: {
    title: '密码策略',
    description: '密码复杂度和安全策略',
    icon: <IconLock />,
    key: 'password'
  },
  upload: {
    title: '文件上传',
    description: '文件上传限制和类型配置',
    icon: <IconUpload />,
    key: 'upload'
  },
  ldap: {
    title: 'LDAP 设置',
    description: '配置LDAP连接与同步策略',
    icon: <IconUser />,
    key: 'ldap'
  },
};

export default function SettingsPage() {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [activeTab, setActiveTab] = useState('system');

  // 周报相关状态
  const [weeklyReports, setWeeklyReports] = useState<any[]>([]);
  const [weeklyReportLoading, setWeeklyReportLoading] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  // LDAP相关状态
  const [testingLDAP, setTestingLDAP] = useState(false);
  const [syncingLDAP, setSyncingLDAP] = useState(false);
  // 立即展开/折叠LDAP配置项的本地状态
  // 简单/高级模式与目录类型
  const [ldapMode, setLdapMode] = useState<'simple' | 'advanced'>('simple');
  const [ldapDirectoryType, setLdapDirectoryType] = useState<'ad' | 'openldap' | ''>('');

  const [ldapEnabled, setLdapEnabled] = useState<boolean | null>(null);

  const [weeklyReportPagination, setWeeklyReportPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0
  });

  // PDF预览相关状态
  const [pdfPreviewVisible, setPdfPreviewVisible] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState('');
  const [mfaUsers, setMFAUsers] = useState<User[]>([]);
  const [mfaLoading, setMFALoading] = useState(false);
  const [disablingMFAUserID, setDisablingMFAUserID] = useState<number | null>(null);

  // 加载系统配置
  const loadConfigs = async () => {
    try {
      setLoading(true);
      const response = await systemApi.getConfigs();
      if (response.code === 200 && response.data) {
        setConfigs(response.data);
        // 初始化表单数据
        const formData: { [key: string]: any } = {};
        Object.keys(CONFIG_GROUPS).forEach(group => {
          formData[group] = {};
        });

        // 初始化本地 ldapEnabled（仅初始化一次）
        if (ldapEnabled === null) {
          const ldapEnabledCfg = response.data.find((c: SystemConfig) => c.key === 'ldap.enabled');
          if (ldapEnabledCfg) {
            setLdapEnabled(convertConfigValue(ldapEnabledCfg.value, ldapEnabledCfg.type));
          }
        }

        response.data.forEach(config => {
          if (formData[config.group]) {
            formData[config.group][config.key] = convertConfigValue(config.value, config.type);
          }
        });
      } else {
        Toast.error(response.msg || '加载配置失败');
      }
    } catch (error: any) {
      console.error('加载配置失败:', error);
      Toast.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  // 转换配置值类型
  const convertConfigValue = (value: string, type: string): any => {
    switch (type) {
      case 'bool':
        return value === 'true';
      case 'int':
        return parseInt(value) || 0;
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      default:
        return value;
    }
  };

  // 转换表单值为字符串
  const convertFormValue = (value: any, type: string): string => {
    switch (type) {
      case 'bool':
        return value ? 'true' : 'false';
      case 'int':
        return value.toString();
      case 'json':
        return typeof value === 'string' ? value : JSON.stringify(value);
      default:
        return value.toString();
    }
  };

  // 保存配置
  const saveConfigs = async (group: string, values: any) => {
    try {
      setSaving(true);

      // 获取该组的配置项
      const groupConfigs = configs.filter(config => config.group === group);

      // 批量更新配置
      const updatePromises = groupConfigs.map(async (config) => {
        // 使用转换后的字段名获取值
        const fieldName = config.key.replace(/\./g, '_');
        const newValue = values[fieldName];

        // 特殊处理密码字段：只有在用户输入了新密码时才更新
        if (config.key === 'email.password' || config.key === 'ldap.bind_password') {
          if (newValue && newValue.trim() !== '') {
            const updateData: ConfigUpdateRequest = {
              value: newValue.trim(),
              description: config.description
            };
            return systemApi.updateConfig(config.key, updateData);
          }
          // 如果密码字段为空，跳过更新
          return null;
        }

        if (newValue !== undefined) {
          const stringValue = convertFormValue(newValue, config.type);
          const updateData: ConfigUpdateRequest = {
            value: stringValue,
            description: config.description
          };

          return systemApi.updateConfig(config.key, updateData);
        }
      });

      await Promise.all(updatePromises.filter(Boolean));

      Toast.success('配置保存成功');

      // 如果更新的是密码策略，通知相关组件刷新
      if (group === 'password') {
        notifyPasswordPolicyUpdated();
      }

      // 如果更新的是系统配置，通知系统信息刷新
      if (group === 'system') {
        notifySystemInfoUpdated();
      }

      // 重新加载配置
      await loadConfigs();

    } catch (error: any) {
      console.error('保存配置失败:', error);
      Toast.error(error?.response?.data?.msg || '保存配置失败');
    } finally {
      setSaving(false);
    }

  };

  // 一键预填目录类型模板（组件级方法）
  const applyLdapTemplate = (type: 'ad' | 'openldap') => {
    setLdapDirectoryType(type);
    // 简化模式下仅展示示例提示；实际保存仍以用户输入为准
  };

  // 重置配置
  const resetConfigs = () => {
    loadConfigs();
    Toast.info('配置已重置');
  };

  // 测试邮件配置
  const testEmailConfig = async () => {
    if (!testEmail) {
      Toast.error('请输入测试邮箱地址');
      return;
    }

    try {
      setTestingEmail(true);
      const response = await systemApi.testEmailConfig({ test_email: testEmail });

      if (response.code === 200) {
        Toast.success('测试邮件发送成功，请检查邮箱');
  // 测试LDAP连接
  const testLDAP = async () => {
    try {
      setTestingLDAP(true);
      const response = await systemApi.testLDAPConfig();
      if (response.code === 200) {
        Toast.success('LDAP连接成功');
      } else {
        Toast.error(response.msg || 'LDAP连接失败');
      }
    } catch (error: any) {
      Toast.error(error?.response?.data?.msg || 'LDAP连接失败');
    } finally {
      setTestingLDAP(false);
    }
  };

  // 手动同步LDAP用户
  const syncLDAP = async () => {
    try {
      setSyncingLDAP(true);
      const response = await systemApi.syncLDAPUsers();
      if (response.code === 200) {
        const data = response.data || { created: 0, updated: 0 };
        Toast.success(`同步完成：新增${data.created}，更新${data.updated}`);
      } else {
        Toast.error(response.msg || '同步失败');
      }
    } catch (error: any) {
      Toast.error(error?.response?.data?.msg || '同步失败');
    } finally {
      setSyncingLDAP(false);
    }
  };

      } else {
        Toast.error(response.msg || '测试邮件发送失败');
      }
    } catch (error: any) {
      console.error('测试邮件失败:', error);
      Toast.error(error.response?.data?.msg || '测试邮件发送失败');
    } finally {
      setTestingEmail(false);
    }
  };


  // 测试LDAP连接（组件级方法）
  const testLDAP = async () => {
    try {
      setTestingLDAP(true);
      const response = await systemApi.testLDAPConfig();
      if (response.code === 200) {
        Toast.success('LDAP连接成功');
      } else {
        Toast.error(response.msg || 'LDAP连接失败');
      }
    } catch (error: any) {
      Toast.error(error?.response?.data?.msg || 'LDAP连接失败');
    } finally {
      setTestingLDAP(false);
    }
  };

  // 手动同步LDAP用户（组件级方法）
  const syncLDAP = async () => {
    try {
      setSyncingLDAP(true);
      const response = await systemApi.syncLDAPUsers();
      if (response.code === 200) {
        const data = response.data || { created: 0, updated: 0 };
        Toast.success(`同步完成：新增${data.created}，更新${data.updated}`);
      } else {
        Toast.error(response.msg || '同步失败');
      }
    } catch (error: any) {
      Toast.error(error?.response?.data?.msg || '同步失败');
    } finally {
      setSyncingLDAP(false);
    }
  };

  // 渲染配置字段
  const renderConfigField = (config: SystemConfig) => {
    // 将带点的key转换为下划线，避免Semi Design表单处理问题
    const fieldKey = config.key.replace(/\./g, '_');
    const fieldProps = {
      field: fieldKey,
      label: config.description || config.key,
      key: fieldKey,
    };

    // 特殊处理密码字段
    if (config.key === 'email.password' || config.key === 'ldap.bind_password') {
      const placeholder = config.key === 'email.password' ? '请输入邮箱授权码（留空表示不修改）' : '请输入LDAP绑定密码（留空表示不修改）';
      return (
        <Form.Input
          {...fieldProps}
          type="password"
          placeholder={placeholder}
          initValue="" // 密码字段始终为空，不显示现有值
          suffix={
            <Text type="tertiary" size="small">
              {config.value === '********' ? '已设置' : '未设置'}
            </Text>
          }
        />
      );
    }

    switch (config.type) {
      case 'bool':
        return (
          <Form.Switch
            {...fieldProps}
            initValue={convertConfigValue(config.value, config.type)}
            onChange={(val) => {
              if (config.key === 'ldap.enabled') {
                setLdapEnabled(!!val);
              }
            }}
          />
        );

      case 'int':
        return (
          <Form.InputNumber
            {...fieldProps}
            initValue={convertConfigValue(config.value, config.type)}
            min={0}
            style={{ width: '200px' }}
          />
        );

      case 'text':
        return (
          <Form.TextArea
            {...fieldProps}
            initValue={convertConfigValue(config.value, config.type)}
            maxCount={500}
            autosize
          />
        );

      default:
        return (
          <Form.Input
            {...fieldProps}
            initValue={convertConfigValue(config.value, config.type)}
            placeholder={`请输入${config.description || config.key}`}
          />
        );
    }
  };

  // 渲染配置组
  const renderConfigGroup = (group: string, groupConfigs: SystemConfig[]) => {
    if (groupConfigs.length === 0) {
      return null;
    }

    return (
      <Form
        labelPosition="left"
        labelWidth="150px"
        onSubmit={(values) => saveConfigs(group, values)}
        key={`form-${group}`}
        style={{ maxWidth: '800px' }}
      >
        {(() => {
          if (group === 'ldap') {
            const enabledCfg = groupConfigs.find(c => c.key === 'ldap.enabled');
            const enabled = (ldapEnabled !== null) ? ldapEnabled : (enabledCfg ? convertConfigValue(enabledCfg.value, enabledCfg.type) : false);
            // 简单模式仅显示：开关 + url + base_dn + bind_dn + bind_password
            const simpleKeys = new Set(['ldap.enabled','ldap.url','ldap.base_dn','ldap.bind_dn','ldap.bind_password']);
            let visible = groupConfigs;
            if (!enabled) {
              visible = groupConfigs.filter(c => c.key === 'ldap.enabled');
            } else if (ldapMode === 'simple') {
              visible = groupConfigs.filter(c => simpleKeys.has(c.key));
            }
            return (
              <>
                {/* 顶部先放两个关键开关，然后是模式/目录类型，再渲染其余 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* 关键开关：启用 + 调试 */}
                  <div>
                    {groupConfigs.filter(c => c.key === 'ldap.enabled').map(config => renderConfigField(config))}
                  </div>
                  {enabled && (
                    <div>
                      {groupConfigs.filter(c => c.key === 'ldap.debug_logging').map(config => renderConfigField(config))}
                    </div>
                  )}
                  {/* 模式/目录类型控制条 */}
                  <div>
                    <Space>
                      <Select
                        value={ldapMode}
                        onChange={(v) => setLdapMode(v as 'simple' | 'advanced')}
                        style={{ width: 140 }}
                        optionList={[{ value: 'simple', label: '简单模式' }, { value: 'advanced', label: '高级模式' }]}
                      />
                      <Select
                        placeholder="目录类型(可选)"
                        value={ldapDirectoryType}
                        onChange={(v) => applyLdapTemplate(v as 'ad' | 'openldap')}
                        style={{ width: 180 }}
                        optionList={[{ value: 'ad', label: 'Active Directory' }, { value: 'openldap', label: 'OpenLDAP' }]}
                      />
                    </Space>
                  </div>
                </div>

                {/* 渲染其余字段：移除已渲染的两个开关 */}
                {(() => {
                  const skip = new Set(['ldap.enabled','ldap.debug_logging']);
                  const rest = visible.filter(c => !skip.has(c.key));
                  return rest.map(config => renderConfigField(config));
                })()}
                {/* 简单模式下给常用字段添加占位提示 */}
                {ldapMode === 'simple' && enabled && (
                  <div style={{ marginTop: 8 }}>
                    <Text type="tertiary" size="small">
                      {ldapDirectoryType === 'ad' && '示例：url=ldaps://ad.example.com:636，base_dn=DC=example,DC=com，bind_dn=CN=svc_ldap,OU=Service Accounts,DC=example,DC=com'}
                      {ldapDirectoryType === 'openldap' && '示例：url=ldaps://ldap.example.com:636，base_dn=dc=example,dc=com，bind_dn=cn=admin,dc=example,dc=com'}
                      {!ldapDirectoryType && '提示：选择目录类型将显示示例。默认值已内置，先填这4项测试连接即可。'}
                    </Text>
                  </div>
                )}
                {/* 在字段下方放置测试/同步按钮（任意模式，只要已启用）*/}
                {enabled && (
                  <div style={{ marginTop: 16 }}>
                    <Space>
                      <Button
                        theme="solid"
                        type="primary"
                        icon={testingLDAP ? <IconLoading /> : <IconRefresh />}
                        loading={testingLDAP}
                        onClick={testLDAP}
                      >
                        测试连接
                      </Button>
                      <Button
                        type="secondary"
                        theme="solid"
                        icon={syncingLDAP ? <IconLoading /> : <IconUser />}
                        loading={syncingLDAP}
                        onClick={syncLDAP}
                      >
                        手动同步用户
                      </Button>
                    </Space>
                  </div>
                )}

              </>
            );
          }
          return groupConfigs.map(config => renderConfigField(config));
        })()}

        <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: '1px solid var(--semi-color-border)' }}>
          <Space>
            <Button
              htmlType="submit"
              theme="solid"
              type="primary"
              icon={saving ? <IconLoading /> : <IconSave />}
              loading={saving}
              disabled={saving}
            >
              保存配置
            </Button>

            {group === 'email' && (
              <Button
                type="secondary"
                icon={<IconRefresh />}
                onClick={resetConfigs}
                disabled={saving}
              >
                重置
              </Button>
            )}
            </Space>
          </div>

        {/* 邮件配置测试功能 */}
        {group === 'email' && (
          <>
            <Divider margin="32px 0" />

            {/* 配置说明 */}
            <div style={{ marginBottom: '24px' }}>
              <Title heading={5} style={{ marginBottom: '16px' }}>
                配置说明
              </Title>
              <div style={{
                background: 'var(--semi-color-fill-0)',
                padding: '20px',
                borderRadius: '8px',
                fontSize: '14px',
                lineHeight: '1.6',
                border: '1px solid var(--semi-color-border)'
              }}>
                <Text type="secondary">
                  <strong>常用邮箱配置：</strong><br/>
                  • <strong>QQ邮箱：</strong>smtp.qq.com:587，需要开启SMTP服务并使用授权码<br/>
                  • <strong>163邮箱：</strong>smtp.163.com:587，需要开启SMTP服务并使用授权码<br/>
                  • <strong>Gmail：</strong>smtp.gmail.com:587，需要使用应用专用密码<br/>
                  • <strong>企业邮箱：</strong>请联系IT管理员获取SMTP配置信息<br/><br/>
        {/* LDAP操作 */}
        {group === 'ldap' && (
          <>
            <Divider margin="32px 0" />
            <div style={{
              background: 'var(--semi-color-fill-0)',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid var(--semi-color-border)'
            }}>
              <Title heading={5} style={{ marginBottom: 12 }}>LDAP 操作</Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                可在此测试LDAP连接与手动同步用户清单
              </Text>
              <Space>
                <Button
                  theme="solid"
                  type="primary"
                  icon={testingLDAP ? <IconLoading /> : <IconRefresh />}
                  loading={testingLDAP}
                  onClick={testLDAP}
                >
                  测试连接
                </Button>
                <Button
                  type="secondary"
                  theme="solid"
                  icon={syncingLDAP ? <IconLoading /> : <IconUser />}
                  loading={syncingLDAP}
                  onClick={syncLDAP}
                >
                  手动同步用户
                </Button>
              </Space>
            </div>
          </>
        )}

                  <strong>重要提醒：</strong><br/>
                  • 邮箱密码必须使用授权码，不是登录密码！<br/>
                  • 密码字段留空表示不修改现有密码<br/>
                  • 如果提示"用户被暂停"，请重新生成授权码<br/>
                  • 发送频率过高可能导致临时限制<br/>
                  • 建议使用企业邮箱以获得更好的稳定性
                </Text>
              </div>
            </div>

            <div style={{
              background: 'var(--semi-color-warning-light-default)',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid var(--semi-color-warning-light-active)'
            }}>
              <Title heading={5} style={{ marginBottom: '12px', color: 'var(--semi-color-warning-dark)' }}>
                邮件配置测试
              </Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                发送测试邮件以验证邮件配置是否正确
              </Text>

              <Space>
                <Input
                  placeholder="请输入测试邮箱地址"
                  value={testEmail}
                  onChange={setTestEmail}
                  style={{ width: '300px' }}
                  type="email"
                />
                <Button
                  theme="solid"
                  type="warning"
                  icon={testingEmail ? <IconLoading /> : <IconRefresh />}
                  loading={testingEmail}
                  disabled={testingEmail || !testEmail}
                  onClick={testEmailConfig}
                >
                  发送测试邮件
                </Button>
              </Space>
            </div>
          </>
        )}
      </Form>
    );
  };

  // 加载周报历史记录
  const loadWeeklyReports = async (page = 1, pageSize = 10) => {
    setWeeklyReportLoading(true);
    try {
      const response = await weeklyReportApi.getWeeklyReportHistory(page, pageSize);
      if (response.code === 200 && response.data) {
        setWeeklyReports(response.data.list);
        setWeeklyReportPagination({
          page: response.data.page,
          pageSize: response.data.pageSize,
          total: response.data.total
        });
      } else {
        Toast.error(response.msg || '加载周报历史失败');
      }
    } catch (error) {
      console.error('加载周报历史失败:', error);
      Toast.error('加载周报历史失败');
    } finally {
      setWeeklyReportLoading(false);
    }
  };

  // 预览周报
  const handlePreviewReport = async (fileName: string) => {
    try {
      // 构建后端API静态文件URL
      const pdfUrl = resolveImageUrl(`/uploads/weekly/${fileName}`);

      // 设置预览URL并打开模态框
      setPreviewPdfUrl(pdfUrl);
      setPdfPreviewVisible(true);
    } catch (error) {
      console.error('预览周报失败:', error);
      Toast.error('预览周报失败');
    }
  };

  // 关闭PDF预览
  const handleClosePdfPreview = () => {
    setPdfPreviewVisible(false);
    setPreviewPdfUrl('');
  };

  // 下载周报
  const handleDownloadReport = async (fileName: string) => {
    try {
      // 构建后端API静态文件URL
      const url = resolveImageUrl(`/uploads/weekly/${fileName}`);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('下载周报失败:', error);
      Toast.error('下载周报失败');
    }
  };

  // 手动生成周报
  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const response = await weeklyReportApi.generateWeeklyReport();
      if (response.code === 200) {
        Toast.success('周报生成并发送成功');
        // 重新加载周报列表
        loadWeeklyReports(weeklyReportPagination.page, weeklyReportPagination.pageSize);
      } else {
        Toast.error(response.msg || '生成周报失败');
      }
    } catch (error) {
      console.error('生成周报失败:', error);
      Toast.error('生成周报失败');
    } finally {
      setGeneratingReport(false);
    }
  };

  const loadMFAUsers = async () => {
    setMFALoading(true);
    try {
      const response = await mfaAdminApi.listEnabledUsers();
      if (response.code === 200 && response.data) {
        setMFAUsers(response.data);
      } else {
        Toast.error(response.msg || '加载MFA用户失败');
      }
    } catch (error: unknown) {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { msg?: string } } }).response?.data?.msg === 'string'
          ? (error as { response?: { data?: { msg?: string } } }).response?.data?.msg
          : '加载MFA用户失败';
      Toast.error(message);
    } finally {
      setMFALoading(false);
    }
  };

  const handleDisableUserMFA = async (user: User) => {
    const targetID = user.id || user.ID;
    if (!targetID) {
      Toast.error('用户ID无效');
      return;
    }

    setDisablingMFAUserID(targetID);
    try {
      const response = await mfaAdminApi.disableUserMFA(targetID);
      if (response.code === 200) {
        Toast.success(`已关闭 ${user.real_name || user.username} 的 MFA`);
        loadMFAUsers();
      } else {
        Toast.error(response.msg || '关闭MFA失败');
      }
    } catch (error: unknown) {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { msg?: string } } }).response?.data?.msg === 'string'
          ? (error as { response?: { data?: { msg?: string } } }).response?.data?.msg
          : '关闭MFA失败';
      Toast.error(message);
    } finally {
      setDisablingMFAUserID(null);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  // 当切换到周报tab时加载数据
  useEffect(() => {
    if (activeTab === 'weekly-report') {
      loadWeeklyReports();
    } else if (activeTab === 'mfa-admin') {
      loadMFAUsers();
    }
  }, [activeTab]);

  if (loading) {
    return (
      <div style={{
        padding: '24px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px'
      }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title heading={3} style={{ margin: 0 }}>系统设置</Title>
        <Text type="secondary">配置系统参数和安全策略</Text>

        <div style={{ marginTop: '16px' }}>
          <Space>
            <Button
              icon={<IconRefresh />}
              onClick={resetConfigs}
              disabled={saving}
            >
              重新加载配置
            </Button>
          </Space>
        </div>
      </div>

      <Card style={{ minHeight: '600px' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          type="card"
          size="large"
        >
          {Object.entries(CONFIG_GROUPS).map(([groupKey, groupInfo]) => {
            const groupConfigs = configs.filter(config => config.group === groupKey);
            if (groupConfigs.length === 0) return null;

            return (
              <TabPane
                key={groupKey}
                tab={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {groupInfo.icon}
                    <span>{groupInfo.title}</span>
                  </div>
                }
                itemKey={groupKey}
              >
                <div style={{ padding: '20px 0' }}>
                  <div style={{ marginBottom: '20px' }}>
                    <Title heading={4} style={{ margin: '0 0 8px 0' }}>
                      {groupInfo.title}
                    </Title>
                    <Text type="secondary">{groupInfo.description}</Text>
                  </div>
                  {renderConfigGroup(groupKey, groupConfigs)}
                </div>
              </TabPane>
            );
          })}

          <TabPane tab={
            <span>
              <IconShield style={{ marginRight: '8px' }} />
              MFA 管理
            </span>
          } itemKey="mfa-admin">
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                  <Title heading={4}>MFA 管理</Title>
                  <Text type="secondary">仅管理员可以关闭用户 MFA，普通用户无法自行关闭。</Text>
                </div>
                <Button icon={<IconRefresh />} loading={mfaLoading} onClick={loadMFAUsers}>
                  刷新列表
                </Button>
              </div>

              <Table
                dataSource={mfaUsers}
                loading={mfaLoading}
                pagination={false}
                empty="暂无已启用 MFA 的用户"
                columns={[
                  {
                    title: '用户',
                    render: (record: User) => (
                      <div>
                        <div style={{ fontWeight: 600 }}>{record.real_name || record.username}</div>
                        <Text type="secondary" size="small">{record.username}</Text>
                      </div>
                    ),
                  },
                  {
                    title: '邮箱',
                    dataIndex: 'email',
                  },
                  {
                    title: '角色',
                    render: (record: User) => record.role?.name || '-',
                  },
                  {
                    title: '最近登录',
                    render: (record: User) => record.last_login_at ? new Date(record.last_login_at).toLocaleString('zh-CN') : '-',
                  },
                  {
                    title: '操作',
                    render: (record: User) => {
                      const targetID = record.id || record.ID;
                      return (
                        <Button
                          theme="solid"
                          type="danger"
                          size="small"
                          loading={disablingMFAUserID === targetID}
                          onClick={() => handleDisableUserMFA(record)}
                        >
                          关闭 MFA
                        </Button>
                      );
                    },
                  },
                ]}
              />
            </div>
          </TabPane>

          {/* 周报管理Tab */}
          <TabPane tab={
            <span>
              <IconCalendar style={{ marginRight: '8px' }} />
              周报管理
            </span>
          } itemKey="weekly-report">
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                  <Title heading={4}>周报历史记录</Title>
                  <Text type="secondary">查看和管理系统自动生成的周报记录</Text>
                </div>
                <Button
                  theme="solid"
                  type="primary"
                  loading={generatingReport}
                  onClick={handleGenerateReport}
                  style={{ flexShrink: 0 }}
                >
                  {generatingReport ? '生成中...' : '立即生成周报'}
                </Button>
              </div>

              <Table
                dataSource={weeklyReports}
                loading={weeklyReportLoading}
                pagination={{
                  currentPage: weeklyReportPagination.page,
                  pageSize: weeklyReportPagination.pageSize,
                  total: weeklyReportPagination.total,
                  showSizeChanger: true,
                  pageSizeOpts: [10, 20, 50],
                  onPageChange: (page) => loadWeeklyReports(page, weeklyReportPagination.pageSize),
                  onPageSizeChange: (pageSize) => loadWeeklyReports(1, pageSize),
                }}
                columns={[
                  {
                    title: '周期',
                    dataIndex: 'week_start',
                    render: (_: string, record: any) => (
                      <div>
                        <Text strong>{record.week_start}</Text>
                        <br />
                        <Text type="secondary" size="small">至 {record.week_end}</Text>
                      </div>
                    ),
                  },
                  {
                    title: '统计数据',
                    render: (record: any) => (
                      <div>
                        <div style={{ marginBottom: '4px' }}>
                          <Text size="small">提交: {record.total_submitted} | 修复: {record.total_fixed}</Text>
                        </div>
                        <div>
                          <Text size="small" type="secondary">
                            修复中: {record.total_fixing} | 待复测: {record.total_retesting}
                          </Text>
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    render: (status: string) => {
                      const statusMap = {
                        'generated': { color: 'blue' as const, text: '已生成' },
                        'sent': { color: 'green' as const, text: '已发送' },
                        'failed': { color: 'red' as const, text: '发送失败' }
                      };
                      const statusInfo = statusMap[status as keyof typeof statusMap] || { color: 'grey' as const, text: status };
                      return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
                    },
                  },
                  {
                    title: '生成时间',
                    dataIndex: 'created_at',
                    render: (text: string) => new Date(text).toLocaleString('zh-CN'),
                  },
                  {
                    title: '发送时间',
                    dataIndex: 'sent_at',
                    render: (text: string | null) => text ? new Date(text).toLocaleString('zh-CN') : '-',
                  },
                  {
                    title: '文件大小',
                    dataIndex: 'file_size',
                    render: (size: number) => {
                      if (size < 1024) return `${size} B`;
                      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
                      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
                    },
                  },
                  {
                    title: '操作',
                    render: (record: any) => (
                      <Space>
                        <Button
                          theme="borderless"
                          type="primary"
                          size="small"
                          onClick={() => handlePreviewReport(record.file_name)}
                        >
                          预览
                        </Button>
                        <Button
                          theme="borderless"
                          type="secondary"
                          size="small"
                          onClick={() => handleDownloadReport(record.file_name)}
                        >
                          下载
                        </Button>
                      </Space>
                    ),
                  },
                ]}
              />
            </div>
          </TabPane>
        </Tabs>
      </Card>

      {/* PDF预览模态框 */}
      <Modal
        title="周报预览"
        visible={pdfPreviewVisible}
        onCancel={handleClosePdfPreview}
        footer={null}
        width="90%"
        style={{ top: 20 }}
        bodyStyle={{ height: '80vh', padding: 0 }}
      >
        {previewPdfUrl && (
          <iframe
            src={previewPdfUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none'
            }}
            title="PDF预览"
          />
        )}
      </Modal>
    </div>
  );
}
