import { Search, Layers } from 'lucide-react';
import Image from 'next/image';
import { matImageUrl } from '@/features/mat-types/image-url';
import { exactMoney } from '@/features/commerce/business-types';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { requireSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { getCatalog } from '@/features/shared/data';
import { saveMat } from '@/features/mat-types/actions';
import { ActionForm } from '@/components/ui/action-form';
import { CatalogFields as Fields } from '@/features/mat-types/catalog-fields';
import { getMatDefaults } from '@/features/mat-types/defaults-data';
import { Card } from '@/components/ui/card';
import { Denied } from '@/components/ui/states';
import { PageHeader } from '@/components/ui/page-header';

export const metadata = { title: 'Loại chiếu' };

export default async function MatTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  if (!can(session.roles, 'manage_catalog')) return <Denied />;
  const [{ mats }, defaults] = await Promise.all([getCatalog(), getMatDefaults()]);
  const { q = '' } = await searchParams;
  const visibleMats = mats.filter((m) => !(['CHIEU_16', 'CHIEU_18'].includes(m.code) && !m.active));
  const filtered = visibleMats.filter((m) =>
    `${m.name} ${m.code}`.toLocaleLowerCase('vi').includes(q.toLocaleLowerCase('vi')),
  );

  const addDialog = (
    <Dialog
      openOnHash="new-mat"
      title="Thêm loại chiếu"
      trigger="Thêm loại chiếu"
      triggerClassName="w-full sm:w-auto justify-center font-bold shadow-xs py-2.5 px-4"
    >
      <ActionForm action={saveMat} submitLabel="Thêm loại chiếu">
        <Fields prices={defaults.new} />
      </ActionForm>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loại chiếu"
        description="Danh mục dùng chung cho ghi nhận sản lượng và thiết lập đơn giá."
        icon={Layers}
        action={addDialog}
      />

      <Card className="p-4 sm:p-6 space-y-4">
        {/* Search bar */}
        <form role="search" className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="q" className="sr-only">
              Tìm loại chiếu
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Tìm loại chiếu…"
              className="w-full !min-h-9 rounded-xl border border-border bg-card !px-3 !py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:!min-h-10"
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            className="!min-h-9 h-9 shrink-0 gap-1.5 px-3 font-semibold sm:h-10 sm:!min-h-10"
            aria-label="Tìm kiếm"
          >
            <Search size={16} aria-hidden />
            Tìm
          </Button>
        </form>

        {/* Desktop Table */}
        <div className="hidden sm:block">
          <DataTable
            caption="Danh sách loại chiếu"
            rows={filtered}
            rowKey={(m) => m.id}
            emptyMessage="Chưa tìm thấy loại chiếu."
            columns={[
              {
                key: 'image',
                header: 'Ảnh',
                className: 'w-20',
                cell: (m) =>
                  m.image_path ? (
                    <Image
                      src={matImageUrl(m.image_path)!}
                      alt={m.name}
                      width={56}
                      height={56}
                      unoptimized
                      className="size-14 rounded-xl border border-border/80 object-cover shadow-2xs"
                    />
                  ) : (
                    <div className="size-14 rounded-xl border border-dashed border-border/80 bg-muted/30 flex flex-col items-center justify-center text-muted-foreground/50">
                      <Layers size={18} />
                      <span className="text-[9px] mt-0.5">Chưa ảnh</span>
                    </div>
                  ),
              },
              {
                key: 'name',
                header: 'Loại chiếu',
                cell: (m) => (
                  <div>
                    <span className="font-semibold text-foreground">{m.name}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">({m.code})</span>
                    {m.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {m.description}
                      </p>
                    )}
                  </div>
                ),
              },
              { key: 'size', header: 'Kích thước', cell: (m) => m.dimensions || 'Chưa ghi' },
              {
                key: 'cost',
                header: 'Giá vốn / chiếc',
                cell: (m) =>
                  defaults[m.id]?.cost_price == null ? (
                    <span className="text-xs text-muted-foreground">Chưa thiết lập</span>
                  ) : (
                    exactMoney(defaults[m.id].cost_price!)
                  ),
              },
              {
                key: 'status',
                header: 'Trạng thái',
                cell: (m) => (
                  <Badge variant={m.active ? 'success' : 'secondary'}>
                    {m.active ? 'Đang dùng' : 'Ngừng dùng'}
                  </Badge>
                ),
              },
              {
                key: 'actions',
                header: 'Thao tác',
                className: 'text-right',
                cell: (m) => (
                  <div className="flex justify-end">
                    <Dialog title={`Cập nhật ${m.name}`} trigger="Chỉnh sửa" variant="outline">
                      <ActionForm action={saveMat}>
                        <Fields mat={m} prices={defaults[m.id]} />
                      </ActionForm>
                    </Dialog>
                  </div>
                ),
              },
            ]}
          />
        </div>

        {/* Mobile Cards */}
        <div className="sm:hidden divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
          {filtered.length ? (
            filtered.map((m) => (
              <div key={m.id} className="p-4 space-y-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  {m.image_path ? (
                    <Image
                      src={matImageUrl(m.image_path)!}
                      alt={m.name}
                      width={64}
                      height={64}
                      unoptimized
                      className="size-16 shrink-0 rounded-xl border border-border object-cover shadow-2xs"
                    />
                  ) : (
                    <div className="size-16 shrink-0 rounded-xl border border-dashed border-border/80 bg-muted/30 flex flex-col items-center justify-center text-muted-foreground/50">
                      <Layers size={20} />
                      <span className="text-[9px] mt-0.5">Chưa ảnh</span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-base text-foreground leading-snug break-words">
                      {m.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                        {m.code}
                      </span>
                      {m.dimensions && (
                        <span>
                          • Kích thước:{' '}
                          <strong className="text-foreground font-semibold">{m.dimensions}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant={m.active ? 'success' : 'secondary'} className="shrink-0 text-xs">
                    {m.active ? 'Đang dùng' : 'Ngừng dùng'}
                  </Badge>
                </div>

                {m.description && (
                  <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-xl italic">
                    {m.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Giá vốn / chiếc:{' '}
                  <strong className="text-foreground">
                    {defaults[m.id]?.cost_price == null
                      ? 'Chưa thiết lập'
                      : exactMoney(defaults[m.id].cost_price!)}
                  </strong>
                </p>

                <div className="flex items-center justify-end pt-1">
                  <Dialog
                    title={`Cập nhật ${m.name}`}
                    trigger="Chỉnh sửa"
                    variant="outline"
                    triggerClassName="flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl border border-border text-xs font-semibold hover:bg-muted text-foreground shadow-2xs"
                  >
                    <ActionForm action={saveMat}>
                      <Fields mat={m} prices={defaults[m.id]} />
                    </ActionForm>
                  </Dialog>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Chưa tìm thấy loại chiếu.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
