'use client';

import { SystemProvider } from '@/contexts/SystemContext';

interface ClientLayoutProps {
  children: React.ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <SystemProvider>
      {children}
    </SystemProvider>
  );
}
