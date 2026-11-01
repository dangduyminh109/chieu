import Link from 'next/link';
import {
  ArrowUpRight,
  NotebookPen,
  Layers3,
  Coins,
  CalendarDays,
  CheckCheck,
  Clock3,
} from 'lucide-react';
import { requireSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { businessDate, money, number } from '@/lib/utils';
import { getCatalog, getWorkLogs } from '@/features/shared/data';
import { WorkHistory } from '@/features/production/work-history';
import { ProductionChart } from '@/features/dashboard/production-chart';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
export default async function Home() {
  const session = await requireSession();
  const manager = can(session.roles, 'view_operations');
  const today = businessDate();
  const from = `${today.slice(0, 7)}-01`;
  const db = await createClient();
  const [summaryResult, todayResult, catalog, recent] = await Promise.all([
    db.rpc('production_summary', { p_from: from, p_to: today, p_personal: !manager }),
    db.rpc('production_summary', { p_from: today, p_to: today, p_personal: !manager }),
    getCatalog(),
    getWorkLogs(session.userId, from, today, 1, 5),
  ]);
  if (summaryResult.error || todayResult.error) throw new Error('SUMMARY_QUERY_FAILED');
  const summary = summaryResult.data as {
    records: number;
    submitted_quantity: number;
    submitted_amount: number;
    approved_amount: number;
    by_stage: { name: string; quantity: number }[];
  };
  const daily = todayResult.data as typeof summary;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Chào {session.profile.full_name.split(' ').at(-1)},</h1>
          <p>
            {manager
              ? 'Cùng nhìn lại công việc của xưởng hôm nay.'
              : 'Ghi lại thành quả, theo dõi tiền công của bạn.'}
          </p>
        </div>
        {can(session.roles, 'submit_work') && (
          <Button asChild>
            <Link href="/production#new-work">
              <NotebookPen size={18} aria-hidden />
              Ghi công hôm nay
            </Link>
          </Button>
        )}
      </div>
      <section className="relative mb-8 overflow-hidden rounded-2xl bg-primary p-6 text-white sm:p-8">
        <div
          aria-hidden
          className="weave absolute -right-16 -top-16 h-64 w-64 rotate-12 rounded-3xl opacity-20"
        />
        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-2 text-sm text-white/80">
            <CalendarDays size={16} aria-hidden />
            Tháng {Number(today.slice(5, 7))}, {today.slice(0, 4)}
          </span>
          <h2 className="mt-4 text-2xl font-semibold sm:text-3xl">
            Từng tấm chiếu,
            <br />
            từng ngày chăm chỉ.
          </h2>
          <p className="mt-4 text-sm text-white/80">
            {manager
              ? 'Theo dõi công đã gửi và cập nhật đơn giá cho mọi người trong xưởng.'
              : 'Chọn công đoạn và loại chiếu, tiền công sẽ được tính theo ngày bạn làm.'}
          </p>
        </div>
      </section>
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          {
            label: 'Bản ghi hôm nay',
            value: number(daily.records),
            hint: manager ? 'Công đã ghi của cả xưởng' : 'Công bạn đã ghi hôm nay',
            icon: NotebookPen,
          },
          {
            label: 'Số chiếu chờ duyệt',
            value: number(summary.submitted_quantity),
            hint: 'Tổng lượt xử lý trong tháng',
            icon: Clock3,
          },
          {
            label: 'Công đã duyệt tháng này',
            value: money(summary.approved_amount),
            hint: 'Chưa trừ các khoản thanh toán',
            icon: CheckCheck,
          },
        ].map((item) => (
          <Card key={item.label}>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <item.icon size={20} className="text-primary" aria-hidden />
            </div>
            <p className="text-3xl font-bold">{item.value}</p>
            <p className="mt-3 text-xs text-muted-foreground">{item.hint}</p>
          </Card>
        ))}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <div className="min-w-0 space-y-6">
          <Card>
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Công việc theo công đoạn</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {manager ? 'Cả xưởng' : 'Của bạn'} trong tháng này
                </p>
              </div>
              <Link
                href="/production"
                className="flex items-center gap-1 text-sm font-semibold text-primary"
              >
                Xem nhật ký
                <ArrowUpRight size={16} aria-hidden />
              </Link>
            </div>
            {summary.by_stage.some((s) => s.quantity > 0) ? (
              <ProductionChart data={summary.by_stage} />
            ) : (
              <EmptyState
                title="Một tháng mới đang chờ"
                description="Biểu đồ sẽ xuất hiện khi có công được gửi. Bắt đầu bằng việc ghi công trong ngày."
              />
            )}
            <p className="text-xs text-muted-foreground">
              Số lượt xử lý theo công đoạn, không phải số chiếu thành phẩm nhập kho.
            </p>
          </Card>
          <WorkHistory logs={recent.logs} mats={catalog.mats} stages={catalog.stages} />
        </div>
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-xl font-semibold">Lối tắt công việc</h2>
            <div className="space-y-3">
              {[
                {
                  href: '/production',
                  label: can(session.roles, 'submit_work')
                    ? 'Ghi công và xem lịch sử'
                    : 'Xem nhật ký sản xuất',
                  description: 'Công việc trong ngày',
                  icon: NotebookPen,
                  show: true,
                },
                {
                  href: '/mat-types',
                  label: 'Danh mục loại chiếu',
                  description: 'Thêm và cập nhật sản phẩm',
                  icon: Layers3,
                  show: manager,
                },
                {
                  href: '/pricing',
                  label: 'Thiết lập đơn giá',
                  description: 'Đơn giá theo ngày áp dụng',
                  icon: Coins,
                  show: manager,
                },
              ]
                .filter((i) => i.show)
                .map((i) => (
                  <Link
                    key={i.href}
                    href={i.href}
                    className="flex min-h-16 items-center gap-3 rounded-xl p-3 hover:bg-muted"
                  >
                    <span className="rounded-xl bg-muted p-3 text-primary">
                      <i.icon size={20} aria-hidden />
                    </span>
                    <span className="flex-1">
                      <strong className="block text-sm">{i.label}</strong>
                      <span className="text-xs text-muted-foreground">{i.description}</span>
                    </span>
                    <ArrowUpRight size={16} aria-hidden />
                  </Link>
                ))}
            </div>
          </Card>
          <Card className="bg-muted">
            <h2 className="text-lg font-semibold">Rõ công, đúng đơn giá</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Mỗi bản ghi giữ lại đơn giá đã áp dụng. Thay đổi giá sau này sẽ không làm thay đổi
              công cũ.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              Duyệt công và thanh toán lương sẽ được bổ sung ở giai đoạn tiếp theo.
            </p>
          </Card>
          {manager && (
            <Card>
              <h2 className="text-lg font-semibold">Thu chi và kho hàng</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Các phân hệ này chưa triển khai. Doanh thu, tồn kho và số dư thanh toán chưa được
                tính trong giai đoạn hiện tại.
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
