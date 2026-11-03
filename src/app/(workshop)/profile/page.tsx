import { LogOut, UserRound } from 'lucide-react';
import { requireSession } from '@/lib/auth/session';
import { getCatalog } from '@/features/shared/data';
import { updateProfile, setPassword } from '@/features/users/actions';
import { logout } from '@/features/auth/actions';
import { roleLabel, displayDate } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { ActionForm } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InstallAppButton } from '@/components/layout/pwa';
import { PageHeader } from '@/components/ui/page-header';
import { AvatarUpload } from '@/features/users/avatar-upload';

export const metadata = { title: 'Tài khoản' };

export default async function ProfilePage() {
  const session = await requireSession();
  const { stages } = await getCatalog();

  return (
    <>
      <PageHeader
        title="Tài khoản"
        description="Thông tin cá nhân, quyền hạn và bảo mật tài khoản."
        icon={UserRound}
      />

      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <h2 className="mb-6 text-xl font-semibold">Thông tin cá nhân</h2>
          <AvatarUpload
            name={session.profile.full_name}
            initialPath={session.profile.avatar_path}
          />
          <ActionForm action={updateProfile}>
            <Field id="name" label="Họ và tên">
              <input
                id="name"
                name="name"
                defaultValue={session.profile.full_name}
                required
                maxLength={120}
                autoComplete="name"
              />
            </Field>
            <Field id="phone" label="Số điện thoại">
              <input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={session.profile.phone ?? ''}
                maxLength={30}
                autoComplete="tel"
              />
            </Field>
            <div className="min-w-0">
              <span className="field-label">Email đăng nhập</span>
              <p className="text-muted-foreground break-all">{session.profile.email ?? 'Chưa cập nhật'}</p>
            </div>
          </ActionForm>
        </Card>

        <div className="min-w-0 space-y-6">
          <Card className="min-w-0">
            <h2 className="text-xl font-semibold">Quyền và công đoạn</h2>
            <dl className="mt-6 space-y-4 text-sm">
              <div className="min-w-0">
                <dt className="text-muted-foreground">Vai trò</dt>
                <dd className="mt-2 font-semibold">
                  <span className="flex flex-wrap gap-2">
                    {session.roles.length
                      ? session.roles.map((r) => (
                          <Badge key={r} variant="outline">
                            {roleLabel[r]}
                          </Badge>
                        ))
                      : 'Chưa được phân quyền'}
                  </span>
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-muted-foreground">Công đoạn được giao</dt>
                <dd className="mt-2 break-words">
                  {stages
                    .filter((s) => session.skills.includes(s.id))
                    .map((s) => s.name)
                    .join(', ') || 'Chưa được phân công'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Tham gia từ</dt>
                <dd className="mt-2">{displayDate(session.profile.created_at)}</dd>
              </div>
            </dl>
            {session.profile.zero_wage && (
              <p className="mt-4 rounded-xl bg-muted p-3 text-sm">
                Tài khoản ghi công không nhận lương.
              </p>
            )}
          </Card>

          <Card className="min-w-0">
            <h2 className="mb-4 text-xl font-semibold">Đặt mật khẩu</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Dùng khi vừa nhận lời mời hoặc muốn đổi mật khẩu.
            </p>
            <ActionForm action={setPassword} submitLabel="Lưu mật khẩu">
              <Field id="password" label="Mật khẩu mới (ít nhất 5 ký tự)">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={5}
                  maxLength={128}
                  placeholder="Nhập mật khẩu mới từ 5 ký tự"
                />
              </Field>
            </ActionForm>
          </Card>

          <Card className="min-w-0" id="installation">
            <h2 className="text-xl font-semibold">Cài trên điện thoại</h2>
            <InstallAppButton />
            <p className="mt-3 text-sm text-muted-foreground break-words">
              iPhone: mở bằng Safari, chọn Chia sẻ rồi &ldquo;Thêm vào MH chính&rdquo;.
            </p>
            <p className="mt-3 text-sm text-muted-foreground break-words">
              Cần kết nối mạng để xem dữ liệu mới và gửi công. Cài đặt yêu cầu địa chỉ có kết nối
              bảo mật.
            </p>
          </Card>
        </div>
      </div>

      {/* Logout full-width at the bottom */}
      <div className="mt-8 border-t border-border/60 pt-6">
        <form action={logout}>
          <Button
            type="submit"
            variant="outline"
            className="w-full min-h-12 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive hover:border-destructive font-bold gap-2 text-sm rounded-xl shadow-2xs"
          >
            <LogOut size={18} />
            Đăng xuất
          </Button>
        </form>
      </div>
    </>
  );
}
