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
  const params = await searchParams;
  const today = businessDate();
  const from = dateSchema.safeParse(params.from).success
    ? String(params.from)
    : `${today.slice(0, 7)}-01`;
  const to = dateSchema.safeParse(params.to).success ? String(params.to) : today;
  const page = Math.max(1, Math.min(10000, Math.trunc(Number(params.page) || 1)));
  const team = can(session.roles, 'view_operations') && params.scope === 'team';
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
      <div className="page-heading">
        <div>
          <h1>Sản xuất</h1>
          <p>Ghi lại công việc, giữ rõ từng khoản công.</p>
        </div>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
        {can(session.roles, 'submit_work') ? (
          assigned.length && mats.some((m) => m.active) ? (
            <WorkForm
              mats={mats.filter((m) => m.active)}
              stages={assigned}
              rates={rates}
              workerId={session.userId}
              today={today}
              zeroWage={hasZeroWage(session.roles, session.profile.zero_wage)}
            />
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
              Chọn nhật ký của xưởng để xem công đã gửi. Muốn tự ghi công, tài khoản cần thêm vai
              trò thợ và công đoạn được phân công.
            </p>
          </Card>
        )}
        <div className="min-w-0 space-y-6">
          <Card>
            <form className="grid items-end gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="from">Từ ngày</label>
                <input id="from" name="from" type="date" defaultValue={from} required />
              </div>
              <div>
                <label htmlFor="to">Đến ngày</label>
                <input id="to" name="to" type="date" defaultValue={to} required />
              </div>
              {can(session.roles, 'view_operations') && (
                <div>
                  <label htmlFor="scope">Phạm vi</label>
                  <select id="scope" name="scope" defaultValue={team ? 'team' : 'personal'}>
                    <option value="personal">Công của tôi</option>
                    <option value="team">Cả xưởng</option>
                  </select>
                </div>
              )}
              <button className="min-h-12 rounded-xl bg-muted px-3 py-2 font-semibold text-primary">
                Xem lịch sử
              </button>
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
