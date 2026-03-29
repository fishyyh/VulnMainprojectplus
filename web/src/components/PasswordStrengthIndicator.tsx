import React, { useEffect, useState } from 'react';
import { Progress, Typography, List } from '@douyinfe/semi-ui';
import { IconTick, IconClose } from '@douyinfe/semi-icons';
import { validatePassword, getPasswordPolicy, getPasswordStrengthColor, getPasswordStrengthText, clearPasswordPolicyCache, PASSWORD_POLICY_UPDATED_EVENT } from '@/utils/password';
import type { PasswordValidationResult } from '@/utils/password';

const { Text } = Typography;

interface PasswordStrengthIndicatorProps {
  password: string;
  onValidationChange?: (result: PasswordValidationResult) => void;
  showRequirements?: boolean;
  forceRefresh?: boolean; // 强制刷新密码策略
}

const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  onValidationChange,
  showRequirements = true,
  forceRefresh = false,
}) => {
  const [validationResult, setValidationResult] = useState<PasswordValidationResult>({
    isValid: false,
    errors: [],
    strength: 'weak',
    score: 0,
  });
  const [requirements, setRequirements] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRequirements = async () => {
      try {
        // 如果需要强制刷新，先清除缓存
        if (forceRefresh) {
          clearPasswordPolicyCache();
        }
        const { requirements: reqs } = await getPasswordPolicy(forceRefresh);
        setRequirements(reqs);
      } catch (error) {
        console.error('加载密码要求失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRequirements();

    // 监听密码策略更新事件
    const handlePolicyUpdate = () => {
      setLoading(true);
      loadRequirements();
    };

    window.addEventListener(PASSWORD_POLICY_UPDATED_EVENT, handlePolicyUpdate);

    return () => {
      window.removeEventListener(PASSWORD_POLICY_UPDATED_EVENT, handlePolicyUpdate);
    };
  }, [forceRefresh]);

  useEffect(() => {
    const validatePasswordAsync = async () => {
      if (!password) {
        const emptyResult: PasswordValidationResult = {
          isValid: false,
          errors: [],
          strength: 'weak',
          score: 0,
        };
        setValidationResult(emptyResult);
        onValidationChange?.(emptyResult);
        return;
      }

      try {
        const result = await validatePassword(password);
        setValidationResult(result);
                        // Defer the callback to the next event loop cycle to avoid state updates during render
        if (onValidationChange) {
          setTimeout(() => onValidationChange(result), 0);
        }
      } catch (error) {
        console.error('密码验证失败:', error);
      }
    };

    validatePasswordAsync();
  }, [password, onValidationChange]);

  if (loading) {
    return <div>加载中...</div>;
  }

  if (!password) {
    return showRequirements ? (
      <div style={{ marginTop: '8px' }}>
        <Text type="secondary" size="small">
          密码要求：
        </Text>
        <List
          size="small"
          dataSource={requirements}
          renderItem={(item) => (
            <List.Item style={{ padding: '2px 0' }}>
              <Text type="secondary" size="small">• {item}</Text>
            </List.Item>
          )}
        />
      </div>
    ) : null;
  }

  const strengthColor = getPasswordStrengthColor(validationResult.strength);
  const strengthText = getPasswordStrengthText(validationResult.strength);

  return (
    <div style={{ marginTop: '8px' }}>
      {/* 密码强度指示器 */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
          <Text size="small" style={{ marginRight: '8px' }}>
            密码强度：
          </Text>
          <Text 
            size="small" 
            style={{ 
              color: strengthColor, 
              fontWeight: 'bold' 
            }}
          >
            {strengthText}
          </Text>
          <Text 
            size="small" 
            type="secondary" 
            style={{ marginLeft: '8px' }}
          >
            ({validationResult.score}/100)
          </Text>
        </div>
        <Progress
          percent={validationResult.score}
          stroke={strengthColor}
          showInfo={false}
          size="small"
          style={{ width: '100%' }}
        />
      </div>

      {/* 验证错误信息 */}
      {validationResult.errors.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          {validationResult.errors.map((error, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
              <IconClose style={{ color: '#ff4d4f', marginRight: '4px', fontSize: '12px' }} />
              <Text type="danger" size="small">{error}</Text>
            </div>
          ))}
        </div>
      )}

      {/* 密码要求检查列表 */}
      {showRequirements && (
        <div>
          <Text type="secondary" size="small" style={{ marginBottom: '4px', display: 'block' }}>
            密码要求检查：
          </Text>
          <List
            size="small"
            dataSource={requirements}
            renderItem={(requirement) => {
              // 检查每个要求是否满足
              const isMet = !validationResult.errors.some(error => 
                error.includes(requirement.split('(')[0].trim().replace('密码长度至少', '密码长度不能少于'))
              );
              
              return (
                <List.Item style={{ padding: '2px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {isMet ? (
                      <IconTick style={{ color: '#52c41a', marginRight: '4px', fontSize: '12px' }} />
                    ) : (
                      <IconClose style={{ color: '#ff4d4f', marginRight: '4px', fontSize: '12px' }} />
                    )}
                    <Text 
                      size="small" 
                      style={{ 
                        color: isMet ? '#52c41a' : '#ff4d4f',
                        textDecoration: isMet ? 'line-through' : 'none'
                      }}
                    >
                      {requirement}
                    </Text>
                  </div>
                </List.Item>
              );
            }}
          />
        </div>
      )}

      {/* 成功提示 */}
      {validationResult.isValid && (
        <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
          <IconTick style={{ color: '#52c41a', marginRight: '4px' }} />
          <Text type="success" size="small">密码符合安全要求</Text>
        </div>
      )}
    </div>
  );
};

export default PasswordStrengthIndicator;
