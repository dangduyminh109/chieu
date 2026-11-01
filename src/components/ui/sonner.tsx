'use client';
import { Toaster as Sonner } from 'sonner';
export function Toaster() {
  return (
    <Sonner
      position="top-center"
      theme="light"
      richColors
      closeButton
      visibleToasts={3}
      duration={4500}
      containerAriaLabel="Thông báo"
      toastOptions={{
        closeButtonAriaLabel: 'Đóng thông báo',
        classNames: { toast: 'font-sans', closeButton: '!size-12' },
      }}
    />
  );
}
