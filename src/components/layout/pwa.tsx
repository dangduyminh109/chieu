'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';
function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}
export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
export function Pwa() {
  const online = useOnline();
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production')
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* Installation is optional; data entry stays online-only. */
      });
  }, []);
  return !online ? (
    <div
      role="alert"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-100 p-3 text-sm text-amber-950"
    >
      <WifiOff size={18} aria-hidden />
      Bạn đang ngoại tuyến. Kết nối mạng để xem và gửi dữ liệu mới.
    </div>
  ) : null;
}
