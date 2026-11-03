import Link from 'next/link';
import { Package } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { getInventory } from '@/features/commerce/data';
import { getBusinessCatalog } from '@/features/catalog/data';
import { getBusinessOptions } from '@/features/commerce/options';
import { businessDate } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { ActionForm } from '@/components/ui/action-form';
import { MaterialFields } from '@/features/materials/material-fields';
import { MaterialMovementForm } from '@/features/materials/movement-form';
import { saveMaterialForm } from '@/features/commerce/form-actions';
import { unitLabels, type Material } from '@/features/commerce/business-types';

export const metadata = { title: 'Kho nguyên liệu' };
export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePermission('view_operations');
  const params = await searchParams;
  const page = /^\d{1,5}$/.test(params.page ?? '') ? Math.max(1, Number(params.page)) : 1;
  const [catalog, inventory, options] = await Promise.all([
    getBusinessCatalog('materials', page, 20),
    getInventory(),
    getBusinessOptions(),
  ]);
  const mats = catalog.rows as Material[],
    today = businessDate();
  const stock = new Map(inventory.materials.map((m) => [m.id, m]));
  return (
    <div className="space-y-5">
      <PageHeader
        title="Kho nguyên liệu"
        icon={Package}
        action={
          <Dialog title="Thêm nguyên liệu" trigger="Thêm nguyên liệu">
            <ActionForm action={saveMaterialForm}>
              <MaterialFields />
            </ActionForm>
          </Dialog>
        }
      />
      {!!options.materials.length && (
        <div className="grid grid-cols-2 gap-2">
          <Dialog
            title="Mua & nhập nguyên liệu"
            trigger="Mua nguyên liệu"
            triggerClassName="btn btn-primary w-full !px-2 text-xs sm:text-sm"
          >
            <MaterialMovementForm
              materials={options.materials}
              suppliers={options.suppliers}
              today={today}
              kind="MATERIAL_PURCHASE"
            />
          </Dialog>
          <Dialog
            title="Xuất nguyên liệu sử dụng"
            trigger="Xuất sử dụng"
            variant="outline"
            triggerClassName="btn btn-outline w-full !px-2 text-xs sm:text-sm"
          >
            <MaterialMovementForm
              materials={options.materials}
              suppliers={options.suppliers}
              today={today}
              kind="MATERIAL_ISSUE"
            />
          </Dialog>
        </div>
      )}
      <Card className="!p-3">
        <div className="divide-y divide-border">
          {mats.map((m) => {
            const s = stock.get(m.id);
            return (
              <div key={m.id} className="space-y-3 py-4">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <strong>{m.name}</strong>
                    {!m.active && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Ngừng sử dụng
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <strong className="text-primary">
                      {Number(s?.quantity ?? '0').toLocaleString('vi-VN', {
                        maximumFractionDigits: 3,
                      })}{' '}
                      {unitLabels[m.unit]}
                    </strong>
                    {m.is_sedge && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {Number(s?.weight_kg ?? '0').toLocaleString('vi-VN', {
                          maximumFractionDigits: 3,
                        })}{' '}
                        kg
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/materials/${m.id}`} className="text-sm font-semibold text-primary">
                    Lịch sử nhập / xuất
                  </Link>
                  <Dialog
                    title={`Chỉnh sửa · ${m.name}`}
                    trigger="Chỉnh sửa"
                    variant="outline"
                    triggerClassName="btn btn-outline !min-h-9 px-3 text-xs"
                  >
                    <ActionForm action={saveMaterialForm}>
                      <MaterialFields material={m} />
                    </ActionForm>
                  </Dialog>
                </div>
              </div>
            );
          })}
          {!mats.length && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Thêm nguyên liệu để bắt đầu theo dõi lát, chỉ, màu nhuộm.
            </p>
          )}
        </div>
      </Card>
      <Card className="!p-2">
        <Link
          href="/contacts?kind=SUPPLIER"
          className="block px-3 py-3 text-sm font-semibold text-primary"
        >
          Nhà cung cấp
        </Link>
        <Link
          href="/transactions?kind=PURCHASE&unpaid=1"
          className="block px-3 py-3 text-sm font-semibold text-primary"
        >
          Tiền mua nguyên liệu / chiếu còn nợ
        </Link>
      </Card>
      <div className="flex items-center justify-between">
        {page > 1 ? (
          <Link className="btn btn-outline" href={`?page=${page - 1}`}>
            Trước
          </Link>
        ) : (
          <span />
        )}
        <span className="text-sm">Trang {page}</span>
        {page * 20 < catalog.count ? (
          <Link className="btn btn-outline" href={`?page=${page + 1}`}>
            Sau
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
