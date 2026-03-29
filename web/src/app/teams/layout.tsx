import MainLayout from '@/components/MainLayout';

export default function TeamsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
