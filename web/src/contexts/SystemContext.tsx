'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { systemApi, SystemInfo } from '@/lib/api';
import { onSystemInfoUpdated } from '@/utils/system';

interface SystemContextType {
  systemInfo: SystemInfo | null;
  refreshSystemInfo: () => Promise<void>;
  loading: boolean;
}

const SystemContext = createContext<SystemContextType | undefined>(undefined);

interface SystemProviderProps {
  children: ReactNode;
}

export function SystemProvider({ children }: SystemProviderProps) {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSystemInfo = async () => {
    try {
      const response = await systemApi.getPublicInfo();
      if (response.code === 200 && response.data) {
        setSystemInfo(response.data);
        // 更新页面标题
        const title = `${response.data.system_name} - ${response.data.system_title}`;
        document.title = title;
      }
    } catch (error) {
      console.error('获取系统信息失败:', error);
      // 设置默认值
      const defaultInfo: SystemInfo = {
        system_name: 'VulnMain',
        system_title: '漏洞管理平台',
        company_name: '漏洞管理平台',
        logo: '',
        version: '1.0.0'
      };
      setSystemInfo(defaultInfo);
      document.title = 'VulnMain - 漏洞管理平台';
    } finally {
      setLoading(false);
    }
  };

  const refreshSystemInfo = async () => {
    setLoading(true);
    await fetchSystemInfo();
  };

  useEffect(() => {
    fetchSystemInfo();
  }, []);

  // 监听自定义事件来刷新系统信息
  useEffect(() => {
    const cleanup = onSystemInfoUpdated(() => {
      refreshSystemInfo();
    });

    return cleanup;
  }, []);

  return (
    <SystemContext.Provider value={{ systemInfo, refreshSystemInfo, loading }}>
      {children}
    </SystemContext.Provider>
  );
}

export function useSystem() {
  const context = useContext(SystemContext);
  if (context === undefined) {
    throw new Error('useSystem must be used within a SystemProvider');
  }
  return context;
}
