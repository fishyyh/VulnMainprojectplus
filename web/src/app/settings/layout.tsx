import MainLayout from '@/components/MainLayout';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}