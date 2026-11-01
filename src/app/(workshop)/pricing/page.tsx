import Link from 'next/link';
import { requireSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { getCatalog, getRates } from '@/features/shared/data';
import { addRate } from '@/features/pricing/actions';
import { businessDate, displayDate, money } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { ActionForm } from '@/components/ui/action-form';
import { Denied, EmptyState } from '@/components/ui/states';
export const metadata = { title: 'Đơn giá công' };
export default async function PricingPage() {
  const session = await requireSession();
  if (!can(session.roles, 'manage_catalog')) return <Denied />;
  const [{ mats, stages }, rates] = await Promise.all([getCatalog(), getRates()]);
  const db = await createClient();
  const people = await db.from('profiles').select('id,full_name').eq('active', true);
  if (people.error) throw new Error('PROFILE_QUERY_FAILED');
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Đơn giá công</h1>
          <p>Áp dụng theo ngày làm việc, giữ nguyên công đã ghi nhận.</p>
        </div>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <h2 className="mb-6 text-xl font-semibold">Thêm mốc đơn giá</h2>
          {mats.some((m) => m.active) ? (
            <ActionForm action={addRate} submitLabel="Lưu đơn giá mới">
              <div>
                <label htmlFor="mat">Loại chiếu</label>
                <select id="mat" name="mat_type_id" required>
                  {mats
                    .filter((m) => m.active)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label htmlFor="stage">Công đoạn</label>
                <select id="stage" name="stage_id" required>
                  {stages
                    .filter((s) => s.active)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label htmlFor="worker">Áp dụng cho</label>
                <select id="worker" name="worker_id">
                  <option value="">Đơn giá chung</option>
                  {people.data.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-muted-foreground">
                  Đơn giá riêng của thợ được ưu tiên hơn đơn giá chung.
                </p>
              </div>
              <div>
                <label htmlFor="effective">Có hiệu lực từ ngày</label>
                <input
                  id="effective"
                  name="effective_from"
                  type="date"
                  required
                  defaultValue={businessDate()}
                  min="2000-01-01"
                  max="2100-12-31"
                />
              </div>
              <div>
                <label htmlFor="unit_rate">Đơn giá mỗi chiếu (đồng)</label>
                <input
                  id="unit_rate"
                  name="unit_rate"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={1000000000}
                  step={1}
                  required
                />
              </div>
              <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
                Mỗi mốc được lưu vào lịch sử. Để đổi giá, thêm mốc ngày mới. Công cũ sẽ không tự
                thay đổi.
              </p>
            </ActionForm>
          ) : (
            <EmptyState
              title="Cần thêm loại chiếu trước"
              description="Tạo danh mục trước khi thiết lập đơn giá."
            >
              <Link className="text-primary underline" href="/mat-types">
                Đến loại chiếu
              </Link>
            </EmptyState>
          )}
        </Card>
        <Card>
          <h2 className="text-xl font-semibold">Lịch sử đơn giá</h2>
          {rates.length === 0 ? (
            <EmptyState
              title="Chưa thiết lập đơn giá"
              description="Thêm đơn giá đầu tiên để thợ bắt đầu ghi công."
            />
          ) : (
            <div className="mt-6 divide-y divide-border">
              {rates.map((r) => (
                <article key={r.id} className="flex flex-wrap justify-between gap-4 py-4">
                  <div>
                    <h3 className="font-semibold">
                      {mats.find((m) => m.id === r.mat_type_id)?.name}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {stages.find((s) => s.id === r.stage_id)?.name} ·{' '}
                      {r.worker_id
                        ? (people.data.find((p) => p.id === r.worker_id)?.full_name ??
                          'Thợ đã ngừng hoạt động')
                        : 'Đơn giá chung'}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Từ {displayDate(r.effective_from)}
                    </p>
                  </div>
                  <strong className="text-primary">
                    {money(r.unit_rate)}
                    <span className="block text-right text-xs font-normal text-muted-foreground">
                      mỗi chiếu
                    </span>
                  </strong>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
