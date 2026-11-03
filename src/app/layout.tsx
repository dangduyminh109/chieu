import type { Metadata, Viewport } from 'next';
import { ThemeInitializer } from '@/components/layout/theme-initializer';
import './globals.css';
import { Pwa } from '@/components/layout/pwa';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: { default: 'Quản Lý Chiếu', template: '%s | Chiếu' },
  description:
    'Ghi công hằng ngày, quản lý loại chiếu và đơn giá công cho cơ sở làm chiếu gia đình.',
  applicationName: 'Quản Lý Chiếu',
  appleWebApp: { capable: true, title: 'Chiếu', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/icons/chieu-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon.png', type: 'image/png' },
    ],
    shortcut: '/icons/chieu-192.png',
    apple: '/icons/chieu-apple-180.png',
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#245B48' },
    { media: '(prefers-color-scheme: dark)', color: '#131A16' },
  ],
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>
        <ThemeInitializer />
        <Pwa />
        <Toaster />
        {children}
        {modal}
      </body>
    </html>
  );
}
