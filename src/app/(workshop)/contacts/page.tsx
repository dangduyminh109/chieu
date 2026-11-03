import Link from 'next/link';
import { UsersRound } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { ActionForm } from '@/components/ui/action-form';
import { ContactFields } from '@/features/commerce/contact-fields';
import { ContactPaymentDetails } from '@/features/commerce/contact-payment-details';
import { saveContactForm } from '@/features/commerce/form-actions';
import { exactMoney, type Contact } from '@/features/commerce/business-types';

export const metadata = { title: 'Khách hàng & nhà cung cấp' };
export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; q?: string; page?: string }>;
}) {
  await requirePermission('view_operations');
  const params = await searchParams;
  const kind = params.kind === 'SUPPLIER' ? 'SUPPLIER' : 'CUSTOMER';
  const q = (params.q ?? '').slice(0, 120);
  const page = /^\d{1,5}$/.test(params.page ?? '') ? Math.max(1, Number(params.page)) : 1;
  const db = await createClient();
  const result = await db.rpc('contact_directory', { p_kind: kind, p_search: q, p_page: page });
  if (result.error) throw new Error('Không tải được danh bạ.');
  const data = result.data as { count: number; rows: (Contact & { remaining: string })[] };
  const href = (next: number) =>
    `/contacts?${new URLSearchParams({ kind, q, page: String(next) })}`;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Danh bạ"
        icon={UsersRound}
        action={
          <Dialog
            title={kind === 'CUSTOMER' ? 'Thêm khách hàng' : 'Thêm nhà cung cấp'}
            trigger="Thêm mới"
          >
            <ActionForm action={saveContactForm} submitLabel="Lưu">
              <ContactFields kind={kind} />
            </ActionForm>
          </Dialog>
        }
      />
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
        {(['CUSTOMER', 'SUPPLIER'] as const).map((value) => (
          <Link
            key={value}
            href={`/contacts?kind=${value}`}
            aria-current={kind === value ? 'page' : undefined}
            className={`flex min-h-11 items-center justify-center rounded-xl px-2 text-sm font-semibold ${kind === value ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}
          >
            {value === 'CUSTOMER' ? 'Khách hàng' : 'Nhà cung cấp'}
          </Link>
        ))}
      </div>
      <form className="flex min-w-0 gap-2">
        <input type="hidden" name="kind" value={kind} />
        <label htmlFor="contact-q" className="sr-only">
          Tìm theo tên hoặc điện thoại
        </label>
        <input
          id="contact-q"
          name="q"
          maxLength={120}
          defaultValue={q}
          placeholder="Tên hoặc số điện thoại…"
          className="min-w-0 flex-1"
        />
        <button className="btn btn-outline" type="submit">
          Tìm
        </button>
      </form>
      <Card className="!p-3">
        <p className="px-1 pb-2 text-xs text-muted-foreground">
          {data.count} {kind === 'CUSTOMER' ? 'khách hàng' : 'nhà cung cấp'}
        </p>
        <div className="divide-y divide-border">
          {data.rows.map((person) => (
            <div key={person.id} className="space-y-3 px-1 py-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <strong className="block">{person.name}</strong>
                  {person.phone && (
                    <a href={`tel:${person.phone}`} className="mt-1 block text-sm text-primary">
                      {person.phone}
                    </a>
                  )}
                  {!person.active && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Ngừng giao dịch
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {kind === 'CUSTOMER' ? 'Khách còn nợ' : 'Còn phải trả'}
                  </p>
                  <strong className="mt-1 block text-primary">
                    {exactMoney(person.remaining)}
                  </strong>
                </div>
              </div>
              {person.notes && (
                <p className="break-words text-sm text-muted-foreground">{person.notes}</p>
              )}
              <ContactPaymentDetails contact={person} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/transactions?contact=${person.id}&kind=${kind === 'CUSTOMER' ? 'SALE' : 'PURCHASE'}&from=2000-01-01`}
                  className="text-sm font-semibold text-primary"
                >
                  Giao dịch & công nợ
                </Link>
                <Dialog
                  title={`Chỉnh sửa · ${person.name}`}
                  trigger="Chỉnh sửa"
                  variant="outline"
                  triggerClassName="btn btn-outline !min-h-9 px-3 text-xs"
                >
                  <ActionForm action={saveContactForm}>
                    <ContactFields kind={kind} contact={person} />
                  </ActionForm>
                </Dialog>
              </div>
            </div>
          ))}
          {!data.rows.length && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Chưa có dữ liệu phù hợp.
            </p>
          )}
        </div>
      </Card>
      <div className="flex items-center justify-between gap-3">
        {page > 1 ? (
          <Link href={href(page - 1)} className="btn btn-outline">
            Trước
          </Link>
        ) : (
          <span />
        )}
        <span className="text-sm">Trang {page}</span>
        {page * 20 < data.count ? (
          <Link href={href(page + 1)} className="btn btn-outline">
            Sau
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
