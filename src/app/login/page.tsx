import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { isConfigured } from '@/lib/supabase/server';
import { Brand } from '@/components/layout/navigation';
import { ActionForm } from '@/components/ui/action-form';
import { login } from '@/features/auth/actions';
import { Check, Leaf } from 'lucide-react';
import { Field } from '@/components/ui/field';
export default async function LoginPage() {
  if (await getSession()) redirect('/');
  const configured = isConfigured();
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="flex flex-col p-8 lg:p-16">
        <Brand />
        <div className="m-auto w-full max-w-md py-16">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-sm text-primary">
            <Leaf size={16} aria-hidden />
            Cùng chăm chút việc xưởng
          </span>
          <h1 className="text-3xl font-bold sm:text-4xl">
            Chào bạn,
            <br />
            một ngày làm việc mới.
          </h1>
          <p className="mt-4 mb-8 text-muted-foreground">
            Đăng nhập để ghi công và theo dõi công việc của mình.
          </p>
          {configured ? (
            <ActionForm action={login} submitLabel="Đăng nhập">
              <Field id="email" label="Email">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  placeholder="Email được mời vào xưởng"
                />
              </Field>
              <Field id="password" label="Mật khẩu">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  maxLength={200}
                  required
                />
              </Field>
            </ActionForm>
          ) : (
            <div className="rounded-2xl border border-border bg-white p-6">
              <h2 className="text-lg font-semibold">Sẵn sàng kết nối xưởng của bạn</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Ứng dụng chưa được kết nối cơ sở dữ liệu. Người cài đặt cần điền thông tin kết nối
                và khởi tạo dữ liệu theo hướng dẫn README.
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Sau khi kết nối, bạn có thể đăng nhập bằng tài khoản được mời.
              </p>
            </div>
          )}
          <p className="mt-6 text-sm text-muted-foreground">
            Chưa có tài khoản hoặc quên mật khẩu? Liên hệ người quản lý xưởng để được hỗ trợ.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Dành cho những người làm nên từng tấm chiếu.
        </p>
      </section>
      <aside className="relative hidden overflow-hidden bg-primary p-16 text-white lg:flex lg:flex-col lg:justify-end">
        <div
          aria-hidden
          className="weave absolute -right-16 top-16 h-96 w-96 rotate-12 rounded-3xl border-8 border-white/20"
        />
        <div className="relative max-w-lg">
          <div className="mb-8 flex size-16 items-center justify-center rounded-2xl bg-white/10">
            <Leaf size={32} aria-hidden />
          </div>
          <h2 className="text-4xl font-semibold">
            Việc xưởng gọn gàng.
            <br />
            Tiền công rõ ràng.
          </h2>
          <p className="mt-6 text-white/80">
            Từ công dệt, công may đến từng đơn giá, mọi ghi chép được giữ lại trong một nơi.
          </p>
          <ul className="mt-8 space-y-4 text-sm">
            {[
              'Ghi công nhanh trên điện thoại',
              'Đơn giá theo đúng ngày làm việc',
              'Mỗi người xem đúng thông tin của mình',
            ].map((s) => (
              <li key={s} className="flex items-center gap-3">
                <Check size={18} aria-hidden />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </main>
  );
}
