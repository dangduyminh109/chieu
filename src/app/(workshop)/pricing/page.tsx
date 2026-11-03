import { LaborScopeFields } from '@/features/pricing/labor-scope-fields';
import { WorkerSelect } from '@/components/ui/worker-select';
import { Avatar } from '@/components/ui/avatar';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog } from '@/components/ui/dialog';
import { DataTable } from '@/components/ui/data-table';
import Link from 'next/link';
import Image from 'next/image';
import { Coins, Layers, Users } from 'lucide-react';
import { matImageUrl } from '@/features/mat-types/image-url';
import { requireSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { getCatalog, getRates } from '@/features/shared/data';
import { addRate } from '@/features/pricing/actions';
import { businessDate, displayDate, money } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { ActionForm } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Denied, EmptyState } from '@/components/ui/states';
import { PageHeader } from '@/components/ui/page-header';

export const metadata = { title: 'Đơn giá công' };

export default async function PricingPage() {
  const session = await requireSession();
  if (!can(session.roles, 'manage_catalog')) return <Denied />;
  const [{ mats, stages }, rates] = await Promise.all([getCatalog(), getRates()]);
  const db = await createClient();
  const people = await db.from('profiles').select('id,full_name,avatar_path').eq('active', true);
  if (people.error) throw new Error('PROFILE_QUERY_FAILED');

  const addDialog = (
    <Dialog title="Thêm mốc đơn giá" trigger="Thêm đơn giá">
      {stages.some((s) => s.active) ? (
        <ActionForm action={addRate} submitLabel="Lưu đơn giá mới">
          <LaborScopeFields
            mats={mats.filter((m) => m.active)}
            stages={stages.filter((s) => s.active)}
          />
          <Field
            id="worker"
            label="Áp dụng cho"
            hint="Đơn giá riêng của thợ được ưu tiên hơn đơn giá chung."
          >
            <WorkerSelect
              id="worker"
              name="worker_id"
              workers={people.data.map((p) => ({
                id: p.id,
                name: p.full_name,
                avatar_path: p.avatar_path,
              }))}
              allLabel="Đơn giá chung (tất cả thợ)"
            />
          </Field>
          <Field id="effective" label="Có hiệu lực từ ngày">
            <DatePicker
              id="effective"
              name="effective_from"
              required
              defaultValue={businessDate()}
              min="2000-01-01"
              max="2100-12-31"
            />
          </Field>
          <Field id="unit_rate" label="Đơn giá mỗi chiếu (đồng)">
            <input
              id="unit_rate"
              name="unit_rate"
              type="number"
              inputMode="numeric"
              min={0}
              max={1000000000}
              step={1}
              required
              placeholder="VD: 15000"
            />
          </Field>
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
    </Dialog>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Đơn giá công"
        description="Đơn giá theo công đoạn và loại chiếu, có hiệu lực theo ngày."
        icon={Coins}
        action={addDialog}
      />
      <Card>
        <h2 className="text-lg font-bold text-foreground">Lịch sử đơn giá</h2>
        <DataTable
          caption="Lịch sử đơn giá"
          rows={rates}
          rowKey={(r) => r.id}
          emptyMessage="Chưa thiết lập đơn giá."
          columns={[
            {
              key: 'mat',
              header: 'Loại chiếu',
              cell: (r) => {
                const mat = r.mat_type_id ? mats.find((m) => m.id === r.mat_type_id) : null;
                if (!mat) return <span className="text-muted-foreground">Không phân loại</span>;
                return (
                  <div className="flex items-center gap-2">
                    {mat.image_path ? (
                      <Image
                        src={matImageUrl(mat.image_path)!}
                        alt={mat.name}
                        width={28}
                        height={28}
                        unoptimized
                        className="size-7 rounded-lg border border-border/80 object-cover shrink-0 shadow-2xs"
                      />
                    ) : (
                      <div className="size-7 rounded-lg border border-border/60 bg-muted/60 flex items-center justify-center shrink-0 text-muted-foreground/50">
                        <Layers size={13} />
                      </div>
                    )}
                    <span className="font-semibold text-foreground">{mat.name}</span>
                  </div>
                );
              },
            },
            {
              key: 'stage',
              header: 'Công đoạn',
              cell: (r) => stages.find((s) => s.id === r.stage_id)?.name,
            },
            {
              key: 'worker',
              header: 'Áp dụng cho',
              cell: (r) => {
                if (!r.worker_id) {
                  return (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                      <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Users size={11} />
                      </div>
                      <span>Đơn giá chung</span>
                    </div>
                  );
                }
                const person = people.data.find((p) => p.id === r.worker_id);
                return (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Avatar
                      path={person?.avatar_path}
                      name={person?.full_name ?? 'Thợ'}
                      className="size-5 text-[9px] shrink-0 ring-1 ring-border"
                    />
                    <span className="font-medium text-foreground">
                      {person?.full_name ?? 'Thợ đã ngừng hoạt động'}
                    </span>
                  </div>
                );
              },
            },
            { key: 'date', header: 'Có hiệu lực từ', cell: (r) => displayDate(r.effective_from) },
            {
              key: 'price',
              header: 'Đơn giá mỗi chiếu',
              className: 'text-right',
              cell: (r) => money(r.unit_rate),
            },
          ]}
        />
      </Card>
    </div>
  );
}
