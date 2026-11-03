import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { isConfigured } from '@/lib/supabase/server';
import { LoginForm } from '@/features/auth/login-form';
import { ThemeToggle } from '@/components/layout/theme-toggle';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  if (await getSession()) redirect('/');
  const configured = isConfigured();

  return (
    /**
     * Mobile-first:
     *   - Flex column, viewport-locked (h-dvh, no outer scroll)
     *   - Image panel: fixed 28svh shrink-0
     *   - Form panel: flex-1, scrollable internally as safety net
     * Desktop (lg):
     *   - Flex row, image left / form right
     */
    <main className="flex h-dvh flex-col overflow-hidden lg:flex-row">

      {/* ── Image panel ── */}
      <aside className="relative shrink-0 overflow-hidden
                        h-[28svh]
                        lg:h-full lg:w-1/2 lg:overflow-visible lg:rounded-r-4xl xl:w-3/5">
        {/* Clip image inside the rounded wrapper on desktop */}
        <div className="absolute inset-0 overflow-hidden lg:rounded-r-4xl">
        <Image
          src="/images/hero-workshop.jpg"
          alt="Khu làm chiếu nhìn từ trên cao – những tấm chiếu đỏ phơi nắng"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 60vw"
          className="object-cover object-center"
        />
        {/* Gradient: mobile – fade bottom; desktop – fade bottom-up for text */}
        <div className="absolute inset-0
                        bg-gradient-to-b from-black/10 via-transparent to-black/50
                        lg:bg-gradient-to-t lg:from-[#0d2b1e]/90 lg:via-[#0d2b1e]/30 lg:to-transparent" />

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
          /* mobile: overlap image by 20px, rounded top corners, internal scroll */
          relative z-10 -mt-5 flex flex-1 flex-col overflow-y-auto
          rounded-t-3xl bg-background
          /* desktop: flat left edge, rounded right, no overlap */
          lg:z-auto lg:mt-0 lg:rounded-none lg:w-1/2 xl:w-2/5
        "
        style={{ boxShadow: '0 -8px 32px rgba(0,0,0,0.18)' }}
      >
        {/* Theme toggle */}
        <div className="absolute right-4 top-4 z-20">
          <ThemeToggle />
        </div>
        {/* Inner: vertically centered, doesn't stretch past content */}
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
              <h1 className="text-2xl font-extrabold text-foreground lg:text-3xl">Đăng nhập</h1>
              <p className="mt-1 text-sm text-muted-foreground">Chào mừng bạn quay trở lại.</p>
            </div>

            {/* Form */}
            {configured ? (
              <div>
                {params.error === 'confirmation' && (
                  <p role="alert" className="mb-3 text-sm text-destructive">
                    Liên kết xác thực không hợp lệ hoặc đã hết hạn. Hãy yêu cầu gửi lại.
                  </p>
                )}
                <LoginForm />
                <Link
                  href="/forgot-password"
                  className="mt-3 block text-right text-sm text-primary underline-offset-4 hover:underline"
                >
                  Quên mật khẩu?
                </Link>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-base font-semibold">Sẵn sàng kết nối dữ liệu</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Ứng dụng chưa được kết nối cơ sở dữ liệu. Người cài đặt cần điền thông tin kết
                  nối và khởi tạo dữ liệu theo hướng dẫn README.
                </p>
              </div>
            )}

            {/* Footer */}
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Bạn không đăng nhập được?{' '}
              <Link
                href="mailto:"
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                Hãy liên hệ người quản lý.
              </Link>
            </p>

          </div>
        </div>
      </section>

    </main>
  );
}
