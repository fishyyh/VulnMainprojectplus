'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Card,
  Typography,
  Button,
  Table,
  Tag,
  Space,
  Avatar,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Toast,
  Empty,
  Spin,
  Badge
} from '@douyinfe/semi-ui';
import PasswordStrengthIndicator from '@/components/PasswordStrengthIndicator';
import type { PasswordValidationResult } from '@/utils/password';
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconUser,
  IconRefresh,
  IconSearch,
  IconUserGroup
} from '@douyinfe/semi-icons';
import {
  userApi,
  authUtils,
  User,
  Role,
  UserCreateRequest,
  UserUpdateRequest,
  USER_STATUSES
} from '@/lib/api';

const { Title, Text } = Typography;

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [resetPasswordModalVisible, setResetPasswordModalVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterRole, setFilterRole] = useState<number | undefined>();
  const [filterStatus, setFilterStatus] = useState<number | undefined>();
    const formRef = useRef<any>(null);
  const resetPasswordFormRef = useRef<any>(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 10,
    total: 0,
  });

  // 当前用户信息状态
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const isAdmin = authUtils.hasAnyRole(['super_admin', 'admin'], currentUser);

  // 密码验证状态
  const [resetPasswordValidation, setResetPasswordValidation] = useState<PasswordValidationResult | null>(null);

  const [resetPasswordsMatch, setResetPasswordsMatch] = useState(false);
  const [resetFormValues, setResetFormValues] = useState<any>({});

  const handleResetPasswordValidationChange = useCallback((result: PasswordValidationResult) => {
    setResetPasswordValidation(result);
  }, []);

  // 权限检查：非管理员用户跳转到首页
  useEffect(() => {
    // 在客户端获取当前用户信息
    const user = authUtils.getCurrentUser();
    setCurrentUser(user);

    // 延迟一小段时间确保组件完全挂载
    const timer = setTimeout(() => {
      const isManager = authUtils.hasAnyRole(['super_admin', 'admin'], user);
      if (user && !isManager) {
        // 非管理员用户直接重定向
        window.location.href = '/dashboard';
        return;
      }

      // 权限检查完成
      setAuthChecked(true);

      // 如果是管理员，加载数据
      if (user && isManager) {
        loadUsers();
        loadRoles();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const loadUsers = async (page = 1, pageSize?: number) => {
    try {
      setLoading(true);
      const effectivePageSize = pageSize ?? pagination.pageSize;
      const response = await userApi.getUserList({
        page,
        page_size: effectivePageSize,
        keyword: searchKeyword || undefined,
        role_id: filterRole,
        status: filterStatus,
      });

      if (response.code === 200 && response.data) {
        setUsers(response.data.users || []);
        setPagination(prev => ({
          ...prev,
          currentPage: page,
          pageSize: effectivePageSize,
          total: response.data.total || 0,
        }));
      }
    } catch (error) {
      console.error('Error loading users:', error);
      Toast.error('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await userApi.getRoles();
      if (response.code === 200 && response.data) {
        setRoles(response.data);
      }
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  };

  const handleCreateUser = () => {
    setEditingUser(null);
        if (formRef.current) {
      formRef.current.reset();
    }
    setResetPasswordsMatch(false);
    setModalVisible(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setModalVisible(true);
  };

  const handleDeleteUser = async (user: User) => {
    const userId = user.ID || user.id;
    const currentUserId = currentUser?.ID || currentUser?.id;

    if (userId === currentUserId) {
      Toast.error('不能删除自己的账户');
      return;
    }

    try {
      if (!userId) {
        Toast.error('用户ID无效');
        return;
      }
      await userApi.deleteUser(userId as number);
      Toast.success('删除成功');
      loadUsers(pagination.currentPage);
    } catch (error) {
      console.error('Error deleting user:', error);
      Toast.error('删除失败');
    }
  };

  const handleToggleStatus = async (user: User) => {
    const userId = user.ID || user.id;
    const currentUserId = currentUser?.ID || currentUser?.id;

    if (userId === currentUserId) {
      Toast.error('不能禁用自己的账户');
      return;
    }

    try {
      if (!userId) {
        Toast.error('用户ID无效');
        return;
      }
      await userApi.toggleUserStatus(userId as number);
      Toast.success(user.status === 1 ? '已禁用用户' : '已启用用户');
      loadUsers(pagination.currentPage);
    } catch (error) {
      console.error('Error toggling user status:', error);
      Toast.error('状态切换失败');
    }
  };

        const handleSaveUser = async (values: any) => {
    try {
      const userData: UserCreateRequest | UserUpdateRequest = {
        username: values.username,
        email: values.email,
        phone: values.phone,
        real_name: values.real_name,
        department: values.department,
        role_id: values.role_id,
        status: values.status,
      };

      let response;
      if (editingUser) {
        const userId = editingUser.ID || editingUser.id;
        if (!userId) {
          throw new Error('用户ID无效');
        }
        response = await userApi.updateUser(userId as number, userData);
      } else {
        response = await userApi.createUser(userData as UserCreateRequest);
      }

      // 检查响应是否成功
      if (response && response.code === 200) {
        Toast.success(editingUser ? '更新成功' : '创建成功');

        // 关闭弹窗并重置状态
        setModalVisible(false);
        setEditingUser(null);

        // 重置表单
                if (formRef.current) {
          formRef.current.reset();
        }

        // 刷新用户列表
        await loadUsers(pagination.currentPage);
      } else {
        throw new Error(response?.msg || '操作失败');
      }
    } catch (error: any) {
      console.error('保存用户失败:', error);
      const errorMessage = error?.response?.data?.msg || error?.message || (editingUser ? '更新失败' : '创建失败');
      Toast.error(errorMessage);
    }
  };

  const handleResetPassword = (user: User) => {
    setResetPasswordUser(user);
        if (resetPasswordFormRef.current) {
      resetPasswordFormRef.current.reset();
    }
    setResetPasswordValidation(null);
    setResetPasswordsMatch(false);
    setResetFormValues({});
    setResetPasswordModalVisible(true);
  };

        const handleConfirmResetPassword = async (values: any) => {
    if (!resetPasswordUser) return;

    // 重新验证密码以确保最新状态
    const { validatePassword } = await import('@/utils/password');
    const currentValidation = await validatePassword(values.password);
    if (!currentValidation.isValid) {
      Toast.error('密码不符合安全要求，请检查密码强度提示');
      return;
    }

    try {
      const userId = resetPasswordUser.ID || resetPasswordUser.id;
      if (!userId) {
        Toast.error('用户ID无效');
        return;
      }
      await userApi.resetPassword(userId as number, values.password);
      Toast.success('密码重置成功');
      setResetPasswordModalVisible(false);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      const errorMessage = error?.response?.data?.msg || error?.message || '密码重置失败';
      Toast.error(errorMessage);
    }
  };

  const handleSearch = () => {
    setPagination({ ...pagination, currentPage: 1 });
    loadUsers(1);
  };

  const handlePageChange = (page: number) => {
    loadUsers(page);
  };

  const getRoleName = (roleId: number) => {
    const role = roles.find(r => r.id === roleId);
    if (role?.name) return role.name;
    return authUtils.getRoleDisplayName(roleId);
  };

  const getRoleColor = (roleCode?: string) => {
    switch (roleCode) {
      case 'super_admin':
        return 'red';
      case 'admin':
        return 'orange';
      case 'security_engineer':
        return 'blue';
      case 'dev_engineer':
        return 'green';
      default:
        return 'grey';
    }
  };

  // 权限检查中或非管理员，显示加载状态
  if (!authChecked || !currentUser || !isAdmin) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px'
      }}>
        <Spin size="large" tip="检查权限中..." />
      </div>
    );
  }

  const columns = [
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      render: (_: any, record: User) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Avatar size="small">
            {record.real_name?.charAt(0) || record.username?.charAt(0)}
          </Avatar>
          <div>
            <Text strong>{record.username}</Text>
            <br />
            <Text type="secondary" size="small">{record.real_name}</Text>
          </div>
        </div>
      ),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
    },
    {
      title: '角色',
      dataIndex: 'role_id',
      key: 'role_id',
      render: (roleId: number, record: User) => (
        <Tag color={getRoleColor(record.role?.code)}>
          {record.role?.name || getRoleName(roleId)}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: number) => (
        <Badge
          dot
          type={status === 1 ? 'success' : 'danger'}
        >
          {status === 1 ? '启用' : '禁用'}
        </Badge>
      ),
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      render: (source: string) => (
        <Tag color={source === 'ldap' ? 'blue' : 'grey'}>
          {source === 'ldap' ? 'LDAP' : '本地'}
        </Tag>
      ),
    },
    {
      title: '最后登录',
      dataIndex: 'last_login_at',
      key: 'last_login_at',
      render: (time: string) => time ? new Date(time).toLocaleString('zh-CN') : '从未登录',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: User) => (
        <Space>
          <Button
            theme="borderless"
            icon={<IconEdit />}
            size="small"
            onClick={() => handleEditUser(record)}
          >
            编辑
          </Button>
          <Button
            theme="borderless"
            type={record.status === 1 ? 'danger' : 'primary'}
            size="small"
            onClick={() => handleToggleStatus(record)}
            disabled={(record.ID || record.id) === (currentUser?.ID || currentUser?.id)}
          >
            {record.status === 1 ? '禁用' : '启用'}
          </Button>
          <Button
            theme="borderless"
            type="danger"
            icon={<IconDelete />}
            size="small"
            disabled={(record.ID || record.id) === (currentUser?.ID || currentUser?.id)}
            onClick={() => {
              setUserToDelete(record);
              setDeleteConfirmVisible(true);
            }}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面头部 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <Title heading={3} style={{ margin: 0 }}>用户管理</Title>
          <Text type="secondary">管理系统用户账户</Text>
        </div>
        <Space>
          <Button
            theme="borderless"
            icon={<IconRefresh />}
            onClick={() => loadUsers(pagination.currentPage)}
            loading={loading}
          >
            刷新
          </Button>
        <Button
          theme="solid"
          type="primary"
          icon={<IconPlus />}
            onClick={handleCreateUser}
        >
          新建用户
        </Button>
        </Space>
      </div>

      {/* 搜索和筛选 */}
      <Card style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Input
            prefix={<IconSearch />}
            placeholder="搜索用户名或邮箱"
            value={searchKeyword}
            onChange={(value) => setSearchKeyword(value as string)}
            style={{ width: '200px' }}
          />
          <Select
            placeholder="角色"
            value={filterRole}
            onChange={(value) => setFilterRole(value as number)}
            style={{ width: '150px' }}
          >
            <Select.Option value={undefined}>全部角色</Select.Option>
            {roles.map(role => (
              <Select.Option key={role.id} value={role.id}>
                {role.name}
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="状态"
            value={filterStatus}
            onChange={(value) => setFilterStatus(value as number)}
            style={{ width: '150px' }}
          >
            <Select.Option value={undefined}>全部状态</Select.Option>
            {USER_STATUSES.map(status => (
              <Select.Option key={status.value} value={status.value}>
                {status.label}
              </Select.Option>
            ))}
          </Select>
          <Button
            onClick={handleSearch}
            loading={loading}
          >
            搜索
          </Button>
        </div>
      </Card>

      {/* 用户列表 */}
      <Card>
        <Spin spinning={loading}>
        <Table
          columns={columns}
            dataSource={users}
          pagination={{
              currentPage: pagination.currentPage,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showQuickJumper: true,
              onChange: handlePageChange,
              onPageSizeChange: (pageSize) => {
                setPagination(prev => ({ ...prev, pageSize, currentPage: 1 }));
                loadUsers(1, pageSize);
              },
          }}
            rowKey={(record) => record.ID || record.id}
        />
        </Spin>
      </Card>

      {/* 用户创建/编辑弹窗 */}
      <Modal
        key={editingUser ? `edit-${editingUser.ID || editingUser.id}` : 'create'}
        title={editingUser ? '编辑用户' : '新建用户'}
        visible={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingUser(null);
          if (formRef.current) {
            formRef.current.reset();
          }
        }}
        footer={null}
        width={600}
        maskClosable={false}
      >
        <Form
                    getFormApi={(api) => { formRef.current = api; }}
          onSubmit={handleSaveUser}
          onSubmitFail={(errors) => {
            console.error('用户表单验证失败:', errors);
            Toast.error('请检查表单输入');
          }}
          labelPosition="left"
          labelAlign="left"
          labelWidth={80}
          style={{ padding: '8px 0' }}
          initValues={editingUser ? {
            username: editingUser.username,
            email: editingUser.email,
            phone: editingUser.phone,
            real_name: editingUser.real_name,
            department: editingUser.department,
            role_id: editingUser.role_id,
            status: editingUser.status,
          } : {
            status: 1
          }}
        >
          {/* 基本信息 */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <Form.Input
                  field="username"
                  label="用户名"
                  placeholder="请输入用户名"
                  disabled={!!editingUser}
                  rules={[{ required: true, message: '请输入用户名' }]}
                  style={{ marginBottom: 0 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Form.Input
                  field="real_name"
                  label="真实姓名"
                  placeholder="请输入真实姓名（选填）"
                  style={{ marginBottom: 0 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <Form.Input
                  field="email"
                  label="邮箱"
                  placeholder="请输入邮箱地址"
                  rules={[
                    { required: true, message: '请输入邮箱地址' },
                    { type: 'email', message: '请输入有效的邮箱地址' }
                  ]}
                  style={{ marginBottom: 0 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Form.Input
                  field="phone"
                  label="手机号"
                  placeholder="请输入手机号（选填）"
                  style={{ marginBottom: 0 }}
                />
              </div>
            </div>

            <Form.Input
              field="department"
              label="部门"
              placeholder="请输入所属部门"
              rules={[{ required: true, message: '请输入所属部门' }]}
              style={{ marginBottom: '16px' }}
            />

            {!editingUser && (
              <div style={{ marginBottom: '16px', marginLeft: '80px' }}>
                <Text type="secondary">当前系统为 Google 登录模式，创建用户无需设置密码。</Text>
              </div>
            )}


          </div>

          {/* 权限设置 */}
          <div style={{
            borderTop: '1px solid #e6e6e6',
            paddingTop: '16px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <Form.Select
                  field="role_id"
                  label="角色"
                  placeholder="请选择角色"
                  rules={[{ required: true, message: '请选择角色' }]}
                  style={{ marginBottom: 0 }}
                >
                  {roles
                    .filter(role => role.code !== 'super_admin' && role.code !== 'normal_user')
                    .map(role => (
                    <Select.Option key={role.id} value={role.id}>
                      {role.name}
                    </Select.Option>
                  ))}
                </Form.Select>
              </div>
              <div style={{ flex: 1 }}>
                <Form.Select
                  field="status"
                  label="状态"
                  placeholder="请选择状态"
                  rules={[{ required: true, message: '请选择状态' }]}
                  style={{ marginBottom: 0 }}
                >
                  {USER_STATUSES.map(status => (
                    <Select.Option key={status.value} value={status.value}>
                      {status.label}
                    </Select.Option>
                  ))}
                </Form.Select>
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            borderTop: '1px solid #e6e6e6',
            paddingTop: '16px',
            marginTop: '8px'
          }}>
            <Button onClick={() => setModalVisible(false)} size="large">
              取消
            </Button>
                                    <Button theme="solid" type="primary" htmlType="submit" size="large">
              {editingUser ? '更新' : '创建'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* 重置密码弹窗 */}
      <Modal
        title="重置密码"
        visible={resetPasswordModalVisible}
        onCancel={() => setResetPasswordModalVisible(false)}
        footer={null}
        width={600}
        destroyOnClose={true}
        maskClosable={false}
        style={{ top: 100 }}
      >
        <div style={{ padding: '8px 0' }}>
          {/* 用户信息卡片 */}
          <Card
            style={{
              marginBottom: '24px',
              backgroundColor: '#f8f9fa',
              border: '1px solid #e9ecef'
            }}
            bodyStyle={{ padding: '16px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#1890ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '16px'
              }}>
                {resetPasswordUser?.username?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>
                  {resetPasswordUser?.real_name || resetPasswordUser?.username}
                </div>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  用户名：{resetPasswordUser?.username}
                </div>
                {resetPasswordUser?.email && (
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    邮箱：{resetPasswordUser?.email}
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Form
                        getFormApi={(api) => { resetPasswordFormRef.current = api; }}
            onSubmit={handleConfirmResetPassword}
            labelPosition="top"
            style={{ maxWidth: '100%' }}
            onValueChange={(values) => {
              setResetFormValues(values);
              const match = !!values.password && !!values.confirmPassword && values.password === values.confirmPassword;
              setResetPasswordsMatch(match);
            }}
          >
            <div style={{ marginBottom: '24px' }}>
              <Form.Input
                field="password"
                label="新密码"
                type="password"
                placeholder="请输入新密码"
                size="large"
                rules={[
                  { required: true, message: '请输入新密码' }
                ]}
                style={{ marginBottom: '12px' }}

              />
              <Form.Slot field="password">
                {({ value }: { value: any }) => (
                  <div style={{ marginTop: '8px' }}>
                    <PasswordStrengthIndicator
                      password={value || ''}
                      onValidationChange={handleResetPasswordValidationChange}
                      showRequirements={true}
                    />
                  </div>
                )}
              </Form.Slot>
            </div>

            <div style={{ marginBottom: '32px' }}>
              <Form.Input
                field="confirmPassword"
                label="确认密码"
                type="password"
                placeholder="请再次输入新密码"
                size="large"
                rules={[
                  { required: true, message: '请确认密码' },
                  {
                    validator: (rule, value) => {
                      const password = resetFormValues.password;
                      if (password && value !== password) {
                        return false;
                      }
                      return true;
                    },
                    message: '两次输入的密码不一致'
                  }
                ]}

              />
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              paddingTop: '16px',
              borderTop: '1px solid #f0f0f0'
            }}>
              <Button
                size="large"
                onClick={() => setResetPasswordModalVisible(false)}
              >
                取消
              </Button>
              <Button
                theme="solid"
                type="primary"
                htmlType="submit"
                size="large"
                style={{ minWidth: '100px' }}
                disabled={!resetPasswordsMatch}
              >
                确认重置
              </Button>
            </div>
          </Form>
        </div>
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal
        title="确认删除"
        visible={deleteConfirmVisible}
        onCancel={() => {
          setDeleteConfirmVisible(false);
          setUserToDelete(null);
        }}
        footer={null}
        width={400}
        destroyOnClose={true}
        maskClosable={false}
      >
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ marginBottom: '16px' }}>
            <Text>确定要删除用户 <Text strong>&quot;{userToDelete?.username}&quot;</Text> 吗？</Text>
          </div>
          <div style={{ marginBottom: '24px' }}>
            <Text type="danger">此操作无法撤销，请谨慎操作。</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <Button
              onClick={() => {
                setDeleteConfirmVisible(false);
                setUserToDelete(null);
              }}
            >
              取消
            </Button>
            <Button
              type="danger"
              theme="solid"
              onClick={async () => {
                if (userToDelete) {
                  await handleDeleteUser(userToDelete);
                  setDeleteConfirmVisible(false);
                  setUserToDelete(null);
                }
              }}
            >
              确认删除
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
