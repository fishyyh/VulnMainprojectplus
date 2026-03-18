'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Card,
  Typography,
  Button,
  Space,
  Tag,
  Tabs,
  Table,
  Empty,
  Spin,
  Modal,
  Input,
  Select,
  DatePicker,
  Toast,
  TextArea,
  Popconfirm,
} from '@douyinfe/semi-ui';
import {
  IconArrowLeft,
  IconPlus,
  IconEdit,
  IconDelete,
  IconUser,
  IconBolt,
  IconRefresh,
  IconSearch,
  IconEyeOpened,
} from '@douyinfe/semi-icons';
import MarkdownEditor from '@/components/MarkdownEditor';
import MarkdownViewer from '@/components/MarkdownViewer';
import {
  teamApi,
  vulnApi,
  userApi,
  authUtils,
  Team,
  Vulnerability,
  User,
  VulnTimeline,
  VulnWatcher,
  VULN_SEVERITIES,
  VULN_STATUSES,
  VULN_TYPES,
  VulnCreateRequest,
  VulnUpdateRequest,
} from '@/lib/api';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

export default function TeamDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const teamId = searchParams.get('id') as string;

  // Basic state
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTabKey, setActiveTabKey] = useState('vulns');

  // Current user
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<User[]>([]);

  // Vuln list state
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [vulnTotal, setVulnTotal] = useState(0);
  const [vulnPage, setVulnPage] = useState(1);
  const [vulnPageSize] = useState(10);
  const [vulnLoading, setVulnLoading] = useState(false);

  // Vuln filters
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterKeyword, setFilterKeyword] = useState<string>('');

  // Vuln create/edit modal
  const [vulnModalVisible, setVulnModalVisible] = useState(false);
  const [editingVuln, setEditingVuln] = useState<Vulnerability | null>(null);

  // Vuln form fields (controlled state)
  const [formTitle, setFormTitle] = useState('');
  const [formVulnUrl, setFormVulnUrl] = useState('');
  const [formVulnType, setFormVulnType] = useState('');
  const [formSeverity, setFormSeverity] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formFixSuggestion, setFormFixSuggestion] = useState('');
  const [formAssigneeId, setFormAssigneeId] = useState<number | null>(null);
  const [formFixDeadline, setFormFixDeadline] = useState<Date | null>(null);
  const [formCveId, setFormCveId] = useState('');
  const [formTags, setFormTags] = useState('');

  // Vuln detail modal
  const [vulnDetailModalVisible, setVulnDetailModalVisible] = useState(false);
  const [viewingVuln, setViewingVuln] = useState<Vulnerability | null>(null);
  const [vulnDetailLoading, setVulnDetailLoading] = useState(false);

  // Timeline
  const [vulnTimeline, setVulnTimeline] = useState<VulnTimeline[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Comment
  const [commentText, setCommentText] = useState('');

  // Watcher
  const [watcherEmail, setWatcherEmail] = useState('');

  const roleCode = authUtils.getRoleCodeFromUser(currentUser);
  const isAdmin = roleCode === 'super_admin' || roleCode === 'admin';
  const isSecurityEngineer = roleCode === 'security_engineer';
  const isDevEngineer = roleCode === 'dev_engineer';

  // ========== Helpers ==========

  const getSeverityColor = (severity: string): 'red' | 'orange' | 'yellow' | 'blue' | 'grey' | 'green' => {
    const severityItem = VULN_SEVERITIES.find(s => s.value === severity);
    return (severityItem?.color as any) || 'grey';
  };

  const getStatusColor = (status: string): 'red' | 'orange' | 'yellow' | 'blue' | 'grey' | 'green' | 'light-green' | 'purple' => {
    const statusItem = VULN_STATUSES.find(s => s.value === status);
    return (statusItem?.color as any) || 'grey';
  };

  // ========== Data Loading ==========

  useEffect(() => {
    setCurrentUser(authUtils.getCurrentUser());
    if (teamId) {
      loadTeamDetail();
      loadAssignableUsers();
    }
  }, [teamId]);

  useEffect(() => {
    if (team && activeTabKey === 'vulns') {
      loadVulns();
    }
  }, [team, activeTabKey, vulnPage, filterSeverity, filterStatus, filterKeyword]);

  useEffect(() => {
    if (!vulnDetailModalVisible) {
      document.body.style.overflow = 'auto';
    }
  }, [vulnDetailModalVisible]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const loadTeamDetail = async () => {
    try {
      setLoading(true);
      const response = await teamApi.getTeam(parseInt(teamId));
      if (response.code === 200 && response.data) {
        setTeam(response.data);
      }
    } catch (error) {
      console.error('Error loading team detail:', error);
      Toast.error('加载团队详情失败');
    } finally {
      setLoading(false);
    }
  };

  const loadAssignableUsers = async () => {
    try {
      const pageSize = 100;
      let page = 1;
      let totalPages = 1;
      const allUsers: User[] = [];

      while (page <= totalPages) {
        const response = await userApi.getUserList({
          page,
          page_size: pageSize,
          status: 1,
        });

        if (response.code !== 200 || !response.data) {
          throw new Error(response.msg || '加载用户列表失败');
        }

        allUsers.push(...(response.data.users || []));
        const total = response.data.total || allUsers.length;
        totalPages = Math.max(1, Math.ceil(total / pageSize));
        page += 1;
      }

      const uniqueUsers = Array.from(
        new Map(allUsers.map((user) => [user.ID || user.id, user])).values()
      ).sort((a, b) => {
        const nameA = a.real_name || a.username || '';
        const nameB = b.real_name || b.username || '';
        return nameA.localeCompare(nameB, 'zh-CN');
      });

      setAssignableUsers(uniqueUsers);
    } catch (error) {
      console.warn('Error loading assignable users, fallback to team members:', error);
      setAssignableUsers([]);
    }
  };

  const loadVulns = async () => {
    try {
      setVulnLoading(true);
      const params: any = {
        team_id: parseInt(teamId),
        page: vulnPage,
        page_size: vulnPageSize,
      };
      if (filterSeverity) params.severity = filterSeverity;
      if (filterStatus.length > 0) params.status = filterStatus.join(',');
      if (filterKeyword) params.keyword = filterKeyword;

      const response = await vulnApi.getVulnList(params);
      if (response.code === 200 && response.data) {
        setVulns(response.data.vulns || []);
        setVulnTotal(response.data.total || 0);
      }
    } catch (error) {
      console.error('Error loading vulns:', error);
      Toast.error('加载漏洞列表失败');
    } finally {
      setVulnLoading(false);
    }
  };

  const refreshTimeline = async (vulnId: number) => {
    try {
      const timelineResponse = await vulnApi.getVulnTimeline(vulnId);
      if (timelineResponse.code === 200) {
        setVulnTimeline(timelineResponse.data || []);
      }
    } catch (error) {
      console.error('刷新时间线失败:', error);
    }
  };

  // ========== Form Helpers ==========

  const resetForm = () => {
    setFormTitle('');
    setFormVulnUrl('');
    setFormVulnType('');
    setFormSeverity('');
    setFormDescription('');
    setFormFixSuggestion('');
    setFormAssigneeId(null);
    setFormFixDeadline(null);
    setFormCveId('');
    setFormTags('');
  };

  const fillFormFromVuln = (vuln: Vulnerability) => {
    setFormTitle(vuln.title || '');
    setFormVulnUrl(vuln.vuln_url || '');
    setFormVulnType(vuln.vuln_type || '');
    setFormSeverity(vuln.severity || '');
    setFormDescription(vuln.description || '');
    setFormFixSuggestion(vuln.fix_suggestion || '');
    setFormAssigneeId(vuln.assignee_id || null);
    setFormFixDeadline(vuln.fix_deadline ? new Date(vuln.fix_deadline) : null);
    setFormCveId(vuln.cve_id || '');
    setFormTags(vuln.tags || '');
  };

  // ========== Vuln CRUD ==========

  const handleCreateVuln = () => {
    setEditingVuln(null);
    resetForm();
    setVulnModalVisible(true);
  };

  const handleEditVuln = (vuln: Vulnerability) => {
    setEditingVuln(vuln);
    fillFormFromVuln(vuln);
    setVulnModalVisible(true);
  };

  const handleSaveVuln = async () => {
    // Validate required fields
    if (!formTitle.trim()) { Toast.error('请输入漏洞标题'); return; }
    if (!formVulnUrl.trim()) { Toast.error('请输入漏洞地址'); return; }
    if (!formVulnType) { Toast.error('请选择漏洞类型'); return; }
    if (!formSeverity) { Toast.error('请选择严重程度'); return; }
    if (!formFixSuggestion.trim()) { Toast.error('请输入修复建议'); return; }
    if (!formAssigneeId) { Toast.error('请选择指派人'); return; }
    if (!formFixDeadline) { Toast.error('请选择修复期限'); return; }

    try {
      if (editingVuln) {
        const updateData: VulnUpdateRequest = {
          title: formTitle,
          vuln_url: formVulnUrl,
          vuln_type: formVulnType,
          severity: formSeverity,
          description: formDescription,
          fix_suggestion: formFixSuggestion,
          assignee_id: formAssigneeId,
          fix_deadline: formFixDeadline.toISOString().split('T')[0],
          cve_id: formCveId,
          tags: formTags,
        };
        await vulnApi.updateVuln(editingVuln.id, updateData);
        Toast.success('更新漏洞成功');
      } else {
        const createData: VulnCreateRequest = {
          title: formTitle,
          vuln_url: formVulnUrl,
          vuln_type: formVulnType,
          severity: formSeverity,
          description: formDescription,
          fix_suggestion: formFixSuggestion,
          assignee_id: formAssigneeId,
          fix_deadline: formFixDeadline.toISOString().split('T')[0],
          cve_id: formCveId,
          tags: formTags,
          team_id: parseInt(teamId),
        };
        await vulnApi.createVuln(createData);
        Toast.success('创建漏洞成功');
      }

      setVulnModalVisible(false);
      setEditingVuln(null);
      resetForm();
      loadVulns();
    } catch (error) {
      console.error('保存漏洞失败:', error);
      Toast.error(editingVuln ? '更新漏洞失败' : '创建漏洞失败');
    }
  };

  const handleDeleteVuln = async (vuln: Vulnerability) => {
    try {
      await vulnApi.deleteVuln(vuln.id);
      Toast.success('删除漏洞成功');
      loadVulns();
    } catch (error) {
      console.error('Error deleting vulnerability:', error);
      Toast.error('删除漏洞失败');
    }
  };

  // ========== Vuln Detail ==========

  const handleViewVuln = async (vuln: Vulnerability) => {
    setVulnDetailLoading(true);
    setTimelineLoading(true);
    try {
      const response = await vulnApi.getVuln(vuln.id);
      if (response.code === 200 && response.data) {
        setViewingVuln(response.data);
        await refreshTimeline(vuln.id);
        setVulnDetailModalVisible(true);
        document.body.style.overflow = 'hidden';
      } else {
        Toast.error('获取漏洞详情失败');
      }
    } catch (error) {
      console.error('获取漏洞详情失败:', error);
      Toast.error('获取漏洞详情失败');
    } finally {
      setVulnDetailLoading(false);
      setTimelineLoading(false);
    }
  };

  // ========== Status Change ==========

  const handleUpdateVulnStatus = async (vulnId: number, status: string, extraData?: any) => {
    try {
      await vulnApi.updateVulnStatus(vulnId, { status, ...extraData });
      Toast.success('更新漏洞状态成功');
      loadVulns();

      if (viewingVuln && viewingVuln.id === vulnId) {
        try {
          const response = await vulnApi.getVuln(vulnId);
          if (response.code === 200 && response.data) {
            setViewingVuln(response.data);
          }
          await refreshTimeline(vulnId);
        } catch (refreshError) {
          console.error('刷新漏洞详情失败:', refreshError);
        }
      }
    } catch (error: any) {
      console.error('Error updating vulnerability status:', error);
      Toast.error(error?.response?.data?.msg || error?.message || '更新漏洞状态失败');
    }
  };

  const handleAddComment = async () => {
    if (!viewingVuln || !commentText.trim()) {
      Toast.warning('请输入评论内容');
      return;
    }
    try {
      await vulnApi.addVulnComment(viewingVuln.id, commentText.trim());
      Toast.success('评论添加成功');
      setCommentText('');
      // 刷新漏洞详情以获取最新评论列表
      const vulnResponse = await vulnApi.getVuln(viewingVuln.id);
      if (vulnResponse.code === 200 && vulnResponse.data) {
        setViewingVuln(vulnResponse.data);
      }
      await refreshTimeline(viewingVuln.id);
    } catch (error) {
      console.error('添加评论失败:', error);
      Toast.error('添加评论失败');
    }
  };

  const handleAddWatcher = async () => {
    if (!viewingVuln || !watcherEmail.trim()) {
      Toast.warning('请输入关注者邮箱');
      return;
    }
    try {
      await vulnApi.addVulnWatcher(viewingVuln.id, { email: watcherEmail.trim() });
      Toast.success('添加关注者成功');
      setWatcherEmail('');
      // 刷新漏洞详情以更新关注者列表
      const response = await vulnApi.getVuln(viewingVuln.id);
      if (response.code === 200 && response.data) {
        setViewingVuln(response.data);
      }
      await refreshTimeline(viewingVuln.id);
    } catch (error: any) {
      const msg = error?.response?.data?.msg || '添加关注者失败';
      Toast.error(msg);
    }
  };

  const handleRemoveWatcher = async (watcherId: number) => {
    if (!viewingVuln) return;
    try {
      await vulnApi.removeVulnWatcher(viewingVuln.id, watcherId);
      Toast.success('移除关注者成功');
      const response = await vulnApi.getVuln(viewingVuln.id);
      if (response.code === 200 && response.data) {
        setViewingVuln(response.data);
      }
      await refreshTimeline(viewingVuln.id);
    } catch (error) {
      Toast.error('移除关注者失败');
    }
  };

  // Get status action buttons based on current status
  const getStatusActions = (vuln: Vulnerability) => {
    const buttons: React.ReactNode[] = [];
    const userId = currentUser?.id || currentUser?.ID;
    const isAssignee = vuln.assignee_id === userId;

    switch (vuln.status) {
      case 'pending':
        // 开发可以开始修复
        if (isAdmin || (isDevEngineer && isAssignee)) {
          buttons.push(
            <Button key="fixing" size="small" type="primary" onClick={() => handleUpdateVulnStatus(vuln.id, 'fixing', { fix_started_at: new Date().toISOString() })}>
              开始修复
            </Button>
          );
        }
        // 开发可以驳回
        if (isAdmin || (isDevEngineer && isAssignee)) {
          buttons.push(
            <Button key="reject" size="small" type="danger" onClick={() => {
              Modal.confirm({
                title: '驳回漏洞',
                content: '确定要驳回该漏洞吗？',
                onOk: () => handleUpdateVulnStatus(vuln.id, 'rejected', { rejected_at: new Date().toISOString(), rejected_by: userId, reject_reason: '研发驳回' }),
              });
            }}>
              驳回
            </Button>
          );
        }
        if (isAdmin || isSecurityEngineer) {
          buttons.push(
            <Button key="ignore" size="small" type="warning" onClick={() => {
              Modal.confirm({
                title: '忽略漏洞',
                content: '确定要忽略该漏洞吗？',
                onOk: () => handleUpdateVulnStatus(vuln.id, 'ignored', { ignored_at: new Date().toISOString(), ignore_reason: '手动忽略' }),
              });
            }}>
              忽略
            </Button>
          );
        }
        break;
      case 'unfixed':
        if (isAdmin || (isDevEngineer && isAssignee)) {
          buttons.push(
            <Button key="fixing" size="small" type="primary" onClick={() => handleUpdateVulnStatus(vuln.id, 'fixing', { fix_started_at: new Date().toISOString() })}>
              开始修复
            </Button>
          );
        }
        if (isAdmin || isSecurityEngineer) {
          buttons.push(
            <Button key="ignore" size="small" type="warning" onClick={() => {
              Modal.confirm({
                title: '忽略漏洞',
                content: '确定要忽略该漏洞吗？',
                onOk: () => handleUpdateVulnStatus(vuln.id, 'ignored', { ignored_at: new Date().toISOString(), ignore_reason: '手动忽略' }),
              });
            }}>
              忽略
            </Button>
          );
        }
        break;
      case 'fixing':
        // 开发提交已修复
        if (isAdmin || (isDevEngineer && isAssignee)) {
          buttons.push(
            <Button key="fixed" size="small" type="primary" onClick={() => handleUpdateVulnStatus(vuln.id, 'fixed', { fixed_at: new Date().toISOString(), fixed_by: userId })}>
              提交已修复
            </Button>
          );
          buttons.push(
            <Button key="reject" size="small" type="danger" onClick={() => {
              Modal.confirm({
                title: '驳回漏洞',
                content: '确定要驳回该漏洞吗？',
                onOk: () => handleUpdateVulnStatus(vuln.id, 'rejected', { rejected_at: new Date().toISOString(), rejected_by: userId, reject_reason: '研发驳回' }),
              });
            }}>
              驳回
            </Button>
          );
        }
        break;
      case 'fixed':
        // 安全工程师（漏洞创建人）复测
        if (isAdmin || isSecurityEngineer) {
          buttons.push(
            <Button key="close" size="small" type="primary" style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }} onClick={() => handleUpdateVulnStatus(vuln.id, 'closed', { completed_at: new Date().toISOString() })}>
              复测通过，关闭漏洞
            </Button>
          );
          buttons.push(
            <Button key="unfixed" size="small" type="danger" onClick={() => handleUpdateVulnStatus(vuln.id, 'unfixed')}>
              复测不通过
            </Button>
          );
        }
        break;
      case 'rejected':
        if (isAdmin || isSecurityEngineer) {
          buttons.push(
            <Button key="resubmit" size="small" type="primary" icon={<IconRefresh />} onClick={() => handleUpdateVulnStatus(vuln.id, 'pending', { reject_reason: '', resubmitted_at: new Date().toISOString(), resubmitted_by: userId })}>
              重新提交
            </Button>
          );
        }
        break;
      case 'ignored':
        if (isAdmin || isSecurityEngineer) {
          buttons.push(
            <Button key="reactivate" size="small" type="primary" onClick={() => handleUpdateVulnStatus(vuln.id, 'pending')}>
              重新激活
            </Button>
          );
        }
        break;
    }
    return buttons;
  };

  // ========== Permission Helpers ==========

  const canEditVuln = (vuln: Vulnerability) => {
    if (isAdmin) return true;
    if (vuln.status === 'completed' || vuln.status === 'closed') return false;
    const userId = currentUser?.id || currentUser?.ID;
    if (isSecurityEngineer) return true;
    if (isDevEngineer && vuln.assignee_id === userId) return true;
    return false;
  };

  const canDeleteVuln = (vuln: Vulnerability) => {
    if (isAdmin) return true;
    const userId = currentUser?.id || currentUser?.ID;
    if (isSecurityEngineer && vuln.reporter_id === userId && (vuln.status === 'unfixed' || vuln.status === 'pending')) return true;
    return false;
  };

  // ========== Table Columns ==========

  const vulnColumns = [
    {
      title: '漏洞标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: Vulnerability) => (
        <a onClick={() => handleViewVuln(record)} style={{ cursor: 'pointer' }}>
          <Text strong link>{text}</Text>
        </a>
      ),
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: string) => {
        const item = VULN_SEVERITIES.find(s => s.value === severity);
        return <Tag color={getSeverityColor(severity)}>{item?.label || severity}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const item = VULN_STATUSES.find(s => s.value === status);
        return <Tag color={getStatusColor(status)}>{item?.label || status}</Tag>;
      },
    },
    {
      title: '指派人',
      dataIndex: 'assignee',
      key: 'assignee',
      width: 100,
      render: (assignee: User) => assignee ? assignee.real_name : '未指派',
    },
    {
      title: '修复期限',
      dataIndex: 'fix_deadline',
      key: 'fix_deadline',
      width: 130,
      render: (deadline: string, record: Vulnerability) => {
        if (!deadline) return '-';
        const deadlineDate = new Date(deadline);
        const now = new Date();
        const isOverdue = deadlineDate < now && record.status !== 'completed';
        const daysDiff = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return (
          <div>
            <Text
              type={isOverdue ? 'danger' : daysDiff <= 3 ? 'warning' : 'secondary'}
              style={{ fontWeight: isOverdue || daysDiff <= 3 ? 'bold' : 'normal' }}
            >
              {deadlineDate.toLocaleDateString()}
            </Text>
            {isOverdue && (
              <div><Text type="danger" size="small">已逾期 {Math.abs(daysDiff)} 天</Text></div>
            )}
            {!isOverdue && record.status !== 'completed' && daysDiff <= 3 && daysDiff >= 0 && (
              <div><Text type="warning" size="small">还有 {daysDiff} 天</Text></div>
            )}
          </div>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (time: string) => time ? new Date(time).toLocaleDateString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_text: string, record: Vulnerability) => (
        <Space>
          <Button
            theme="borderless"
            icon={<IconEyeOpened />}
            size="small"
            onClick={() => handleViewVuln(record)}
          />
          {canEditVuln(record) && (
            <Button
              theme="borderless"
              icon={<IconEdit />}
              size="small"
              onClick={() => handleEditVuln(record)}
            />
          )}
          {canDeleteVuln(record) && (
            <Popconfirm
              title="确定要删除该漏洞吗？"
              onConfirm={() => handleDeleteVuln(record)}
            >
              <Button
                theme="borderless"
                icon={<IconDelete />}
                size="small"
                type="danger"
              />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const memberColumns = [
    {
      title: '用户名',
      dataIndex: ['user', 'username'],
      key: 'username',
    },
    {
      title: '真实姓名',
      dataIndex: ['user', 'real_name'],
      key: 'real_name',
    },
    {
      title: '邮箱',
      dataIndex: ['user', 'email'],
      key: 'email',
    },
    {
      title: '角色',
      key: 'role',
      render: (_text: string, record: any) => record.user?.role?.name || '-',
    },
    {
      title: '加入时间',
      dataIndex: 'joined_at',
      key: 'joined_at',
      render: (time: string) => time ? new Date(time).toLocaleDateString() : '-',
    },
  ];

  // ========== Team member helpers ==========

  const getTeamMemberUsers = (): User[] => {
    if (!team?.members) return [];
    return team.members
      .filter(m => m.user)
      .map(m => m.user);
  };

  const getAssigneeUsers = (): User[] => {
    if (assignableUsers.length > 0) return assignableUsers;
    return getTeamMemberUsers();
  };

  // ========== Rendering ==========

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!team) {
    return (
      <div style={{ padding: 24 }}>
        <Empty
          title="团队不存在"
          description="该团队可能已被删除或您无权访问"
        />
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button icon={<IconArrowLeft />} onClick={() => router.push('/teams')}>返回团队列表</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* 团队基本信息 */}
      <Card style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <Space>
            <Button
              theme="borderless"
              icon={<IconArrowLeft />}
              onClick={() => router.push('/teams')}
            >
              返回
            </Button>
            <Title heading={3} style={{ margin: 0 }}>{team.name}</Title>
          </Space>
          <Button
            icon={<IconRefresh />}
            onClick={() => {
              loadTeamDetail();
              if (activeTabKey === 'vulns') {
                loadVulns();
              }
            }}
          >
            刷新
          </Button>
        </div>

        {/* 团队详细信息 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '16px',
          marginBottom: '16px',
          padding: '16px',
          backgroundColor: '#fafafa',
          borderRadius: '8px',
        }}>
          <div>
            <Text type="secondary" size="small">团队负责人：</Text>
            <div style={{ marginTop: '4px' }}>
              <Text strong>{team.leader?.real_name || team.leader?.username || '未设置'}</Text>
            </div>
          </div>

          <div>
            <Text type="secondary" size="small">团队成员：</Text>
            <div style={{ marginTop: '4px' }}>
              <Text strong>{team.members?.length || 0} 人</Text>
            </div>
          </div>

          <div>
            <Text type="secondary" size="small">创建时间：</Text>
            <div style={{ marginTop: '4px' }}>
              <Text strong>
                {team.created_at ? new Date(team.created_at).toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                }) : '未知'}
              </Text>
            </div>
          </div>

          <div>
            <Text type="secondary" size="small">成员列表：</Text>
            <div style={{ marginTop: '4px' }}>
              <Space wrap>
                {team.members?.map((member) => {
                  const userId = member.user?.id || member.user?.ID;
                  const isLeader = team.leader_id === userId;
                  return (
                    <Tag
                      key={userId}
                      color={isLeader ? 'blue' : 'light-blue'}
                      size="small"
                    >
                      {member.user?.real_name || member.user?.username || '未知'}
                      {isLeader ? ' (负责人)' : ''}
                    </Tag>
                  );
                })}
              </Space>
            </div>
          </div>
        </div>

        {team.description && (
          <div>
            <Text type="secondary" size="small">团队描述：</Text>
            <div style={{ marginTop: '8px' }}>
              <Text>{team.description}</Text>
            </div>
          </div>
        )}
      </Card>

      {/* 标签页 */}
      <Card>
        <Tabs activeKey={activeTabKey} onChange={(key) => setActiveTabKey(key)} type="line" size="large">
          {/* Tab 1: Vulnerability Management */}
          <TabPane
            tab={
              <span>
                <IconBolt style={{ marginRight: '8px' }} />
                漏洞管理
              </span>
            }
            itemKey="vulns"
          >
            {/* Filters Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <Space wrap>
                <Select
                  placeholder="严重程度"
                  style={{ width: 130 }}
                  value={filterSeverity || undefined}
                  onChange={(value) => { setFilterSeverity(value as string || ''); setVulnPage(1); }}
                  showClear
                >
                  {VULN_SEVERITIES.map(s => (
                    <Select.Option key={s.value} value={s.value}>{s.label}</Select.Option>
                  ))}
                </Select>
                <Select
                  placeholder="状态"
                  multiple
                  style={{ width: 200 }}
                  value={filterStatus}
                  onChange={(value) => { setFilterStatus(value as string[]); setVulnPage(1); }}
                  showClear
                >
                  {VULN_STATUSES.map(s => (
                    <Select.Option key={s.value} value={s.value}>{s.label}</Select.Option>
                  ))}
                </Select>
                <Input
                  prefix={<IconSearch />}
                  placeholder="搜索漏洞..."
                  style={{ width: 200 }}
                  value={filterKeyword}
                  onChange={(value) => { setFilterKeyword(value); setVulnPage(1); }}
                  showClear
                />
                <Button icon={<IconRefresh />} onClick={() => loadVulns()}>刷新</Button>
              </Space>
              <Button type="primary" theme="solid" icon={<IconPlus />} onClick={handleCreateVuln}>
                创建漏洞
              </Button>
            </div>

            {/* Vuln Table */}
            <Table
              columns={vulnColumns}
              dataSource={vulns}
              rowKey="id"
              loading={vulnLoading}
              pagination={{
                currentPage: vulnPage,
                pageSize: vulnPageSize,
                total: vulnTotal,
                onPageChange: (page: number) => setVulnPage(page),
              }}
              empty={<Empty title="暂无漏洞数据" description="点击「创建漏洞」添加第一个漏洞" />}
            />
          </TabPane>

          {/* Tab 2: Team Members */}
          <TabPane
            tab={
              <span>
                <IconUser style={{ marginRight: '8px' }} />
                团队成员
              </span>
            }
            itemKey="members"
          >
            <Table
              columns={memberColumns}
              dataSource={team.members || []}
              rowKey={(record) => {
                const userId = record.user?.id || record.user?.ID;
                return userId || record.id;
              }}
              pagination={false}
              empty={<Empty title="暂无团队成员" />}
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* Create / Edit Vuln Modal */}
      <Modal
        title={editingVuln ? '编辑漏洞' : '创建漏洞'}
        visible={vulnModalVisible}
        onOk={handleSaveVuln}
        onCancel={() => { setVulnModalVisible(false); setEditingVuln(null); resetForm(); }}
        okText={editingVuln ? '更新' : '创建'}
        cancelText="取消"
        width={860}
        style={{ maxHeight: '90vh' }}
        bodyStyle={{ overflow: 'auto', maxHeight: '70vh' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* title */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>漏洞标题 <Text type="danger">*</Text></Text>
            <Input
              value={formTitle}
              onChange={(value) => setFormTitle(value)}
              placeholder="请输入漏洞标题"
            />
          </div>

          {/* vuln_url */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>漏洞地址 <Text type="danger">*</Text></Text>
            <Input
              value={formVulnUrl}
              onChange={(value) => setFormVulnUrl(value)}
              placeholder="请输入漏洞URL"
            />
          </div>

          {/* vuln_type + severity in a row */}
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>漏洞类型 <Text type="danger">*</Text></Text>
              <Select
                value={formVulnType || undefined}
                onChange={(value) => setFormVulnType(value as string)}
                placeholder="请选择漏洞类型"
                style={{ width: '100%' }}
              >
                {VULN_TYPES.map(t => (
                  <Select.Option key={t} value={t}>{t}</Select.Option>
                ))}
              </Select>
            </div>
            <div style={{ flex: 1 }}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>严重程度 <Text type="danger">*</Text></Text>
              <Select
                value={formSeverity || undefined}
                onChange={(value) => setFormSeverity(value as string)}
                placeholder="请选择严重程度"
                style={{ width: '100%' }}
              >
                {VULN_SEVERITIES.map(s => (
                  <Select.Option key={s.value} value={s.value}>{s.label}</Select.Option>
                ))}
              </Select>
            </div>
          </div>

          {/* description */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>漏洞描述</Text>
            <MarkdownEditor
              value={formDescription}
              onChange={(value) => setFormDescription(value || '')}
              placeholder="请输入漏洞详情（支持Markdown格式和图片上传）"
              height={300}
            />
          </div>

          {/* fix_suggestion */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>修复建议 <Text type="danger">*</Text></Text>
            <MarkdownEditor
              value={formFixSuggestion}
              onChange={(value) => setFormFixSuggestion(value || '')}
              placeholder="请输入修复建议（支持Markdown格式和图片上传）"
              height={200}
            />
          </div>

          {/* assignee_id + fix_deadline in a row */}
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>指派人 <Text type="danger">*</Text></Text>
              <Select
                value={formAssigneeId || undefined}
                onChange={(value) => setFormAssigneeId(value as number)}
                placeholder="请选择指派人"
                style={{ width: '100%' }}
                filter
              >
                {getAssigneeUsers().map(user => {
                  const userId = user.id || user.ID;
                  return (
                    <Select.Option key={userId} value={userId}>
                      {user.real_name || user.username} ({user.username})
                    </Select.Option>
                  );
                })}
              </Select>
            </div>
            <div style={{ flex: 1 }}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>修复期限 <Text type="danger">*</Text></Text>
              <DatePicker
                value={formFixDeadline}
                onChange={(date) => setFormFixDeadline(date as Date)}
                placeholder="请选择修复期限"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* cve_id + tags in a row */}
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>CVE编号</Text>
              <Input
                value={formCveId}
                onChange={(value) => setFormCveId(value)}
                placeholder="例如: CVE-2024-1234"
              />
            </div>
            <div style={{ flex: 1 }}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>标签</Text>
              <Input
                value={formTags}
                onChange={(value) => setFormTags(value)}
                placeholder="多个标签用逗号分隔"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Vuln Detail Modal */}
      <Modal
        title="漏洞详情"
        visible={vulnDetailModalVisible}
        onCancel={() => { setVulnDetailModalVisible(false); setViewingVuln(null); setCommentText(''); }}
        footer={null}
        width={720}
        style={{ maxHeight: '90vh' }}
        bodyStyle={{ overflow: 'auto', maxHeight: '70vh' }}
      >
        {viewingVuln && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Basic Info */}
            <div>
              <Title heading={5}>{viewingVuln.title}</Title>
              <Space wrap style={{ marginTop: 8 }}>
                <Tag color={getSeverityColor(viewingVuln.severity)}>
                  {VULN_SEVERITIES.find(s => s.value === viewingVuln.severity)?.label || viewingVuln.severity}
                </Tag>
                <Tag color={getStatusColor(viewingVuln.status)}>
                  {VULN_STATUSES.find(s => s.value === viewingVuln.status)?.label || viewingVuln.status}
                </Tag>
                {viewingVuln.vuln_type && <Tag>{viewingVuln.vuln_type}</Tag>}
                {viewingVuln.cve_id && <Tag color="cyan">{viewingVuln.cve_id}</Tag>}
              </Space>
            </div>

            {/* Detail Fields */}
            <Card style={{ backgroundColor: 'var(--semi-color-fill-0)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
                <div><Text type="secondary">漏洞地址:</Text> <Text>{viewingVuln.vuln_url || '-'}</Text></div>
                <div><Text type="secondary">提交人:</Text> <Text>{viewingVuln.reporter?.real_name || '-'}</Text></div>
                <div><Text type="secondary">指派人:</Text> <Text>{viewingVuln.assignee?.real_name || '未指派'}</Text></div>
                <div><Text type="secondary">修复期限:</Text> <Text>{viewingVuln.fix_deadline ? new Date(viewingVuln.fix_deadline).toLocaleDateString() : '-'}</Text></div>
                <div><Text type="secondary">创建时间:</Text> <Text>{viewingVuln.created_at ? new Date(viewingVuln.created_at).toLocaleString() : '-'}</Text></div>
                <div><Text type="secondary">更新时间:</Text> <Text>{viewingVuln.updated_at ? new Date(viewingVuln.updated_at).toLocaleString() : '-'}</Text></div>
                {viewingVuln.tags && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <Text type="secondary">标签:</Text>{' '}
                    {viewingVuln.tags.split(',').map((tag, i) => (
                      <Tag key={i} size="small" style={{ marginRight: 4 }}>{tag.trim()}</Tag>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* Description */}
            {viewingVuln.description && (
              <div>
                <Title heading={5} style={{ marginBottom: '16px', color: 'var(--semi-color-primary)' }}>漏洞详情</Title>
                <div style={{
                  padding: '16px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '6px',
                  border: '1px solid #e9ecef',
                }}>
                  <MarkdownViewer content={viewingVuln.description} />
                </div>
              </div>
            )}

            {/* Fix Suggestion */}
            {viewingVuln.fix_suggestion && (
              <div>
                <Title heading={5} style={{ marginBottom: '16px', color: 'var(--semi-color-primary)' }}>修复建议</Title>
                <div style={{
                  padding: '16px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '6px',
                  border: '1px solid #e9ecef',
                }}>
                  <MarkdownViewer content={viewingVuln.fix_suggestion} />
                </div>
              </div>
            )}

            {/* Reject Reason */}
            {viewingVuln.reject_reason && (
              <div>
                <Text strong type="danger" style={{ display: 'block', marginBottom: 4 }}>驳回原因</Text>
                <Card style={{ backgroundColor: '#fff2f0' }}>
                  <Text>{viewingVuln.reject_reason}</Text>
                </Card>
              </div>
            )}

            {/* Status Action Buttons */}
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>状态操作</Text>
              <Space wrap>
                {getStatusActions(viewingVuln)}
                {getStatusActions(viewingVuln).length === 0 && (
                  <Text type="secondary">当前状态下无可用操作</Text>
                )}
              </Space>
            </div>

            {/* Watchers */}
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                <IconUser style={{ marginRight: 4 }} />
                关注者
              </Text>
              {viewingVuln.watchers && viewingVuln.watchers.length > 0 ? (
                <Space wrap style={{ marginBottom: 8 }}>
                  {viewingVuln.watchers.map((watcher) => (
                    <Tag
                      key={watcher.id}
                      color="blue"
                      size="large"
                      closable={isAdmin || isSecurityEngineer || isDevEngineer}
                      onClose={() => handleRemoveWatcher(watcher.id)}
                    >
                      {watcher.user?.real_name || watcher.user?.username || watcher.email}
                    </Tag>
                  ))}
                </Space>
              ) : (
                <Text type="tertiary" style={{ display: 'block', marginBottom: 8 }}>暂无关注者</Text>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  value={watcherEmail}
                  onChange={(value) => setWatcherEmail(value)}
                  placeholder="输入用户邮箱添加关注者"
                  style={{ flex: 1 }}
                />
                <Button type="primary" onClick={handleAddWatcher}>
                  添加
                </Button>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                <IconBolt style={{ marginRight: 4 }} />
                时间线
              </Text>
              {timelineLoading ? (
                <Spin />
              ) : vulnTimeline.length > 0 ? (
                <div style={{ maxHeight: 300, overflow: 'auto' }}>
                  {vulnTimeline.map((item) => (
                    <div key={item.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--semi-color-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space>
                          <Tag size="small" color="blue">{item.user?.real_name || '系统'}</Tag>
                          <Text>{item.description}</Text>
                        </Space>
                        <Text type="tertiary" size="small">
                          {new Date(item.created_at).toLocaleString()}
                        </Text>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Text type="tertiary">暂无时间线记录</Text>
              )}
            </div>

            {/* Comments List */}
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>评论</Text>
              {viewingVuln.comments && viewingVuln.comments.length > 0 ? (
                <div style={{ maxHeight: 300, overflow: 'auto', marginBottom: 12 }}>
                  {viewingVuln.comments.map((comment) => (
                    <div key={comment.id} style={{ padding: '10px 12px', marginBottom: 8, backgroundColor: 'var(--semi-color-fill-0)', borderRadius: 6, border: '1px solid var(--semi-color-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Tag size="small" color="blue">{comment.user?.real_name || comment.user?.username || '未知用户'}</Tag>
                        <Text type="tertiary" size="small">
                          {new Date(comment.created_at).toLocaleString()}
                        </Text>
                      </div>
                      <Text style={{ whiteSpace: 'pre-wrap' }}>{comment.content}</Text>
                    </div>
                  ))}
                </div>
              ) : (
                <Text type="tertiary" style={{ display: 'block', marginBottom: 8 }}>暂无评论</Text>
              )}

              {/* Comment Input */}
              <div style={{ display: 'flex', gap: 8 }}>
                <TextArea
                  value={commentText}
                  onChange={(value) => setCommentText(value)}
                  placeholder="请输入评论内容..."
                  autosize={{ minRows: 2, maxRows: 4 }}
                  style={{ flex: 1 }}
                />
                <Button type="primary" onClick={handleAddComment} style={{ alignSelf: 'flex-end' }}>
                  提交
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
