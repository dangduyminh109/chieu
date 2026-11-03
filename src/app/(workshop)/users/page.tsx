import { updateMember } from '@/features/users/update-member';
import { Dialog } from '@/components/ui/dialog';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { requireSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { getCatalog } from '@/features/shared/data';
import { createWorker } from '@/features/users/actions';
import { roleLabel } from '@/lib/utils';
import { UsersRound, Pencil, Plus } from 'lucide-react';
import { StageIcon } from '@/features/production/stage-icon';
import { Card } from '@/components/ui/card';
import { ActionForm } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Denied } from '@/components/ui/states';
import { PageHeader } from '@/components/ui/page-header';
import type { Role, Profile } from '@/types/domain';

export const metadata = { title: 'Thành viên' };

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (!parts.length || !parts[0]) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0][0];
  const last = parts[parts.length - 1][0];
  return (first + last).toUpperCase();
}

export default async function UsersPage() {
  const session = await requireSession();
  if (!can(session.roles, 'provision_users')) return <Denied />;
  const db = await createClient();
  const [people, roles, skills, catalog] = await Promise.all([
    db.from('profiles').select('*').order('full_name'),
    db.from('user_roles').select('*'),
    db.from('worker_skills').select('*'),
    getCatalog(),
  ]);
  if (people.error || roles.error || skills.error) throw new Error('MEMBERS_QUERY_FAILED');

  const canEdit = (person: Profile) =>
    person.id !== session.userId &&
    (can(session.roles, 'manage_users') ||
      (roles.data.some((r) => r.user_id === person.id && r.role === 'WORKER') &&
        !roles.data.some(
          (r) => r.user_id === person.id && (r.role === 'ADMIN' || r.role === 'OWNER'),
        )));

  const renderEditDialog = (person: Profile, isMobile = false) => {
    if (!canEdit(person)) return null;

    return (
      <Dialog
        title={`Chỉnh sửa ${person.full_name}`}
        trigger="Chỉnh sửa"
        variant="outline"
        triggerIcon={<Pencil size={14} />}
        triggerClassName={
          isMobile
            ? 'flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl border border-border text-xs font-semibold hover:bg-muted text-foreground shadow-2xs ml-auto'
            : 'flex items-center gap-1.5 text-xs font-semibold ml-auto'
        }
      >
        <ActionForm action={updateMember} submitLabel="Lưu thay đổi">
          <input type="hidden" name="id" value={person.id} />
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field id={`edit-name-${person.id}`} label="Họ và tên">
                <input
                  id={`edit-name-${person.id}`}
                  name="name"
                  defaultValue={person.full_name}
                  required
                  maxLength={120}
                />
              </Field>
            </div>
            <Field id={`edit-username-${person.id}`} label="Tên đăng nhập">
              <input
                id={`edit-username-${person.id}`}
                name="username"
                defaultValue={person.username ?? ''}
                required
                minLength={3}
                maxLength={32}
                pattern="[A-Za-z0-9][A-Za-z0-9_.-]{2,31}"
                autoCapitalize="none"
              />
            </Field>
            <Field id={`edit-phone-${person.id}`} label="Số điện thoại">
              <input
                id={`edit-phone-${person.id}`}
                name="phone"
                type="tel"
                defaultValue={person.phone ?? ''}
                maxLength={30}
              />
            </Field>
          </div>

          {can(session.roles, 'manage_users') && (
            <fieldset className="space-y-1.5">
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Vai trò tài khoản
              </legend>
              <div className="grid grid-cols-3 gap-1.5">
                {(['ADMIN', 'OWNER', 'WORKER'] as Role[]).map((role) => (
                  <label
                    key={role}
                    className="checkbox-card !min-h-[38px] !p-2 !gap-1.5 !text-xs justify-center text-center font-medium"
                  >
                    <input
                      type="checkbox"
                      name="roles"
                      value={role}
                      defaultChecked={roles.data.some(
                        (r) => r.user_id === person.id && r.role === role,
                      )}
                    />
                    <span className="truncate">{roleLabel[role]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset className="space-y-1.5">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Công đoạn được giao
            </legend>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {catalog.stages
                .filter((s) => s.active)
                .map((s, idx, arr) => (
                  <label
                    key={s.id}
                    className={`checkbox-card !min-h-[40px] !p-2 !gap-2 !text-xs font-medium ${
                      arr.length % 2 === 1 && idx === arr.length - 1
                        ? 'col-span-2 sm:col-span-1'
                        : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="skills"
                      value={s.id}
                      defaultChecked={skills.data.some(
                        (k) => k.user_id === person.id && k.stage_id === s.id,
                      )}
                    />
                    <StageIcon name={s.name} size={22} className="rounded-md border border-border/70" />
                    <span className="truncate">{s.name}</span>
                  </label>
                ))}
            </div>
          </fieldset>

          <div className="space-y-1.5 pt-1">
            {can(session.roles, 'manage_users') && (
              <label className="checkbox-card !min-h-[36px] !py-1.5 !px-2.5 !gap-2 !text-xs">
                <input type="checkbox" name="zero" defaultChecked={person.zero_wage} />
                <span>Chủ cơ sở ghi công không nhận lương</span>
              </label>
            )}
            <label className="checkbox-card !min-h-[36px] !py-1.5 !px-2.5 !gap-2 !text-xs">
              <input type="checkbox" name="active" defaultChecked={person.active} />
              <span>Tài khoản đang hoạt động</span>
            </label>
          </div>

          <Field id={`reason-${person.id}`} label="Lý do thay đổi">
            <input
              id={`reason-${person.id}`}
              name="reason"
              minLength={5}
              maxLength={500}
              required
              placeholder="Ghi rõ lý do cập nhật tài khoản…"
            />
          </Field>
        </ActionForm>
      </Dialog>
    );
  };

  const createDialog = (
    <Dialog
      title="Tạo tài khoản"
      openOnHash="new-user"
      trigger="Tạo tài khoản"
      triggerIcon={<Plus size={16} />}
      triggerClassName="btn btn-primary font-bold shadow-xs flex items-center gap-1.5 ml-auto"
      description={
        can(session.roles, 'manage_users')
          ? 'Chọn một hoặc nhiều vai trò cho tài khoản mới.'
          : 'Tài khoản mới có vai trò thợ.'
      }
    >
      <ActionForm action={createWorker} submitLabel="Tạo tài khoản">
        {can(session.roles, 'manage_users') && (
          <fieldset className="space-y-1.5">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Vai trò tài khoản
            </legend>
            <div className="grid grid-cols-3 gap-1.5">
              {(['OWNER', 'WORKER', 'ADMIN'] as Role[]).map((role) => (
                <label
                  key={role}
                  className="checkbox-card !min-h-[38px] !p-2 !gap-1.5 !text-xs justify-center text-center font-medium"
                >
                  <input
                    type="checkbox"
                    name="roles"
                    value={role}
                    defaultChecked={role === 'WORKER'}
                  />
                  <span className="truncate">{roleLabel[role]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <Field id="new-name" label="Họ và tên">
          <input
            id="new-name"
            name="name"
            required
            maxLength={120}
            placeholder="VD: Nguyễn Văn A"
          />
        </Field>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Field
            id="new-username"
            label="Tên đăng nhập"
          >
            <input
              id="new-username"
              name="username"
              required
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9][A-Za-z0-9_.-]{2,31}"
              autoCapitalize="none"
              autoComplete="off"
              placeholder="VD: nguyen_van_a"
            />
          </Field>
          <Field id="new-email" label="Email đăng nhập">
            <input
              id="new-email"
              name="email"
              type="email"
              autoComplete="off"
              required
              placeholder="email@vi-du.com"
            />
          </Field>
        </div>
        <Field
          id="new-password"
          label="Mật khẩu ban đầu"
          hint="Ít nhất 5 ký tự. Người sử dụng có thể đổi lại sau."
        >
          <input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={5}
            maxLength={128}
            required
            placeholder="Tối thiểu 5 ký tự"
          />
        </Field>
        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Công đoạn được giao
          </legend>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {catalog.stages
              .filter((s) => s.active)
              .map((s, idx, arr) => (
                <label
                  key={s.id}
                  className={`checkbox-card !min-h-[40px] !p-2 !gap-2 !text-xs font-medium ${
                    arr.length % 2 === 1 && idx === arr.length - 1
                      ? 'col-span-2 sm:col-span-1'
                      : ''
                  }`}
                >
                  <input type="checkbox" name="skills" value={s.id} />
                  <StageIcon name={s.name} size={22} className="rounded-md border border-border/70" />
                  <span className="truncate">{s.name}</span>
                </label>
              ))}
          </div>
        </fieldset>
      </ActionForm>
    </Dialog>
  );

  const memberList = people.data as Profile[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thành viên"
        description="Vai trò tài khoản và công đoạn được giao."
        icon={UsersRound}
        action={createDialog}
      />

      <Card className="p-4 sm:p-6 space-y-4">
        {/* Desktop Table View */}
        <div className="hidden sm:block">
          <DataTable
            caption="Danh sách thành viên"
            rows={memberList}
            rowKey={(p) => p.id}
            columns={[
              { key: 'name', header: 'Họ và tên', cell: (p) => p.full_name },
              { key: 'username', header: 'Tên đăng nhập', cell: (p) => p.username ?? 'Chưa đặt' },
              { key: 'email', header: 'Email', cell: (p) => p.email ?? 'Chưa ghi' },
              {
                key: 'roles',
                header: 'Vai trò',
                cell: (p) => (
                  <span className="flex flex-wrap gap-2">
                    {roles.data
                      .filter((r) => r.user_id === p.id)
                      .map((r) => (
                        <Badge key={r.role}>{roleLabel[r.role as Role]}</Badge>
                      ))}
                  </span>
                ),
              },
              {
                key: 'skills',
                header: 'Công đoạn',
                cell: (p) => {
                  const userStages = catalog.stages.filter((s) =>
                    skills.data.some((k) => k.user_id === p.id && k.stage_id === s.id),
                  );
                  if (!userStages.length)
                    return <span className="text-xs text-muted-foreground">Chưa phân công</span>;
                  return (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {userStages.map((s) => (
                        <span
                          key={s.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 px-2 py-0.5 text-xs font-medium"
                        >
                          <StageIcon name={s.name} size={15} />
                          {s.name}
                        </span>
                      ))}
                    </div>
                  );
                },
              },
              {
                key: 'status',
                header: 'Trạng thái',
                cell: (p) => (
                  <Badge variant={p.active ? 'success' : 'secondary'}>
                    {p.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                  </Badge>
                ),
              },
              {
                key: 'actions',
                header: 'Thao tác',
                className: 'text-right',
                hideWhenEmpty: true,
                cell: (person) => (
                  <div className="flex justify-end">
                    {renderEditDialog(person, false)}
                  </div>
                ),
              },
            ]}
          />
        </div>

        {/* Mobile Cards (Balanced, ergonomic & buttons aligned to the right) */}
        <div className="sm:hidden divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
          {memberList.length ? (
            memberList.map((person) => {
              const userRoles = roles.data.filter((r) => r.user_id === person.id);
              const userSkills = catalog.stages
                .filter((s) => skills.data.some((k) => k.user_id === person.id && k.stage_id === s.id))
                .map((s) => s.name);
              const editable = canEdit(person);

              return (
                <div key={person.id} className="p-4 space-y-3 hover:bg-muted/30 transition-colors">
                  {/* Top: Avatar, Name, Username & Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary font-bold text-sm shadow-2xs">
                        {getInitials(person.full_name)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-base text-foreground leading-snug break-words">
                          {person.full_name}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">
                          @{person.username || 'chuadatten'}
                        </p>
                      </div>
                    </div>

                    <Badge variant={person.active ? 'success' : 'secondary'} className="shrink-0 text-xs">
                      {person.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                    </Badge>
                  </div>

                  {/* Roles badges */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {userRoles.map((r) => (
                      <Badge key={r.role} variant="outline" className="text-xs font-medium">
                        {roleLabel[r.role as Role]}
                      </Badge>
                    ))}
                    {person.zero_wage && (
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        Không nhận lương
                      </span>
                    )}
                  </div>

                  {/* Contact & Skills info block */}
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5 text-xs space-y-1.5">
                    {person.email && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">Email:</span>
                        <span className="font-medium text-foreground truncate">{person.email}</span>
                      </div>
                    )}
                    {person.phone && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">Điện thoại:</span>
                        <span className="font-medium text-foreground">{person.phone}</span>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-muted-foreground shrink-0 pt-0.5">Công đoạn:</span>
                      <div className="flex flex-wrap items-center justify-end gap-1.5 text-right">
                        {userSkills.length ? (
                          catalog.stages
                            .filter((s) =>
                              skills.data.some((k) => k.user_id === person.id && k.stage_id === s.id),
                            )
                            .map((s) => (
                              <span
                                key={s.id}
                                className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card px-1.5 py-0.5 text-[11px] font-medium text-foreground shadow-2xs"
                              >
                                <StageIcon name={s.name} size={13} />
                                {s.name}
                              </span>
                            ))
                        ) : (
                          <span className="font-medium text-muted-foreground">Chưa phân công</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action button aligned to the RIGHT */}
                  {editable && (
                    <div className="flex justify-end pt-1">
                      {renderEditDialog(person, true)}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Chưa có thành viên nào.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
