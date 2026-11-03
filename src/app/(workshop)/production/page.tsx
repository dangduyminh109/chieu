import { redirect } from 'next/navigation';
import { ListFilter, BarChart3, ArrowUpRight, NotebookPen } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog } from '@/components/ui/dialog';
import Link from 'next/link';
import { requireSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { businessDate } from '@/lib/utils';
import { dateSchema } from '@/features/production/schemas';
import { getCatalog, getRates, getWorkLogs } from '@/features/shared/data';
import { hasZeroWage } from '@/features/production/calculations';
import { WorkForm } from '@/features/production/work-form';
import { WorkHistory } from '@/features/production/work-history';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { EmptyState, Denied } from '@/components/ui/states';

export const metadata = { title: 'Sản xuất' };

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  if (!session.roles.includes('WORKER') && !can(session.roles, 'view_operations'))
    return <Denied />;
  if (session.roles.includes('WORKER') && !can(session.roles, 'view_operations'))
    redirect('/wages');
  const params = await searchParams;
  const today = businessDate();
  const from = dateSchema.safeParse(params.from).success
    ? String(params.from)
    : `${today.slice(0, 7)}-01`;
  const to = dateSchema.safeParse(params.to).success ? String(params.to) : today;
  const page = Math.max(1, Math.min(10000, Math.trunc(Number(params.page) || 1)));
  const isManager = can(session.roles, 'view_operations');
  const team = isManager && params.scope === 'team';

  const [{ mats, stages }, rates, history] = await Promise.all([
    getCatalog(),
    getRates(),
    getWorkLogs(team ? null : session.userId, from, to, page),
  ]);

  let names: Record<string, string> | undefined;
  if (team) {
    const db = await createClient();
    const people = await db.from('profiles').select('id,full_name');
    if (people.error) throw new Error('PROFILE_QUERY_FAILED');
    names = Object.fromEntries(people.data.map((p) => [p.id, p.full_name]));
  }
  const assigned = stages.filter((s) => s.active && session.skills.includes(s.id));

  return (
    <>
      <PageHeader title="Sản xuất" description="Theo dõi số lượng chiếu và tiền công chi tiết." icon={NotebookPen} />
      <div className="space-y-6">
        {/* Shortcut banner to /analytics if worker wants to see calendar & charts */}
        {!isManager && (
          <Link
            href="/analytics"
            className="flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 transition-all hover:border-primary hover:bg-primary/10"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                <BarChart3 size={20} />
              </span>
              <div>
                <strong className="block text-sm font-bold text-foreground">
                  Xem Thống kê số lượng & Biểu đồ (Tuần, Tháng, Năm)
                </strong>
                <span className="text-xs text-muted-foreground">
                  Theo dõi số lượng chiếu từng ngày và biểu đồ tích lũy tiền công
                </span>
              </div>
            </div>
            <ArrowUpRight size={18} className="text-primary shrink-0" />
          </Link>
        )}

        {/* Manager work recording dialog or empty state */}
        {isManager && (
          <>
            {can(session.roles, 'submit_work') ? (
              assigned.length &&
              (assigned.some((s) => s.code !== 'WEAVING') || mats.some((m) => m.active)) ? (
                <Dialog title="Ghi công sản xuất" trigger="Ghi công hôm nay" openOnHash="new-work">
                  <WorkForm
                    mats={mats.filter((m) => m.active)}
                    stages={assigned}
                    rates={rates}
                    workerId={session.userId}
                    today={today}
                    zeroWage={hasZeroWage(session.roles, session.profile.zero_wage)}
                  />
                </Dialog>
              ) : (
                <Card>
                  <EmptyState
                    title="Chưa thể ghi công"
                    description="Người quản lý cần tạo loại chiếu và phân công công đoạn cho tài khoản của bạn."
                  />
                </Card>
              )
            ) : (
              <Card>
                <h2 className="text-xl font-semibold">Theo dõi sản xuất</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  Chọn nhật ký chung để xem công đã gửi. Muốn tự ghi công, tài khoản cần thêm
                  vai trò thợ và công đoạn được phân công.
                </p>
              </Card>
            )}
          </>
        )}

        {/* Detailed History Table with Filter */}
        <div className="min-w-0 space-y-6">
          <Card>
            <h3 className="text-base font-bold text-foreground mb-3">Tra cứu lịch sử sản lượng</h3>
            <form className="grid grid-cols-2 items-end gap-3 max-sm:gap-2">
              <Field id="from" label="Từ ngày">
                <DatePicker id="from" name="from" defaultValue={from} required />
              </Field>
              <Field id="to" label="Đến ngày">
                <DatePicker id="to" name="to" defaultValue={to} required />
              </Field>
              {isManager && (
                <Field id="scope" label="Phạm vi">
                  <Select id="scope" name="scope" defaultValue={team ? 'team' : 'personal'}>
                    <option value="personal">Bản ghi của tôi</option>
                    <option value="team">Tất cả</option>
                  </Select>
                </Field>
              )}
              <Button type="submit" variant="outline" className="w-full">
                <ListFilter size={16} aria-hidden />
                Xem lịch sử
              </Button>
            </form>
          </Card>
          <WorkHistory logs={history.logs} mats={mats} stages={stages} names={names} />
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
            <span>
              {history.count} bản ghi · Trang {page}
            </span>
            <div className="flex gap-4">
              {page > 1 && (
                <Link
                  className="p-3 underline"
                  href={{
                    pathname: '/production',
                    query: { from, to, page: page - 1, scope: team ? 'team' : 'personal' },
                  }}
                >
                  Trang trước
                </Link>
              )}
              {page * 20 < history.count && (
                <Link
                  className="p-3 underline"
                  href={{
                    pathname: '/production',
                    query: { from, to, page: page + 1, scope: team ? 'team' : 'personal' },
                  }}
                >
                  Trang sau
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
