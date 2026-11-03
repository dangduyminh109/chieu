'use client';

import { useLayoutEffect } from 'react';

export function ThemeInitializer() {
  useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem('theme');
      const dark = stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', dark);
    } catch {
      // Keep the default theme when browser storage is unavailable.
    }
  }, []);
  return null;
}
