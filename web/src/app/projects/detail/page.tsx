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
  Badge,
  Empty,
  Spin,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Toast,
  Popconfirm,
  TextArea,
  Upload,
  List
} from '@douyinfe/semi-ui';
import MarkdownEditor from '@/components/MarkdownEditor';
import MarkdownViewer from '@/components/MarkdownViewer';

import {
  IconArrowLeft,
  IconBolt,
  IconServer,
  IconEdit,
  IconDelete,
  IconPlus,
  IconUser,
  IconCalendar,
  IconRefresh,
  IconEyeOpened,
  IconInfoCircle,
  IconDownload,
  IconUpload
} from '@douyinfe/semi-icons';
import {
  projectApi,
  vulnApi,
  assetApi,
  userApi,
  authUtils,
  Project,
  Vulnerability,
  Asset,
  User,
  PROJECT_TYPES,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  VULN_SEVERITIES,
  VULN_STATUSES,
  VULN_TYPES,
  ASSET_TYPES,
  OS_TYPES,
  ENVIRONMENT_TYPES,
  ASSET_IMPORTANCE_LEVELS,
  VulnCreateRequest,
  VulnUpdateRequest,
  VulnStatusUpdateRequest,
  VulnTimeline,
  AssetCreateRequest,
  AssetUpdateRequest
} from '@/lib/api';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

export default function ProjectDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 基础状态
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTabKey, setActiveTabKey] = useState('vulnerabilities');

  // 漏洞相关状态
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [vulnModalVisible, setVulnModalVisible] = useState(false);
  const [vulnLoading, setVulnLoading] = useState(false);
  const [editingVuln, setEditingVuln] = useState<Vulnerability | null>(null);
  const [vulnFormRef, setVulnFormRef] = useState<any>(null);
  const [selectedVulnIds, setSelectedVulnIds] = useState<number[]>([]);
  const [exportingVulns, setExportingVulns] = useState(false);

  // 漏洞详情相关状态
  const [vulnDetailModalVisible, setVulnDetailModalVisible] = useState(false);
  const [viewingVuln, setViewingVuln] = useState<Vulnerability | null>(null);
  const [vulnDetailLoading, setVulnDetailLoading] = useState(false);

  // 状态变更相关状态（研发工程师专用）
  const [statusChangeModalVisible, setStatusChangeModalVisible] = useState(false);
  const [changingVuln, setChangingVuln] = useState<Vulnerability | null>(null);
  const [statusChangeFormRef, setStatusChangeFormRef] = useState<any>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [retestModalVisible, setRetestModalVisible] = useState(false);
  const [retestTargetVuln, setRetestTargetVuln] = useState<Vulnerability | null>(null);
  const [retestTargetStatus, setRetestTargetStatus] = useState<'completed' | 'unfixed' | ''>('');
  const [retestEvidence, setRetestEvidence] = useState<string>('');

  // 时间线相关状态
  const [vulnTimeline, setVulnTimeline] = useState<VulnTimeline[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // 刷新时间线数据的通用函数
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

  // 资产相关状态
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetModalVisible, setAssetModalVisible] = useState(false);
  const [assetLoading, setAssetLoading] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [assetFormRef, setAssetFormRef] = useState<any>(null);
  const [selectedAssetType, setSelectedAssetType] = useState<string>('');

  // 资产导出相关状态
  const [selectedAssetIds, setSelectedAssetIds] = useState<number[]>([]);
  const [exporting, setExporting] = useState(false);

  // 资产导入相关状态
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importing, setImporting] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // 用户列表（用于指派）
  const [assignableUsers, setAssignableUsers] = useState<User[]>([]);

  // 当前用户信息状态
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // 漏洞描述内容状态（用于Markdown编辑器）
  const [vulnDescription, setVulnDescription] = useState<string>('');

  const projectId = searchParams.get('id') as string;
  const roleCode = authUtils.getRoleCodeFromUser(currentUser);
  const isAdmin = roleCode === 'super_admin' || roleCode === 'admin';
  const isSecurityEngineer = roleCode === 'security_engineer';
  const isDevEngineer = roleCode === 'dev_engineer';
  const canExportVulnReport = isAdmin || isSecurityEngineer;

  // 项目过期检查
  const isProjectExpired = (project: Project) => {
    if (!project.end_date) return false;
    return new Date(project.end_date) < new Date();
  };

  useEffect(() => {
    // 在客户端获取当前用户信息
    setCurrentUser(authUtils.getCurrentUser());

    if (projectId) {
      loadProjectDetail();
      loadAssignableUsers();
    }
  }, [projectId]);

  useEffect(() => {
    if (project && activeTabKey === 'vulnerabilities') {
      loadVulnerabilities();
    } else if (project && activeTabKey === 'assets') {
      loadAssets();
    }
  }, [project, activeTabKey]);

  useEffect(() => {
    setSelectedVulnIds(prev => prev.filter(id => vulnerabilities.some(vuln => vuln.id === id)));
  }, [vulnerabilities]);

  // 监听弹窗状态变化，控制页面滚动
  useEffect(() => {
    return () => {
      // 组件卸载时恢复页面滚动
      document.body.style.overflow = 'auto';
    };
  }, []);

  // 监听弹窗关闭，恢复页面滚动
  useEffect(() => {
    if (!vulnDetailModalVisible) {
      document.body.style.overflow = 'auto';
    }
  }, [vulnDetailModalVisible]);

  // 监听 editingVuln 变化，自动填充表单
  useEffect(() => {
    if (editingVuln && vulnFormRef && vulnModalVisible) {
      const formValues = {
        title: editingVuln.title || '',
        vuln_url: editingVuln.vuln_url || '',
        description: editingVuln.description || '',
        vuln_type: editingVuln.vuln_type || '',
        severity: editingVuln.severity || '',
        status: editingVuln.status || 'unfixed',
        cve_id: editingVuln.cve_id || '',
        fix_suggestion: editingVuln.fix_suggestion || '',
        asset_id: editingVuln.asset_id,
        assignee_id: editingVuln.assignee_id || null,
        fix_deadline: editingVuln.fix_deadline ? new Date(editingVuln.fix_deadline) : null,
        tags: editingVuln.tags || '',
      };


      // 延迟设置表单值，确保表单完全渲染（包括动态显示的状态选择框）
      setTimeout(() => {
        try {
          vulnFormRef.setValues(formValues);

          // 对于研发工程师，额外确保状态字段被正确设置
          if (isDevEngineer && editingVuln.status) {
            setTimeout(() => {
              try {
                vulnFormRef.setValue('status', editingVuln.status);
              } catch (statusError) {
                console.error('Failed to set status field:', statusError);
              }
            }, 50);
          }
        } catch (error) {
          console.error('Failed to set form values:', error);
          // 如果第一次失败，再尝试一次
          setTimeout(() => {
            try {
              vulnFormRef.setValues(formValues);
            } catch (retryError) {
              console.error('Failed to set form values on retry:', retryError);
            }
          }, 200);
        }
      }, 150); // 增加延迟时间以确保动态表单字段已渲染
    }
  }, [editingVuln, vulnFormRef, vulnModalVisible, isDevEngineer]);

  // 监听 editingAsset 变化，自动填充资产表单
  useEffect(() => {
    if (editingAsset && assetFormRef && assetModalVisible) {
      // 检查是否是自定义类型
      const isCustomType = !ASSET_TYPES.some(type => type.value === editingAsset.type);

      const formValues = {
        name: editingAsset.name || '',
        type: isCustomType ? 'custom' : editingAsset.type || '',
        customType: isCustomType ? editingAsset.type : '',
        domain: editingAsset.domain || '',
        ip: editingAsset.ip || '',
        port: editingAsset.port || '',
        os: editingAsset.os || '',
        owner: editingAsset.owner || '',
        environment: editingAsset.environment || '',
        department: editingAsset.department || '',
        importance: editingAsset.importance || '',
        tags: editingAsset.tags || '',
        description: editingAsset.description || '',
      };

      // 延迟设置表单值，确保表单完全渲染
      setTimeout(() => {
        try {
          assetFormRef.setValues(formValues);
        } catch (error) {
          console.error('Failed to set asset form values:', error);
          // 如果第一次失败，再尝试一次
          setTimeout(() => {
            try {
              assetFormRef.setValues(formValues);
            } catch (retryError) {
              console.error('Failed to set asset form values on retry:', retryError);
            }
          }, 200);
        }
      }, 150);
    }
  }, [editingAsset, assetFormRef, assetModalVisible]);

  // 加载项目详情
  const loadProjectDetail = async () => {
    try {
      setLoading(true);
      const response = await projectApi.getProject(parseInt(projectId));
      if (response.code === 200 && response.data) {
        setProject(response.data);
      }
    } catch (error) {
      console.error('Error loading project detail:', error);
      Toast.error('加载项目详情失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载可指派用户列表（全部启用用户）
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
      console.error('Error loading assignable users:', error);
    }
  };

  // 加载漏洞列表
  const loadVulnerabilities = async () => {
    try {
      setVulnLoading(true);
      const response = await vulnApi.getProjectVulns(parseInt(projectId));
      setVulnerabilities(response.data || []);
    } catch (error) {
      console.error('Error loading vulnerabilities:', error);
      Toast.error('加载漏洞列表失败');
    } finally {
      setVulnLoading(false);
    }
  };

  // 加载资产列表
  const loadAssets = async () => {
    try {
      setAssetLoading(true);
      const response = await assetApi.getProjectAssets(parseInt(projectId));
      setAssets(response.data || []);
    } catch (error) {
      console.error('Error loading assets:', error);
      Toast.error('加载资产列表失败');
    } finally {
      setAssetLoading(false);
    }
  };

  // 获取可用的资产列表（优先使用已加载的资产，其次是项目详情中的资产）
  const getAvailableAssets = () => {
    // 如果独立加载的资产列表不为空，使用它
    if (assets.length > 0) {
      return assets;
    }

    // 否则尝试使用项目详情中的资产数据
    if (project?.assets && project.assets.length > 0) {
      return project.assets;
    }

    // 都没有则返回空数组
    return [];
  };

  // 漏洞相关操作
  const handleCreateVuln = async () => {
    if (!(isAdmin || isSecurityEngineer)) {
      Toast.warning('当前角色不允许创建漏洞');
      return;
    }

    setEditingVuln(null);
    setVulnDescription(''); // 清空markdown内容
    if (vulnFormRef) {
      vulnFormRef.reset();
    }

    // 确保资产数据已加载，如果还没有加载就先加载
    const availableAssets = getAvailableAssets();
    if (availableAssets.length === 0) {
      try {
        await loadAssets();
      } catch (error) {
        console.error('加载资产数据失败:', error);
        Toast.warning('资产数据加载失败，您可能无法看到完整的资产列表');
      }
    }

    setVulnModalVisible(true);
  };

  const handleEditVuln = async (vuln: Vulnerability) => {
    if (!(isAdmin || isSecurityEngineer)) {
      Toast.warning('当前角色不允许修改漏洞');
      return;
    }

    // 确保资产数据已加载，如果还没有加载就先加载
    const availableAssets = getAvailableAssets();
    if (availableAssets.length === 0) {
      try {
        await loadAssets();
      } catch (error) {
        console.error('加载资产数据失败:', error);
        Toast.warning('资产数据加载失败，您可能无法看到完整的资产列表');
      }
    }

    setEditingVuln(vuln);
    setVulnDescription(vuln.description || ''); // 设置markdown内容
    setVulnModalVisible(true);
    // 表单值设置由 useEffect 处理
  };

  // 研发工程师状态变更处理
  const handleChangeVulnStatus = (vuln: Vulnerability) => {
    setChangingVuln(vuln);
    setSelectedStatus(vuln.status); // 初始化为当前状态
    setStatusChangeModalVisible(true);
  };

  const openRetestEvidenceModal = (vuln: Vulnerability, status: 'completed' | 'unfixed') => {
    setRetestTargetVuln(vuln);
    setRetestTargetStatus(status);
    setRetestEvidence('');
    setRetestModalVisible(true);
  };

  const closeRetestEvidenceModal = () => {
    setRetestModalVisible(false);
    setRetestTargetVuln(null);
    setRetestTargetStatus('');
    setRetestEvidence('');
  };

  // 保存状态变更
  const handleSaveStatusChange = async (values: any) => {
    if (!changingVuln) return;

    try {
      // 验证驳回状态必须填写批注
      if (selectedStatus === 'rejected' && (!values.comment || !values.comment.trim())) {
        Toast.error('驳回漏洞时必须填写批注');
        return;
      }

      const updateData: VulnStatusUpdateRequest = {
        status: selectedStatus,
      };

      // 如果有批注，添加到更新数据中
      if (values.comment && values.comment.trim()) {
        updateData.comment = values.comment.trim();
      }

      if (selectedStatus === 'rejected') {
        updateData.reject_reason = values.comment.trim();
      }

      await vulnApi.updateVulnStatus(changingVuln.id, updateData);

      // 关闭弹窗并重置状态
      setStatusChangeModalVisible(false);
      setChangingVuln(null);
      setSelectedStatus('');

      // 重置表单
      if (statusChangeFormRef) {
        statusChangeFormRef.reset();
      }

      // 刷新漏洞列表
      await loadVulnerabilities();

      // 如果当前正在查看这个漏洞的详情，需要刷新详情和时间线
      if (viewingVuln && viewingVuln.id === changingVuln.id) {
        try {
          // 重新获取漏洞详情
          const response = await vulnApi.getVuln(changingVuln.id);
          if (response.code === 200 && response.data) {
            setViewingVuln(response.data);
          }

          // 刷新时间线数据
          await refreshTimeline(changingVuln.id);
        } catch (refreshError) {
          console.error('刷新漏洞详情失败:', refreshError);
        }
      }

      Toast.success('状态变更成功');

    } catch (error: any) {
      console.error('状态变更失败:', error);
      Toast.error(error?.response?.data?.msg || error?.message || '状态变更失败');
    }
  };

  // 查看漏洞详情
  const handleViewVuln = async (vuln: Vulnerability) => {
    setVulnDetailLoading(true);
    setTimelineLoading(true);
    try {
      // 获取完整的漏洞详情
      const response = await vulnApi.getVuln(vuln.id);
      if (response.code === 200 && response.data) {
        setViewingVuln(response.data);

        // 获取时间线数据
        await refreshTimeline(vuln.id);

        setVulnDetailModalVisible(true);
        // 禁用页面滚动
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

  const handleSaveVuln = async (values: any) => {
    if (!(isAdmin || isSecurityEngineer)) {
      Toast.warning('当前角色不允许创建或修改漏洞');
      return;
    }

    try {

      // 验证markdown内容
      if (!vulnDescription.trim()) {
        Toast.error('请输入漏洞详情');
        return;
      }

      // 验证必填字段（创建新漏洞时）
      if (!editingVuln) {
        if (!values.vuln_url?.trim()) {
          Toast.error('请输入漏洞地址');
          return;
        }
        if (!values.fix_suggestion?.trim()) {
          Toast.error('请输入修复建议');
          return;
        }
        if (!values.assignee_id) {
          Toast.error('请选择指派人');
          return;
        }
        if (!values.fix_deadline) {
          Toast.error('请选择修复期限');
          return;
        }
      }

      const vulnData: VulnCreateRequest | VulnUpdateRequest = {
        title: values.title,
        vuln_url: values.vuln_url,
        description: vulnDescription, // 使用markdown编辑器的内容
        vuln_type: values.vuln_type,
        severity: values.severity,
        cve_id: values.cve_id,
        fix_suggestion: values.fix_suggestion,
        asset_id: values.asset_id,
        assignee_id: values.assignee_id,
        fix_deadline: values.fix_deadline ? values.fix_deadline.toISOString().split('T')[0] : undefined,
        tags: values.tags,
      };

      // 如果是编辑模式，需要包含状态字段
      if (editingVuln) {
        // 对于研发工程师，如果选择了状态，使用选择的状态；否则保持原状态
        if (isDevEngineer && values.status) {
          vulnData.status = values.status;
        } else if (!isDevEngineer && values.status) {
          // 对于其他角色，直接使用表单的状态值
          vulnData.status = values.status;
        } else {
          // 如果没有明确的状态选择，保持原状态
          vulnData.status = editingVuln.status;
        }
      } else {
        // 创建新漏洞时，使用表单状态或默认状态
        vulnData.status = values.status || 'unfixed';
      }

      if (editingVuln) {
        await vulnApi.updateVuln(editingVuln.id, vulnData);
      } else {
        // 创建新漏洞时，确保必填字段不为空
        if (!vulnData.vuln_url) {
          Toast.error('漏洞地址不能为空');
          return;
        }
        if (!vulnData.fix_suggestion) {
          Toast.error('修复建议不能为空');
          return;
        }
        if (!vulnData.assignee_id) {
          Toast.error('请选择指派人');
          return;
        }
        if (!vulnData.fix_deadline) {
          Toast.error('修复期限不能为空');
          return;
        }
        await vulnApi.createVuln({
          ...vulnData,
          project_id: parseInt(projectId),
          vuln_url: vulnData.vuln_url,
          fix_suggestion: vulnData.fix_suggestion,
          assignee_id: vulnData.assignee_id,
          fix_deadline: vulnData.fix_deadline
        } as VulnCreateRequest);
      }


      // 立即关闭弹窗并重置状态
      setVulnModalVisible(false);
      setEditingVuln(null);

      // 重置表单
      if (vulnFormRef) {
        vulnFormRef.reset();
      }

      // 刷新漏洞列表
      await loadVulnerabilities();

      // 如果当前正在查看这个漏洞的详情，需要刷新详情和时间线
      if (editingVuln && viewingVuln && viewingVuln.id === editingVuln.id) {
        try {
          // 重新获取漏洞详情
          const response = await vulnApi.getVuln(editingVuln.id);
          if (response.code === 200 && response.data) {
            setViewingVuln(response.data);
            // 刷新时间线
            await refreshTimeline(editingVuln.id);
          }
        } catch (error) {
          console.error('刷新漏洞详情失败:', error);
        }
      }

      // 延迟显示Toast消息以避免React 18兼容性问题
      setTimeout(() => {
        Toast.success(editingVuln ? '更新漏洞成功' : '创建漏洞成功');
      }, 100);

    } catch (error) {
      console.error('保存漏洞失败:', error);
      // 延迟显示错误Toast
      setTimeout(() => {
        Toast.error(editingVuln ? '更新漏洞失败' : '创建漏洞失败');
      }, 100);
    }
  };

  const handleDeleteVuln = async (vuln: Vulnerability) => {
    try {
      await vulnApi.deleteVuln(vuln.id);
      Toast.success('删除漏洞成功');
      loadVulnerabilities();
    } catch (error) {
      console.error('Error deleting vulnerability:', error);
      Toast.error('删除漏洞失败');
    }
  };

  const handleUpdateVulnStatus = async (vulnId: number, status: string, extraData?: any): Promise<boolean> => {
    try {
      await vulnApi.updateVulnStatus(vulnId, { status, ...extraData });
      Toast.success('更新漏洞状态成功');
      loadVulnerabilities();

      // 如果当前正在查看这个漏洞的详情，需要刷新详情和时间线
      if (viewingVuln && viewingVuln.id === vulnId) {
        try {
          // 重新获取漏洞详情
          const response = await vulnApi.getVuln(vulnId);
          if (response.code === 200 && response.data) {
            setViewingVuln(response.data);
          }

          // 刷新时间线数据
          await refreshTimeline(vulnId);
        } catch (refreshError) {
          console.error('刷新漏洞详情失败:', refreshError);
        }
      }
      return true;
    } catch (error: any) {
      console.error('Error updating vulnerability status:', error);
      Toast.error(error?.response?.data?.msg || error?.message || '更新漏洞状态失败');
      return false;
    }
  };

  const handleSubmitRetestEvidence = async () => {
    if (!retestTargetVuln || !retestTargetStatus) {
      return;
    }

    if (!retestEvidence.trim()) {
      Toast.error('请填写复测验证说明（支持文字或图片）');
      return;
    }

    const now = new Date().toISOString();
    const payload: VulnStatusUpdateRequest = {
      status: retestTargetStatus,
      retest_result: retestEvidence.trim(),
      retest_at: now,
      ...(retestTargetStatus === 'completed' ? { completed_at: now } : {}),
    };

    const updated = await handleUpdateVulnStatus(retestTargetVuln.id, retestTargetStatus, payload);
    if (updated) {
      closeRetestEvidenceModal();
    }
  };

  const handleFixVuln = async (vulnId: number) => {
    try {
      await vulnApi.fixVuln(vulnId);
      Toast.success('修复操作已提交');
      loadVulnerabilities();

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
      console.error('Error fixing vulnerability:', error);
      Toast.error(error?.response?.data?.msg || error?.message || '修复漏洞失败');
    }
  };

  // 重新提交驳回的漏洞
  const handleResubmitVuln = async (vuln: Vulnerability) => {
    try {
      // 重新提交时将状态改为未修复，并清除驳回相关信息
      await vulnApi.updateVulnStatus(vuln.id, {
        status: 'unfixed',
        reject_reason: '', // 清除驳回原因
        resubmitted_at: new Date().toISOString(),
        resubmitted_by: currentUser?.ID || currentUser?.id
      });
      Toast.success('漏洞重新提交成功');

      // 刷新漏洞列表
      loadVulnerabilities();

      // 如果当前正在查看这个漏洞的详情，需要刷新详情和时间线
      if (viewingVuln && viewingVuln.id === vuln.id) {
        try {
          // 重新获取漏洞详情
          const response = await vulnApi.getVuln(vuln.id);
          if (response.code === 200 && response.data) {
            setViewingVuln(response.data);
          }

          // 刷新时间线数据
          await refreshTimeline(vuln.id);
        } catch (refreshError) {
          console.error('刷新漏洞详情失败:', refreshError);
        }
      }
    } catch (error: any) {
      console.error('Error resubmitting vulnerability:', error);
      Toast.error(error?.response?.data?.msg || error?.message || '重新提交漏洞失败');
    }
  };

  // 资产相关操作
  const handleCreateAsset = () => {
    setEditingAsset(null);
    setSelectedAssetType('');
    if (assetFormRef) {
      assetFormRef.reset();
    }
    setAssetModalVisible(true);
  };

  const handleEditAsset = (asset: Asset) => {
    setEditingAsset(asset);
    // 检查是否是自定义类型
    const isCustomType = !ASSET_TYPES.some(type => type.value === asset.type);
    setSelectedAssetType(isCustomType ? 'custom' : asset.type);
    setAssetModalVisible(true);
    // 表单值设置由 useEffect 处理
  };

  const handleSaveAsset = async (values: any) => {
    try {
      // 处理自定义资产类型
      let assetType = values.type;
      if (values.type === 'custom' && values.customType) {
        assetType = values.customType;
      }

      const assetData: AssetCreateRequest | AssetUpdateRequest = {
        name: values.name,
        type: assetType,
        domain: values.domain,
        ip: values.ip,
        port: values.port,
        os: values.os,
        owner: values.owner,
        environment: values.environment,
        department: values.department,
        importance: values.importance,
        tags: values.tags,
        description: values.description,
      };

      if (editingAsset) {
        await assetApi.updateAsset(editingAsset.id, assetData);
      } else {
        await assetApi.createAsset({ ...assetData, project_id: parseInt(projectId) } as AssetCreateRequest);
      }

      // 立即关闭弹窗并重置状态
      setAssetModalVisible(false);
      setEditingAsset(null);
      setSelectedAssetType('');

      // 重置表单
      if (assetFormRef) {
        assetFormRef.reset();
      }

      // 刷新资产列表
      await loadAssets();

      // 延迟显示Toast消息以避免React 18兼容性问题
      setTimeout(() => {
        Toast.success(editingAsset ? '更新资产成功' : '创建资产成功');
      }, 100);

    } catch (error) {
      console.error('保存资产失败:', error);
      // 延迟显示错误Toast
      setTimeout(() => {
        Toast.error(editingAsset ? '更新资产失败' : '创建资产失败');
      }, 100);
    }
  };

  const handleDeleteAsset = async (asset: Asset) => {
    try {
      await assetApi.deleteAsset(asset.id);
      Toast.success('删除资产成功');
      loadAssets();
    } catch (error: any) {
      console.error('Error deleting asset:', error);

      // 检查是否是特定的错误响应
      if (error.response?.data?.code === 400 &&
          error.response?.data?.msg === "该资产下存在漏洞，无法删除") {
        Toast.error('该资产下存在漏洞，无法删除');
      } else {
        // 其他错误情况
        const errorMsg = error.response?.data?.msg || error.message || '删除资产失败';
        Toast.error(errorMsg);
      }
    }
  };

  // 处理批量导入
  const handleImportAssets = () => {
    setImportModalVisible(true);
    setUploadFile(null);
  };

  // 处理文件选择（现在使用原生input，这个函数可能不再需要）
  const handleFileChange = (fileList: any[]) => {
    console.log('onChange 文件列表变化:', fileList); // 调试日志
    // 现在使用原生input，这个函数主要用于调试
  };

  // 执行导入
  const handleConfirmImport = async () => {
    console.log('开始导入，当前文件状态:', uploadFile); // 调试日志
    console.log('文件是否存在:', !!uploadFile); // 调试日志

    if (!uploadFile) {
      console.error('uploadFile 为空，无法导入'); // 调试日志
      Toast.error('请选择要导入的Excel文件');
      return;
    }

    // 验证文件类型
    const fileName = uploadFile.name || '';
    if (!fileName.toLowerCase().endsWith('.xlsx') && !fileName.toLowerCase().endsWith('.xls')) {
      Toast.error('请选择Excel文件（.xlsx或.xls格式）');
      return;
    }

    console.log('文件验证通过，准备上传:', {
      name: uploadFile.name,
      size: uploadFile.size,
      type: uploadFile.type,
      constructor: uploadFile.constructor.name,
      isFile: uploadFile instanceof File
    }); // 调试日志

    // 确保我们传递的是真正的File对象
    if (!(uploadFile instanceof File)) {
      console.error('uploadFile不是File对象:', uploadFile);
      Toast.error('文件对象无效，请重新选择文件');
      return;
    }

    try {
      setImporting(true);
      console.log('调用导入API，项目ID:', projectId); // 调试日志
      const response = await assetApi.importAssets(uploadFile, parseInt(projectId));
      console.log('导入API响应:', response); // 调试日志

      if (response.code === 200) {
        const result = response.data;
        let message = `导入完成！成功 ${result.success_count} 条`;
        if (result.failure_count > 0) {
          message += `，失败 ${result.failure_count} 条`;
        }

        Toast.success(message);

        // 如果有错误信息，显示详细错误
        if (result.errors && result.errors.length > 0) {
          console.log('导入错误详情:', result.errors);
          // 显示前几个错误信息
          const errorPreview = result.errors.slice(0, 3).join('; ');
          if (result.errors.length > 3) {
            Toast.warning(`部分导入失败: ${errorPreview}... (共${result.errors.length}个错误，详见控制台)`);
          } else {
            Toast.warning(`导入错误: ${errorPreview}`);
          }
        }

        // 刷新资产列表
        await loadAssets();

        // 关闭弹窗
        setImportModalVisible(false);
        setUploadFile(null);
      } else {
        Toast.error(response.msg || '导入失败');
      }
    } catch (error: any) {
      console.error('导入失败:', error);
      console.error('错误详情:', error.response); // 更详细的错误日志
      console.error('响应数据:', error.response?.data); // 显示后端返回的具体错误
      const errorMsg = error.response?.data?.msg || error.message || '导入失败';
      Toast.error(`导入失败: ${errorMsg}`);
    } finally {
      setImporting(false);
    }
  };

  // 下载导入模板
  const handleDownloadTemplate = async () => {
    try {
      const blob = await assetApi.downloadImportTemplate();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'asset_import_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      Toast.success('模板下载成功');
    } catch (error) {
      console.error('下载模板失败:', error);
      Toast.error('下载模板失败');
    }
  };

  // 获取标签颜色
  const getSeverityColor = (severity: string): 'red' | 'orange' | 'yellow' | 'blue' | 'grey' | 'green' => {
    const severityItem = VULN_SEVERITIES.find(s => s.value === severity);
    return (severityItem?.color as any) || 'grey';
  };

  const getStatusColor = (status: string): 'red' | 'orange' | 'yellow' | 'blue' | 'grey' | 'green' => {
    const statusItem = VULN_STATUSES.find(s => s.value === status);
    return (statusItem?.color as any) || 'grey';
  };

  const getImportanceColor = (importance: string): 'red' | 'orange' | 'yellow' | 'blue' | 'grey' | 'green' => {
    const importanceItem = ASSET_IMPORTANCE_LEVELS.find(i => i.value === importance);
    return (importanceItem?.color as any) || 'grey';
  };

  // 检查操作权限
  const canEditVuln = (vuln: Vulnerability) => {
    // 管理员可以编辑任何状态的漏洞
    if (isAdmin) return true;

    // 已完成的漏洞只有管理员才能编辑
    if (vuln.status === 'completed') return false;

    // 驳回状态的漏洞只有漏洞提交人（安全工程师）和管理员能编辑
    if (vuln.status === 'rejected') {
      const userId = currentUser?.id || currentUser?.ID;
      return isSecurityEngineer && vuln.reporter_id === userId;
    }

    const userId = currentUser?.id || currentUser?.ID;
    if (isSecurityEngineer && vuln.reporter_id === userId && vuln.status === 'unfixed') return true;
    return false;
  };

  // 检查复测权限
  const canRetestVuln = (vuln: Vulnerability) => {
    // 管理员可以复测任何漏洞
    if (isAdmin) return true;

    // 安全工程师可以复测自己提交的漏洞
    const userId = currentUser?.id || currentUser?.ID;
    if (isSecurityEngineer && vuln.reporter_id === userId) return true;

    return false;
  };

  // 检查是否可以重新提交（驳回状态的漏洞）
  const canResubmitVuln = (vuln: Vulnerability) => {
    if (vuln.status !== 'rejected') return false;

    // 管理员可以重新提交任何驳回的漏洞
    if (isAdmin) return true;

    // 漏洞提交人可以重新提交自己提交的驳回漏洞
    const userId = currentUser?.id || currentUser?.ID;
    return isSecurityEngineer && vuln.reporter_id === userId;
  };

  // 获取状态在时间线中的顺序
  const getStatusOrder = (status: string): number => {
    const statusOrder: { [key: string]: number } = {
      'unfixed': 1,
      'fixing': 2,
      'fixed': 3,
      'rejected': 1, // 驳回状态回到起点
      'retesting': 4,
      'completed': 5,
      'ignored': 0
    };
    return statusOrder[status] || 0;
  };

  const canDeleteVuln = (vuln: Vulnerability) => {
    // 管理员可以删除任何状态的漏洞
    if (isAdmin) return true;

    // 已完成的漏洞只有管理员才能删除
    if (vuln.status === 'completed') return false;

    const userId = currentUser?.id || currentUser?.ID;
    if (isSecurityEngineer && vuln.reporter_id === userId) return true;
    return false;
  };

  const canEditAsset = (asset: Asset) => {
    if (isAdmin) return true;
    if (isSecurityEngineer && asset.created_by === currentUser?.id) return true;
    return false;
  };

  const canDeleteAsset = (asset: Asset) => {
    if (isAdmin) return true;
    if (isSecurityEngineer && asset.created_by === currentUser?.id) return true;
    return false;
  };

  const handleExportVulns = async (format: 'excel' | 'word' = 'excel') => {
    if (!canExportVulnReport) {
      Toast.error('当前角色无权限导出漏洞报告');
      return;
    }

    if (selectedVulnIds.length === 0) {
      Toast.warning('请选择要导出的漏洞');
      return;
    }

    setExportingVulns(true);
    try {
      const blob = await vulnApi.exportVulnsReport({
        vuln_ids: selectedVulnIds,
        project_id: parseInt(projectId),
        format,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extension = format === 'word' ? 'doc' : 'xlsx';
      a.download = `vuln_report_${projectId}_${new Date().getTime()}.${extension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      Toast.success(format === 'word' ? 'Word 报告导出成功' : 'Excel 报告导出成功');
      setSelectedVulnIds([]);
    } catch (error: any) {
      console.error('导出漏洞报告失败:', error);
      if (error?.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const parsed = JSON.parse(text);
          Toast.error(parsed?.msg || '导出漏洞报告失败');
        } catch {
          Toast.error('导出漏洞报告失败');
        }
      } else {
        Toast.error(error?.response?.data?.msg || error?.message || '导出漏洞报告失败');
      }
    } finally {
      setExportingVulns(false);
    }
  };

  const handleSelectAllVulns = (checked: boolean) => {
    if (checked) {
      setSelectedVulnIds(vulnerabilities.map(vuln => vuln.id));
    } else {
      setSelectedVulnIds([]);
    }
  };

  const handleSelectVuln = (vulnId: number, checked: boolean) => {
    if (checked) {
      setSelectedVulnIds(prev => Array.from(new Set([...prev, vulnId])));
    } else {
      setSelectedVulnIds(prev => prev.filter(id => id !== vulnId));
    }
  };


  // 处理批量导出
  const handleExportAssets = async () => {
    if (selectedAssetIds.length === 0) {
      Toast.warning('请选择要导出的资产');
      return;
    }

    setExporting(true);
    try {
      const blob = await assetApi.exportAssets(selectedAssetIds, parseInt(projectId));

      // 创建下载链接
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assets_${projectId}_${new Date().getTime()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      Toast.success('导出成功');
      setSelectedAssetIds([]); // 清空选择
    } catch (error: any) {
      console.error('导出失败:', error);
      Toast.error(error.response?.data?.msg || '导出失败');
    } finally {
      setExporting(false);
    }
  };

  // 处理全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAssetIds(assets.map(asset => asset.id));
    } else {
      setSelectedAssetIds([]);
    }
  };

  // 处理单个选择
  const handleSelectAsset = (assetId: number, checked: boolean) => {
    if (checked) {
      setSelectedAssetIds([...selectedAssetIds, assetId]);
    } else {
      setSelectedAssetIds(selectedAssetIds.filter(id => id !== assetId));
    }
  };

  // 漏洞表格列定义
  const vulnColumns = [
    ...(canExportVulnReport ? [{
      title: (
        <input
          type="checkbox"
          checked={selectedVulnIds.length === vulnerabilities.length && vulnerabilities.length > 0}
          onChange={(e) => handleSelectAllVulns(e.target.checked)}
        />
      ),
      dataIndex: 'select',
      key: 'select',
      width: 50,
      render: (text: string, record: Vulnerability) => (
        <input
          type="checkbox"
          checked={selectedVulnIds.includes(record.id)}
          onChange={(e) => handleSelectVuln(record.id, e.target.checked)}
        />
      ),
    }] : []),
    {
      title: '漏洞标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: Vulnerability) => (
        <div>
          <Text strong>{text}</Text>
          {record.vuln_url && (
            <div>
              <Text type="secondary" size="small">{record.vuln_url}</Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      render: (severity: string) => {
        const severityItem = VULN_SEVERITIES.find(s => s.value === severity);
        return <Tag color={getSeverityColor(severity)}>{severityItem?.label || severity}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusItem = VULN_STATUSES.find(s => s.value === status);
        return <Tag color={getStatusColor(status)}>{statusItem?.label || status}</Tag>;
      },
    },
    {
      title: '漏洞类型',
      dataIndex: 'vuln_type',
      key: 'vuln_type',
    },
    {
      title: '所属资产',
      dataIndex: 'asset',
      key: 'asset',
      render: (asset: Asset) => asset ? `${asset.name} (${asset.ip})` : '-',
    },
    {
      title: '提交人',
      dataIndex: 'reporter',
      key: 'reporter',
      render: (reporter: User) => reporter ? reporter.real_name : '未知',
    },
    {
      title: '指派人',
      dataIndex: 'assignee',
      key: 'assignee',
      render: (assignee: User) => assignee ? assignee.real_name : '未指派',
    },
    {
      title: '提交时间',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      render: (time: string) => new Date(time).toLocaleDateString(),
    },
    {
      title: '截止时间',
      dataIndex: 'fix_deadline',
      key: 'fix_deadline',
      render: (deadline: string, record: Vulnerability) => {
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
              {deadlineDate.toLocaleDateString()}
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
    },
    {
      title: '操作',
      key: 'action',
      render: (text: string, record: Vulnerability) => (
        <Space>
          <Button
            theme="borderless"
            icon={<IconEyeOpened />}
            size="small"
            onClick={() => handleViewVuln(record)}
            loading={vulnDetailLoading}
          >
            查看详情
          </Button>

          {canEditVuln(record) && (
            <Button
              theme="borderless"
              icon={<IconEdit />}
              size="small"
              onClick={() => handleEditVuln(record)}
            >
              {isDevEngineer ? '状态变更' : (record.status === 'rejected' ? '重新编辑' : '编辑')}
            </Button>
          )}

          {canResubmitVuln(record) && (
            <Button
              theme="borderless"
              type="primary"
              icon={<IconRefresh />}
              size="small"
              onClick={() => {
                Modal.confirm({
                  title: '重新提交漏洞',
                  content: `确定要重新提交漏洞"${record.title}"吗？重新提交后漏洞状态将变为未修复。`,
                  onOk: () => handleResubmitVuln(record)
                });
              }}
            >
              重新提交
            </Button>
          )}

          {isSecurityEngineer && record.status === 'ignored' && (
            <Button
              theme="borderless"
              type="primary"
              size="small"
              onClick={() => handleUpdateVulnStatus(record.id, 'unfixed')}
            >
              重新激活
            </Button>
          )}

          {canRetestVuln(record) && record.status === 'fixed' && (
            <Button
              theme="borderless"
              type="primary"
              size="small"
              onClick={() => handleUpdateVulnStatus(record.id, 'retesting', { retester_id: currentUser?.ID || currentUser?.id })}
            >
              复测
            </Button>
          )}

          {/* 被指派人（非管理员/安全人员）仅允许修复漏洞 */}
          {record.assignee_id === (currentUser?.ID || currentUser?.id) &&
            !isAdmin &&
            !isSecurityEngineer &&
            ['pending', 'confirmed', 'unfixed', 'fixing'].includes(record.status) && (
              <Button
                theme="borderless"
                type="primary"
                size="small"
                onClick={() => handleFixVuln(record.id)}
              >
                修复漏洞
              </Button>
            )}

          {/* 复测完成操作 - 仅管理员和安全工程师 */}
          {canRetestVuln(record) && record.status === 'retesting' && (
            <>
              <Button
                theme="borderless"
                type="secondary"
                size="small"
                onClick={() => openRetestEvidenceModal(record, 'completed')}
              >
                修复完成
              </Button>
              <Button
                theme="borderless"
                type="tertiary"
                size="small"
                onClick={() => openRetestEvidenceModal(record, 'unfixed')}
              >
                复测不通过
              </Button>
            </>
          )}

          {canDeleteVuln(record) && (
            <Popconfirm
              title="确认删除"
              content={`确定要删除漏洞"${record.title}"吗？`}
              onConfirm={() => handleDeleteVuln(record)}
            >
              <Button
                theme="borderless"
                type="danger"
                icon={<IconDelete />}
                size="small"
              >
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // 资产表格列定义
  const assetColumns = [
    {
      title: (
        <input
          type="checkbox"
          checked={selectedAssetIds.length === assets.length && assets.length > 0}
          onChange={(e) => handleSelectAll(e.target.checked)}
        />
      ),
      dataIndex: 'select',
      key: 'select',
      width: 50,
      render: (text: string, record: Asset) => (
        <input
          type="checkbox"
          checked={selectedAssetIds.includes(record.id)}
          onChange={(e) => handleSelectAsset(record.id, e.target.checked)}
        />
      ),
    },
    {
      title: '资产名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Asset) => (
        <div>
          <Text strong>{text}</Text>
          <div>
            <Text type="secondary" size="small">{record.ip}:{record.port}</Text>
          </div>
        </div>
      ),
    },
    {
      title: '资产类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const typeItem = ASSET_TYPES.find(t => t.value === type);
        return typeItem?.label || type;
      },
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      render: (environment: string) => {
        const envItem = ENVIRONMENT_TYPES.find(e => e.value === environment);
        return envItem?.label || environment;
      },
    },
    {
      title: '重要性',
      dataIndex: 'importance',
      key: 'importance',
      render: (importance: string) => {
        const importanceItem = ASSET_IMPORTANCE_LEVELS.find(i => i.value === importance);
        return <Tag color={getImportanceColor(importance)}>{importanceItem?.label || importance}</Tag>;
      },
    },
    {
      title: '负责人',
      dataIndex: 'owner',
      key: 'owner',
    },
    {
      title: '所属部门',
      dataIndex: 'department',
      key: 'department',
    },
    {
      title: '操作系统',
      dataIndex: 'os',
      key: 'os',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time: string) => new Date(time).toLocaleDateString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (text: string, record: Asset) => (
        <Space>
          {canEditAsset(record) && (
            <Button
              theme="borderless"
              icon={<IconEdit />}
              size="small"
              onClick={() => handleEditAsset(record)}
            >
              编辑
            </Button>
          )}
          {canDeleteAsset(record) && (
            <Popconfirm
              title="确认删除"
              content={`确定要删除资产"${record.name}"吗？`}
              onConfirm={() => handleDeleteAsset(record)}
            >
              <Button
                theme="borderless"
                type="danger"
                icon={<IconDelete />}
                size="small"
              >
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  if (loading) {
    return <Spin size="large" style={{ display: 'flex', justifyContent: 'center', padding: '50px' }} />;
  }

  if (!project) {
    return <div>项目不存在</div>;
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* 时间线滚动条样式 */}
      <style jsx>{`
        .timeline-container::-webkit-scrollbar {
          height: 6px;
        }
        .timeline-container::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 3px;
        }
        .timeline-container::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 3px;
        }
        .timeline-container::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }
        .timeline-container {
          scrollbar-width: thin;
          scrollbar-color: #c1c1c1 #f1f1f1;
        }

        /* 时间线节点悬浮效果 */
        .timeline-node {
          transition: all 0.3s ease;
        }
        .timeline-node:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        }
      `}</style>

      {/* 项目基本信息 */}
      <Card style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <Space>
            <Button
              theme="borderless"
              icon={<IconArrowLeft />}
              onClick={() => router.back()}
            >
              返回
            </Button>
            <Title heading={3} style={{ margin: 0 }}>{project.name}</Title>
            <Tag color="blue">{PROJECT_TYPES.find(t => t.value === project.type)?.label}</Tag>
            <Tag color="green">{PROJECT_PRIORITIES.find(p => p.value === project.priority)?.label}</Tag>
          </Space>
          <Button
            icon={<IconRefresh />}
            onClick={() => {
              loadProjectDetail();
              if (activeTabKey === 'vulnerabilities') {
                loadVulnerabilities();
              } else {
                loadAssets();
              }
            }}
          >
            刷新
          </Button>
        </div>

        {/* 项目详细信息 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '16px',
          marginBottom: '16px',
          padding: '16px',
          backgroundColor: '#fafafa',
          borderRadius: '8px'
        }}>
          <div>
            <Text type="secondary" size="small">项目类型：</Text>
            <div style={{ marginTop: '4px' }}>
              <Text strong>{PROJECT_TYPES.find(t => t.value === project.type)?.label || project.type}</Text>
            </div>
          </div>

          <div>
            <Text type="secondary" size="small">项目负责人：</Text>
            <div style={{ marginTop: '4px' }}>
              <Text strong>{project.owner?.real_name || project.owner?.username || '未设置'}</Text>
            </div>
          </div>

          <div>
            <Text type="secondary" size="small">创建时间：</Text>
            <div style={{ marginTop: '4px' }}>
              <Text strong>
                {project.created_at ? new Date(project.created_at).toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit'
                }) : '未知'}
              </Text>
            </div>
          </div>

          <div>
            <Text type="secondary" size="small">项目到期时间：</Text>
            <div style={{ marginTop: '4px' }}>
              <Text strong style={{
                color: project.end_date && new Date(project.end_date) < new Date() ? '#ff4d4f' : 'inherit'
              }}>
                {project.end_date ? new Date(project.end_date).toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit'
                }) : '永久有效'}
              </Text>
              {project.end_date && new Date(project.end_date) < new Date() && (
                <Tag color="red" size="small" style={{ marginLeft: '8px' }}>已过期</Tag>
              )}
            </div>
          </div>
        </div>

        {project.description && (
          <div>
            <Text type="secondary" size="small">项目描述：</Text>
            <div style={{ marginTop: '8px' }}>
              <Text>{project.description}</Text>
            </div>
          </div>
        )}
      </Card>

      {/* 标签页 */}
      <Card>
        <Tabs
          activeKey={activeTabKey}
          onChange={setActiveTabKey}
          type="line"
          size="large"
        >
          <TabPane
            tab={
              <span>
                <IconBolt style={{ marginRight: '8px' }} />
                漏洞管理
              </span>
            }
            itemKey="vulnerabilities"
          >
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div>
                  {canExportVulnReport && selectedVulnIds.length > 0 && (
                    <Space>
                      <Text type="secondary">已选择 {selectedVulnIds.length} 项</Text>
                      <Button
                        icon={<IconDownload />}
                        onClick={() => handleExportVulns('excel')}
                        loading={exportingVulns}
                        disabled={selectedVulnIds.length === 0}
                      >
                        导出Excel
                      </Button>
                      <Button
                        icon={<IconDownload />}
                        onClick={() => handleExportVulns('word')}
                        loading={exportingVulns}
                        disabled={selectedVulnIds.length === 0}
                      >
                        导出Word
                      </Button>
                    </Space>
                  )}
                </div>
                <div>
                  {(isAdmin || isSecurityEngineer) && (
                    <Button
                      theme="solid"
                      type="primary"
                      icon={<IconPlus />}
                      onClick={handleCreateVuln}
                      disabled={project && isProjectExpired(project)}
                    >
                      添加漏洞
                    </Button>
                  )}
                  {project && isProjectExpired(project) && (
                    <div style={{
                      marginLeft: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      color: 'var(--semi-color-danger)',
                      fontSize: '12px'
                    }}>
                      <IconInfoCircle style={{ marginRight: '4px' }} />
                      项目已过期，无法添加漏洞
                    </div>
                  )}
                </div>
              </div>
            </div>
            <Table
              columns={vulnColumns}
              dataSource={vulnerabilities}
              rowKey="id"
              loading={vulnLoading}
              pagination={{
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: true,
              }}
              empty={
                <Empty
                  image={<IconBolt size="extra-large" />}
                  title="暂无漏洞"
                  description="暂时没有漏洞记录"
                />
              }
            />
          </TabPane>

          <TabPane
            tab={
              <span>
                <IconServer style={{ marginRight: '8px' }} />
                资产管理
              </span>
            }
            itemKey="assets"
          >
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {selectedAssetIds.length > 0 && (
                    <Space>
                      <Text type="secondary">已选择 {selectedAssetIds.length} 项</Text>
                      <Button
                        icon={<IconDownload />}
                        onClick={handleExportAssets}
                        loading={exporting}
                        disabled={selectedAssetIds.length === 0}
                      >
                        导出选中
                      </Button>
                    </Space>
                  )}
                </div>

                <div>
                  <Space>
                    {(isAdmin || isSecurityEngineer) && (
                      <>
                        <Button
                          icon={<IconUpload />}
                          onClick={handleImportAssets}
                          disabled={project && isProjectExpired(project)}
                        >
                          批量导入
                        </Button>
                        <Button
                          theme="solid"
                          type="primary"
                          icon={<IconPlus />}
                          onClick={handleCreateAsset}
                          disabled={project && isProjectExpired(project)}
                        >
                          添加资产
                        </Button>
                      </>
                    )}
                  </Space>
                  {project && isProjectExpired(project) && (
                    <div style={{
                      marginLeft: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      color: 'var(--semi-color-danger)',
                      fontSize: '12px'
                    }}>
                      <IconInfoCircle style={{ marginRight: '4px' }} />
                      项目已过期，无法添加资产
                    </div>
                  )}
                </div>
              </div>
              <Table
                columns={assetColumns}
                dataSource={assets}
                loading={assetLoading}
                pagination={{
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: true,
                }}
                empty={
                  <Empty
                    image={<IconServer size="extra-large" />}
                    title="暂无资产"
                    description="暂时没有资产记录"
                  />
                }
              />
            </TabPane>
        </Tabs>
      </Card>

      {/* 漏洞创建/编辑弹窗 */}
      <Modal
        title={editingVuln ? '编辑漏洞' : '添加漏洞'}
        visible={vulnModalVisible}
        onCancel={() => {
          setVulnModalVisible(false);
          setEditingVuln(null);
          setVulnDescription(''); // 重置markdown内容
          if (vulnFormRef) {
            vulnFormRef.reset();
          }
        }}
        footer={null}
        width={800}
        maskClosable={false}
      >
        <Form
          getFormApi={(api) => setVulnFormRef(api)}
          onSubmit={handleSaveVuln}
          onSubmitFail={(errors) => {
            console.error('漏洞表单验证失败:', errors);
            Toast.error('请检查表单输入');
          }}
          labelPosition="left"
          labelAlign="left"
          labelWidth={120}
        >
          <Form.Input
            field="title"
            label="漏洞名称"
            placeholder="请输入漏洞名称"
            rules={[{ required: true, message: '请输入漏洞名称' }]}
            disabled={isDevEngineer && !!editingVuln}
          />

          <Form.Input
            field="vuln_url"
            label="漏洞地址"
            placeholder="请输入漏洞地址"
            rules={[{ required: true, message: '请输入漏洞地址' }]}
            disabled={isDevEngineer && !!editingVuln}
          />

          {/* 研发工程师编辑时显示状态选择 */}
          {isDevEngineer && editingVuln && (
            <Form.Select
              field="status"
              label="漏洞状态"
              placeholder="请选择漏洞状态"
              rules={[{ required: true, message: '请选择漏洞状态' }]}
            >
              {/* 研发工程师可选的状态 */}
              <Select.Option value="unfixed">未修复</Select.Option>
              <Select.Option value="fixing">修复中</Select.Option>
              <Select.Option value="fixed">已修复</Select.Option>
            </Form.Select>
          )}

          <Form.Select
            field="asset_id"
            label="所属资产"
            placeholder={getAvailableAssets().length === 0 ? "正在加载资产列表..." : "请选择所属资产"}
            rules={[{ required: true, message: '请选择所属资产' }]}
            loading={assetLoading}
            disabled={isDevEngineer && !!editingVuln}
            emptyContent={
              <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                {assetLoading ? '正在加载资产...' : '暂无可用资产，请先添加资产'}
              </div>
            }
          >
            {getAvailableAssets().map(asset => (
              <Select.Option key={asset.id} value={asset.id}>
                {asset.name} ({asset.ip})
              </Select.Option>
            ))}
          </Form.Select>

          <Form.Select
            field="severity"
            label="漏洞等级"
            placeholder="请选择漏洞等级"
            rules={[{ required: true, message: '请选择漏洞等级' }]}
            disabled={isDevEngineer && !!editingVuln}
          >
            {VULN_SEVERITIES.map(severity => (
              <Select.Option key={severity.value} value={severity.value}>
                {severity.label}
              </Select.Option>
            ))}
          </Form.Select>

          <Form.Select
            field="vuln_type"
            label="漏洞类型"
            placeholder="请选择漏洞类型"
            rules={[{ required: true, message: '请选择漏洞类型' }]}
            disabled={isDevEngineer && !!editingVuln}
          >
            {VULN_TYPES.map(type => (
              <Select.Option key={type} value={type}>
                {type}
              </Select.Option>
            ))}
          </Form.Select>

          <div style={{ marginBottom: '16px' }}>
            <div style={{
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center'
            }}>
              <span style={{ color: '#f56565', marginRight: '4px' }}>*</span>
              漏洞详情
            </div>
            <MarkdownEditor
              value={vulnDescription}
              onChange={(value) => setVulnDescription(value || '')}
              placeholder="请输入漏洞详情（支持Markdown格式和图片上传）"
              height={300}
              disabled={isDevEngineer && !!editingVuln}
            />
            {!vulnDescription.trim() && (
              <div style={{
                color: '#f56565',
                fontSize: '12px',
                marginTop: '4px',
                display: 'none'
              }}
              id="description-error">
                请输入漏洞详情
              </div>
            )}
          </div>

          <Form.Input
            field="cve_id"
            label="CVE编号"
            placeholder="请输入CVE编号（可选）"
            disabled={isDevEngineer && !!editingVuln}
          />

          <Form.TextArea
            field="fix_suggestion"
            label="修复建议"
            placeholder="请输入修复建议"
            rules={[{ required: true, message: '请输入修复建议' }]}
            autosize={{ minRows: 2, maxRows: 4 }}
            disabled={isDevEngineer && !!editingVuln}
          />

          <Form.Select
            field="assignee_id"
            label="指派给"
            placeholder="请选择指派人"
            rules={[{ required: true, message: '请选择指派人' }]}
            disabled={isDevEngineer && !!editingVuln}
          >
            {assignableUsers.map(user => (
              <Select.Option key={user.ID || user.id} value={user.ID || user.id}>
                {user.real_name || user.username} ({user.username})
              </Select.Option>
            ))}
          </Form.Select>

          <Form.DatePicker
            field="fix_deadline"
            label="修复期限"
            placeholder="请选择修复期限"
            type="date"
            rules={[
              { required: true, message: '请选择修复期限' },
              {
                validator: (rule, value, callback) => {
                  if (!value) {
                    callback();
                    return true;
                  }
                  const selectedDate = new Date(value);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  if (selectedDate < today) {
                    callback('修复期限不能是过去的日期');
                    return false;
                  }
                  callback();
                  return true;
                }
              }
            ]}
            disabled={isDevEngineer && !!editingVuln}
          />

          <Form.Input
            field="tags"
            label="标签"
            placeholder="请输入标签，用逗号分隔"
            disabled={isDevEngineer && !!editingVuln}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <Button onClick={() => setVulnModalVisible(false)}>
              取消
            </Button>
            <Button theme="solid" type="primary" htmlType="submit">
              {editingVuln ? '更新' : '创建'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* 漏洞详情查看弹窗 */}
      <Modal
        title="漏洞详情"
        visible={vulnDetailModalVisible}
        onCancel={() => {
          setVulnDetailModalVisible(false);
          setViewingVuln(null);
          // 恢复页面滚动
          document.body.style.overflow = 'auto';
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => {
              setVulnDetailModalVisible(false);
              setViewingVuln(null);
              // 恢复页面滚动
              document.body.style.overflow = 'auto';
            }}>
              关闭
            </Button>
          </div>
        }
        width={1400}
        height={900}
        centered={true}
        maskClosable={true}
        bodyStyle={{
          padding: '24px',
          height: '800px',
          overflow: 'visible'
        }}
        style={{
          top: 0,
          paddingBottom: 0
        }}
      >
        {viewingVuln && (
          <div style={{
            display: 'flex',
            gap: '32px',
            minHeight: '800px',
            lineHeight: '1.6'
          }}>
            {/* 左侧：漏洞信息 */}
            <div style={{
              flex: '0 0 500px',
              paddingRight: '32px',
              borderRight: '2px dashed var(--semi-color-border)',
              overflowY: 'auto',
              maxHeight: '800px'
            }}>
              {/* 基础信息 */}
              <div style={{ marginBottom: '24px' }}>
                <Title heading={5} style={{ marginBottom: '16px', color: 'var(--semi-color-primary)' }}>基础信息</Title>

                {/* 漏洞标题 - 单独一行 */}
                <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                  <Text type="secondary" size="small">漏洞标题：</Text>
                  <div style={{ marginTop: '4px' }}><Text strong style={{ fontSize: '16px' }}>{viewingVuln.title}</Text></div>
                </div>

                {/* 基础属性 - 两列布局 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                    <Text type="secondary" size="small">漏洞类型：</Text>
                    <div style={{ marginTop: '4px' }}><Text strong>{viewingVuln.vuln_type}</Text></div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                    <Text type="secondary" size="small">严重程度：</Text>
                    <div style={{ marginTop: '6px' }}>
                      <Tag color={getSeverityColor(viewingVuln.severity)} size="large">
                        {VULN_SEVERITIES.find(s => s.value === viewingVuln.severity)?.label || viewingVuln.severity}
                      </Tag>
                    </div>
                  </div>
                  {viewingVuln.cve_id && (
                    <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                      <Text type="secondary" size="small">CVE编号：</Text>
                      <div style={{ marginTop: '4px' }}><Text strong>{viewingVuln.cve_id}</Text></div>
                    </div>
                  )}
                </div>

                {/* 状态和期限 - 一行两列布局 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                    <Text type="secondary" size="small">当前状态：</Text>
                    <div style={{ marginTop: '6px' }}>
                      <Tag color={getStatusColor(viewingVuln.status)} size="large">
                        {VULN_STATUSES.find(s => s.value === viewingVuln.status)?.label || viewingVuln.status}
                      </Tag>
                    </div>
                  </div>
                  {viewingVuln.fix_deadline && (
                    <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                      <Text type="secondary" size="small">修复期限：</Text>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginTop: '6px'
                      }}>
                        <Text strong style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: (() => {
                            const deadlineDate = new Date(viewingVuln.fix_deadline);
                            const now = new Date();
                            const isOverdue = deadlineDate < now && !['fixed', 'completed', 'closed', 'ignored'].includes(viewingVuln.status);
                            const daysDiff = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                            if (isOverdue) return '#ff4d4f';
                            if (daysDiff <= 3) return '#fa8c16';
                            return '#1890ff';
                          })(),
                          padding: '4px 12px',
                          borderRadius: '4px',
                          backgroundColor: (() => {
                            const deadlineDate = new Date(viewingVuln.fix_deadline);
                            const now = new Date();
                            const isOverdue = deadlineDate < now && !['fixed', 'completed', 'closed', 'ignored'].includes(viewingVuln.status);
                            const daysDiff = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                            if (isOverdue) return 'rgba(255, 77, 79, 0.1)';
                            if (daysDiff <= 3) return 'rgba(250, 140, 22, 0.1)';
                            return 'rgba(24, 144, 255, 0.1)';
                          })(),
                        }}>
                          {new Date(viewingVuln.fix_deadline).toLocaleDateString('zh-CN')}
                        </Text>
                        {(() => {
                          const deadlineDate = new Date(viewingVuln.fix_deadline);
                          const now = new Date();
                          const isOverdue = deadlineDate < now && !['fixed', 'completed', 'closed', 'ignored'].includes(viewingVuln.status);
                          const daysDiff = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                          if (viewingVuln.status === 'completed') {
                            return null;
                          }
                          if (isOverdue) {
                            return <Text type="danger" size="small">已逾期</Text>;
                          } else if (daysDiff <= 3 && daysDiff >= 0) {
                            return <Text type="warning" size="small">即将到期</Text>;
                          } else if (daysDiff > 3) {
                            return <Text type="secondary" size="small">{daysDiff}天后</Text>;
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* 可选信息 */}
                {viewingVuln.vuln_url && (
                  <div style={{ marginBottom: '12px', padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                    <Text type="secondary" size="small">漏洞地址：</Text>
                    <div style={{ marginTop: '4px' }}><Text>{viewingVuln.vuln_url}</Text></div>
                  </div>
                )}

                {viewingVuln.tags && (
                  <div style={{ marginBottom: '12px', padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                    <Text type="secondary" size="small">标签：</Text>
                    <div style={{ marginTop: '4px' }}><Text>{viewingVuln.tags}</Text></div>
                  </div>
                )}


              </div>

              {/* 关联信息 */}
              <div style={{ marginBottom: '24px' }}>
                <Title heading={5} style={{ marginBottom: '16px', color: 'var(--semi-color-primary)' }}>关联信息</Title>

                {/* 项目和资产信息 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                    <Text type="secondary" size="small">所属项目：</Text>
                    <div style={{ marginTop: '4px' }}><Text strong>{viewingVuln.project?.name || '未知'}</Text></div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                    <Text type="secondary" size="small">所属资产：</Text>
                    <div style={{ marginTop: '4px' }}>
                      <Text strong>{viewingVuln.asset ? `${viewingVuln.asset.name} (${viewingVuln.asset.ip})` : '未知'}</Text>
                    </div>
                  </div>
                </div>

                {/* 人员信息 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                    <Text type="secondary" size="small">提交人：</Text>
                    <div style={{ marginTop: '4px' }}><Text strong>{viewingVuln.reporter?.real_name || '未知'}</Text></div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                    <Text type="secondary" size="small">指派人：</Text>
                    <div style={{ marginTop: '4px' }}><Text strong>{viewingVuln.assignee?.real_name || '未指派'}</Text></div>
                  </div>
                  {viewingVuln.fixer && (
                    <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                      <Text type="secondary" size="small">修复人：</Text>
                      <div style={{ marginTop: '4px' }}><Text strong>{viewingVuln.fixer.real_name}</Text></div>
                    </div>
                  )}
                  {viewingVuln.retester && (
                    <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                      <Text type="secondary" size="small">复测人：</Text>
                      <div style={{ marginTop: '4px' }}><Text strong>{viewingVuln.retester.real_name}</Text></div>
                    </div>
                  )}
                </div>
              </div>

              {/* 处理时间线 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <Title heading={5} style={{ margin: 0, color: 'var(--semi-color-primary)' }}>处理时间线</Title>
                  {vulnTimeline.length > 2 && (
                    <Text type="tertiary" size="small">
                      拖动查看更多 →
                    </Text>
                  )}
                </div>
                <div style={{
                  padding: '16px 16px 8px 16px',
                  border: '1px solid var(--semi-color-border)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--semi-color-bg-0)',
                  width: '100%',
                  maxWidth: '468px',
                  minHeight: '160px', // 增加最小高度以适应更大的节点
                  overflow: 'visible'
                }}>
                  {timelineLoading ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <Spin />
                      <Text type="secondary" style={{ marginLeft: '8px' }}>加载时间线...</Text>
                    </div>
                  ) : vulnTimeline.length > 0 ? (
                    <div
                      className="timeline-container"
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start', // 改为顶部对齐，避免居中裁剪
                        gap: '16px',
                        overflowX: 'auto',
                        overflowY: 'visible',
                        padding: '4px 0 20px 0', // 调整内边距，底部留更多空间
                        scrollBehavior: 'smooth',
                        cursor: 'grab',
                        userSelect: 'none',
                        minHeight: '110px', // 减少最小高度
                        height: 'auto' // 自动高度
                      }}
                      onMouseDown={(e) => {
                        const container = e.currentTarget;
                        const startX = e.pageX - container.offsetLeft;
                        const scrollLeft = container.scrollLeft;

                        const handleMouseMove = (e: MouseEvent) => {
                          const x = e.pageX - container.offsetLeft;
                          const walk = (x - startX) * 2;
                          container.scrollLeft = scrollLeft - walk;
                          container.style.cursor = 'grabbing';
                        };

                        const handleMouseUp = () => {
                          container.style.cursor = 'grab';
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                        };

                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.cursor = 'grab';
                      }}
                    >
                      {vulnTimeline.map((timeline, index) => {
                        // 根据操作类型设置颜色和标签
                        const getTimelineStyle = (action: string) => {
                          switch (action) {
                            case 'created':
                              return { color: '#1890ff', label: '创建' };
                            case 'assigned':
                              return { color: '#fa8c16', label: '分配' };
                            case 'unassigned':
                              return { color: '#8c8c8c', label: '取消分配' };
                            case 'updated':
                              return { color: '#52c41a', label: '更新' };
                            case 'status_changed':
                              return { color: '#722ed1', label: '状态变更' };
                            case 'deleted':
                              return { color: '#ff4d4f', label: '删除' };
                            default:
                              return { color: '#8c8c8c', label: action };
                          }
                        };

                        const style = getTimelineStyle(timeline.action);

                        return (
                          <div key={timeline.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {/* 连接线 */}
                            {index > 0 && (
                              <div style={{
                                width: '24px',
                                height: '2px',
                                backgroundColor: '#d9d9d9',
                                flexShrink: 0
                              }} />
                            )}

                            {/* 时间线节点 */}
                            <div
                              className="timeline-node"
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                minWidth: '120px',
                                maxWidth: '140px',
                                padding: '10px 8px 12px 8px',
                                borderRadius: '8px',
                                backgroundColor: 'white',
                                border: `2px solid ${style.color}`,
                                boxShadow: '0 3px 8px rgba(0,0,0,0.12)',
                                position: 'relative',
                                flexShrink: 0,
                                minHeight: '100px',
                                overflow: 'visible'
                              }}
                            >
                              {/* 状态圆点 */}
                              <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: style.color,
                                marginBottom: '3px',
                                boxShadow: `0 0 0 2px rgba(${parseInt(style.color.slice(1, 3), 16)}, ${parseInt(style.color.slice(3, 5), 16)}, ${parseInt(style.color.slice(5, 7), 16)}, 0.2)`
                              }} />

                              {/* 操作标签 */}
                              <Text size="small" strong style={{
                                marginBottom: '4px',
                                color: style.color,
                                textAlign: 'center',
                                lineHeight: '1.1',
                                fontSize: '12px',
                                display: 'block',
                                fontWeight: '600'
                              }}>
                                {style.label}
                              </Text>

                              {/* 操作描述 */}
                              {timeline.description && (
                                <Text size="small" type="secondary" style={{
                                  textAlign: 'center',
                                  lineHeight: '1.2',
                                  fontSize: '10px',
                                  display: 'block',
                                  marginBottom: '4px',
                                  maxWidth: '130px',
                                  wordBreak: 'break-word',
                                  whiteSpace: 'normal',
                                  padding: '2px 4px',
                                  backgroundColor: 'rgba(0,0,0,0.02)',
                                  borderRadius: '4px',
                                  maxHeight: '32px',
                                  overflow: 'hidden'
                                }}>
                                  {timeline.description}
                                </Text>
                              )}

                              {/* 时间信息 */}
                              <div style={{ marginTop: 'auto', paddingTop: '4px' }}>
                                <Text size="small" type="tertiary" style={{
                                  textAlign: 'center',
                                  lineHeight: '1.1',
                                  marginBottom: '2px',
                                  fontSize: '10px',
                                  display: 'block'
                                }}>
                                  {new Date(timeline.created_at).toLocaleDateString('zh-CN', {
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </Text>
                                <Text size="small" type="tertiary" style={{
                                  textAlign: 'center',
                                  lineHeight: '1.1',
                                  fontSize: '9px',
                                  display: 'block',
                                  marginBottom: '2px'
                                }}>
                                  {new Date(timeline.created_at).toLocaleTimeString('zh-CN', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </Text>

                                {/* 操作人信息 */}
                                {timeline.user && (
                                  <Text size="small" type="secondary" style={{
                                    textAlign: 'center',
                                    fontSize: '9px',
                                    maxWidth: '130px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    display: 'block',
                                    backgroundColor: 'rgba(0,0,0,0.05)',
                                    padding: '1px 4px',
                                    borderRadius: '3px'
                                  }}>
                                    {timeline.user.real_name || timeline.user.username}
                                  </Text>
                                )}
                              </div>


                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <Text type="secondary">暂无时间线记录</Text>
                    </div>
                  )}
                </div>
              </div>

              {/* 左侧底部占位，确保时间线内容不会贴着底部 */}
              <div style={{ height: '24px' }} />
            </div>
            {/* 右侧：漏洞详情 */}
            <div style={{
              flex: 1,
              paddingLeft: '32px',
              overflowY: 'auto',
              maxHeight: '800px'
            }}>





              {/* 详细描述 */}
              {viewingVuln.description && (
                <div style={{ marginBottom: '24px' }}>
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

              {/* 修复建议 */}
              {viewingVuln.fix_suggestion && (
                <div style={{ marginBottom: '24px' }}>
                  <Title heading={5} style={{ marginBottom: '16px', color: 'var(--semi-color-primary)' }}>修复建议</Title>
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#f0f9ff',
                    borderRadius: '6px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    <Text>{viewingVuln.fix_suggestion}</Text>
                  </div>
                </div>
              )}

              {/* 忽略原因 */}
              {viewingVuln.ignore_reason && (
                <div style={{ marginBottom: '24px' }}>
                  <Title heading={5} style={{ marginBottom: '16px', color: 'var(--semi-color-primary)' }}>忽略原因</Title>
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#fef2f2',
                    borderRadius: '6px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    <Text>{viewingVuln.ignore_reason}</Text>
                  </div>
                </div>
              )}

              {/* 复测结果 */}
              {viewingVuln.retest_result && (
                <div style={{ marginBottom: '24px' }}>
                  <Title heading={5} style={{ marginBottom: '16px', color: 'var(--semi-color-primary)' }}>复测结果</Title>
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#f0fdf4',
                    borderRadius: '6px',
                    wordBreak: 'break-word'
                  }}>
                    <MarkdownViewer content={viewingVuln.retest_result} />
                  </div>
                </div>
              )}

              {/* 底部占位，确保内容不会贴着底部 */}
              <div style={{ height: '24px' }} />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title={retestTargetStatus === 'completed' ? '复测通过验证' : '复测不通过说明'}
        visible={retestModalVisible}
        onCancel={closeRetestEvidenceModal}
        footer={null}
        width={760}
        maskClosable={false}
      >
        <div>
          <Text type="secondary">
            请填写复测结论，支持文字说明与图片上传（Markdown 格式）。
          </Text>
          <div style={{ marginTop: '12px' }}>
            <MarkdownEditor
              value={retestEvidence}
              onChange={(value) => setRetestEvidence(value || '')}
              placeholder="例如：已验证关键路径，无未授权访问；可上传截图作为修复凭证。"
              height={260}
              autoFocus
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <Button onClick={closeRetestEvidenceModal}>取消</Button>
            <Button theme="solid" type="primary" onClick={handleSubmitRetestEvidence}>
              提交复测结果
            </Button>
          </div>
        </div>
      </Modal>

      {/* 资产创建/编辑弹窗 */}
      <Modal
        title={editingAsset ? '编辑资产' : '添加资产'}
        visible={assetModalVisible}
        onCancel={() => {
          setAssetModalVisible(false);
          setEditingAsset(null);
          setSelectedAssetType('');
          if (assetFormRef) {
            assetFormRef.reset();
          }
        }}
        footer={null}
        width={800}
        maskClosable={false}
      >
        <Form
          getFormApi={(api) => setAssetFormRef(api)}
          onSubmit={handleSaveAsset}
          onSubmitFail={(errors) => {
            console.error('资产表单验证失败:', errors);
            Toast.error('请检查表单输入');
          }}
          labelPosition="left"
          labelAlign="left"
          labelWidth={120}
        >
          <Form.Input
            field="name"
            label="资产名称"
            placeholder="请输入资产名称"
            rules={[{ required: true, message: '请输入资产名称' }]}
          />

          <Form.Select
            field="type"
            label="资产类型"
            placeholder="请选择资产类型"
            rules={[{ required: true, message: '请选择资产类型' }]}
            onChange={(value) => setSelectedAssetType(value as string)}
          >
            {ASSET_TYPES.map(type => (
              <Select.Option key={type.value} value={type.value}>
                {type.label}
              </Select.Option>
            ))}
          </Form.Select>

          {/* 自定义类型输入框 */}
          {selectedAssetType === 'custom' && (
            <Form.Input
              field="customType"
              label="自定义类型"
              placeholder="请输入自定义资产类型名称"
              rules={[
                { required: true, message: '请输入自定义资产类型名称' },
                { max: 50, message: '类型名称不能超过50个字符' }
              ]}
            />
          )}

          <Form.Input
            field="domain"
            label="域名"
            placeholder="请输入域名（可选，必须加http或https）"
          />

          <Form.Input
            field="ip"
            label="IP地址"
            placeholder="请输入IP地址"
            rules={[{ required: true, message: '请输入IP地址' }]}
          />

          <Form.Input
            field="port"
            label="端口"
            placeholder="请输入端口"
            rules={[{ required: true, message: '请输入端口' }]}
          />

          <Form.Select
            field="os"
            label="操作系统"
            placeholder="请选择操作系统"
          >
            {OS_TYPES.map(os => (
              <Select.Option key={os} value={os}>
                {os}
              </Select.Option>
            ))}
          </Form.Select>

          <Form.Input
            field="owner"
            label="资产负责人"
            placeholder="请输入资产负责人名字"
            rules={[{ required: true, message: '请输入资产负责人名字' }]}
          />

          <Form.Select
            field="environment"
            label="所属环境"
            placeholder="请选择所属环境"
            rules={[{ required: true, message: '请选择所属环境' }]}
          >
            {ENVIRONMENT_TYPES.map(env => (
              <Select.Option key={env.value} value={env.value}>
                {env.label}
              </Select.Option>
            ))}
          </Form.Select>

          <Form.Input
            field="department"
            label="所属部门"
            placeholder="请输入资产所属部门"
          />

          <Form.Select
            field="importance"
            label="资产重要性"
            placeholder="请选择资产重要性"
            rules={[{ required: true, message: '请选择资产重要性' }]}
          >
            {ASSET_IMPORTANCE_LEVELS.map(level => (
              <Select.Option key={level.value} value={level.value}>
                {level.label}
              </Select.Option>
            ))}
          </Form.Select>

          <Form.Input
            field="tags"
            label="资产标签"
            placeholder="请输入资产标签，用逗号分隔"
          />

          <Form.TextArea
            field="description"
            label="资产描述"
            placeholder="请输入资产描述"
            autosize={{ minRows: 2, maxRows: 4 }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <Button onClick={() => {
              setAssetModalVisible(false);
              setSelectedAssetType('');
            }}>
              取消
            </Button>
            <Button theme="solid" type="primary" htmlType="submit">
              {editingAsset ? '更新' : '创建'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* 批量导入弹窗 */}
      <Modal
        title="批量导入资产"
        visible={importModalVisible}
        onCancel={() => {
          setImportModalVisible(false);
          setUploadFile(null);
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button onClick={handleDownloadTemplate}>
              下载模板
            </Button>
            <Space>
              <Button onClick={() => setImportModalVisible(false)}>
                取消
              </Button>
              <Button
                theme="solid"
                type="primary"
                onClick={handleConfirmImport}
                loading={importing}
                disabled={!uploadFile}
              >
                {importing ? '导入中...' : (uploadFile ? '开始导入' : '请先选择文件')}
              </Button>
            </Space>
          </div>
        }
        width={600}
        maskClosable={false}
      >
        <div style={{ marginBottom: '20px' }}>
          <Typography.Title heading={6}>上传Excel文件</Typography.Title>
          <div style={{
            border: '2px dashed #d1d5db',
            borderRadius: '8px',
            padding: '20px',
            textAlign: 'center',
            backgroundColor: uploadFile ? '#f0f9ff' : '#fafafa',
            borderColor: uploadFile ? '#3b82f6' : '#d1d5db'
          }}>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const file = e.target.files?.[0];
                console.log('原生input选择的文件:', file); // 调试日志
                if (file) {
                  console.log('文件详情:', {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    isFile: file instanceof File
                  });
                  setUploadFile(file);
                } else {
                  setUploadFile(null);
                }
              }}
              style={{ display: 'none' }}
              id="excel-file-input"
            />
            <label htmlFor="excel-file-input" style={{ cursor: 'pointer' }}>
              <div>
                <IconUpload size="large" style={{ color: uploadFile ? '#3b82f6' : '#6b7280' }} />
                <div style={{ marginTop: '8px' }}>
                  <Button theme="light" icon={<IconUpload />}>
                    选择Excel文件
                  </Button>
                </div>
                <Typography.Text type="tertiary" size="small" style={{ marginTop: '8px', display: 'block' }}>
                  支持.xlsx和.xls格式，文件大小不超过10MB
                </Typography.Text>
              </div>
            </label>
          </div>

          {uploadFile && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              background: '#f0f9ff',
              borderRadius: '6px',
              border: '1px solid #bae6fd',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <Typography.Text size="small" style={{ color: '#0369a1', fontWeight: 'bold' }}>
                  ✓ 已选择文件: {uploadFile.name}
                </Typography.Text>
                <Typography.Text type="tertiary" size="small" style={{ marginLeft: '8px' }}>
                  ({(uploadFile.size / 1024).toFixed(1)} KB)
                </Typography.Text>
              </div>
              <Button
                size="small"
                theme="borderless"
                type="danger"
                onClick={() => {
                  setUploadFile(null);
                  // 重置input的值
                  const input = document.getElementById('excel-file-input') as HTMLInputElement;
                  if (input) input.value = '';
                }}
              >
                移除
              </Button>
            </div>
          )}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <Typography.Title heading={6}>导入说明</Typography.Title>
          <div style={{
            background: '#f8f9fa',
            padding: '16px',
            borderRadius: '6px',
            border: '1px solid #e9ecef'
          }}>
            <List
              size="small"
              dataSource={[
                '请先下载Excel模板，在模板基础上填写资产数据',
                '必填字段：资产名称、资产类型、IP地址、端口',
                '资产类型：server（服务器）、network_device（网络设备）、database（数据库）、storage_device（存储设备）、custom（自定义类型）',
                '环境类型：production（生产）、testing（测试）、development（开发）等',
                '重要性：extremely_high（极高）、high（高）、medium（中）、low（低）',
                '同一项目中资产名称不能重复',
                '导入过程中如有错误，系统会显示详细的错误信息'
              ]}
              renderItem={(item) => (
                <List.Item style={{ padding: '4px 0' }}>
                  <Typography.Text size="small">• {item}</Typography.Text>
                </List.Item>
              )}
            />
          </div>
        </div>
      </Modal>

      {/* 状态变更弹窗（研发工程师专用） */}
      <Modal
        title="漏洞状态变更"
        visible={statusChangeModalVisible}
        onCancel={() => {
          setStatusChangeModalVisible(false);
          setChangingVuln(null);
          setSelectedStatus('');
          if (statusChangeFormRef) {
            statusChangeFormRef.reset();
          }
        }}
        footer={null}
        width={600}
        maskClosable={false}
      >
        {changingVuln && (
          <div>
            {/* 漏洞基本信息展示 */}
            <div style={{
              marginBottom: '24px',
              padding: '16px',
              backgroundColor: '#fafafa',
              borderRadius: '8px'
            }}>
              <Title heading={6} style={{ marginBottom: '12px' }}>漏洞信息</Title>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <Text type="secondary" size="small">漏洞标题：</Text>
                  <div><Text strong>{changingVuln.title}</Text></div>
                </div>
                <div>
                  <Text type="secondary" size="small">漏洞类型：</Text>
                  <div><Text>{changingVuln.vuln_type}</Text></div>
                </div>
                <div>
                  <Text type="secondary" size="small">漏洞等级：</Text>
                  <div>
                    <Tag color={getSeverityColor(changingVuln.severity)}>
                      {VULN_SEVERITIES.find(s => s.value === changingVuln.severity)?.label || changingVuln.severity}
                    </Tag>
                  </div>
                </div>
                <div>
                  <Text type="secondary" size="small">所属资产：</Text>
                  <div><Text>{changingVuln.asset ? `${changingVuln.asset.name} (${changingVuln.asset.ip})` : '未知'}</Text></div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Text type="secondary" size="small">漏洞提交人：</Text>
                  <div><Text>{changingVuln.reporter ? changingVuln.reporter.real_name : '未知'}</Text></div>
                </div>
              </div>
            </div>

            {/* 当前驳回信息（如果存在） */}
            {changingVuln.status === 'rejected' && changingVuln.reject_reason && (
              <div style={{
                marginBottom: '24px',
                padding: '16px',
                backgroundColor: '#fff2f0',
                border: '1px solid #ffccc7',
                borderRadius: '8px'
              }}>
                <Title heading={6} style={{ marginBottom: '12px', color: '#cf1322' }}>当前驳回信息</Title>
                <div style={{ marginBottom: '8px' }}>
                  <Text type="secondary">驳回人：</Text>
                  <Text strong>{changingVuln.rejector ? changingVuln.rejector.real_name : '未知'}</Text>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <Text type="secondary">驳回时间：</Text>
                  <Text>{changingVuln.rejected_at ? new Date(changingVuln.rejected_at).toLocaleString() : '未知'}</Text>
                </div>
                <div>
                  <Text type="secondary">驳回原因：</Text>
                  <div style={{
                    marginTop: '8px',
                    padding: '12px',
                    backgroundColor: 'white',
                    border: '1px solid #f0f0f0',
                    borderRadius: '6px',
                    whiteSpace: 'pre-wrap'
                  }}>
                    <Text>{changingVuln.reject_reason}</Text>
                  </div>
                </div>
              </div>
            )}

            {/* 状态变更表单 */}
            <Form
              getFormApi={(api) => setStatusChangeFormRef(api)}
              onSubmit={handleSaveStatusChange}
              onSubmitFail={(errors) => {
                console.error('状态变更表单验证失败:', errors);
                Toast.error('请检查表单输入');
              }}
              labelPosition="left"
              labelAlign="left"
              labelWidth={100}
            >
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <span style={{ color: '#f56565', marginRight: '4px' }}>*</span>
                  变更状态
                </div>

                {/* 状态选择 */}
                <div style={{
                  padding: '16px',
                  border: '1px solid var(--semi-color-border)',
                  borderRadius: '8px',
                  backgroundColor: 'var(--semi-color-bg-0)'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px'
                  }}>
                    {[
                      {
                        value: 'unfixed',
                        label: '未修复',
                        color: '#ff4d4f',
                        description: '漏洞尚未开始修复',
                        time: changingVuln.submitted_at,
                        timeLabel: '提交时间'
                      },
                      {
                        value: 'fixing',
                        label: '修复中',
                        color: '#fa8c16',
                        description: '正在修复漏洞',
                        time: changingVuln.fix_started_at,
                        timeLabel: '开始修复'
                      },
                      {
                        value: 'fixed',
                        label: '已修复',
                        color: '#52c41a',
                        description: '漏洞已修复完成，等待复测',
                        time: changingVuln.fixed_at,
                        timeLabel: '修复完成'
                      },
                      {
                        value: 'rejected',
                        label: '驳回',
                        color: '#722ed1',
                        description: '驳回此漏洞',
                        time: changingVuln.rejected_at,
                        timeLabel: '驳回时间'
                      }
                    ].map((status) => {
                      const isCompleted = getStatusOrder(changingVuln.status) >= getStatusOrder(status.value);
                      const isSelected = selectedStatus === status.value;
                      const isCurrentStatus = changingVuln.status === status.value;

                      return (
                        <div
                          key={status.value}
                          style={{
                            padding: '12px',
                            border: `2px solid ${isSelected ? 'var(--semi-color-primary)' :
                                                isCurrentStatus ? '#faad14' :
                                                'var(--semi-color-border)'}`,
                            borderRadius: '8px',
                            backgroundColor: isSelected ? 'var(--semi-color-primary-light-default)' :
                                           isCurrentStatus ? 'var(--semi-color-warning-light-default)' :
                                           'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            position: 'relative'
                          }}
                          onClick={() => {
                            setSelectedStatus(status.value);
                            if (statusChangeFormRef) {
                              statusChangeFormRef.setValue('status', status.value);
                            }
                          }}
                        >
                          {/* 状态指示器 */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            marginBottom: '8px'
                          }}>
                            <div style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: isCompleted ? status.color : '#d9d9d9',
                              marginRight: '8px'
                            }} />
                            <Text strong style={{ fontSize: '14px' }}>
                              {status.label}
                            </Text>
                            {isCurrentStatus && (
                              <Tag color="orange" size="small" style={{ marginLeft: '8px' }}>
                                当前
                              </Tag>
                            )}
                            {isSelected && (
                              <Tag color="blue" size="small" style={{ marginLeft: '8px' }}>
                                已选择
                              </Tag>
                            )}
                          </div>

                          <Text size="small" type="secondary" style={{
                            display: 'block',
                            marginBottom: '6px',
                            lineHeight: '1.4'
                          }}>
                            {status.description}
                          </Text>

                          {status.time && (
                            <Text size="small" type="tertiary" style={{
                              fontSize: '11px',
                              lineHeight: '1.2'
                            }}>
                              {status.timeLabel}: {new Date(status.time).toLocaleDateString('zh-CN', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </Text>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Form.Input
                  field="status"
                  style={{ display: 'none' }}
                  rules={[{ required: true, message: '请选择新状态' }]}
                />
              </div>

              <Form.TextArea
                field="comment"
                label="批注"
                placeholder="请输入批注（驳回时必填）"
                autosize={{ minRows: 3, maxRows: 6 }}
                rules={[
                  {
                    validator: (rule, value, callback) => {
                      if (selectedStatus === 'rejected' && (!value || !value.trim())) {
                        callback('驳回漏洞时必须填写批注');
                        return false;
                      } else {
                        callback();
                        return true;
                      }
                    }
                  }
                ]}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <Button onClick={() => setStatusChangeModalVisible(false)}>
                  取消
                </Button>
                <Button theme="solid" type="primary" htmlType="submit">
                  确认变更
                </Button>
              </div>
            </Form>
          </div>
        )}
      </Modal>

    </div>
  );
}
