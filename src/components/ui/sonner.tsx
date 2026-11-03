'use client';

import { useEffect, useState } from 'react';
import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setTheme(isDark ? 'dark' : 'light');
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <Sonner
      position="top-center"
      theme={theme}
      richColors
      closeButton={false}
      visibleToasts={3}
      duration={3500}
      containerAriaLabel="Thông báo"
      toastOptions={{
        classNames: {
          toast: 'font-sans text-sm rounded-2xl shadow-lg border px-4 py-3',
        },
      }}
    />
  );
}
