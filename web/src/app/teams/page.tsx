'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Typography,
  Button,
  Table,
  Tag,
  Space,
  Modal,
  Input,
  Select,
  Toast,
  Empty,
  Spin,
  Divider,
  Avatar,
  Pagination,
  RadioGroup,
  Radio,
} from '@douyinfe/semi-ui';
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconSearch,
  IconRefresh,
  IconUserGroup,
  IconEyeOpened,
  IconUser,
  IconGridView,
  IconListView,
  IconMore,
  IconSetting,
} from '@douyinfe/semi-icons';
import {
  teamApi,
  userApi,
  authUtils,
  Team,
  User,
  TeamCreateRequest,
  TeamUpdateRequest,
} from '@/lib/api';

const { Title, Text } = Typography;

export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 视图模式状态
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('teamViewMode');
      return (saved as 'card' | 'list') || 'card';
    }
    return 'card';
  });

  // 分页
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(8);
  const [total, setTotal] = useState(0);

  // 当前用户
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const isAdmin = currentUser?.role_id === 1;
  const isSecurityEngineer = currentUser?.role_id === 2;
  const canManageTeams = isAdmin || isSecurityEngineer;

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLeaderId, setFormLeaderId] = useState<number | undefined>(undefined);
  const [formMemberIds, setFormMemberIds] = useState<number[]>([]);

  // User list for selects
  const [selectableUsers, setSelectableUsers] = useState<User[]>([]);

  const getUserId = (user: User): number => {
    return user.id || user.ID;
  };

  const getUserLabel = (user: User): string => {
    const name = user.real_name || user.username;
    return `${name} (${user.username})`;
  };

  const loadTeams = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const response = await teamApi.getTeamList({
        page,
        page_size: 100,
        keyword: searchKeyword || undefined,
      });

      if (response.code === 200 && response.data) {
        setTeams(response.data.teams || []);
        setTotal(response.data.total || 0);
      }
    } catch (error) {
      console.error('Error loading teams:', error);
      Toast.error('加载团队列表失败');
    } finally {
      setLoading(false);
    }
  }, [searchKeyword]);

  const loadUsers = async () => {
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

      // 去重并按姓名/用户名排序，提升下拉选择体验
      const uniqueUsers = Array.from(
        new Map(allUsers.map((user) => [getUserId(user), user])).values()
      ).sort((a, b) => {
        const nameA = a.real_name || a.username || '';
        const nameB = b.real_name || b.username || '';
        return nameA.localeCompare(nameB, 'zh-CN');
      });

      setSelectableUsers(uniqueUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      Toast.error('加载用户列表失败');
    }
  };

  useEffect(() => {
    const user = authUtils.getCurrentUser();
    setCurrentUser(user);
    loadTeams();
  }, []);

  useEffect(() => {
    if (canManageTeams) {
      loadUsers();
    }
  }, [canManageTeams]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchKeyword]);

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormLeaderId(undefined);
    setFormMemberIds([]);
  };

  const handleCreateTeam = () => {
    setEditingTeam(null);
    resetForm();
    setModalVisible(true);
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeam(team);
    setFormName(team.name);
    setFormDescription(team.description || '');
    setFormLeaderId(team.leader_id);
    const memberIds = (team.members || []).map(m => {
      const uid = m.user_id || (m.user ? getUserId(m.user) : 0);
      return uid;
    }).filter(id => id > 0);
    setFormMemberIds(memberIds);
    setModalVisible(true);
  };

  const handleSaveTeam = async () => {
    if (!formName.trim()) {
      Toast.error('请输入团队名称');
      return;
    }
    if (!formLeaderId) {
      Toast.error('请选择团队负责人');
      return;
    }

    let memberIds = [...formMemberIds];
    if (!memberIds.includes(formLeaderId)) {
      memberIds.push(formLeaderId);
    }

    setSubmitting(true);
    try {
      let response;
      if (editingTeam) {
        const teamId = editingTeam.id || editingTeam.ID;
        if (!teamId) {
          Toast.error('团队ID无效');
          return;
        }
        const updateData: TeamUpdateRequest = {
          name: formName.trim(),
          description: formDescription.trim(),
          leader_id: formLeaderId,
          member_ids: memberIds,
        };
        response = await teamApi.updateTeam(teamId as number, updateData);
      } else {
        const createData: TeamCreateRequest = {
          name: formName.trim(),
          description: formDescription.trim(),
          leader_id: formLeaderId,
          member_ids: memberIds,
        };
        response = await teamApi.createTeam(createData);
      }

      if (response && response.code === 200) {
        Toast.success(editingTeam ? '更新成功' : '创建成功');
        setModalVisible(false);
        setEditingTeam(null);
        resetForm();
        await loadTeams();
      } else {
        throw new Error(response?.msg || '操作失败');
      }
    } catch (error: any) {
      console.error('保存团队失败:', error);
      const errorMessage =
        error?.response?.data?.msg || error?.message || (editingTeam ? '更新失败' : '创建失败');
      Toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!teamToDelete) return;
    const teamId = teamToDelete.id || teamToDelete.ID;
    if (!teamId) {
      Toast.error('团队ID无效');
      return;
    }

    try {
      await teamApi.deleteTeam(teamId as number);
      Toast.success('删除成功');
      setDeleteConfirmVisible(false);
      setTeamToDelete(null);
      await loadTeams();
    } catch (error: any) {
      console.error('Error deleting team:', error);
      const errorMessage = error?.response?.data?.msg || error?.message || '删除失败';
      Toast.error(errorMessage);
    }
  };

  const handleViewTeam = (team: Team) => {
    router.push(`/teams/detail?id=${team.id || team.ID}`);
  };

  const handleViewModeChange = (mode: 'card' | 'list') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('teamViewMode', mode);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const leaderOptions = selectableUsers.map(user => ({
    value: getUserId(user),
    label: getUserLabel(user),
  }));

  const memberOptions = selectableUsers.map(user => ({
    value: getUserId(user),
    label: getUserLabel(user),
  }));

  // 搜索过滤
  const filteredTeams = teams.filter(team => {
    if (searchKeyword && !team.name.toLowerCase().includes(searchKeyword.toLowerCase())) {
      return false;
    }
    return true;
  });

  // 分页计算
  const totalTeams = filteredTeams.length;
  const totalPages = Math.ceil(totalTeams / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentPageTeams = filteredTeams.slice(startIndex, endIndex);

  // ========== 卡片视图 ==========
  const renderTeamCard = (team: Team) => {
    const memberCount = team.members?.length || 0;

    return (
      <Card
        key={team.id || team.ID}
        style={{
          height: '260px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          background: 'var(--semi-color-bg-1)',
        }}
        bodyStyle={{
          padding: '16px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
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
        onClick={() => handleViewTeam(team)}
      >
        {/* 团队名称 */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <IconUserGroup style={{ color: 'var(--semi-color-primary)', fontSize: '18px' }} />
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
              }}
            >
              {team.name}
            </Title>
          </div>
        </div>

        {/* 团队信息 */}
        <div style={{ marginBottom: '12px', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
            {/* 负责人 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Text type="secondary" style={{ fontWeight: 500, fontSize: '11px', flexShrink: 0 }}>
                负责人:
              </Text>
              <Tag color="blue" size="small" style={{ margin: 0, fontSize: '11px', padding: '2px 6px' }}>
                {team.leader?.real_name || team.leader?.username || '未指定'}
              </Tag>
            </div>

            {/* 创建时间 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Text type="secondary" style={{ fontWeight: 500, fontSize: '11px', flexShrink: 0 }}>
                创建时间:
              </Text>
              <Text style={{ color: 'var(--semi-color-text-1)', fontSize: '12px' }}>
                {team.created_at ? new Date(team.created_at).toLocaleDateString('zh-CN') : '-'}
              </Text>
            </div>
          </div>
        </div>

        {/* 团队描述 */}
        {team.description && (
          <div style={{ marginBottom: '12px' }}>
            <Text
              style={{
                color: 'var(--semi-color-text-2)',
                lineHeight: '1.4',
                fontSize: '11px',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {team.description}
            </Text>
          </div>
        )}

        <Divider margin="8px 0" />

        {/* 统计信息 */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--semi-color-primary)', marginBottom: '2px' }}>
                {memberCount}
              </div>
              <Text type="secondary" size="small" style={{ fontSize: '10px' }}>成员</Text>
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--semi-color-warning)', marginBottom: '2px' }}>
                {team.vuln_count || 0}
              </div>
              <Text type="secondary" size="small" style={{ fontSize: '10px' }}>漏洞</Text>
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
              onClick={(e) => { e.stopPropagation(); handleViewTeam(team); }}
              style={{ borderRadius: '4px', fontSize: '11px', padding: '4px 8px', flex: 1 }}
            >
              查看
            </Button>
            {canManageTeams && (
              <>
                <Button
                  theme="light"
                  type="warning"
                  size="small"
                  onClick={(e) => { e.stopPropagation(); handleEditTeam(team); }}
                  style={{ borderRadius: '4px', fontSize: '11px', padding: '4px 8px' }}
                >
                  编辑
                </Button>
                <Button
                  theme="light"
                  type="danger"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTeamToDelete(team);
                    setDeleteConfirmVisible(true);
                  }}
                  style={{ borderRadius: '4px', fontSize: '11px', padding: '4px 8px' }}
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

  // ========== 列表视图 ==========
  const renderTeamTable = () => {
    const columns = [
      {
        title: '团队名称',
        dataIndex: 'name',
        key: 'name',
        width: 180,
        render: (name: string, record: Team) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconUserGroup style={{ color: 'var(--semi-color-primary)', fontSize: '14px' }} />
            <Text
              strong
              style={{ color: 'var(--semi-color-text-0)', cursor: 'pointer', fontSize: '13px' }}
              onClick={() => handleViewTeam(record)}
            >
              {name}
            </Text>
          </div>
        ),
      },
      {
        title: '描述',
        dataIndex: 'description',
        key: 'description',
        width: 200,
        render: (desc: string) => (
          <Text
            size="small"
            type="secondary"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: '1.3',
              fontSize: '12px',
            }}
          >
            {desc || '暂无描述'}
          </Text>
        ),
      },
      {
        title: '负责人',
        dataIndex: 'leader',
        key: 'leader',
        width: 100,
        render: (leader: User) => {
          if (!leader) return <Text type="secondary" size="small">-</Text>;
          return (
            <Tag color="blue" size="small" style={{ fontSize: '11px', padding: '2px 6px' }}>
              {leader.real_name || leader.username}
            </Tag>
          );
        },
      },
      {
        title: '统计',
        key: 'stats',
        width: 140,
        render: (_text: string, record: Team) => (
          <div style={{ display: 'flex', gap: '12px', fontSize: '11px', whiteSpace: 'nowrap' }}>
            <Text type="secondary" size="small" style={{ fontSize: '11px' }}>
              成员: {record.members?.length || 0}
            </Text>
            <Text type="secondary" size="small" style={{ fontSize: '11px' }}>
              漏洞: {record.vuln_count || 0}
            </Text>
          </div>
        ),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 110,
        render: (time: string) => (
          <Text size="small" type="secondary" style={{ fontSize: '12px' }}>
            {time ? new Date(time).toLocaleDateString('zh-CN') : '-'}
          </Text>
        ),
      },
      {
        title: '操作',
        key: 'action',
        width: 180,
        fixed: 'right' as const,
        render: (_text: string, record: Team) => (
          <Space size="small">
            <Button
              theme="borderless"
              icon={<IconMore />}
              size="small"
              onClick={() => handleViewTeam(record)}
              style={{ color: 'var(--semi-color-primary)', padding: '4px 8px' }}
            >
              查看
            </Button>
            {canManageTeams && (
              <>
                <Button
                  theme="borderless"
                  icon={<IconEdit />}
                  size="small"
                  onClick={() => handleEditTeam(record)}
                  style={{ color: 'var(--semi-color-warning)', padding: '4px 8px' }}
                >
                  编辑
                </Button>
                <Button
                  theme="borderless"
                  type="danger"
                  icon={<IconDelete />}
                  size="small"
                  onClick={() => { setTeamToDelete(record); setDeleteConfirmVisible(true); }}
                  style={{ padding: '4px 8px' }}
                >
                  删除
                </Button>
              </>
            )}
          </Space>
        ),
      },
    ];

    return (
      <Card style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)' }}>
        <Table
          columns={columns}
          dataSource={currentPageTeams}
          pagination={false}
          loading={loading}
          rowKey={(record) => record.id || record.ID}
          size="small"
          scroll={{ x: 900 }}
          className="compact-table"
          empty={
            <Empty
              image={<IconUserGroup size="extra-large" style={{ color: 'var(--semi-color-text-2)' }} />}
              title={<Text style={{ fontSize: '16px', fontWeight: 500, color: 'var(--semi-color-text-1)' }}>暂无团队</Text>}
              description={<Text type="secondary" style={{ fontSize: '14px' }}>{canManageTeams ? '点击"新建团队"创建第一个团队' : '暂时没有分配给您的团队'}</Text>}
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
        marginBottom: '32px',
      }}>
        <div>
          <Title heading={3} style={{ margin: 0 }}>团队管理</Title>
          <Text type="secondary">
            管理安全团队与成员
            {filteredTeams.length > 0 && (
              <span style={{ marginLeft: '8px' }}>
                • 共 {totalTeams} 个团队
                {totalPages > 1 && ` • 第 ${currentPage}/${totalPages} 页`}
              </span>
            )}
          </Text>
        </div>
        <Space>
          <Button
            theme="borderless"
            icon={<IconRefresh />}
            onClick={() => loadTeams()}
            loading={loading}
          >
            刷新
          </Button>
          {canManageTeams && (
            <Button
              theme="solid"
              type="primary"
              icon={<IconPlus />}
              onClick={handleCreateTeam}
            >
              新建团队
            </Button>
          )}
        </Space>
      </div>

      {/* 搜索和筛选 */}
      <Card style={{
        marginBottom: '32px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
      }}>
        <div style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          flexWrap: 'wrap',
          padding: '8px 0',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Input
              prefix={<IconSearch />}
              placeholder="搜索团队名称"
              value={searchKeyword}
              onChange={(value) => setSearchKeyword(value as string)}
              onEnterPress={() => loadTeams()}
              style={{ width: '200px' }}
            />
            <Button onClick={() => loadTeams()} loading={loading}>
              搜索
            </Button>
          </div>

          {/* 视图切换 */}
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

      {/* 团队列表 */}
      <Spin spinning={loading}>
        {filteredTeams.length > 0 ? (
          <>
            {viewMode === 'card' ? (
              <div
                className="team-cards-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '16px',
                  marginBottom: '32px',
                }}
              >
                {currentPageTeams.map(renderTeamCard)}
                <style jsx>{`
                  .team-cards-grid {
                    min-height: 540px;
                  }
                  @media (max-width: 1200px) {
                    .team-cards-grid {
                      grid-template-columns: repeat(3, 1fr) !important;
                    }
                  }
                  @media (max-width: 900px) {
                    .team-cards-grid {
                      grid-template-columns: repeat(2, 1fr) !important;
                    }
                  }
                  @media (max-width: 600px) {
                    .team-cards-grid {
                      grid-template-columns: 1fr !important;
                      min-height: auto !important;
                    }
                  }
                `}</style>
              </div>
            ) : (
              <div style={{ marginBottom: '32px' }}>
                {renderTeamTable()}
              </div>
            )}

            {/* 分页 */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                marginTop: '40px',
                padding: '20px 0',
              }}>
                <Pagination
                  total={totalTeams}
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
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
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
            padding: '60px 20px',
          }}>
            <Empty
              image={<IconUserGroup size="extra-large" style={{ color: 'var(--semi-color-text-2)' }} />}
              title={<Text style={{ fontSize: '18px', fontWeight: 500, color: 'var(--semi-color-text-1)' }}>暂无团队</Text>}
              description={<Text type="secondary" style={{ fontSize: '14px', lineHeight: '1.6' }}>{canManageTeams ? '点击"新建团队"创建第一个团队' : '暂时没有分配给您的团队'}</Text>}
            />
          </Card>
        )}
      </Spin>

      {/* 创建/编辑弹窗 */}
      <Modal
        title={editingTeam ? '编辑团队' : '新建团队'}
        visible={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingTeam(null);
          resetForm();
        }}
        onOk={handleSaveTeam}
        okText={editingTeam ? '保存' : '创建'}
        cancelText="取消"
        confirmLoading={submitting}
        width={560}
        maskClosable={false}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
          <div>
            <Text strong style={{ display: 'block', marginBottom: '8px' }}>
              团队名称 <span style={{ color: 'var(--semi-color-danger)' }}>*</span>
            </Text>
            <Input
              placeholder="请输入团队名称"
              value={formName}
              onChange={(value) => setFormName(value as string)}
            />
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: '8px' }}>描述</Text>
            <Input
              placeholder="请输入团队描述（选填）"
              value={formDescription}
              onChange={(value) => setFormDescription(value as string)}
            />
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: '8px' }}>
              负责人 <span style={{ color: 'var(--semi-color-danger)' }}>*</span>
            </Text>
            <Select
              placeholder="请选择团队负责人"
              value={formLeaderId}
              onChange={(value) => setFormLeaderId(value as number)}
              optionList={leaderOptions}
              filter
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: '8px' }}>团队成员</Text>
            <Select
              placeholder="请选择团队成员"
              value={formMemberIds}
              onChange={(value) => setFormMemberIds(value as number[])}
              optionList={memberOptions}
              multiple
              filter
              style={{ width: '100%' }}
              maxTagCount={5}
            />
          </div>
        </div>
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal
        title="确认删除"
        visible={deleteConfirmVisible}
        onCancel={() => {
          setDeleteConfirmVisible(false);
          setTeamToDelete(null);
        }}
        onOk={handleDeleteTeam}
        okText="删除"
        okButtonProps={{ type: 'danger' }}
        cancelText="取消"
        width={420}
      >
        <div style={{ padding: '16px 0' }}>
          <Text>
            确定要删除团队 <Text strong>「{teamToDelete?.name}」</Text> 吗？此操作不可撤销。
          </Text>
        </div>
      </Modal>
    </div>
  );
}
