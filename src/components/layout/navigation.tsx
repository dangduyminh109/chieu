'use client';

import { useState, useRef, Fragment } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  House,
  BarChart3,
  NotebookPen,
  Layers3,
  Coins,
  UserRound,
  ShieldCheck,
  UsersRound,
  Sparkles,
  ShoppingCart,
  Wallet,
  Receipt,
  ShoppingBag,
  Menu,
  X,
} from 'lucide-react';
import { can } from '@/lib/permissions';
import { QuickWorkDialog } from '@/features/production/quick-work-dialog';
import { QuickCommerceDialog } from '@/features/commerce/quick-commerce-dialog';
import type { Role, MatType, Stage, LaborRate } from '@/types/domain';

const items = [
  { href: '/', label: 'Trang chủ', icon: House },
  { href: '/analytics', label: 'Thống kê', icon: BarChart3 },
  { href: '/production', label: 'Sản xuất', icon: NotebookPen },
  {
    href: '/payroll',
    label: 'Tiền công',
    icon: Wallet,
    permission: 'view_operations' as const,
  },
  { href: '/cashflow', label: 'Thu chi', icon: Receipt, permission: 'view_financials' as const },
  {
    href: '/profit',
    label: 'Giá vốn & lãi bán',
    icon: BarChart3,
    permission: 'view_financials' as const,
  },
  {
    href: '/transactions',
    label: 'Mua bán & công nợ',
    icon: ShoppingBag,
    permission: 'view_operations' as const,
  },
  {
    href: '/contacts',
    label: 'Khách & nhà cung cấp',
    icon: UsersRound,
    permission: 'view_operations' as const,
  },
  { href: '/mat-types', label: 'Loại chiếu', icon: Layers3, permission: 'manage_catalog' as const },
  { href: '/pricing', label: 'Đơn giá công', icon: Coins, permission: 'manage_catalog' as const },
  { href: '/users', label: 'Thành viên', icon: UsersRound, permission: 'provision_users' as const },
  {
    href: '/audit',
    label: 'Nhật ký hệ thống',
    icon: ShieldCheck,
    permission: 'view_audit' as const,
  },
  { href: '/profile', label: 'Tài khoản', icon: UserRound },
];

export function Navigation({
  roles,
  mobile = false,
  mats = [],
  stages = [],
  rates = [],
  workerId = '',
  today = '',
  recentMatId,
  defaultStageId,
}: {
  roles: Role[];
  mobile?: boolean;
  mats?: MatType[];
  stages?: Stage[];
  rates?: LaborRate[];
  workerId?: string;
  today?: string;
  recentMatId?: string | null;
  defaultStageId?: string;
}) {
  const path = usePathname();
  const menuRef = useRef<HTMLDialogElement>(null);
  const [quickWorkOpen, setQuickWorkOpen] = useState(false);
  const [commerceOpen, setCommerceOpen] = useState(false);

  const isWorkerOnly = roles.includes('WORKER') && !can(roles, 'view_operations');
  const isManager = can(roles, 'view_operations');

  const allowed = items
    .filter(
      (i) =>
        (!i.permission || can(roles, i.permission)) && !(isManager && i.href === '/production'),
    )
    .map((i) =>
      isWorkerOnly && i.href === '/production'
        ? { ...i, href: '/wages', label: 'Tiền công', icon: Wallet }
        : i,
    );
  const hasMore = allowed.some(
    (i) => !['/', '/analytics', '/production', '/wages', '/profile'].includes(i.href),
  );
  const shown = mobile
    ? hasMore
      ? [
          items[0],
          items[1],
          { href: '/payroll', label: 'Tiền công', icon: Wallet },
          { href: '#more', label: 'Thêm', icon: Menu },
        ]
      : allowed.filter((i) =>
          ['/', '/analytics', '/production', '/wages', '/profile'].includes(i.href),
        )
    : allowed;

  const split = Math.ceil(shown.length / 2);

  const primaryButton = mobile ? (
    isWorkerOnly ? (
      <button
        key="mobile-primary-btn"
        type="button"
        onClick={() => setQuickWorkOpen(true)}
        className="mobile-primary"
        aria-label="Ghi công nhanh"
      >
        <span className="mobile-primary-circle">
          <Sparkles size={24} aria-hidden />
        </span>
        <span className="mobile-primary-label">Ghi công</span>
      </button>
    ) : isManager ? (
      <button
        key="mobile-primary-btn"
        type="button"
        onClick={() => setCommerceOpen(true)}
        className="mobile-primary"
        aria-label="Mua bán"
      >
        <span className="mobile-primary-circle">
          <ShoppingCart size={24} aria-hidden />
        </span>
        <span className="mobile-primary-label">Mua bán</span>
      </button>
    ) : null
  ) : null;

  return (
    <>
      <nav
        aria-label={mobile ? 'Điều hướng điện thoại' : 'Điều hướng chính'}
        className={mobile ? 'mobile-nav' : 'space-y-2'}
      >
        {shown.map((item, idx) => {
          const active = path === item.href;
          return (
            <Fragment key={item.href}>
              {mobile && idx === split && primaryButton}
              {item.href === '#more' ? (
                <button
                  type="button"
                  onClick={() => menuRef.current?.showModal()}
                  aria-haspopup="dialog"
                  aria-label="Mở menu chức năng"
                  className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-xs ${!['/', '/analytics', '/payroll', '/profile'].includes(path) ? 'bg-muted text-primary' : 'text-muted-foreground'}`}
                >
                  <Menu size={20} aria-hidden />
                  Thêm
                </button>
              ) : (
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={
                    mobile
                      ? `flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-xs ${
                          active ? 'bg-muted text-primary' : 'text-muted-foreground'
                        }`
                      : `flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${
                          active
                            ? 'bg-primary text-white'
                            : 'text-muted-foreground hover:bg-muted hover:text-primary'
                        }`
                  }
                >
                  <item.icon aria-hidden size={20} />
                  {item.label}
                </Link>
              )}
            </Fragment>
          );
        })}
      </nav>

      {mobile && hasMore && (
        <dialog
          ref={menuRef}
          aria-labelledby="mobile-menu-title"
          className="m-auto mb-4 max-h-[80dvh] w-[calc(100%-1rem)] max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-4 text-foreground backdrop:bg-black/50"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 id="mobile-menu-title" className="text-lg font-semibold">
                Chức năng của bạn
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Các mục theo quyền tài khoản hiện tại
              </p>
            </div>
            <button
              type="button"
              onClick={() => menuRef.current?.close()}
              aria-label="Đóng menu"
              className="flex size-11 items-center justify-center rounded-xl hover:bg-muted"
            >
              <X size={20} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {allowed.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => menuRef.current?.close()}
                aria-current={path === item.href ? 'page' : undefined}
                className={`flex min-h-16 items-center gap-3 rounded-xl border border-border px-3 py-3 text-sm ${path === item.href ? 'bg-muted font-semibold text-primary' : 'hover:bg-muted'}`}
              >
                <item.icon size={20} aria-hidden className="shrink-0" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </dialog>
      )}
      {/* Mobile Dialogs */}
      {mobile && isWorkerOnly && (
        <QuickWorkDialog
          open={quickWorkOpen}
          onOpenChange={setQuickWorkOpen}
          mats={mats}
          stages={stages}
          rates={rates}
          workerId={workerId}
          today={today || new Date().toISOString().slice(0, 10)}
          recentMatId={recentMatId}
          initialStageId={defaultStageId}
        />
      )}

      {mobile && isManager && (
        <QuickCommerceDialog
          open={commerceOpen}
          onOpenChange={setCommerceOpen}
          mats={mats}
          today={today || new Date().toISOString().slice(0, 10)}
        />
      )}
    </>
  );
}

export function Brand({
  boxed = false,
}: {
  collapsed?: boolean;
  logoOnly?: boolean;
  boxed?: boolean;
}) {
  return (
    <Link href="/" className="group inline-flex items-center" aria-label="Trang chủ Chiếu">
      {boxed ? (
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-card border border-border/70 p-2 shadow-xs transition-transform group-hover:scale-105">
          <Image
            src="/images/logo-icon.png"
            alt="Chiếu"
            width={36}
            height={36}
            className="object-contain"
          />
        </span>
      ) : (
        <Image
          src="/images/logo-icon.png"
          alt="Chiếu"
          width={72}
          height={48}
          priority
          className="h-10 w-auto shrink-0 object-contain transition-transform group-hover:scale-105"
        />
      )}
    </Link>
  );
}
