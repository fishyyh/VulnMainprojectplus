'use client';

import { useEffect, useState } from 'react';
import { Card, Typography, Button, Space, Table, Badge, Progress, List, Avatar } from '@douyinfe/semi-ui';
import { IconUser, IconCalendar, IconAt, IconArrowUp, IconSafe, IconBolt } from '@douyinfe/semi-icons';
import { VChart } from '@visactor/react-vchart';
import { authApi, authUtils, DashboardData, EngineerRankingItem, VulnListItem } from '@/lib/api';

const { Title, Text } = Typography;

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
  role_id: number;
  role?: {
    code?: string;
    name?: string;
  };
  role_code?: string;
}

export default function DashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 检查是否登录
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token) {
      // 未登录，跳转到登录页
      window.location.href = '/login';
      return;
    }

    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        setUser(userData);
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }

    setIsAuthenticated(true);
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await authApi.getDashboardData();
      if (response.code === 200 && response.data) {
        setDashboardData(response.data);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 正在验证登录状态
  if (isAuthenticated === null) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: 'var(--semi-color-text-1)'
      }}>
        正在验证登录状态...
      </div>
    );
  }

  // 未登录，显示跳转信息
  if (!isAuthenticated) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: 'var(--semi-color-text-1)'
      }}>
        正在跳转到登录页...
      </div>
    );
  }

  // 获取角色显示名称（优先使用后端返回的role信息）
  const getRoleDisplayName = (current: User): string => {
    return authUtils.getRoleDisplayNameFromUser(current);
  };

  // 获取严重程度颜色
  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return 'red';
      case 'high':
        return 'orange';
      case 'medium':
        return 'yellow';
      case 'low':
        return 'blue';
      case 'info':
        return 'gray';
      default:
        return 'gray';
    }
  };

  // 获取状态颜色
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'unfixed':
        return 'red';
      case 'fixing':
        return 'orange';
      case 'fixed':
        return 'green';
      case 'retesting':
        return 'blue';
      case 'completed':
        return 'green';
      case 'ignored':
        return 'gray';
      case 'rejected':
        return 'purple';
      default:
        return 'gray';
    }
  };

  // 获取状态显示名称
  const getStatusDisplayName = (status: string): string => {
    switch (status) {
      case 'unfixed':
        return '未修复';
      case 'fixing':
        return '修复中';
      case 'fixed':
        return '已修复';
      case 'retesting':
        return '复测中';
      case 'completed':
        return '已完成';
      case 'ignored':
        return '已忽略';
      case 'rejected':
        return '驳回';
      default:
        return status;
    }
  };

  // 统计卡片组件
  const StatCard = ({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) => (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {icon}
        <div>
          <Text type="secondary" size="small">{title}</Text>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '4px' }}>
            {value}
          </div>
        </div>
      </div>
    </Card>
  );

  // 准备图表数据
  const prepareChartData = () => {
    if (!dashboardData) return { statusData: [], severityData: [], trendData: [], rankingData: [] };

    // 状态分布数据 - 使用真实数据
    const statusData = Object.entries(dashboardData.vuln_status_stats || {}).map(([status, count]) => ({
      type: getStatusDisplayName(status),
      value: count,
      status: status
    }));

    // 严重程度分布数据 - 从最新漏洞中统计真实数据
    const severityStats: { [key: string]: number } = {};
    (dashboardData.latest_vulns || []).forEach(vuln => {
      const severity = vuln.severity || 'unknown';
      severityStats[severity] = (severityStats[severity] || 0) + 1;
    });

    const severityData = Object.entries(severityStats).map(([severity, count]) => ({
      severity: severity.charAt(0).toUpperCase() + severity.slice(1),
      count: count,
      color: getSeverityHexColor(severity)
    }));

    // 趋势数据 - 基于最新漏洞的提交时间统计真实数据
    const trendData = generateTrendDataFromVulns(dashboardData.latest_vulns || []);

    // 排行榜数据 - 使用真实排行榜数据
    const rankingData = (dashboardData.security_engineer_ranking || []).map((item, index) => ({
      name: item.real_name,
      count: item.count,
      rank: index + 1
    }));

    return { statusData, severityData, trendData, rankingData };
  };

  // 获取严重程度对应的十六进制颜色
  const getSeverityHexColor = (severity: string): string => {
    switch (severity.toLowerCase()) {
      case 'critical': return '#ff4d4f';
      case 'high': return '#ff7a45';
      case 'medium': return '#ffa940';
      case 'low': return '#1890ff';
      case 'info': return '#52c41a';
      default: return '#d9d9d9';
    }
  };

  // 从漏洞数据生成趋势数据
  const generateTrendDataFromVulns = (vulns: VulnListItem[]) => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return {
        date: date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
        dateObj: new Date(date),
        新增漏洞: 0,
        已修复: 0,
        待修复: 0
      };
    });

    // 统计每天的漏洞数据
    vulns.forEach(vuln => {
      const submitDate = new Date(vuln.submitted_at);
      const dayIndex = last7Days.findIndex(day =>
        day.dateObj.toDateString() === submitDate.toDateString()
      );

      if (dayIndex !== -1) {
        last7Days[dayIndex].新增漏洞++;

        if (vuln.status === 'fixed' || vuln.status === 'completed') {
          last7Days[dayIndex].已修复++;
        } else {
          last7Days[dayIndex].待修复++;
        }
      }
    });

    return last7Days.map(({ dateObj, ...rest }) => rest);
  };

  // 获取项目分布图表配置
  const getProjectDistributionSpec = () => {
    if (!dashboardData?.latest_vulns) return null;

    // 统计每个项目的漏洞数量
    const projectStats: { [key: string]: number } = {};
    dashboardData.latest_vulns.forEach(vuln => {
      const projectName = vuln.project_name || '未知项目';
      projectStats[projectName] = (projectStats[projectName] || 0) + 1;
    });

    const projectData = Object.entries(projectStats)
      .map(([project, count]) => ({ project, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // 只显示前10个项目

    return {
      type: 'bar' as const,
      data: [{ id: 'data', values: projectData }],
      xField: 'project',
      yField: 'count',
      title: { visible: true, text: '项目漏洞分布' },
      axes: [
        { orient: 'bottom' as const, type: 'band' as const, label: { style: { angle: -45 } } },
        { orient: 'left' as const, type: 'linear' as const }
      ],
      bar: {
        style: {
          fill: '#52c41a'
        }
      }
    };
  };

  // 渲染超级管理员仪表板
  const renderSuperAdminDashboard = () => {
    if (!dashboardData) return null;

    const { statusData, severityData, trendData, rankingData } = prepareChartData();

    // 饼图配置
    const pieSpec = {
      type: 'pie' as const,
      data: [{ id: 'data', values: statusData }],
      outerRadius: 0.8,
      valueField: 'value',
      categoryField: 'type',
      title: { visible: true, text: '漏洞状态分布' },
      legends: { visible: true, orient: 'bottom' as const },
      label: { visible: true }
    };

    // 柱状图配置
    const barSpec = {
      type: 'bar' as const,
      data: [{ id: 'data', values: severityData }],
      xField: 'severity',
      yField: 'count',
      title: { visible: true, text: '严重程度分布' },
      axes: [
        { orient: 'bottom' as const, type: 'band' as const },
        { orient: 'left' as const, type: 'linear' as const }
      ],
      bar: {
        style: {
          fill: (datum: any) => datum.color
        }
      }
    };

    // 折线图配置
    const lineSpec = {
      type: 'line' as const,
      data: [{ id: 'data', values: trendData }],
      xField: 'date',
      yField: ['新增漏洞', '已修复', '待修复'],
      seriesField: 'type',
      title: { visible: true, text: '最近7天趋势' },
      point: { visible: true },
      legends: { visible: true, orient: 'bottom' as const }
    };

    // 安全工程师排行榜柱状图配置
    const securityRankingSpec = {
      type: 'bar' as const,
      data: [{ id: 'data', values: rankingData.slice(0, 8) }], // 显示前8名
      xField: 'name',
      yField: 'count',
      title: { visible: true, text: '安全工程师排行榜' },
      axes: [
        { orient: 'bottom' as const, type: 'band' as const, label: { style: { angle: -45, fontSize: 10 } } },
        { orient: 'left' as const, type: 'linear' as const }
      ],
      bar: {
        style: {
          fill: (datum: any, ctx: any) => {
            // 前三名使用特殊颜色
            if (ctx.dataIndex < 3) {
              const colors = ['#ffd700', '#c0c0c0', '#cd7f32']; // 金银铜
              return colors[ctx.dataIndex];
            }
            return '#1890ff';
          }
        }
      }
    };

    // 研发工程师排行榜柱状图配置
    const devRankingData = (dashboardData.dev_engineer_ranking || []).map((item, index) => ({
      name: item.real_name,
      count: item.count,
      rank: index + 1
    }));

    const devRankingSpec = {
      type: 'bar' as const,
      data: [{ id: 'data', values: devRankingData.slice(0, 8) }], // 显示前8名
      xField: 'name',
      yField: 'count',
      title: { visible: true, text: '研发工程师排行榜' },
      axes: [
        { orient: 'bottom' as const, type: 'band' as const, label: { style: { angle: -45, fontSize: 10 } } },
        { orient: 'left' as const, type: 'linear' as const }
      ],
      bar: {
        style: {
          fill: (datum: any, ctx: any) => {
            // 前三名使用特殊颜色
            if (ctx.dataIndex < 3) {
              const colors = ['#ffd700', '#c0c0c0', '#cd7f32']; // 金银铜
              return colors[ctx.dataIndex];
            }
            return '#52c41a';
          }
        }
      }
    };

    return (
      <div style={{ display: 'grid', gap: '24px' }}>
        {/* 统计卡片 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <StatCard
            title="总漏洞数"
            value={dashboardData.total_vulns}
            icon={<IconBolt style={{ color: 'var(--semi-color-danger)', fontSize: '24px' }} />}
          />
          <StatCard
            title="总项目数"
            value={dashboardData.total_projects}
            icon={<IconSafe style={{ color: 'var(--semi-color-primary)', fontSize: '24px' }} />}
          />
          <StatCard
            title="即将到期漏洞"
            value={dashboardData.due_soon_vulns}
            icon={<IconAt style={{ color: 'var(--semi-color-warning)', fontSize: '24px' }} />}
          />
        </div>

        {/* 图表区域 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <Card title="漏洞状态分布" headerStyle={{ padding: '16px 24px' }}>
            <div style={{ height: '300px' }}>
              <VChart spec={pieSpec} />
            </div>
          </Card>

          <Card title="严重程度分布" headerStyle={{ padding: '16px 24px' }}>
            <div style={{ height: '300px' }}>
              <VChart spec={barSpec} />
            </div>
          </Card>
        </div>

        {/* 趋势图 */}
        <Card title="漏洞趋势分析" headerStyle={{ padding: '16px 24px' }}>
          <div style={{ height: '300px' }}>
            <VChart spec={lineSpec} />
          </div>
        </Card>

        {/* 排行榜图表 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <Card title="安全工程师排行榜（当月提交漏洞数）" headerStyle={{ padding: '16px 24px' }}>
            <div style={{ height: '300px' }}>
              <VChart spec={securityRankingSpec} />
            </div>
          </Card>

          <Card title="研发工程师排行榜（当月修复完成漏洞数）" headerStyle={{ padding: '16px 24px' }}>
            <div style={{ height: '300px' }}>
              <VChart spec={devRankingSpec} />
            </div>
          </Card>
        </div>



        {/* 最新漏洞列表 */}
        <Card title="最新漏洞" headerStyle={{ padding: '16px 24px' }}>
          <Table
            columns={[
              {
                title: '漏洞标题',
                dataIndex: 'title',
                key: 'title',
                render: (text: string) => <Text strong>{text}</Text>
              },
              {
                title: '严重程度',
                dataIndex: 'severity',
                key: 'severity',
                render: (severity: string) => (
                  <Badge dot type={getSeverityColor(severity) as any}>
                    {severity}
                  </Badge>
                )
              },
              {
                title: '状态',
                dataIndex: 'status',
                key: 'status',
                render: (status: string) => (
                  <Badge dot type={getStatusColor(status) as any}>
                    {getStatusDisplayName(status)}
                  </Badge>
                )
              },
              {
                title: '项目',
                dataIndex: 'project_name',
                key: 'project_name'
              },
              {
                title: '报告人',
                dataIndex: 'reporter_name',
                key: 'reporter_name'
              },
              {
                title: '提交时间',
                dataIndex: 'submitted_at',
                key: 'submitted_at',
                render: (time: string) => new Date(time).toLocaleDateString('zh-CN')
              },
              {
                title: '截止时间',
                dataIndex: 'fix_deadline',
                key: 'fix_deadline',
                render: (deadline: string, record: VulnListItem) => {
                  if (!deadline) return '-';

                  const deadlineDate = new Date(deadline);
                  const now = new Date();
                  const isOverdue = deadlineDate < now && !['fixed', 'completed', 'closed', 'ignored'].includes(record.status);
                  const daysDiff = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                  return (
                    <div>
                      <Text
                        type={isOverdue ? 'danger' : daysDiff <= 3 ? 'warning' : 'secondary'}
                        style={{ fontWeight: isOverdue || daysDiff <= 3 ? 'bold' : 'normal' }}
                      >
                        {deadlineDate.toLocaleDateString('zh-CN')}
                      </Text>
                      {isOverdue && (
                        <div>
                          <Text type="danger" size="small">已逾期 {Math.abs(daysDiff)} 天</Text>
                        </div>
                      )}
                      {!isOverdue && record.status !== 'completed' && daysDiff <= 3 && daysDiff >= 0 && (
                        <div>
                          <Text type="warning" size="small">还有 {daysDiff} 天</Text>
                        </div>
                      )}
                    </div>
                  );
                },
              }
            ]}
            dataSource={dashboardData.latest_vulns}
            pagination={false}
            size="small"
          />
        </Card>
      </div>
    );
  };

  // 渲染安全工程师仪表板
  const renderSecurityEngineerDashboard = () => {
    if (!dashboardData || !dashboardData.current_user_vulns) return null;

    const userStats = dashboardData.current_user_vulns;
    const statusEntries = Object.entries(userStats.status_stats);

    // 个人状态数据
    const userStatusData = statusEntries.map(([status, count]) => ({
      type: getStatusDisplayName(status),
      value: count,
      status: status
    }));

    // 工作概览数据 - 使用更直观的柱状图数据
    const totalVulns = userStats.total_count || 0;
    const dueVulns = userStats.due_soon_count || 0;
    const fixedVulns = userStatusData.find(d => d.type === '已修复')?.value || 0;
    const completedVulns = userStatusData.find(d => d.type === '已完成')?.value || 0;
    const fixingVulns = userStatusData.find(d => d.type === '修复中')?.value || 0;
    const unfixedVulns = userStatusData.find(d => d.type === '未修复')?.value || 0;

    // 计算修复率：已修复 + 已完成的漏洞 / 总漏洞数
    const resolvedVulns = fixedVulns + completedVulns;
    const fixRate = totalVulns > 0 ? Math.round((resolvedVulns / totalVulns) * 100) : 0;

    // 计算响应率：已响应的漏洞（非未修复状态）/ 总漏洞数
    const respondedVulns = totalVulns - unfixedVulns; // 总数减去未修复的就是已响应的
    const responseRate = totalVulns > 0 ? Math.round((respondedVulns / totalVulns) * 100) : 0;

    const workOverviewData = [
      {
        metric: '当月发现',
        value: userStats.monthly_count,
        color: '#1890ff',
        description: '本月提交的漏洞总数'
      },
      {
        metric: '即将到期',
        value: dueVulns,
        color: '#fa8c16',
        description: '需要紧急处理的漏洞'
      },
      {
        metric: '已修复',
        value: fixedVulns,
        color: '#52c41a',
        description: '已经修复完成的漏洞'
      },
      {
        metric: '修复中',
        value: fixingVulns,
        color: '#722ed1',
        description: '正在修复过程中的漏洞'
      },
      {
        metric: '待修复',
        value: unfixedVulns,
        color: '#ff4d4f',
        description: '尚未开始修复的漏洞'
      }
    ].filter(item => item.value > 0); // 只显示有数据的指标

    // 饼图配置
    const pieSpec = {
      type: 'pie' as const,
      data: [{ id: 'data', values: userStatusData }],
      outerRadius: 0.8,
      valueField: 'value',
      categoryField: 'type',
      title: { visible: true, text: '我的漏洞状态分布' },
      legends: { visible: true, orient: 'bottom' as const },
      label: { visible: true }
    };

    // 工作概览柱状图配置
    const workOverviewSpec = {
      type: 'bar' as const,
      data: [{ id: 'data', values: workOverviewData }],
      xField: 'metric',
      yField: 'value',
      title: { visible: true, text: '个人工作概览' },
      axes: [
        {
          orient: 'bottom' as const,
          type: 'band' as const,
          label: {
            style: {
              fontSize: 12,
              fontWeight: 'bold'
            }
          }
        },
        {
          orient: 'left' as const,
          type: 'linear' as const,
          label: {
            style: {
              fontSize: 11
            }
          }
        }
      ],
      bar: {
        style: {
          fill: (datum: any) => datum.color,
          stroke: '#fff',
          strokeWidth: 2,
          cornerRadius: 4,
          fillOpacity: 0.8
        },
        state: {
          hover: {
            fillOpacity: 1,
            stroke: (datum: any) => datum.color,
            strokeWidth: 3
          }
        }
      },
      label: {
        visible: true,
        position: 'top',
        style: {
          fontSize: 14,
          fontWeight: 'bold',
          fill: '#000',
          stroke: '#fff',
          strokeWidth: 2
        }
      },
      tooltip: {
        mark: {
          title: (datum: any) => datum.metric,
          content: [
            {
              key: '数量',
              value: (datum: any) => datum.value
            },
            {
              key: '说明',
              value: (datum: any) => datum.description
            }
          ]
        }
      }
    };

    return (
      <div style={{ display: 'grid', gap: '24px' }}>
        {/* 个人统计卡片 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          <StatCard
            title="当月提交漏洞数"
            value={userStats.monthly_count}
            icon={<IconArrowUp style={{ color: 'var(--semi-color-primary)', fontSize: '24px' }} />}
          />
          <StatCard
            title="即将到期漏洞"
            value={userStats.due_soon_count}
            icon={<IconAt style={{ color: 'var(--semi-color-warning)', fontSize: '24px' }} />}
          />
          <StatCard
            title="已修复漏洞"
            value={fixedVulns}
            icon={<IconSafe style={{ color: 'var(--semi-color-success)', fontSize: '24px' }} />}
          />
          <StatCard
            title="修复中漏洞"
            value={fixingVulns}
            icon={<IconBolt style={{ color: 'var(--semi-color-tertiary)', fontSize: '24px' }} />}
          />
        </div>

        {/* 主要图表区域 */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: '24px' }}>
          <Card title="我的漏洞状态分布" headerStyle={{ padding: '16px 24px' }}>
            <div style={{ height: '350px' }}>
              <VChart spec={pieSpec} />
            </div>
          </Card>

          <Card title="个人工作概览" headerStyle={{ padding: '16px 24px' }}>
            <div style={{ height: '350px' }}>
              <VChart spec={workOverviewSpec} />
            </div>
          </Card>
        </div>

        {/* 工作效率指标 */}
        <Card title="工作效率指标" headerStyle={{ padding: '16px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', padding: '20px 0' }}>
            {/* 修复率 */}
            <div style={{ textAlign: 'center', padding: '20px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '8px' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#52c41a', marginBottom: '8px' }}>
                {fixRate}%
              </div>
              <div style={{ fontSize: '14px', color: 'var(--semi-color-text-1)' }}>修复率</div>
              <div style={{ fontSize: '12px', color: 'var(--semi-color-text-2)', marginTop: '4px' }}>
                {resolvedVulns}/{totalVulns} 已解决
              </div>
            </div>

            {/* 响应率 */}
            <div style={{ textAlign: 'center', padding: '20px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '8px' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1890ff', marginBottom: '8px' }}>
                {responseRate}%
              </div>
              <div style={{ fontSize: '14px', color: 'var(--semi-color-text-1)' }}>响应率</div>
              <div style={{ fontSize: '12px', color: 'var(--semi-color-text-2)', marginTop: '4px' }}>
                {respondedVulns}/{totalVulns} 已响应
              </div>
            </div>

            {/* 紧急处理 */}
            <div style={{ textAlign: 'center', padding: '20px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '8px' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: dueVulns > 0 ? '#fa8c16' : '#52c41a', marginBottom: '8px' }}>
                {dueVulns}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--semi-color-text-1)' }}>紧急处理</div>
              <div style={{ fontSize: '12px', color: 'var(--semi-color-text-2)', marginTop: '4px' }}>
                即将到期漏洞
              </div>
            </div>

            {/* 工作负载 */}
            <div style={{ textAlign: 'center', padding: '20px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '8px' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#722ed1', marginBottom: '8px' }}>
                {unfixedVulns + fixingVulns}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--semi-color-text-1)' }}>待处理</div>
              <div style={{ fontSize: '12px', color: 'var(--semi-color-text-2)', marginTop: '4px' }}>
                当前工作负载
              </div>
            </div>
          </div>
        </Card>

        {/* 项目漏洞分布 */}
        {dashboardData.latest_vulns && dashboardData.latest_vulns.length > 0 && (
          <Card title="项目漏洞分布" headerStyle={{ padding: '16px 24px' }}>
            <div style={{ height: '280px' }}>
              <VChart spec={getProjectDistributionSpec()} />
            </div>
          </Card>
        )}

        {/* 安全工程师排行榜 */}
        <Card title="安全工程师排行榜（当月提交漏洞数）" headerStyle={{ padding: '16px 24px' }}>
          <List
            dataSource={dashboardData.security_engineer_ranking || []}
            renderItem={(item: EngineerRankingItem, index: number) => (
              <List.Item
                main={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Avatar size="small" style={{ backgroundColor: index < 3 ? 'var(--semi-color-warning)' : 'var(--semi-color-fill-1)' }}>
                      {index + 1}
                    </Avatar>
                    <div>
                      <Text strong>{item.real_name}</Text>
                      <br />
                      <Text type="secondary" size="small">{item.username}</Text>
                    </div>
                  </div>
                }
                extra={<Badge count={item.count} />}
              />
            )}
          />
        </Card>

        {/* 项目最新漏洞 */}
        <Card title="项目最新漏洞" headerStyle={{ padding: '16px 24px' }}>
          <Table
            columns={[
              {
                title: '漏洞标题',
                dataIndex: 'title',
                key: 'title',
                render: (text: string) => <Text strong>{text}</Text>
              },
              {
                title: '严重程度',
                dataIndex: 'severity',
                key: 'severity',
                render: (severity: string) => (
                  <Badge dot type={getSeverityColor(severity) as any}>
                    {severity}
                  </Badge>
                )
              },
              {
                title: '状态',
                dataIndex: 'status',
                key: 'status',
                render: (status: string) => (
                  <Badge dot type={getStatusColor(status) as any}>
                    {getStatusDisplayName(status)}
                  </Badge>
                )
              },
              {
                title: '项目',
                dataIndex: 'project_name',
                key: 'project_name'
              },
              {
                title: '提交时间',
                dataIndex: 'submitted_at',
                key: 'submitted_at',
                render: (time: string) => new Date(time).toLocaleDateString('zh-CN')
              },
              {
                title: '截止时间',
                dataIndex: 'fix_deadline',
                key: 'fix_deadline',
                render: (deadline: string, record: VulnListItem) => {
                  if (!deadline) return '-';

                  const deadlineDate = new Date(deadline);
                  const now = new Date();
                  const isOverdue = deadlineDate < now && !['fixed', 'completed', 'closed', 'ignored'].includes(record.status);
                  const daysDiff = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                  return (
                    <div>
                      <Text
                        type={isOverdue ? 'danger' : daysDiff <= 3 ? 'warning' : 'secondary'}
                        style={{ fontWeight: isOverdue || daysDiff <= 3 ? 'bold' : 'normal' }}
                      >
                        {deadlineDate.toLocaleDateString('zh-CN')}
                      </Text>
                      {isOverdue && (
                        <div>
                          <Text type="danger" size="small">已逾期 {Math.abs(daysDiff)} 天</Text>
                        </div>
                      )}
                      {!isOverdue && record.status !== 'completed' && daysDiff <= 3 && daysDiff >= 0 && (
                        <div>
                          <Text type="warning" size="small">还有 {daysDiff} 天</Text>
                        </div>
                      )}
                    </div>
                  );
                },
              }
            ]}
            dataSource={dashboardData.latest_vulns}
            pagination={false}
            size="small"
          />
        </Card>
      </div>
    );
  };

  // 渲染研发工程师仪表板
  const renderDevEngineerDashboard = () => {
    if (!dashboardData || !dashboardData.current_user_vulns) return null;

    const userStats = dashboardData.current_user_vulns;
    const statusEntries = Object.entries(userStats.status_stats);
    const totalAssigned = userStats.total_count || 0;

    const knownProgressTotal =
      Number(statusEntries.find(([status]) => status === 'unfixed')?.[1] || 0) +
      Number(statusEntries.find(([status]) => status === 'fixing')?.[1] || 0) +
      Number(statusEntries.find(([status]) => status === 'fixed')?.[1] || 0) +
      Number(statusEntries.find(([status]) => status === 'completed')?.[1] || 0);

    const otherStatusCount = Math.max(0, totalAssigned - knownProgressTotal);

    // 修复进度数据 - 使用真实的用户状态统计数据
    const progressData = [
      {
        stage: '待修复',
        count: Number(statusEntries.find(([status]) => status === 'unfixed')?.[1] || 0)
      },
      {
        stage: '修复中',
        count: Number(statusEntries.find(([status]) => status === 'fixing')?.[1] || 0)
      },
      {
        stage: '已修复',
        count: Number(statusEntries.find(([status]) => status === 'fixed')?.[1] || 0)
      },
      {
        stage: '已完成',
        count: Number(statusEntries.find(([status]) => status === 'completed')?.[1] || 0)
      },
      {
        stage: '其他状态',
        count: otherStatusCount
      },
    ].filter(item => item.count > 0); // 过滤掉数量为0的项目，使图表更清晰

    // 环形进度图配置 - 替换原来的漏斗图
    const ringProgressSpec = {
      type: 'pie' as const,
      data: [{ id: 'data', values: progressData }],
      categoryField: 'stage',
      valueField: 'count',
      title: { visible: true, text: '修复进度分布' },
      innerRadius: 0.6, // 设置内半径，形成环形
      outerRadius: 0.9,
      label: {
        visible: true,
        position: 'outside',
        style: {
          fontSize: 12,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        visible: true,
        mark: {
          title: {
            key: 'stage',
            value: 'stage'
          },
          content: [
            {
              key: 'count',
              value: 'count'
            },
            {
              key: 'percentage',
              value: (datum: any) => {
                const total = progressData.reduce((sum, item) => sum + item.count, 0);
                return `${((datum.count / total) * 100).toFixed(1)}%`;
              }
            }
          ]
        }
      },
      pie: {
        style: {
          fill: (datum: any) => {
            const colorMap: { [key: string]: string } = {
              '待修复': '#ff4d4f',
              '修复中': '#fa8c16',
              '已修复': '#52c41a',
              '已完成': '#1890ff',
              '其他状态': '#94a3b8'
            };
            return colorMap[datum.stage] || '#d9d9d9';
          },
          stroke: '#fff',
          strokeWidth: 2
        }
      },
      legends: {
        visible: true,
        orient: 'bottom',
        item: {
          marker: {
            style: {
              size: 8
            }
          }
        }
      }
    };

    // 柱状图配置
    const barSpec = {
      type: 'bar' as const,
      data: [{ id: 'data', values: progressData }],
      xField: 'stage',
      yField: 'count',
      title: { visible: true, text: '修复进度统计' },
      axes: [
        { orient: 'bottom' as const, type: 'band' as const },
        { orient: 'left' as const, type: 'linear' as const }
      ],
      bar: {
        style: {
          fill: (datum: any) => {
            const colorMap: { [key: string]: string } = {
              '待修复': '#ff4d4f',
              '修复中': '#fa8c16',
              '已修复': '#52c41a',
              '已完成': '#1890ff',
              '其他状态': '#94a3b8'
            };
            return colorMap[datum.stage] || '#d9d9d9';
          }
        }
      }
    };

    // 获取修复效率分析图表配置
    const getEfficiencySpec = () => {
      // 计算修复效率数据
      const completed = progressData.find(d => d.stage === '已完成')?.count || 0;
      const fixed = progressData.find(d => d.stage === '已修复')?.count || 0;
      const fixing = progressData.find(d => d.stage === '修复中')?.count || 0;
      const pending = progressData.find(d => d.stage === '待修复')?.count || 0;

      const efficiencyData = [
        { metric: '完成率', value: totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0, unit: '%' },
        { metric: '修复率', value: totalAssigned > 0 ? Math.round(((completed + fixed) / totalAssigned) * 100) : 0, unit: '%' },
        { metric: '进行中', value: totalAssigned > 0 ? Math.round((fixing / totalAssigned) * 100) : 0, unit: '%' },
        { metric: '待处理', value: totalAssigned > 0 ? Math.round((pending / totalAssigned) * 100) : 0, unit: '%' }
      ];

      return {
        type: 'bar' as const,
        data: [{ id: 'data', values: efficiencyData }],
        xField: 'metric',
        yField: 'value',
        title: { visible: true, text: '修复效率分析 (%)' },
        axes: [
          { orient: 'bottom' as const, type: 'band' as const },
          { orient: 'left' as const, type: 'linear' as const, max: 100 }
        ],
        bar: {
          style: {
            fill: (datum: any) => {
              const colorMap: { [key: string]: string } = {
                '完成率': '#52c41a',
                '修复率': '#1890ff',
                '进行中': '#fa8c16',
                '待处理': '#ff4d4f'
              };
              return colorMap[datum.metric] || '#d9d9d9';
            }
          }
        }
      };
    };

    return (
      <div style={{ display: 'grid', gap: '24px' }}>
        {/* 个人统计卡片 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <StatCard
            title="分配给我的漏洞数"
            value={userStats.total_count}
            icon={<IconBolt style={{ color: 'var(--semi-color-primary)', fontSize: '24px' }} />}
          />
          <StatCard
            title="即将到期漏洞"
            value={userStats.due_soon_count}
            icon={<IconAt style={{ color: 'var(--semi-color-warning)', fontSize: '24px' }} />}
          />
        </div>

        {/* 图表区域 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <Card title="修复进度统计" headerStyle={{ padding: '16px 24px' }}>
            <div style={{ height: '300px' }}>
              <VChart spec={barSpec} />
            </div>
          </Card>

          <Card title="修复进度分布" headerStyle={{ padding: '16px 24px' }}>
            <div style={{ height: '300px', position: 'relative' }}>
              <VChart spec={ringProgressSpec} />
              {/* 中心显示总数 */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                pointerEvents: 'none'
              }}>
                <div style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: 'var(--semi-color-text-0)',
                  marginBottom: '4px'
                }}>
                  {totalAssigned}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: 'var(--semi-color-text-2)'
                }}>
                  总漏洞数
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* 修复效率分析 */}
        {progressData.length > 0 && (
          <Card title="修复效率分析" headerStyle={{ padding: '16px 24px' }}>
            <div style={{ height: '300px' }}>
              <VChart spec={getEfficiencySpec()} />
            </div>
          </Card>
        )}

        {/* 研发工程师排行榜 */}
        <Card title="研发工程师排行榜（当月修复完成漏洞数）" headerStyle={{ padding: '16px 24px' }}>
          <List
            dataSource={dashboardData.dev_engineer_ranking || []}
            renderItem={(item: EngineerRankingItem, index: number) => (
              <List.Item
                main={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Avatar size="small" style={{ backgroundColor: index < 3 ? 'var(--semi-color-success)' : 'var(--semi-color-fill-1)' }}>
                      {index + 1}
                    </Avatar>
                    <div>
                      <Text strong>{item.real_name}</Text>
                      <br />
                      <Text type="secondary" size="small">{item.username}</Text>
                    </div>
                  </div>
                }
                extra={<Badge count={item.count} />}
              />
            )}
          />
        </Card>

        {/* 项目最新漏洞 */}
        <Card title="项目最新漏洞" headerStyle={{ padding: '16px 24px' }}>
          <Table
            columns={[
              {
                title: '漏洞标题',
                dataIndex: 'title',
                key: 'title',
                render: (text: string) => <Text strong>{text}</Text>
              },
              {
                title: '严重程度',
                dataIndex: 'severity',
                key: 'severity',
                render: (severity: string) => (
                  <Badge dot type={getSeverityColor(severity) as any}>
                    {severity}
                  </Badge>
                )
              },
              {
                title: '状态',
                dataIndex: 'status',
                key: 'status',
                render: (status: string) => (
                  <Badge dot type={getStatusColor(status) as any}>
                    {getStatusDisplayName(status)}
                  </Badge>
                )
              },
              {
                title: '项目',
                dataIndex: 'project_name',
                key: 'project_name'
              },
              {
                title: '提交时间',
                dataIndex: 'submitted_at',
                key: 'submitted_at',
                render: (time: string) => new Date(time).toLocaleDateString('zh-CN')
              },
              {
                title: '截止时间',
                dataIndex: 'fix_deadline',
                key: 'fix_deadline',
                render: (deadline: string, record: VulnListItem) => {
                  if (!deadline) return '-';

                  const deadlineDate = new Date(deadline);
                  const now = new Date();
                  const isOverdue = deadlineDate < now && !['fixed', 'completed', 'closed', 'ignored'].includes(record.status);
                  const daysDiff = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                  return (
                    <div>
                      <Text
                        type={isOverdue ? 'danger' : daysDiff <= 3 ? 'warning' : 'secondary'}
                        style={{ fontWeight: isOverdue || daysDiff <= 3 ? 'bold' : 'normal' }}
                      >
                        {deadlineDate.toLocaleDateString('zh-CN')}
                      </Text>
                      {isOverdue && (
                        <div>
                          <Text type="danger" size="small">已逾期 {Math.abs(daysDiff)} 天</Text>
                        </div>
                      )}
                      {!isOverdue && record.status !== 'completed' && daysDiff <= 3 && daysDiff >= 0 && (
                        <div>
                          <Text type="warning" size="small">还有 {daysDiff} 天</Text>
                        </div>
                      )}
                    </div>
                  );
                },
              }
            ]}
            dataSource={dashboardData.latest_vulns}
            pagination={false}
            size="small"
          />
        </Card>
      </div>
    );
  };

  // 渲染默认仪表板（普通用户）
  const renderDefaultDashboard = () => {
    return (
      <Card
        style={{
          maxWidth: '600px',
          margin: '0 auto',
          textAlign: 'center'
        }}
        bodyStyle={{
          padding: '40px 24px'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: 'var(--semi-color-success-light-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto'
          }}>
            <IconUser size="large" style={{ color: 'var(--semi-color-success)' }} />
          </div>

          <div style={{ textAlign: 'center' }}>
            <Title heading={3} style={{ margin: '0 0 8px 0', color: 'var(--semi-color-success)' }}>
              欢迎使用漏洞管理系统！
            </Title>
            {user && (
              <Text style={{ color: 'var(--semi-color-text-0)', fontSize: '16px' }}>
                你好，{user.username}
              </Text>
            )}
          </div>
        </div>
      </Card>
    );
  };

  // 根据角色渲染不同的仪表板
  const renderRoleDashboard = () => {
    if (loading) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '400px',
          fontSize: '18px',
          color: 'var(--semi-color-text-1)'
        }}>
          正在加载仪表板数据...
        </div>
      );
    }

    if (!user) return renderDefaultDashboard();

    const roleCode = authUtils.getRoleCodeFromUser(user);

    switch (roleCode) {
      case 'super_admin':
      case 'admin':
        return renderSuperAdminDashboard();
      case 'security_engineer':
        return renderSecurityEngineerDashboard();
      case 'dev_engineer':
        return renderDevEngineerDashboard();
      default:
        return renderDefaultDashboard();
    }
  };

  // 已登录，显示首页内容
  return (
    <div style={{ 
      padding: '24px',
      height: '100%',
      backgroundColor: 'var(--semi-color-bg-1)'
    }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: '24px' }}>
        <Title heading={2} style={{ margin: 0 }}>
          首页
        </Title>
        <Text type="secondary" style={{ fontSize: '14px' }}>
          欢迎使用漏洞管理系统 - {user && getRoleDisplayName(user)}
        </Text>
      </div>

      {/* 根据角色渲染仪表板 */}
      {renderRoleDashboard()}

      {/* 页面底部提示 */}
      <div style={{ 
        textAlign: 'center', 
        marginTop: '40px',
        color: 'var(--semi-color-text-2)',
        fontSize: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
          <IconCalendar />
          <Text type="tertiary">
            今天是 {new Date().toLocaleDateString('zh-CN', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Text>
        </div>
      </div>
    </div>
  );
} 
