import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Quản Lý Xưởng Chiếu',
    short_name: 'Xưởng Chiếu',
    description: 'Ghi công và quản lý xưởng chiếu gia đình',
    lang: 'vi',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f6f8f6',
    theme_color: '#216149',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
