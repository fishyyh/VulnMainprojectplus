'use client';

import { useEffect, useState } from 'react';
import { authUtils } from '@/lib/api';

export default function HomePage() {
  const [loadingText, setLoadingText] = useState('正在初始化');

  useEffect(() => {
    // 模拟加载过程的文本变化
    const textStages = [
      '正在初始化...',
      '检查登录状态...',
      '加载用户信息...',
      '准备跳转...'
    ];
    
    let currentStage = 0;
    const textInterval = setInterval(() => {
      setLoadingText(textStages[currentStage]);
      currentStage = (currentStage + 1) % textStages.length;
    }, 800);

    // 检查是否已登录
    const checkAuth = setTimeout(() => {
      if (typeof window !== 'undefined') {
        if (authUtils.isLoggedIn()) {
          setLoadingText('跳转到仪表板...');
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 500);
        } else {
          setLoadingText('跳转到登录页面...');
          setTimeout(() => {
            window.location.href = '/login';
          }, 500);
        }
      }
    }, 1500);

    return () => {
      clearInterval(textInterval);
      clearTimeout(checkAuth);
    };
  }, []);

  // 显示加载状态
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* 背景装饰动画 */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '10%',
        width: '80px',
        height: '80px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '50%',
        animation: 'float 6s ease-in-out infinite'
      }} />
      <div style={{
        position: 'absolute',
        top: '70%',
        right: '15%',
        width: '60px',
        height: '60px',
        background: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '50%',
        animation: 'float 8s ease-in-out infinite reverse'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '20%',
        left: '20%',
        width: '40px',
        height: '40px',
        background: 'rgba(255, 255, 255, 0.06)',
        borderRadius: '50%',
        animation: 'float 4s ease-in-out infinite'
      }} />

      {/* 主加载内容 */}
      <div style={{
        textAlign: 'center',
        position: 'relative',
        zIndex: 10
      }}>
        {/* 外圈旋转环 */}
        <div style={{
          position: 'relative',
          width: '120px',
          height: '120px',
          margin: '0 auto 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* 外环 */}
          <div style={{
            position: 'absolute',
            width: '120px',
            height: '120px',
            border: '3px solid rgba(255, 255, 255, 0.2)',
            borderTop: '3px solid #ffffff',
            borderRadius: '50%',
            animation: 'spin 2s linear infinite'
          }} />
          
          {/* 中环 */}
          <div style={{
            position: 'absolute',
            width: '90px',
            height: '90px',
            border: '2px solid rgba(255, 255, 255, 0.1)',
            borderRight: '2px solid rgba(255, 255, 255, 0.8)',
            borderRadius: '50%',
            animation: 'spin 1.5s linear infinite reverse'
          }} />
          
          {/* 内环 */}
          <div style={{
            position: 'absolute',
            width: '60px',
            height: '60px',
            border: '2px solid rgba(255, 255, 255, 0.1)',
            borderBottom: '2px solid rgba(255, 255, 255, 0.6)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />

          {/* 中心图标 */}
          <div style={{
            width: '32px',
            height: '32px',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
            animation: 'pulse 2s ease-in-out infinite'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: 'white' }}>
              <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z" fill="currentColor"/>
            </svg>
          </div>
        </div>

        {/* 加载文本 */}
        <div style={{
          color: '#ffffff',
          fontSize: '18px',
          fontWeight: '600',
          marginBottom: '12px',
          animation: 'fadeInOut 2s ease-in-out infinite'
        }}>
          {loadingText}
        </div>

        {/* 副标题 */}
        <div style={{
          color: 'rgba(255, 255, 255, 0.8)',
          fontSize: '14px',
          fontWeight: '400',
          letterSpacing: '1px'
        }}>
          VulnMain 漏洞管理平台
        </div>

        {/* 进度条 */}
        <div style={{
          width: '200px',
          height: '2px',
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: '1px',
          margin: '24px auto 0',
          overflow: 'hidden'
        }}>
          <div style={{
            width: '60px',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent)',
            animation: 'loading 2s ease-in-out infinite'
          }} />
        </div>
      </div>

      {/* CSS 动画样式 */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { 
            transform: scale(1);
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
          }
          50% { 
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
          }
        }

        @keyframes fadeInOut {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }

        @keyframes loading {
          0% { transform: translateX(-100px); }
          100% { transform: translateX(300px); }
        }

        @keyframes float {
          0%, 100% { 
            transform: translateY(0px) rotate(0deg);
            opacity: 0.5;
          }
          50% { 
            transform: translateY(-20px) rotate(180deg);
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
}
