'use client';

import React, { useEffect } from 'react';
import { Modal, Button, Title, Text, Tag } from '@douyinfe/semi-ui';
import MarkdownViewer from './MarkdownViewer';

interface VulnDetailModalProps {
  visible: boolean;
  onCancel: () => void;
  vuln: any;
}

export default function VulnDetailModal({ visible, onCancel, vuln }: VulnDetailModalProps) {
  if (!vuln) return null;

  // 控制页面滚动
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [visible]);

  const handleCancel = () => {
    document.body.style.overflow = 'auto';
    onCancel();
  };

  return (
    <Modal
      title="漏洞详情"
      visible={visible}
      onCancel={handleCancel}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={handleCancel}>关闭</Button>
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
            <Title heading={5} style={{ marginBottom: '16px', color: 'var(--semi-color-primary)' }}>
              基础信息
            </Title>

            {/* 漏洞标题 - 单独一行 */}
            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
              <Text type="secondary" size="small">漏洞标题：</Text>
              <div style={{ marginTop: '4px' }}><Text strong style={{ fontSize: '16px' }}>{vuln.title}</Text></div>
            </div>

            {/* 基础属性 - 两列布局 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                <Text type="secondary" size="small">漏洞类型：</Text>
                <div style={{ marginTop: '4px' }}><Text strong>{vuln.vuln_type}</Text></div>
              </div>
              <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                <Text type="secondary" size="small">严重程度：</Text>
                <div style={{ marginTop: '6px' }}>
                  <Tag color="red" size="large">{vuln.severity}</Tag>
                </div>
              </div>
              {vuln.cve_id && (
                <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                  <Text type="secondary" size="small">CVE编号：</Text>
                  <div style={{ marginTop: '4px' }}><Text strong>{vuln.cve_id}</Text></div>
                </div>
              )}
            </div>

            {/* 状态和期限 - 一行两列布局 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                <Text type="secondary" size="small">当前状态：</Text>
                <div style={{ marginTop: '6px' }}>
                  <Tag color="blue" size="large">{vuln.status}</Tag>
                </div>
              </div>
              <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                <Text type="secondary" size="small">修复期限：</Text>
                <div style={{ marginTop: '6px' }}>
                  <Text strong style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1890ff',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(24, 144, 255, 0.1)',
                  }}>
                    2024-12-31
                  </Text>
                  <Text type="secondary" size="small" style={{ marginLeft: '8px' }}>30天后</Text>
                </div>
              </div>
            </div>

            {/* 可选信息 */}
            {vuln.vuln_url && (
              <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                <Text type="secondary" size="small">漏洞地址：</Text>
                <div style={{ marginTop: '4px' }}><Text>{vuln.vuln_url}</Text></div>
              </div>
            )}
          </div>

          {/* 关联信息 */}
          <div style={{ marginBottom: '24px' }}>
            <Title heading={5} style={{ marginBottom: '16px', color: 'var(--semi-color-primary)' }}>
              关联信息
            </Title>

            {/* 项目信息 */}
            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
              <Text type="secondary" size="small">所属项目：</Text>
              <div style={{ marginTop: '4px' }}><Text strong>{vuln.project?.name || '未知'}</Text></div>
            </div>

            {/* 人员信息 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                <Text type="secondary" size="small">提交人：</Text>
                <div style={{ marginTop: '4px' }}><Text strong>{vuln.reporter?.real_name || '未知'}</Text></div>
              </div>
              <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                <Text type="secondary" size="small">指派人：</Text>
                <div style={{ marginTop: '4px' }}><Text strong>{vuln.assignee?.real_name || '未指派'}</Text></div>
              </div>
            </div>
          </div>

          {/* 处理时间线 */}
          <div>
            <Title heading={5} style={{ marginBottom: '16px', color: 'var(--semi-color-primary)' }}>
              处理时间线
            </Title>
            <div style={{
              padding: '16px 16px 8px 16px',
              border: '1px solid var(--semi-color-border)',
              borderRadius: '6px',
              backgroundColor: 'var(--semi-color-bg-0)',
              width: '100%',
              maxWidth: '468px',
              minHeight: '140px',
              overflow: 'visible'
            }}>
              {/* 演示时间线数据 */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                overflowX: 'auto',
                overflowY: 'visible',
                padding: '4px 0 20px 0',
                scrollBehavior: 'smooth',
                minHeight: '110px',
                height: 'auto'
              }}>
                {/* 创建节点 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minWidth: '85px',
                    maxWidth: '100px',
                    padding: '8px 4px 10px 4px',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    border: '2px solid #1890ff',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    position: 'relative',
                    flexShrink: 0,
                    height: 'auto',
                    overflow: 'visible'
                  }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#1890ff',
                      marginBottom: '3px',
                      boxShadow: '0 0 0 2px rgba(24, 144, 255, 0.2)'
                    }} />
                    <Text size="small" strong style={{ marginBottom: '1px', color: '#1890ff', textAlign: 'center', fontSize: '11px', display: 'block' }}>
                      创建
                    </Text>
                    <Text size="small" type="tertiary" style={{ textAlign: 'center', fontSize: '9px', marginBottom: '1px', display: 'block' }}>
                      12-01
                    </Text>
                    <Text size="small" type="tertiary" style={{ textAlign: 'center', fontSize: '8px', display: 'block', marginBottom: '1px' }}>
                      09:30
                    </Text>
                    <Text size="small" type="secondary" style={{ textAlign: 'center', fontSize: '8px', marginTop: '1px', display: 'block' }}>
                      张三
                    </Text>
                  </div>

                  {/* 连接线 */}
                  <div style={{ width: '24px', height: '2px', backgroundColor: '#d9d9d9', flexShrink: 0 }} />

                  {/* 分配节点 */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minWidth: '85px',
                    maxWidth: '100px',
                    padding: '8px 4px 10px 4px',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    border: '2px solid #fa8c16',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    position: 'relative',
                    flexShrink: 0,
                    height: 'auto',
                    overflow: 'visible'
                  }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#fa8c16',
                      marginBottom: '3px',
                      boxShadow: '0 0 0 2px rgba(250, 140, 22, 0.2)'
                    }} />
                    <Text size="small" strong style={{ marginBottom: '1px', color: '#fa8c16', textAlign: 'center', fontSize: '11px', display: 'block' }}>
                      分配
                    </Text>
                    <Text size="small" type="tertiary" style={{ textAlign: 'center', fontSize: '9px', marginBottom: '1px', display: 'block' }}>
                      12-01
                    </Text>
                    <Text size="small" type="tertiary" style={{ textAlign: 'center', fontSize: '8px', display: 'block', marginBottom: '1px' }}>
                      10:15
                    </Text>
                    <Text size="small" type="secondary" style={{ textAlign: 'center', fontSize: '8px', marginTop: '1px', display: 'block' }}>
                      李四
                    </Text>
                  </div>

                  {/* 连接线 */}
                  <div style={{ width: '24px', height: '2px', backgroundColor: '#d9d9d9', flexShrink: 0 }} />

                  {/* 状态变更节点 */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minWidth: '85px',
                    maxWidth: '100px',
                    padding: '8px 4px 10px 4px',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    border: '2px solid #52c41a',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    position: 'relative',
                    flexShrink: 0,
                    height: 'auto',
                    overflow: 'visible'
                  }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#52c41a',
                      marginBottom: '3px',
                      boxShadow: '0 0 0 2px rgba(82, 196, 26, 0.2)'
                    }} />
                    <Text size="small" strong style={{ marginBottom: '1px', color: '#52c41a', textAlign: 'center', fontSize: '11px', display: 'block' }}>
                      修复中
                    </Text>
                    <Text size="small" type="tertiary" style={{ textAlign: 'center', fontSize: '9px', marginBottom: '1px', display: 'block' }}>
                      12-02
                    </Text>
                    <Text size="small" type="tertiary" style={{ textAlign: 'center', fontSize: '8px', display: 'block', marginBottom: '1px' }}>
                      14:20
                    </Text>
                    <Text size="small" type="secondary" style={{ textAlign: 'center', fontSize: '8px', marginTop: '1px', display: 'block' }}>
                      王五
                    </Text>
                  </div>
                </div>
              </div>
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
          {vuln.description && (
            <div style={{ marginBottom: '24px' }}>
              <Title heading={5} style={{ marginBottom: '16px', color: 'var(--semi-color-primary)' }}>
                漏洞详情
              </Title>
              <div style={{ 
                padding: '16px', 
                backgroundColor: '#f8f9fa', 
                borderRadius: '6px',
                border: '1px solid #e9ecef',
              }}>
                <MarkdownViewer content={vuln.description} />
              </div>
            </div>
          )}

          {/* 修复建议 */}
          {vuln.fix_suggestion && (
            <div style={{ marginBottom: '24px' }}>
              <Title heading={5} style={{ marginBottom: '16px', color: 'var(--semi-color-primary)' }}>
                修复建议
              </Title>
              <div style={{ 
                padding: '16px', 
                backgroundColor: '#f0f9ff', 
                borderRadius: '6px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                <Text>{vuln.fix_suggestion}</Text>
              </div>
            </div>
          )}

          {/* 忽略原因 */}
          {vuln.ignore_reason && (
            <div style={{ marginBottom: '24px' }}>
              <Title heading={5} style={{ marginBottom: '16px', color: 'var(--semi-color-primary)' }}>
                忽略原因
              </Title>
              <div style={{ 
                padding: '16px', 
                backgroundColor: '#fef2f2', 
                borderRadius: '6px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                <Text>{vuln.ignore_reason}</Text>
              </div>
            </div>
          )}

          {/* 复测结果 */}
          {vuln.retest_result && (
            <div style={{ marginBottom: '24px' }}>
              <Title heading={5} style={{ marginBottom: '16px', color: 'var(--semi-color-primary)' }}>
                复测结果
              </Title>
              <div style={{
                padding: '16px',
                backgroundColor: '#f0fdf4',
                borderRadius: '6px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                <Text>{vuln.retest_result}</Text>
              </div>
            </div>
          )}

          {/* 右侧底部占位，确保内容不会贴着底部 */}
          <div style={{ height: '24px' }} />
        </div>
      </div>
    </Modal>
  );
}
