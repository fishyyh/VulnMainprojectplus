'use client';

import { Nav, Button, Modal } from '@douyinfe/semi-ui';
import {
  IconHome,
  IconFolderOpen,
  IconUserGroup,
  IconSetting,
  IconExit
} from '@douyinfe/semi-icons';
import { useEffect, useState } from 'react';
import { authUtils } from '@/lib/api';

interface User {
  id: number;
  username: string;
  email: string;
  real_name: string;
  phone: string;
  department: string;
  status: number;
  last_login_at: string;
  role_id: number;
}

interface SidebarProps {
  selectedKey?: string;
  onSelect?: (data: any) => void;
}

export default function Sidebar({ selectedKey = 'home', onSelect }: SidebarProps) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // 从 localStorage 获取用户信息
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

  // 根据用户角色获取导航项
  const getNavigationItems = () => {
    const baseItems = [
      {
        itemKey: 'home',
        text: '首页',
        icon: <IconHome />
      },
      {
        itemKey: 'projects',
        text: '项目管理',
        icon: <IconFolderOpen />
      },
      {
        itemKey: 'teams',
        text: '团队管理',
        icon: <IconUserGroup />
      }
    ];

    // 超级管理员(role_id=1)显示所有选项
    if (user?.role_id === 1) {
      return [
        ...baseItems,
        {
          itemKey: 'users',
          text: '用户管理',
          icon: <IconUserGroup />
        },
        {
          itemKey: 'settings',
          text: '系统设置',
          icon: <IconSetting />
        }
      ];
    }

    // 其他角色只显示首页和项目管理
    return baseItems;
  };

  const handleSelect = (data: any) => {
    if (onSelect) {
      onSelect(data);
    }
  };

  return (
    <div style={{ 
      width: '240px', 
      height: '100vh', 
      borderRight: '1px solid var(--semi-color-border)' 
    }}>
      {/* 导航菜单 */}
      <Nav
        selectedKeys={[selectedKey]}
        onSelect={handleSelect}
        items={getNavigationItems()}
        style={{ 
          maxWidth: '100%',
          height: 'calc(100vh - 80px)',
          paddingTop: '24px'
        }}
        renderWrapper={({ itemElement, isSubNav, isInSubNav, props }) => {
          return (
            <div style={{ padding: '0 12px' }}>
              {itemElement}
            </div>
          );
        }}
      />

      {/* 底部版权信息 */}
      <div style={{
        position: 'absolute',
        bottom: '0',
        left: '0',
        right: '0',
        width: '240px',
        padding: '16px',
        borderTop: '1px solid var(--semi-color-border)',
        backgroundColor: 'var(--semi-color-bg-1)'
      }}>
        {/* 版权信息 */}
        <div style={{ 
          fontSize: '12px', 
          color: 'var(--semi-color-text-2)',
          textAlign: 'center'
        }}>
          © {new Date().getFullYear()} VulnMain
        </div>
      </div>
    </div>
  );
}

// 获取角色显示名称
function getRoleDisplayName(roleId: number): string {
  switch (roleId) {
    case 1:
      return '超级管理员';
    case 2:
      return '安全工程师';
    case 3:
      return '研发工程师';
    case 4:
      return '普通用户';
    default:
      return '未知角色';
  }
} 