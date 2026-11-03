import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Quản Lý Chiếu',
    short_name: 'Chiếu',
    description: 'Ghi công và quản lý cơ sở làm chiếu gia đình',
    lang: 'vi',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f6f8f6',
    theme_color: '#216149',
    icons: [
      { src: '/icons/chieu-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/chieu-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/chieu-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
