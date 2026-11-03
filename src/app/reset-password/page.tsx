import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ResetPasswordForm } from '@/features/auth/reset-password-form';
import { ThemeToggle } from '@/components/layout/theme-toggle';

export const metadata = {
  title: 'Đổi mật khẩu',
};

export default function ResetPasswordPage() {
  return (
    <main className="flex h-dvh flex-col overflow-hidden lg:flex-row">
      {/* ── Image panel ── */}
      <aside
        className="relative shrink-0 overflow-hidden
                   h-[28svh]
                   lg:h-full lg:w-1/2 lg:overflow-visible lg:rounded-r-4xl xl:w-3/5"
      >
        <div className="absolute inset-0 overflow-hidden lg:rounded-r-4xl">
          <Image
            src="/images/hero-workshop.jpg"
            alt="Khu làm chiếu nhìn từ trên cao – những tấm chiếu đỏ phơi nắng"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 60vw"
            className="object-cover object-center"
          />
          {/* Gradient overlay */}
          <div
            className="absolute inset-0
                       bg-gradient-to-b from-black/10 via-transparent to-black/50
                       lg:bg-gradient-to-t lg:from-[#0d2b1e]/90 lg:via-[#0d2b1e]/30 lg:to-transparent"
          />

          {/* Desktop overlay text */}
          <div className="absolute bottom-0 left-0 right-0 hidden p-12 lg:block xl:p-16">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-white/20 p-2 backdrop-blur-sm">
                <Image
                  src="/images/logo-icon.png"
                  alt="Chiếu"
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
              <div className="h-8 w-px bg-white/30" />
              <p className="text-sm font-semibold text-white/90">Chiếu</p>
            </div>
            <h2 className="text-3xl font-bold leading-snug text-white xl:text-4xl">
              Giữ nghề truyền thống,
              <br />
              quản lý dễ dàng hơn.
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">
              Quản lý công làm, nguyên liệu và mua bán trong cùng một ứng dụng.
            </p>
          </div>
        </div>
      </aside>

      {/* ── Form panel ── */}
      <section
        className="
          relative z-10 -mt-5 flex flex-1 flex-col overflow-y-auto
          rounded-t-3xl bg-background
          lg:z-auto lg:mt-0 lg:w-1/2 lg:rounded-none xl:w-2/5
        "
        style={{ boxShadow: '0 -8px 32px rgba(0,0,0,0.18)' }}
      >
        <div className="absolute right-4 top-4 z-20">
          <ThemeToggle />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 sm:px-10 lg:py-16">
          <div className="w-full max-w-sm">
            {/* Logo */}
            <div className="mb-4 flex flex-col items-center text-center">
              <Image
                src="/images/logo.png"
                alt="Chiếu"
                width={170}
                height={112}
                priority
                className="h-16 w-auto object-contain drop-shadow-sm sm:h-20"
              />
            </div>

            {/* Heading */}
            <div className="mb-5 text-center">
              <h1 className="text-2xl font-extrabold text-foreground lg:text-3xl">Đổi mật khẩu</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Tạo mật khẩu mới cho tài khoản của bạn.
              </p>
            </div>

            {/* Form */}
            <ResetPasswordForm />

            {/* Back link */}
            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                <ArrowLeft size={16} aria-hidden />
                Quay lại đăng nhập
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

