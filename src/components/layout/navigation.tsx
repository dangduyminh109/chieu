'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  House,
  NotebookPen,
  Layers3,
  Coins,
  UserRound,
  ShieldCheck,
  UsersRound,
  Grid2X2,
} from 'lucide-react';
import { can } from '@/lib/permissions';
import type { Role } from '@/types/domain';
const items = [
  { href: '/', label: 'Trang chủ', icon: House },
  { href: '/production', label: 'Sản xuất', icon: NotebookPen },
  { href: '/mat-types', label: 'Loại chiếu', icon: Layers3, permission: 'manage_catalog' as const },
  { href: '/pricing', label: 'Đơn giá công', icon: Coins, permission: 'manage_catalog' as const },
  { href: '/users', label: 'Thành viên', icon: UsersRound, permission: 'manage_users' as const },
  {
    href: '/audit',
    label: 'Nhật ký hệ thống',
    icon: ShieldCheck,
    permission: 'view_audit' as const,
  },
  { href: '/profile', label: 'Tài khoản', icon: UserRound },
];
export function Navigation({ roles, mobile = false }: { roles: Role[]; mobile?: boolean }) {
  const path = usePathname();
  const allowed = items.filter((i) => !i.permission || can(roles, i.permission));
  const shown = mobile
    ? allowed.filter((i) => ['/', '/production', '/mat-types', '/profile'].includes(i.href))
    : allowed;
  return (
    <nav
      aria-label={mobile ? 'Điều hướng điện thoại' : 'Điều hướng chính'}
      className={mobile ? 'mobile-nav' : 'space-y-2'}
    >
      {shown.map((item) => {
        const active = path === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={
              mobile
                ? `flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-xs ${active ? 'bg-muted text-primary' : 'text-muted-foreground'}`
                : `flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${active ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted hover:text-primary'}`
            }
          >
            <item.icon aria-hidden size={20} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-white">
        <Grid2X2 aria-hidden size={27} />
      </span>
      <span>
        <strong className="block text-lg font-bold">Xưởng Chiếu</strong>
        <span className="text-xs text-muted-foreground">Gọn việc xưởng, rõ tiền công</span>
      </span>
    </Link>
  );
}
