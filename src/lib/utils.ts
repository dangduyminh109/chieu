import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const money = (amount?: number | bigint | string | null) => {
  const n = typeof amount === 'bigint' ? Number(amount) : Number(amount ?? 0);
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
};

export const number = (amount?: number | bigint | string | null) => {
  const n = typeof amount === 'bigint' ? Number(amount) : Number(amount ?? 0);
  return new Intl.NumberFormat('vi-VN').format(Number.isFinite(n) ? n : 0);
};

export function businessDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function displayDate(date: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'medium',
  }).format(new Date(date.length === 10 ? `${date}T00:00:00+07:00` : date));
}

export const roleLabel = { ADMIN: 'Quản trị viên', OWNER: 'Chủ cơ sở', WORKER: 'Thợ sản xuất' };

export const statusLabel = {
  DRAFT: 'Bản nháp',
  SUBMITTED: 'Đã ghi nhận',
  APPROVED: 'Đã ghi nhận',
  REJECTED: 'Từ chối',
  LOCKED: 'Đã khóa',
};
