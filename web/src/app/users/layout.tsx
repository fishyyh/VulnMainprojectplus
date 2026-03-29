import MainLayout from '@/components/MainLayout';

export default function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
} 