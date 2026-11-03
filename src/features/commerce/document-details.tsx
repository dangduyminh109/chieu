import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getDocument } from '@/features/commerce/data';
import { businessDate, displayDate } from '@/lib/utils';
import { documentLabels, exactMoney, unitLabels } from '@/features/commerce/business-types';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { ManagementMetrics } from '@/components/ui/management';
import { Dialog } from '@/components/ui/dialog';
import { ActionForm } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { recordPaymentForm } from '@/features/commerce/form-actions';
import { saveSaleCost } from '@/features/reports/cost-actions';
import { ContactPaymentDetails } from '@/features/commerce/contact-payment-details';

export async function DocumentDetails({
  params,
  embedded = false,
}: {
  params: Promise<{ id: string }>;
  embedded?: boolean;
}) {
  await requirePermission('view_operations');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await createClient();
  const exists = await db.from('business_documents').select('id').eq('id', id).maybeSingle();
  if (exists.error) throw new Error('Không tải được giao dịch.');
  if (!exists.data) notFound();
  const { document: doc, items, payments, balance: rawBalance } = await getDocument(id);
  const balance = rawBalance as { total: string; paid: string; remaining: string };
  const [mats, materials, contact] = await Promise.all([
    db.from('mat_types').select('id,name'),
    db.from('materials').select('id,name,unit'),
    doc.customer_id
      ? db
          .from('customers')
          .select('name,phone,bank_name,bank_account,account_holder,qr_path')
          .eq('id', doc.customer_id)
          .single()
      : doc.supplier_id
        ? db
            .from('suppliers')
            .select('name,phone,bank_name,bank_account,account_holder,qr_path')
            .eq('id', doc.supplier_id)
            .single()
        : Promise.resolve({ data: null, error: null }),
  ]);
  if (mats.error || materials.error || contact.error)
    throw new Error('Không tải được chi tiết mặt hàng.');
  const today = businessDate();
  const incoming = doc.kind === 'SALE';
  const canPay =
    ['SALE', 'FINISHED_PURCHASE', 'MATERIAL_PURCHASE', 'EXPENSE'].includes(doc.kind) &&
    BigInt(balance.remaining) > 0n;
  return (
    <div className="space-y-5">
      {!embedded && (
        <PageHeader
          title={documentLabels[doc.kind] ?? 'Giao dịch'}
          action={
            <Link href="/transactions" className="text-sm font-semibold text-primary">
              Về lịch sử
            </Link>
          }
        />
      )}
      <Card className="space-y-2 !p-4">
        <p className="text-sm text-muted-foreground">
          {displayDate(doc.business_date)}
          {doc.sale_type ? ` · ${doc.sale_type === 'RETAIL' ? 'Bán lẻ' : 'Bán sỉ'}` : ''}
        </p>
        {contact.data && (
          <>
            <strong className="block">{contact.data.name}</strong>
            {contact.data.phone && (
              <a className="block text-sm text-primary" href={`tel:${contact.data.phone}`}>
                {contact.data.phone}
              </a>
            )}
          </>
        )}
        {doc.notes && <p className="break-words text-sm text-muted-foreground">{doc.notes}</p>}
        {contact.data && <ContactPaymentDetails contact={contact.data} />}
      </Card>
      <ManagementMetrics
        items={[
          { label: 'Tổng tiền', value: exactMoney(balance.total) },
          {
            label: 'Còn nợ',
            value: exactMoney(balance.remaining),
            emphasis: BigInt(balance.remaining) > 0n,
          },
        ]}
      />
      <p className="px-1 text-sm text-muted-foreground">
        Đã {incoming ? 'thu' : 'trả'}: <strong>{exactMoney(balance.paid)}</strong>
      </p>
      {canPay && (
        <Dialog
          title={incoming ? 'Ghi nhận thu nợ' : 'Ghi nhận trả nợ'}
          trigger={incoming ? 'Thu tiền khách nợ' : 'Trả tiền còn nợ'}
        >
          <ActionForm
            action={recordPaymentForm}
            submitLabel={incoming ? 'Xác nhận đã thu' : 'Xác nhận đã trả'}
          >
            <input type="hidden" name="document_id" value={id} />
            <input type="hidden" name="key" value={crypto.randomUUID()} />
            <p className="text-sm">
              Còn nợ: <strong>{exactMoney(balance.remaining)}</strong>
            </p>
            <Field id="payment-date" label="Ngày thanh toán">
              <DatePicker
                id="payment-date"
                name="date"
                defaultValue={today}
                min={doc.business_date}
                max={today}
                required
              />
            </Field>
            <Field id="payment-amount" label="Số tiền (đ)">
              <input
                id="payment-amount"
                name="amount"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                max={balance.remaining}
                defaultValue={balance.remaining}
                required
              />
            </Field>
            <Field id="payment-method" label="Thanh toán">
              <Select id="payment-method" name="method" defaultValue="CASH">
                <option value="CASH">Tiền mặt</option>
                <option value="BANK">Chuyển khoản</option>
              </Select>
            </Field>
            <Field id="payment-notes" label="Ghi chú">
              <input id="payment-notes" name="notes" maxLength={1000} />
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="confirmed" required className="mt-1" />
              <span>Tôi xác nhận đã {incoming ? 'nhận' : 'trả'} số tiền này.</span>
            </label>
          </ActionForm>
        </Dialog>
      )}
      <Card className="!p-4">
        <h2 className="font-bold">Mặt hàng</h2>
        <div className="mt-2 divide-y divide-border">
          {items.map((item) => {
            const material = materials.data.find((m) => m.id === item.material_id);
            const name =
              mats.data.find((m) => m.id === item.mat_type_id)?.name ??
              material?.name ??
              'Mặt hàng';
            const bundles = item.material_bundles as {
              id: string;
              weight_kg: string | number;
              purchase_price: number;
            }[];
            return (
              <div key={item.id} className="space-y-2 py-3">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <strong>{name}</strong>
                  <strong>{exactMoney(item.line_total)}</strong>
                </div>
                <p className="text-sm text-muted-foreground">
                  {item.quantity}{' '}
                  {material ? unitLabels[material.unit as keyof typeof unitLabels] : 'chiếc'}
                  {item.weight_kg ? ` · ${item.weight_kg} kg` : ''}
                  {!bundles?.length ? ` × ${exactMoney(item.unit_price)}` : ''}
                </p>
                {!!bundles?.length && (
                  <details>
                    <summary className="cursor-pointer text-xs font-semibold text-primary">
                      Chi tiết {bundles.length} bó lát
                    </summary>
                    <div className="mt-2 space-y-2">
                      {bundles.map((bundle, i) => (
                        <p key={bundle.id} className="text-xs text-muted-foreground">
                          Bó {i + 1}: {bundle.weight_kg} kg · {exactMoney(bundle.purchase_price)}
                        </p>
                      ))}
                    </div>
                  </details>
                )}
                {doc.kind === 'SALE' && (
                  <div className="space-y-2 rounded-xl bg-muted p-3">
                    <p className="text-xs text-muted-foreground">
                      {item.unit_cost == null
                        ? 'Chưa có giá vốn cho mặt hàng này.'
                        : `Giá vốn: ${exactMoney(item.unit_cost)}/chiếc · Tổng vốn: ${exactMoney(item.cost_amount)}`}
                    </p>
                    {item.unit_cost != null && (
                      <p className="text-sm font-semibold text-primary">
                        Lãi bán: {exactMoney(BigInt(item.line_total) - BigInt(item.cost_amount))}
                      </p>
                    )}
                    <Dialog
                      title={`Giá vốn · ${name}`}
                      trigger={item.unit_cost == null ? 'Nhập giá vốn' : 'Điều chỉnh giá vốn'}
                      variant="outline"
                      triggerClassName="btn btn-outline !min-h-9 px-3 text-xs"
                    >
                      <ActionForm action={saveSaleCost} submitLabel="Lưu giá vốn">
                        <input type="hidden" name="item" value={item.id} />
                        <input type="hidden" name="key" value={crypto.randomUUID()} />
                        <Field id={`cost-item-${item.id}`} label="Giá vốn mỗi chiếc (đ)">
                          <input
                            id={`cost-item-${item.id}`}
                            name="cost"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={1000000000}
                            step={1}
                            defaultValue={item.unit_cost ?? ''}
                            required
                          />
                        </Field>
                        <Field id={`cost-reason-${item.id}`} label="Lý do nhập / sửa">
                          <textarea
                            id={`cost-reason-${item.id}`}
                            name="reason"
                            minLength={5}
                            maxLength={1000}
                            required
                            placeholder="VD: Bổ sung giá vốn thực tế của đơn cũ"
                          />
                        </Field>
                        <p className="text-xs text-muted-foreground">
                          Chỉ áp dụng cho mặt hàng trên phiếu này, không đổi giá vốn mặc định. Báo
                          cáo lãi sẽ cập nhật theo giá vốn vừa lưu.
                        </p>
                      </ActionForm>
                    </Dialog>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
      <Card className="!p-4">
        <h2 className="font-bold">Lịch sử thanh toán</h2>
        <div className="mt-2 divide-y divide-border">
          {payments.map((p) => (
            <div key={p.id} className="space-y-1 py-3">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span>
                  {displayDate(p.payment_date)} ·{' '}
                  {p.method === 'BANK' ? 'Chuyển khoản' : 'Tiền mặt'}
                </span>
                <strong>{exactMoney(p.amount)}</strong>
              </div>
              {p.notes && <p className="break-words text-xs text-muted-foreground">{p.notes}</p>}
            </div>
          ))}
          {!payments.length && (
            <p className="py-4 text-sm text-muted-foreground">
              {BigInt(balance.total) === 0n
                ? 'Phiếu này không phát sinh thanh toán.'
                : 'Chưa thanh toán.'}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
