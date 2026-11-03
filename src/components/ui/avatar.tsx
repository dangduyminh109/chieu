'use client';
import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export function Avatar({
  path,
  name,
  className,
}: {
  path?: string | null;
  name: string;
  className?: string;
}) {
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const url = path ? `/api/avatar?path=${encodeURIComponent(path)}` : null;
  return (
    <span
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-bold text-primary ring-1 ring-border',
        className,
      )}
    >
      {url && failedPath !== path ? (
        <Image
          src={url}
          alt={`Ảnh đại diện ${name}`}
          width={128}
          height={128}
          unoptimized
          className="h-full w-full object-cover"
          onError={() => setFailedPath(path ?? null)}
        />
      ) : (
        <span aria-label={name}>
          {name.trim().split(/\s+/).at(-1)?.charAt(0).toLocaleUpperCase('vi-VN') || '?'}
        </span>
      )}
    </span>
  );
}
