'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Typography,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Switch,
  Toast,
  Empty,
  Spin,
  Divider,
  Avatar,
  Badge,
  Pagination,
  Table,
  RadioGroup,
  Radio
} from '@douyinfe/semi-ui';
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconMore,
  IconCalendar,
  IconUser,
  IconSetting,
  IconSearch,
  IconRefresh,
  IconGridView,
  IconListView
} from '@douyinfe/semi-icons';
import { 
  projectApi, 
  userApi, 
  authUtils, 
  Project, 
  User, 
  ProjectCreateRequest, 
  ProjectUpdateRequest,
  PROJECT_TYPES,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES
} from '@/lib/api';

const { Title, Text } = Typography;

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [securityEngineers, setSecurityEngineers] = useState<User[]>([]);
  const [allEngineers, setAllEngineers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [formRef, setFormRef] = useState<any>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | undefined>();
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [refreshingStats, setRefreshingStats] = useState(false);

  // 视图模式状态
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    // 从本地存储中读取用户的视图偏好
    if (typeof window !== 'undefined') {
      const savedViewMode = localStorage.getItem('projectViewMode');
      return (savedViewMode as 'card' | 'list') || 'card';
    }
    return 'card';
  });

  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(8); // 每页显示8条

  // 当前用户信息状态
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isClient, setIsClient] = useState(false);
  const isAdmin = currentUser?.role_id === 1;
  const isSecurityEngineer = currentUser?.role_id === 2;
  const isDevEngineer = currentUser?.role_id === 3;
  const canManageProjects = isAdmin || isSecurityEngineer;

  useEffect(() => {
    // 在客户端获取当前用户信息
    setCurrentUser(authUtils.getCurrentUser());
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadProjects();
      if (canManageProjects) {
        loadEngineers();
      }
    }
  }, [currentUser, canManageProjects]);

  // 当搜索条件改变时，重置分页到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [searchKeyword, filterType, filterStatus]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      let response;
      
      if (canManageProjects) {
        // 管理员和安全工程师获取所有项目
        response = await projectApi.getProjectList({
          page: 1,
          page_size: 1000,
          keyword: searchKeyword || undefined,
          type: filterType || undefined,
          status: filterStatus || undefined,
        });
        setProjects(response.data?.projects || []);
      } else {
        // 安全工程师和研发工程师获取自己的项目
        response = await projectApi.getUserProjects();
        setProjects(response.data || []);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      Toast.error('加载项目列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadEngineers = async () => {
    try {
      // 加载安全工程师（用于项目负责人）
      const securityResponse = await userApi.getSecurityEngineers();
      
      // 规范化安全工程师数据（处理大小写字段名问题）
      const normalizedSecurityEngineers = (securityResponse.data || []).map((engineer: any) => ({
        id: engineer.id || engineer.ID,
        username: engineer.username,
        real_name: engineer.real_name || engineer.RealName || engineer.realName,
        email: engineer.email || engineer.Email,
        phone: engineer.phone || engineer.Phone,
        department: engineer.department || engineer.Department,
        role_id: engineer.role_id || engineer.RoleId || engineer.RoleID,
        status: engineer.status || engineer.Status,
        last_login_at: engineer.last_login_at || engineer.LastLoginAt,
        ...engineer
      }));
      
      // 过滤有效的工程师数据
      const validSecurityEngineers = normalizedSecurityEngineers.filter((engineer: User) => 
        engineer && engineer.id && engineer.username
      );
      setSecurityEngineers(validSecurityEngineers);
      
      // 加载所有工程师（用于项目成员）
      const allResponse = await userApi.getEngineers();
      
      // 规范化所有工程师数据
      const normalizedAllEngineers = (allResponse.data || []).map((engineer: any) => ({
        id: engineer.id || engineer.ID,
        username: engineer.username,
        real_name: engineer.real_name || engineer.RealName || engineer.realName,
        email: engineer.email || engineer.Email,
        phone: engineer.phone || engineer.Phone,
        department: engineer.department || engineer.Department,
        role_id: engineer.role_id || engineer.RoleId || engineer.RoleID,
        status: engineer.status || engineer.Status,
        last_login_at: engineer.last_login_at || engineer.LastLoginAt,
        ...engineer
      }));
      
      // 过滤有效的工程师数据
      const validAllEngineers = normalizedAllEngineers.filter((engineer: User) => 
        engineer && engineer.id && engineer.username
      );
      setAllEngineers(validAllEngineers);
      
    } catch (error) {
      console.error('Error loading engineers:', error);
      Toast.error('加载工程师列表失败');
    }
  };

  const handleCreateProject = () => {
    setEditingProject(null);
    setSelectedOwnerId(undefined);
    setSelectedMemberIds([]);
    if (formRef) {
      formRef.reset();
    }
    setModalVisible(true);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setModalVisible(true);
  };

  // 使用 useEffect 监听编辑项目的变化
  useEffect(() => {
    if (editingProject && modalVisible && formRef) {
      // 延迟设置确保表单完全渲染
      const timer = setTimeout(() => {
        try {
          const memberIds = editingProject.members?.map(m => m.user_id) || [];
          setSelectedOwnerId(editingProject.owner_id);
          setSelectedMemberIds(memberIds);

          formRef.setValues({
            name: editingProject.name,
            type: editingProject.type,
            priority: editingProject.priority,
            description: editingProject.description,
            start_date: editingProject.start_date ? new Date(editingProject.start_date) : undefined,
            end_date: editingProject.end_date ? new Date(editingProject.end_date) : undefined,
            is_public: editingProject.is_public,
          });
        } catch (error) {
          console.error('设置表单值失败:', error);
        }
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [editingProject, modalVisible, formRef]);

  const handleDeleteProject = async (project: Project) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除项目"${project.name}"吗？此操作无法撤销。`,
      onOk: async () => {
        try {
          await projectApi.deleteProject(project.id);
          Toast.success('删除成功');
          loadProjects();
        } catch (error) {
          console.error('Error deleting project:', error);
          Toast.error('删除失败');
        }
      },
    });
  };

  const handleSaveProject = async (values: any) => {
    try {
      if (!selectedOwnerId) {
        Toast.error('请选择项目负责人');
        return;
      }
      
      const projectData: ProjectCreateRequest | ProjectUpdateRequest = {
        name: values.name,
        type: values.type,
        priority: values.priority,
        description: values.description,
        owner_id: Number(selectedOwnerId),
        start_date: values.start_date ? values.start_date.toISOString().split('T')[0] : undefined,
        end_date: values.end_date ? values.end_date.toISOString().split('T')[0] : undefined,
        is_public: values.is_public,
        member_ids: selectedMemberIds.map(id => Number(id)),
      };
      

      if (editingProject) {
        await projectApi.updateProject(editingProject.id, projectData);
      } else {
        await projectApi.createProject(projectData as ProjectCreateRequest);
      }

      // 关闭弹窗并重置状态
      setModalVisible(false);
      setEditingProject(null);
      
      // 刷新项目列表
      await loadProjects();
      
      // 延迟执行Toast避免React 18兼容性问题
      setTimeout(() => {
        Toast.success(editingProject ? '更新成功' : '创建成功');
      }, 100);
      
    } catch (error) {
      console.error('保存项目失败:', error);
      // 延迟执行Toast避免React 18兼容性问题
      setTimeout(() => {
        Toast.error(editingProject ? '更新失败' : '创建失败');
      }, 100);
    }
  };

  const handleViewProject = (project: Project) => {
    // 跳转到项目详情页
    window.location.href = `/projects/detail?id=${project.id}`;
  };

  const handleRefreshStats = async () => {
    if (!isAdmin) {
      Toast.error('只有超级管理员可以刷新统计数据');
      return;
    }

    try {
      setRefreshingStats(true);
      const response = await projectApi.refreshStats();
      if (response.code === 200) {
        Toast.success(`统计数据刷新完成！更新了 ${response.data?.updated_count || 0} 个项目`);
        // 刷新项目列表以显示最新数据
        loadProjects();
      } else {
        Toast.error(response.msg || '刷新统计数据失败');
      }
    } catch (error) {
      console.error('Error refreshing stats:', error);
      Toast.error('刷新统计数据失败');
    } finally {
      setRefreshingStats(false);
    }
  };

  const getTypeLabel = (type: string) => {
    const typeItem = PROJECT_TYPES.find(t => t.value === type);
    return typeItem?.label || type;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'red';
      case 'medium':
        return 'orange';
      case 'low':
        return 'blue';
      default:
        return 'grey';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'green';
      case 'inactive':
        return 'grey';
      case 'completed':
        return 'blue';
      case 'archived':
        return 'grey';
      default:
        return 'grey';
    }
  };

  const getStatusLabel = (status: string) => {
    const statusItem = PROJECT_STATUSES.find(s => s.value === status);
    return statusItem?.label || status;
  };

  const isProjectExpired = (project: Project) => {
    if (!project.end_date) return false;
    return new Date(project.end_date) < new Date();
  };

  const filteredProjects = projects.filter(project => {
    if (searchKeyword && !project.name.toLowerCase().includes(searchKeyword.toLowerCase())) {
      return false;
    }
    if (filterType && project.type !== filterType) {
      return false;
    }
    if (filterStatus && project.status !== filterStatus) {
      return false;
    }
    return true;
  });

  // 分页计算
  const totalProjects = filteredProjects.length;
  const totalPages = Math.ceil(totalProjects / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentPageProjects = filteredProjects.slice(startIndex, endIndex);

  // 分页变化处理
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 处理视图模式切换
  const handleViewModeChange = (mode: 'card' | 'list') => {
    setViewMode(mode);
    // 保存到本地存储
    if (typeof window !== 'undefined') {
      localStorage.setItem('projectViewMode', mode);
    }
  };

  const renderProjectCard = (project: Project) => {
    const expired = isProjectExpired(project);

    return (
      <Card
        key={project.id}
        style={{
          height: '280px',
          border: expired ? '1px solid var(--semi-color-danger)' : undefined,
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          background: 'var(--semi-color-bg-1)'
        }}
        bodyStyle={{
          padding: '16px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
        headerLine={false}
        footerLine={false}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
        onClick={() => handleViewProject(project)}
      >
        {/* 项目标题和状态 */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <Title
              heading={5}
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--semi-color-text-0)',
                lineHeight: '1.3',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                marginRight: '8px'
              }}
            >
              {project.name}
            </Title>
            {expired && (
              <Badge dot type="danger" size="small" suppressHydrationWarning>
                <Text type="danger" size="small" style={{ fontSize: '10px' }}>过期</Text>
              </Badge>
            )}
          </div>

          {/* 状态标签 */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <Tag
              color={getPriorityColor(project.priority)}
              size="small"
              style={{
                margin: 0,
                fontSize: '10px',
                padding: '2px 6px'
              }}
              suppressHydrationWarning
            >
              {PROJECT_PRIORITIES.find(p => p.value === project.priority)?.label}
            </Tag>
            <Tag
              color={getStatusColor(project.status)}
              size="small"
              style={{
                margin: 0,
                fontSize: '10px',
                padding: '2px 6px'
              }}
              suppressHydrationWarning
            >
              {getStatusLabel(project.status)}
            </Tag>
          </div>
        </div>

        {/* 项目基本信息 */}
        <div style={{ marginBottom: '12px', flex: 1 }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            fontSize: '12px'
          }}>
            {/* 类型和负责人在一行 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                <Text type="secondary" style={{
                  fontWeight: 500,
                  fontSize: '11px',
                  flexShrink: 0
                }}>
                  类型:
                </Text>
                <Text style={{
                  color: 'var(--semi-color-text-1)',
                  fontSize: '12px'
                }}>
                  {getTypeLabel(project.type)}
                </Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                <Text type="secondary" style={{
                  fontWeight: 500,
                  fontSize: '11px',
                  flexShrink: 0
                }}>
                  负责人:
                </Text>
                <Text style={{
                  color: 'var(--semi-color-text-1)',
                  fontSize: '12px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {project.owner?.real_name || project.owner?.username || '未指定'}
                </Text>
              </div>
            </div>

            {/* 开始时间和结束时间在一行 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              {project.start_date && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                  <Text type="secondary" style={{
                    fontWeight: 500,
                    fontSize: '11px',
                    flexShrink: 0
                  }}>
                    开始:
                  </Text>
                  <Text style={{
                    color: 'var(--semi-color-text-1)',
                    fontSize: '12px'
                  }}>
                    {new Date(project.start_date).toLocaleDateString('zh-CN')}
                  </Text>
                </div>
              )}

              {project.end_date && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                  <Text type="secondary" style={{
                    fontWeight: 500,
                    fontSize: '11px',
                    flexShrink: 0
                  }}>
                    截止:
                  </Text>
                  <Text style={{
                    color: expired ? 'var(--semi-color-danger)' : 'var(--semi-color-text-1)',
                    fontSize: '12px'
                  }}>
                    {new Date(project.end_date).toLocaleDateString('zh-CN')}
                  </Text>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 项目描述 */}
        {project.description && (
          <div style={{ marginBottom: '12px' }}>
            <Text
              style={{
                color: 'var(--semi-color-text-2)',
                lineHeight: '1.4',
                fontSize: '11px',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
            >
              {project.description}
            </Text>
          </div>
        )}

        <Divider margin="8px 0" />

        {/* 统计信息 */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            textAlign: 'center'
          }}>
            <div>
              <div style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--semi-color-primary)',
                marginBottom: '2px'
              }}>
                {project.member_count || 0}
              </div>
              <Text type="secondary" size="small" style={{ fontSize: '10px' }}>
                成员
              </Text>
            </div>
            <div>
              <div style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--semi-color-success)',
                marginBottom: '2px'
              }}>
                {project.asset_count || 0}
              </div>
              <Text type="secondary" size="small" style={{ fontSize: '10px' }}>
                资产
              </Text>
            </div>
            <div>
              <div style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--semi-color-warning)',
                marginBottom: '2px'
              }}>
                {project.vuln_count || 0}
              </div>
              <Text type="secondary" size="small" style={{ fontSize: '10px' }}>
                漏洞
              </Text>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div style={{ marginTop: 'auto' }}>
          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
            <Button
              theme="solid"
              type="primary"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleViewProject(project);
              }}
              style={{
                borderRadius: '4px',
                fontSize: '11px',
                padding: '4px 8px',
                flex: 1
              }}
            >
              查看
            </Button>

            {canManageProjects && (
              <>
                <Button
                  theme="light"
                  type="warning"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditProject(project);
                  }}
                  style={{
                    borderRadius: '4px',
                    fontSize: '11px',
                    padding: '4px 8px'
                  }}
                >
                  编辑
                </Button>
                <Button
                  theme="light"
                  type="danger"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteProject(project);
                  }}
                  style={{
                    borderRadius: '4px',
                    fontSize: '11px',
                    padding: '4px 8px'
                  }}
                >
                  删除
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>
    );
  };

  // 列表视图渲染函数
  const renderProjectTable = () => {
    const columns = [
      {
        title: '项目名称',
        dataIndex: 'name',
        key: 'name',
        width: 160,
        render: (text: string, record: Project) => {
          const expired = isProjectExpired(record);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Text
                strong
                style={{
                  color: 'var(--semi-color-text-0)',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
                onClick={() => handleViewProject(record)}
              >
                {text}
              </Text>
              {expired && (
                <Badge dot type="danger" suppressHydrationWarning>
                  <Text type="danger" size="small" style={{ fontSize: '11px' }}>已过期</Text>
                </Badge>
              )}
            </div>
          );
        }
      },
      {
        title: '类型',
        dataIndex: 'type',
        key: 'type',
        width: 80,
        render: (type: string) => (
          <Text size="small" style={{ fontSize: '12px' }}>{getTypeLabel(type)}</Text>
        )
      },
      {
        title: '优先级',
        dataIndex: 'priority',
        key: 'priority',
        width: 70,
        render: (priority: string) => (
          <Tag color={getPriorityColor(priority)} size="small" style={{ fontSize: '11px', padding: '2px 6px' }} suppressHydrationWarning>
            {PROJECT_PRIORITIES.find(p => p.value === priority)?.label}
          </Tag>
        )
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 70,
        render: (status: string) => (
          <Tag color={getStatusColor(status)} size="small" style={{ fontSize: '11px', padding: '2px 6px' }} suppressHydrationWarning>
            {getStatusLabel(status)}
          </Tag>
        )
      },
      {
        title: '负责人',
        dataIndex: 'owner',
        key: 'owner',
        width: 90,
        render: (owner: any) => (
          <Text size="small" style={{ fontSize: '12px' }}>
            {owner?.real_name || owner?.username || '未指定'}
          </Text>
        )
      },
      {
        title: '项目描述',
        dataIndex: 'description',
        key: 'description',
        width: 180,
        render: (description: string) => (
          <Text
            size="small"
            type="secondary"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: '1.3',
              fontSize: '12px'
            }}
          >
            {description || '暂无描述'}
          </Text>
        )
      },
      {
        title: '开始时间',
        dataIndex: 'start_date',
        key: 'start_date',
        width: 90,
        render: (date: string) => (
          <Text size="small" type="secondary" style={{ fontSize: '12px' }}>
            {date ? new Date(date).toLocaleDateString('zh-CN') : '-'}
          </Text>
        )
      },
      {
        title: '结束时间',
        dataIndex: 'end_date',
        key: 'end_date',
        width: 90,
        render: (date: string, record: Project) => {
          const expired = isProjectExpired(record);
          return (
            <Text
              size="small"
              type={expired ? "danger" : "secondary"}
              style={{ fontSize: '12px' }}
            >
              {date ? new Date(date).toLocaleDateString('zh-CN') : '-'}
            </Text>
          );
        }
      },
      {
        title: '统计',
        key: 'stats',
        width: 140,
        render: (text: string, record: Project) => (
          <div style={{ display: 'flex', gap: '8px', fontSize: '11px', whiteSpace: 'nowrap' }}>
            <Text type="secondary" size="small" style={{ fontSize: '11px' }}>
              成员: {record.member_count || 0}
            </Text>
            <Text type="secondary" size="small" style={{ fontSize: '11px' }}>
              资产: {record.asset_count || 0}
            </Text>
            <Text type="secondary" size="small" style={{ fontSize: '11px' }}>
              漏洞: {record.vuln_count || 0}
            </Text>
          </div>
        )
      },
      {
        title: '操作',
        key: 'action',
        width: 120,
        fixed: 'right' as const,
        render: (text: string, record: Project) => (
          <Space size="small">
            <Button
              theme="borderless"
              icon={<IconMore />}
              size="small"
              onClick={() => handleViewProject(record)}
              style={{ color: 'var(--semi-color-primary)', padding: '4px 8px' }}
            >
              查看
            </Button>
            {canManageProjects && (
              <>
                <Button
                  theme="borderless"
                  icon={<IconEdit />}
                  size="small"
                  onClick={() => handleEditProject(record)}
                  style={{ color: 'var(--semi-color-warning)', padding: '4px 8px' }}
                >
                  编辑
                </Button>
                <Button
                  theme="borderless"
                  type="danger"
                  icon={<IconDelete />}
                  size="small"
                  onClick={() => handleDeleteProject(record)}
                  style={{ padding: '4px 8px' }}
                >
                  删除
                </Button>
              </>
            )}
          </Space>
        )
      }
    ];

    return (
      <Card style={{
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
      }}>
        <Table
          columns={columns}
          dataSource={currentPageProjects}
          pagination={false}
          loading={loading}
          rowKey="id"
          size="small"
          scroll={{ x: 1020 }}
          style={{
            '--semi-table-td-padding': '8px 12px',
            '--semi-table-th-padding': '8px 12px'
          } as React.CSSProperties}
          className="compact-table"
          empty={
            <Empty
              image={<IconSetting size="extra-large" style={{ color: 'var(--semi-color-text-2)' }} />}
              title={<Text style={{ fontSize: '16px', fontWeight: 500, color: 'var(--semi-color-text-1)' }}>暂无项目</Text>}
              description={
                <Text type="secondary" style={{ fontSize: '14px' }}>
                  {canManageProjects ? '点击"新建项目"创建第一个项目' : '暂时没有分配给您的项目'}
                </Text>
              }
            />
          }
        />
        <style jsx>{`
          :global(.compact-table .semi-table-tbody .semi-table-row .semi-table-row-cell) {
            padding: 12px 12px !important;
            line-height: 1.5 !important;
            min-height: 48px !important;
          }
          :global(.compact-table .semi-table-thead .semi-table-row .semi-table-row-head) {
            padding: 12px 12px !important;
            font-size: 12px !important;
            font-weight: 600 !important;
            height: 44px !important;
          }
          :global(.compact-table .semi-table-tbody .semi-table-row) {
            height: auto !important;
            min-height: 48px !important;
          }
        `}</style>
      </Card>
    );
  };

  return (
    <div style={{ padding: '24px', backgroundColor: 'var(--semi-color-bg-0)', minHeight: '100vh' }}>
      {/* 页面头部 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px'
      }}>
        <div>
          <Title heading={3} style={{ margin: 0 }}>项目管理</Title>
          <Text type="secondary">
            {canManageProjects ? '管理所有项目' : '查看我的项目列表'}
            {filteredProjects.length > 0 && (
              <span style={{ marginLeft: '8px' }}>
                • 共 {totalProjects} 个项目
                {totalPages > 1 && ` • 第 ${currentPage}/${totalPages} 页`}
              </span>
            )}
          </Text>
        </div>
        <Space>
          <Button
            theme="borderless"
            icon={<IconRefresh />}
            onClick={loadProjects}
            loading={loading}
          >
            刷新
          </Button>
          {isAdmin && (
            <Button
              theme="borderless"
              icon={<IconSetting />}
              onClick={handleRefreshStats}
              loading={refreshingStats}
            >
              刷新统计
            </Button>
          )}
          {canManageProjects && (
            <Button
              theme="solid"
              type="primary"
              icon={<IconPlus />}
              onClick={handleCreateProject}
            >
              新建项目
            </Button>
          )}
        </Space>
      </div>

      {/* 搜索和筛选 */}
      <Card style={{
        marginBottom: '32px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
      }}>
        <div style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          flexWrap: 'wrap',
          padding: '8px 0',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Input
              prefix={<IconSearch />}
              placeholder="搜索项目名称"
              value={searchKeyword}
              onChange={(value) => setSearchKeyword(value as string)}
              style={{ width: '200px' }}
            />
            <Select
              placeholder="项目类型"
              value={filterType}
              onChange={(value) => setFilterType(value as string)}
              style={{ width: '150px' }}
            >
              <Select.Option value="">全部类型</Select.Option>
              {PROJECT_TYPES.map(type => (
                <Select.Option key={`filter_type_${type.value}`} value={type.value}>
                  {type.label}
                </Select.Option>
              ))}
            </Select>
            <Select
              placeholder="项目状态"
              value={filterStatus}
              onChange={(value) => setFilterStatus(value as string)}
              style={{ width: '150px' }}
            >
              <Select.Option value="">全部状态</Select.Option>
              {PROJECT_STATUSES.map(status => (
                <Select.Option key={`filter_status_${status.value}`} value={status.value}>
                  {status.label}
                </Select.Option>
              ))}
            </Select>
            <Button
              onClick={loadProjects}
              loading={loading}
            >
              搜索
            </Button>
          </div>

          {/* 视图切换开关 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Text type="secondary" size="small">视图:</Text>
            <RadioGroup
              type="button"
              value={viewMode}
              onChange={(e) => handleViewModeChange(e.target.value as 'card' | 'list')}
              size="small"
            >
              <Radio value="card">
                <IconGridView style={{ marginRight: '4px' }} />
                卡片
              </Radio>
              <Radio value="list">
                <IconListView style={{ marginRight: '4px' }} />
                列表
              </Radio>
            </RadioGroup>
          </div>
        </div>
      </Card>

      {/* 项目列表 */}
      <Spin spinning={loading}>
        {filteredProjects.length > 0 ? (
          <>
            {viewMode === 'card' ? (
              <div
                className="project-cards-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '16px',
                  marginBottom: '32px'
                }}
              >
                {currentPageProjects.map(renderProjectCard)}
                <style jsx>{`
                  .project-cards-grid {
                    min-height: 580px; /* 固定高度，容纳2行卡片 */
                  }

                  @media (max-width: 1200px) {
                    .project-cards-grid {
                      grid-template-columns: repeat(3, 1fr) !important;
                    }
                  }

                  @media (max-width: 900px) {
                    .project-cards-grid {
                      grid-template-columns: repeat(2, 1fr) !important;
                    }
                  }

                  @media (max-width: 600px) {
                    .project-cards-grid {
                      grid-template-columns: 1fr !important;
                      min-height: auto !important;
                    }
                  }
                `}</style>
              </div>
            ) : (
              <div style={{ marginBottom: '32px' }}>
                {renderProjectTable()}
              </div>
            )}

            {/* 分页组件 */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                marginTop: '40px',
                padding: '20px 0'
              }}>
                <Pagination
                  total={totalProjects}
                  currentPage={currentPage}
                  pageSize={pageSize}
                  onChange={handlePageChange}
                  showSizeChanger={false}
                  showQuickJumper={totalPages > 10}
                  showTotal={true}
                  size="default"
                  style={{
                    backgroundColor: 'var(--semi-color-bg-1)',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
                  }}
                />
              </div>
            )}
          </>
        ) : (
          <Card style={{
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            textAlign: 'center',
            padding: '60px 20px'
          }}>
            <Empty
              image={<IconSetting size="extra-large" style={{ color: 'var(--semi-color-text-2)' }} />}
              title={<Text style={{ fontSize: '18px', fontWeight: 500, color: 'var(--semi-color-text-1)' }}>暂无项目</Text>}
              description={
                <Text type="secondary" style={{ fontSize: '14px', lineHeight: '1.6' }}>
                  {canManageProjects ? '点击"新建项目"创建第一个项目' : '暂时没有分配给您的项目'}
                </Text>
              }
            />
          </Card>
        )}
      </Spin>

      {/* 项目创建/编辑弹窗 */}
      <Modal
        title={editingProject ? '编辑项目' : '新建项目'}
        visible={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingProject(null);
        }}
        footer={null}
        width={700}
        destroyOnClose={true}
        maskClosable={false}
      >
        <Form
          getFormApi={(api) => setFormRef(api)}
          onSubmit={handleSaveProject}
          onSubmitFail={(errors) => {
            console.error('表单验证失败:', errors);
            Toast.error('请检查表单输入');
          }}
          labelPosition="left"
          labelAlign="left"
          labelWidth={100}
          style={{ padding: '20px' }}
        >
          {/* 基本信息区域 */}
          <div style={{
            marginBottom: '18px',
            padding: '16px',
            border: '1px solid var(--semi-color-border)',
            borderRadius: '6px',
            backgroundColor: 'var(--semi-color-bg-1)'
          }}>
            <h4 style={{
              margin: '0 0 12px 0',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--semi-color-text-0)',
              paddingBottom: '6px',
              borderBottom: '1px solid var(--semi-color-border)'
            }}>
              基本信息
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
              <Form.Input
                field="name"
                label="项目名称"
                placeholder="请输入项目名称"
                rules={[{ required: true, message: '请输入项目名称' }]}
              />

              <Form.Select
                field="type"
                label="项目类型"
                placeholder="请选择项目类型"
                rules={[{ required: true, message: '请选择项目类型' }]}
              >
                {PROJECT_TYPES.map(type => (
                  <Select.Option key={`type_${type.value}`} value={type.value}>
                    {type.label}
                  </Select.Option>
                ))}
              </Form.Select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
              <Form.Select
                field="priority"
                label="优先级"
                placeholder="请选择优先级"
                rules={[{ required: true, message: '请选择优先级' }]}
              >
                {PROJECT_PRIORITIES.map(priority => (
                  <Select.Option key={`priority_${priority.value}`} value={priority.value}>
                    {priority.label}
                  </Select.Option>
                ))}
              </Form.Select>

              <Form.Switch
                field="is_public"
                label="公开项目"
                checkedText="是"
                uncheckedText="否"
              />
            </div>

            <div>
              <Form.TextArea
                field="description"
                label="项目描述"
                placeholder="请输入项目描述"
                autosize={{ minRows: 2, maxRows: 3 }}
              />
            </div>
          </div>

          {/* 时间设置区域 */}
          <div style={{
            marginBottom: '18px',
            padding: '16px',
            border: '1px solid var(--semi-color-border)',
            borderRadius: '6px',
            backgroundColor: 'var(--semi-color-bg-1)'
          }}>
            <h4 style={{
              margin: '0 0 12px 0',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--semi-color-text-0)',
              paddingBottom: '6px',
              borderBottom: '1px solid var(--semi-color-border)'
            }}>
              时间设置
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Form.DatePicker
                field="start_date"
                label="开始日期"
                placeholder="请选择开始日期"
                type="date"
              />

              <Form.DatePicker
                field="end_date"
                label="结束日期"
                placeholder="请选择结束日期（可选）"
                type="date"
              />
            </div>
          </div>

          {/* 人员配置区域 */}
          <div style={{
            marginBottom: '18px',
            padding: '16px',
            border: '1px solid var(--semi-color-border)',
            borderRadius: '6px',
            backgroundColor: 'var(--semi-color-bg-1)'
          }}>
            <h4 style={{
              margin: '0 0 12px 0',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--semi-color-text-0)',
              paddingBottom: '6px',
              borderBottom: '1px solid var(--semi-color-border)'
            }}>
              人员配置
            </h4>

            <div style={{ marginBottom: '12px' }}>
              <label style={{
                display: 'block',
                marginBottom: '6px',
                fontWeight: 500,
                color: 'var(--semi-color-text-0)',
                fontSize: '13px'
              }}>
                项目负责人 <span style={{ color: 'var(--semi-color-danger)' }}>*</span>
              </label>
              {securityEngineers.length === 0 ? (
                <div style={{
                  color: 'var(--semi-color-text-2)',
                  padding: '10px',
                  textAlign: 'center',
                  backgroundColor: 'var(--semi-color-fill-0)',
                  borderRadius: '4px',
                  border: '1px dashed var(--semi-color-border)',
                  fontSize: '12px'
                }}>
                  正在加载安全工程师列表...
                </div>
              ) : (
                <Select
                  placeholder="请选择项目负责人"
                  value={selectedOwnerId}
                  onChange={(value) => {
                    setSelectedOwnerId(value as number);
                  }}
                  style={{ width: '100%' }}
                >
                  {securityEngineers.filter(engineer => engineer && engineer.id).map((engineer: User) => (
                    <Select.Option key={`owner_${engineer.id}`} value={engineer.id}>
                      {engineer.real_name || engineer.username} ({engineer.username})
                    </Select.Option>
                  ))}
                </Select>
              )}
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '6px',
                fontWeight: 500,
                color: 'var(--semi-color-text-0)',
                fontSize: '13px'
              }}>
                项目成员
              </label>
              {!isClient || allEngineers.length === 0 ? (
                <div style={{
                  color: 'var(--semi-color-text-2)',
                  padding: '10px',
                  textAlign: 'center',
                  backgroundColor: 'var(--semi-color-fill-0)',
                  borderRadius: '4px',
                  border: '1px dashed var(--semi-color-border)',
                  fontSize: '12px'
                }}>
                  {!isClient ? '加载中...' : '正在加载工程师列表...'}
                </div>
              ) : (
                <Select
                  placeholder="请选择项目成员"
                  value={selectedMemberIds}
                  onChange={(value) => {
                    setSelectedMemberIds(Array.isArray(value) ? value as number[] : []);
                  }}
                  multiple
                  style={{ width: '100%' }}
                  maxTagCount={3}
                  suppressHydrationWarning
                >
                  {allEngineers.filter(engineer => engineer && engineer.id).map((engineer: User) => (
                    <Select.Option key={`member_${engineer.id}`} value={engineer.id}>
                      {engineer.real_name || engineer.username} ({engineer.username}) - {authUtils.getRoleDisplayName(engineer.role_id)}
                    </Select.Option>
                  ))}
                </Select>
              )}
            </div>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid var(--semi-color-border)'
          }}>
            <Button onClick={() => setModalVisible(false)}>
              取消
            </Button>
            <Button
              theme="solid"
              type="primary"
              htmlType="submit"
            >
              {editingProject ? '更新' : '创建'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
} 