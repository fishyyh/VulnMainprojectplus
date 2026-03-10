/**
 * 系统信息相关工具函数
 */

/**
 * 通知系统信息已更新
 * 触发全局事件，让所有监听的组件刷新系统信息
 */
export function notifySystemInfoUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('systemInfoUpdated'));
  }
}

/**
 * 监听系统信息更新事件
 * @param callback 回调函数
 * @returns 清理函数
 */
export function onSystemInfoUpdated(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleUpdate = () => {
    callback();
  };

  window.addEventListener('systemInfoUpdated', handleUpdate);
  
  return () => {
    window.removeEventListener('systemInfoUpdated', handleUpdate);
  };
}
