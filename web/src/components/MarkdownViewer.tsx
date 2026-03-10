'use client';

import React, { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Modal, Button } from '@douyinfe/semi-ui';
import { IconClose, IconChevronLeft, IconChevronRight } from '@douyinfe/semi-icons';
import { resolveImageUrl } from '@/lib/api';

interface MarkdownViewerProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function MarkdownViewer({ content, className, style }: MarkdownViewerProps) {
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string }>({ src: '', alt: '' });
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // 提取所有图片URL
  const imageUrls = useMemo(() => {
    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const images: { src: string; alt: string }[] = [];
    let match;

    while ((match = imgRegex.exec(content)) !== null) {
      const alt = match[1] || '';
      const src = match[2];
      images.push({ src: resolveImageUrl(src), alt });
    }

    return images;
  }, [content]);

  // 处理图片点击
  const handleImageClick = (src: string, alt: string) => {
    const resolvedSrc = resolveImageUrl(src);
    const imageIndex = imageUrls.findIndex(img => img.src === resolvedSrc);
    setCurrentImageIndex(imageIndex >= 0 ? imageIndex : 0);
    setSelectedImage({ src: resolvedSrc, alt });
    setImageModalVisible(true);
  };

  // 上一张图片
  const handlePrevImage = () => {
    if (imageUrls.length > 1) {
      const prevIndex = currentImageIndex > 0 ? currentImageIndex - 1 : imageUrls.length - 1;
      setCurrentImageIndex(prevIndex);
      setSelectedImage(imageUrls[prevIndex]);
    }
  };

  // 下一张图片
  const handleNextImage = () => {
    if (imageUrls.length > 1) {
      const nextIndex = currentImageIndex < imageUrls.length - 1 ? currentImageIndex + 1 : 0;
      setCurrentImageIndex(nextIndex);
      setSelectedImage(imageUrls[nextIndex]);
    }
  };

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!imageModalVisible) return;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          handlePrevImage();
          break;
        case 'ArrowRight':
          event.preventDefault();
          handleNextImage();
          break;
        case 'Escape':
          event.preventDefault();
          setImageModalVisible(false);
          break;
      }
    };

    if (imageModalVisible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [imageModalVisible, currentImageIndex, imageUrls.length]);

  // 自定义图片渲染组件
  const ImageRenderer = ({ src, alt, ...props }: any) => {
    const resolvedSrc = resolveImageUrl(src || '');
    
    return (
      <img
        src={resolvedSrc}
        alt={alt}
        {...props}
        style={{
          maxWidth: '100%',
          height: 'auto',
          cursor: 'pointer',
          borderRadius: '4px',
          margin: '8px 0',
          transition: 'transform 0.2s ease',
        }}
        onClick={() => handleImageClick(src || '', alt || '')}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.02)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title="点击查看大图"
      />
    );
  };

  // 自定义代码块渲染
  const CodeRenderer = ({ children, className, ...props }: any) => {
    const isInline = !className;
    
    if (isInline) {
      return (
        <code
          style={{
            background: '#f6f8fa',
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '0.9em',
            color: '#d73a49',
          }}
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <pre
        style={{
          background: '#f6f8fa',
          padding: '16px',
          borderRadius: '6px',
          overflow: 'auto',
          fontSize: '0.9em',
          lineHeight: '1.45',
        }}
      >
        <code {...props}>{children}</code>
      </pre>
    );
  };

  // 自定义链接渲染
  const LinkRenderer = ({ href, children, ...props }: any) => {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: '#0366d6',
          textDecoration: 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.textDecoration = 'underline';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.textDecoration = 'none';
        }}
        {...props}
      >
        {children}
      </a>
    );
  };

  // 自定义表格渲染
  const TableRenderer = ({ children, ...props }: any) => {
    return (
      <div style={{ overflow: 'auto', margin: '16px 0' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #d0d7de',
          }}
          {...props}
        >
          {children}
        </table>
      </div>
    );
  };

  const TableHeaderRenderer = ({ children, ...props }: any) => {
    return (
      <th
        style={{
          padding: '8px 12px',
          border: '1px solid #d0d7de',
          background: '#f6f8fa',
          fontWeight: 'bold',
          textAlign: 'left',
        }}
        {...props}
      >
        {children}
      </th>
    );
  };

  const TableCellRenderer = ({ children, ...props }: any) => {
    return (
      <td
        style={{
          padding: '8px 12px',
          border: '1px solid #d0d7de',
        }}
        {...props}
      >
        {children}
      </td>
    );
  };

  return (
    <>
      <div
        className={className}
        style={{
          lineHeight: '1.6',
          color: '#24292e',
          fontSize: '14px',
          ...style,
        }}
      >
        <ReactMarkdown
          components={{
            img: ImageRenderer,
            code: CodeRenderer,
            a: LinkRenderer,
            table: TableRenderer,
            th: TableHeaderRenderer,
            td: TableCellRenderer,
            h1: ({ children, ...props }) => (
              <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '24px 0 16px 0', borderBottom: '1px solid #e1e4e8', paddingBottom: '8px' }} {...props}>
                {children}
              </h1>
            ),
            h2: ({ children, ...props }) => (
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '24px 0 16px 0', borderBottom: '1px solid #e1e4e8', paddingBottom: '8px' }} {...props}>
                {children}
              </h2>
            ),
            h3: ({ children, ...props }) => (
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: '20px 0 12px 0' }} {...props}>
                {children}
              </h3>
            ),
            p: ({ children, ...props }) => (
              <p style={{ margin: '0 0 16px 0' }} {...props}>
                {children}
              </p>
            ),
            blockquote: ({ children, ...props }) => (
              <blockquote
                style={{
                  margin: '0 0 16px 0',
                  padding: '0 16px',
                  borderLeft: '4px solid #dfe2e5',
                  color: '#6a737d',
                }}
                {...props}
              >
                {children}
              </blockquote>
            ),
            ul: ({ children, ...props }) => (
              <ul style={{ margin: '0 0 16px 0', paddingLeft: '24px' }} {...props}>
                {children}
              </ul>
            ),
            ol: ({ children, ...props }) => (
              <ol style={{ margin: '0 0 16px 0', paddingLeft: '24px' }} {...props}>
                {children}
              </ol>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>

      {/* 图片预览弹窗 */}
      <Modal
        visible={imageModalVisible}
        onCancel={() => setImageModalVisible(false)}
        footer={null}
        width="95vw"
        height="95vh"
        centered={true}
        maskClosable={true}
        bodyStyle={{
          padding: 0,
          height: '95vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#000'
        }}
        closeIcon={
          <IconClose
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              fontSize: '28px',
              color: '#fff',
              background: 'rgba(0, 0, 0, 0.6)',
              borderRadius: '50%',
              padding: '10px',
              cursor: 'pointer',
              zIndex: 1002,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)';
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          />
        }
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: '#000',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          {/* 上一张按钮 */}
          {imageUrls.length > 1 && (
            <Button
              icon={<IconChevronLeft />}
              onClick={handlePrevImage}
              style={{
                position: 'absolute',
                left: '20px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 1001,
                background: 'rgba(0, 0, 0, 0.6)',
                border: 'none',
                color: '#fff',
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
              }}
            />
          )}

          {/* 图片容器 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '100%',
              height: '100%',
              padding: '20px',
            }}
          >
            <img
              src={selectedImage.src}
              alt={selectedImage.alt}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: '4px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
              }}
            />
          </div>

          {/* 下一张按钮 */}
          {imageUrls.length > 1 && (
            <Button
              icon={<IconChevronRight />}
              onClick={handleNextImage}
              style={{
                position: 'absolute',
                right: '20px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 1001,
                background: 'rgba(0, 0, 0, 0.6)',
                border: 'none',
                color: '#fff',
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
              }}
            />
          )}
        </div>

        {/* 图片信息栏 */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.8))',
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#fff',
          }}
        >
          <div>
            {selectedImage.alt && (
              <div style={{ fontSize: '16px', marginBottom: '4px' }}>
                {selectedImage.alt}
              </div>
            )}
            {imageUrls.length > 1 && (
              <div style={{ fontSize: '14px', opacity: 0.8 }}>
                {currentImageIndex + 1} / {imageUrls.length}
              </div>
            )}
          </div>

          {imageUrls.length > 1 && (
            <div style={{ fontSize: '14px', opacity: 0.8 }}>
              使用 ← → 键或点击按钮切换图片
            </div>
          )}
        </div>
      </Modal>
    </>
  );
} 