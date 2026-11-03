'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    const onPrompt = (event: Event) => {
      event.preventDefault();
      installPrompt = event as InstallPromptEvent;
      notifyInstall();
    };
    const onInstalled = () => {
      installPrompt = null;
      notifyInstall();
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if ('serviceWorker' in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
        // Network-only application use remains available when registration fails.
      });
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
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

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
let installPrompt: InstallPromptEvent | null = null;
const installListeners = new Set<() => void>();
function notifyInstall() {
  installListeners.forEach((callback) => callback());
}
function subscribeInstall(callback: () => void) {
  installListeners.add(callback);
  return () => {
    installListeners.delete(callback);
  };
}
export function InstallAppButton() {
  const prompt = useSyncExternalStore(
    subscribeInstall,
    () => installPrompt,
    () => null,
  );
  const [busy, setBusy] = useState(false);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const update = () => setInstalled(window.matchMedia('(display-mode: standalone)').matches);
    update();
    window.addEventListener('appinstalled', update);
    return () => window.removeEventListener('appinstalled', update);
  }, []);
  if (installed)
    return <p className="mt-3 text-sm text-primary">Ứng dụng đã được cài trên thiết bị này.</p>;
  if (!prompt)
    return (
      <p className="mt-3 text-sm text-muted-foreground break-words">
        Trên Chrome Android: mở menu ⋮ → Thêm vào màn hình chính → Cài đặt. Nếu đang mở trong
        Zalo/Facebook, hãy mở liên kết bằng Chrome trước.
      </p>
    );
  return (
    <Button
      className="mt-3"
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await prompt.prompt();
          const choice = await prompt.userChoice;
          if (choice.outcome === 'accepted') setInstalled(true);
        } catch {
          /* Chrome's menu remains available for a manual retry. */
        } finally {
          installPrompt = null;
          notifyInstall();
          setBusy(false);
        }
      }}
    >
      <Download size={16} />
      {busy ? 'Đang mở cài đặt…' : 'Cài ứng dụng Chiếu'}
    </Button>
  );
}
