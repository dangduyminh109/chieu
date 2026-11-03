import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { LogOut, Leaf } from 'lucide-react';
import { Brand, Navigation } from './navigation';
import { ThemeToggle } from './theme-toggle';
import { logout } from '@/features/auth/actions';
import { roleLabel, businessDate, displayDate } from '@/lib/utils';
import type { Profile, Role, MatType, Stage, LaborRate } from '@/types/domain';

export function Shell({
  profile,
  roles,
  children,
  mats = [],
  stages = [],
  rates = [],
  workerId,
  today,
  recentMatId,
  defaultStageId,
}: {
  profile: Profile;
  roles: Role[];
  children: React.ReactNode;
  mats?: MatType[];
  stages?: Stage[];
  rates?: LaborRate[];
  workerId?: string;
  today?: string;
  recentMatId?: string | null;
  defaultStageId?: string;
}) {
  const currentDate = today || businessDate();

  return (
    <div className="min-h-dvh w-full max-w-full overflow-x-hidden">
      <a href="#main" className="skip-link">
        Đến nội dung chính
      </a>
      <aside className="sidebar">
        <Brand logoOnly />
        <div className="mt-8 mb-4 px-4 text-xs text-muted-foreground">Không gian làm việc</div>
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
            <Brand logoOnly />
          </span>
          <div className="hidden text-sm text-muted-foreground lg:block">
            Quản lý chiếu <span className="mx-3 text-border">/</span> Không gian làm việc
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/profile" className="flex min-h-12 items-center gap-2 text-sm">
              <span className="hidden sm:block">{displayDate(currentDate)}</span>
              <Avatar path={profile.avatar_path} name={profile.full_name} />
            </Link>
          </div>
        </header>
        <main id="main" className="main-content">
          {children}
        </main>
      </div>
      <Navigation
        roles={roles}
        mats={mats}
        stages={stages}
        rates={rates}
        workerId={workerId}
        today={currentDate}
        recentMatId={recentMatId}
        defaultStageId={defaultStageId}
        mobile
      />
    </div>
  );
}
