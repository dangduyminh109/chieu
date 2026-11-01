import { requireSession } from '@/lib/auth/session';
import { getCatalog } from '@/features/shared/data';
import { updateProfile, setPassword } from '@/features/users/actions';
import { logout } from '@/features/auth/actions';
import { roleLabel, displayDate } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { ActionForm } from '@/components/ui/action-form';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
export const metadata = { title: 'Tài khoản' };
export default async function ProfilePage() {
  const session = await requireSession();
  const { stages } = await getCatalog();
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Tài khoản của bạn</h1>
          <p>Thông tin cá nhân và quyền được phân công.</p>
        </div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-6 text-xl font-semibold">Thông tin cá nhân</h2>
          <ActionForm action={updateProfile}>
            <div>
              <label htmlFor="name">Họ và tên</label>
              <input
                id="name"
                name="name"
                defaultValue={session.profile.full_name}
                required
                maxLength={120}
                autoComplete="name"
              />
            </div>
            <div>
              <label htmlFor="phone">Số điện thoại</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={session.profile.phone ?? ''}
                maxLength={30}
                autoComplete="tel"
              />
            </div>
            <div>
              <span className="field-label">Email đăng nhập</span>
              <p className="text-muted-foreground">{session.profile.email ?? 'Chưa cập nhật'}</p>
            </div>
          </ActionForm>
          <form action={logout} className="mt-6">
            <Button variant="outline">Đăng xuất</Button>
          </form>
        </Card>
        <div className="space-y-6">
          <Card>
            <h2 className="text-xl font-semibold">Quyền và công đoạn</h2>
            <dl className="mt-6 space-y-4 text-sm">
              <div>
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
              <div>
                <dt className="text-muted-foreground">Công đoạn được giao</dt>
                <dd className="mt-2">
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
                Chủ xưởng ghi công không nhận lương.
              </p>
            )}
          </Card>
          <Card>
            <h2 className="mb-4 text-xl font-semibold">Đặt mật khẩu</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Dùng khi vừa nhận lời mời hoặc muốn đổi mật khẩu.
            </p>
            <ActionForm action={setPassword} submitLabel="Lưu mật khẩu">
              <div>
                <label htmlFor="password">Mật khẩu mới (ít nhất 12 ký tự)</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                />
              </div>
            </ActionForm>
          </Card>
          <Card id="installation">
            <h2 className="text-xl font-semibold">Cài trên điện thoại</h2>
            <p className="mt-4 text-sm text-muted-foreground">
              Android: mở ứng dụng bằng Chrome, chọn menu rồi chọn “Cài đặt ứng dụng” hoặc “Thêm vào
              màn hình chính”.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              iPhone: mở bằng Safari, chọn Chia sẻ rồi “Thêm vào MH chính”.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Cần kết nối mạng để xem dữ liệu mới và gửi công. Cài đặt yêu cầu địa chỉ có kết nối
              bảo mật.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
