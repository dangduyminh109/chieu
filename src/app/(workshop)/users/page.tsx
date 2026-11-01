import { requireSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { getCatalog } from '@/features/shared/data';
import { configureMember } from '@/features/users/actions';
import { roleLabel } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { ActionForm } from '@/components/ui/action-form';
import { Denied } from '@/components/ui/states';
import type { Role, Profile } from '@/types/domain';
export const metadata = { title: 'Thành viên' };
export default async function UsersPage() {
  const session = await requireSession();
  if (!can(session.roles, 'manage_users')) return <Denied />;
  const db = await createClient();
  const [people, roles, skills, catalog] = await Promise.all([
    db.from('profiles').select('*').order('full_name'),
    db.from('user_roles').select('*'),
    db.from('worker_skills').select('*'),
    getCatalog(),
  ]);
  if (people.error || roles.error || skills.error) throw new Error('MEMBERS_QUERY_FAILED');
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Thành viên</h1>
          <p>Phân vai trò tài khoản độc lập với công đoạn làm việc.</p>
        </div>
      </div>
      <Card className="mb-6">
        <h2 className="text-lg font-semibold">Mời người vào xưởng</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Quản trị viên mời tài khoản qua trang quản lý xác thực. Sau khi tài khoản được tạo, phân
          vai trò và công đoạn tại đây. Hệ thống không cho đăng ký công khai.
        </p>
      </Card>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {(people.data as Profile[]).map((person) => (
          <Card key={person.id}>
            <h2 className="text-lg font-semibold">{person.full_name}</h2>
            <p className="mt-1 mb-6 break-all text-sm text-muted-foreground">{person.email}</p>
            {person.id === session.userId ? (
              <p className="text-sm text-muted-foreground">
                Đây là tài khoản của bạn. Không thể tự thay đổi quyền tại đây.
              </p>
            ) : (
              <ActionForm action={configureMember} submitLabel="Lưu phân quyền">
                <input type="hidden" name="id" value={person.id} />
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold">Vai trò tài khoản</legend>
                  {(['ADMIN', 'OWNER', 'WORKER'] as Role[]).map((role) => (
                    <label key={role}>
                      <input
                        type="checkbox"
                        name="roles"
                        value={role}
                        defaultChecked={roles.data.some(
                          (r) => r.user_id === person.id && r.role === role,
                        )}
                      />
                      {roleLabel[role]}
                    </label>
                  ))}
                </fieldset>
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold">Công đoạn được giao</legend>
                  {catalog.stages
                    .filter((s) => s.active)
                    .map((s) => (
                      <label key={s.id}>
                        <input
                          type="checkbox"
                          name="skills"
                          value={s.id}
                          defaultChecked={skills.data.some(
                            (k) => k.user_id === person.id && k.stage_id === s.id,
                          )}
                        />
                        {s.name}
                      </label>
                    ))}
                </fieldset>
                <label>
                  <input type="checkbox" name="zero" defaultChecked={person.zero_wage} />
                  Chủ xưởng ghi công không nhận lương
                </label>
                <label>
                  <input type="checkbox" name="active" defaultChecked={person.active} />
                  Tài khoản đang hoạt động
                </label>
                <div>
                  <label htmlFor={`reason-${person.id}`}>Lý do thay đổi</label>
                  <input
                    id={`reason-${person.id}`}
                    name="reason"
                    minLength={5}
                    maxLength={500}
                    required
                  />
                </div>
              </ActionForm>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
