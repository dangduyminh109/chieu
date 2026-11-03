import Image from 'next/image';
import {
  Sparkles,
  Sun,
  Paintbrush,
  Wrench,
} from 'lucide-react';

export function getStageImage(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.includes('dệt') || lower.includes('weaving')) return '/images/stages/det-chieu.png';
  if (lower.includes('cắt') || lower.includes('cutting')) return '/images/stages/cat-chieu.png';
  if (lower.includes('buộc') || lower.includes('tying') || lower.includes('gói') || lower.includes('đóng')) return '/images/stages/buoc-chieu.png';
  if (lower.includes('may') || lower.includes('sewing')) return '/images/stages/may-chieu.png';
  return null;
}

export function StageIcon({
  name,
  size = 18,
  className = 'shrink-0',
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const img = getStageImage(name);
  if (img) {
    return (
      <Image
        src={img}
        alt={name}
        width={size}
        height={size}
        unoptimized
        className={`rounded-md object-cover shrink-0 shadow-2xs ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const lower = name.toLowerCase();
  const icon = lower.includes('phơi') ? (
    <Sun size={Math.round(size * 0.7)} className="text-amber-600 dark:text-amber-400" />
  ) : lower.includes('nhuộm') ? (
    <Paintbrush size={Math.round(size * 0.7)} className="text-indigo-600 dark:text-indigo-400" />
  ) : lower.includes('sửa') || lower.includes('máy') ? (
    <Wrench size={Math.round(size * 0.7)} className="text-zinc-600 dark:text-zinc-400" />
  ) : (
    <Sparkles size={Math.round(size * 0.7)} className="text-primary" />
  );

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground border border-border/70 shadow-2xs ${className}`}
      style={{ width: size, height: size }}
    >
      {icon}
    </span>
  );
}
