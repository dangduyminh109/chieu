import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Pwa } from '@/components/layout/pwa';
import { Toaster } from '@/components/ui/sonner';
export const metadata: Metadata = {
  title: { default: 'Quản Lý Xưởng Chiếu', template: '%s | Xưởng Chiếu' },
  description: 'Ghi công hằng ngày, quản lý loại chiếu và đơn giá công cho xưởng chiếu gia đình.',
  applicationName: 'Quản Lý Xưởng Chiếu',
  appleWebApp: { capable: true, title: 'Xưởng Chiếu', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#216149',
  viewportFit: 'cover',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <Pwa />
        <Toaster />
        {children}
      </body>
    </html>
  );
}
