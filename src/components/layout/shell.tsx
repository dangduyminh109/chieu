import Link from 'next/link';
import { LogOut, ArrowUpRight, Leaf } from 'lucide-react';
import { Brand, Navigation } from './navigation';
import { logout } from '@/features/auth/actions';
import { roleLabel, businessDate, displayDate } from '@/lib/utils';
import type { Profile, Role } from '@/types/domain';
export function Shell({
  profile,
  roles,
  children,
}: {
  profile: Profile;
  roles: Role[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <a href="#main" className="skip-link">
        Đến nội dung chính
      </a>
      <aside className="sidebar">
        <Brand />
        <div className="mt-12 mb-4 px-4 text-xs text-muted-foreground">Không gian làm việc</div>
        <Navigation roles={roles} />
        <div className="mt-auto pt-12">
          <div className="rounded-2xl bg-muted p-4">
            <Leaf aria-hidden className="mb-3 text-primary" />
            <p className="text-sm font-semibold">Mỗi ngày một chút, rõ ràng hơn.</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Ghi công trong ngày để không bỏ sót thành quả.
            </p>
          </div>
          <div className="mt-6 flex items-center justify-between gap-2">
            <Link href="/profile" className="min-w-0">
              <p className="truncate text-sm font-semibold">{profile.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {roles.map((r) => roleLabel[r]).join(', ') || 'Chưa phân quyền'}
              </p>
            </Link>
            <form action={logout}>
              <button
                aria-label="Đăng xuất"
                className="flex size-12 items-center justify-center rounded-xl hover:bg-muted"
              >
                <LogOut size={20} />
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="desktop-content">
        <header className="app-header">
          <span className="lg:hidden">
            <Brand />
          </span>
          <div className="hidden text-sm text-muted-foreground lg:block">
            Quản lý xưởng chiếu <span className="mx-3 text-border">/</span> Không gian làm việc
          </div>
          <Link href="/profile" className="flex min-h-12 items-center gap-2 text-sm">
            <span className="hidden sm:block">{displayDate(businessDate())}</span>
            <span className="flex size-10 items-center justify-center rounded-full bg-muted font-bold text-primary">
              {profile.full_name.charAt(0)}
            </span>
          </Link>
        </header>
        <main id="main" className="main-content">
          {children}
        </main>
        <footer className="px-6 pb-8 text-xs text-muted-foreground">
          <span>Quản Lý Xưởng Chiếu</span>
          <Link
            href="/profile#installation"
            className="ml-4 inline-flex items-center gap-1 underline"
          >
            Cài trên điện thoại
            <ArrowUpRight size={14} aria-hidden />
          </Link>
        </footer>
      </div>
      <Navigation roles={roles} mobile />
    </div>
  );
}
