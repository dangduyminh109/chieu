import Image from 'next/image';
import type { Contact } from './business-types';
export function ContactPaymentDetails({
  contact,
}: {
  contact: Pick<Contact, 'name' | 'bank_name' | 'bank_account' | 'account_holder' | 'qr_path'>;
}) {
  if (!contact.bank_name && !contact.bank_account && !contact.account_holder && !contact.qr_path)
    return null;
  const src = contact.qr_path
    ? `/api/contact-qr?path=${encodeURIComponent(contact.qr_path)}`
    : null;
  return (
    <details className="rounded-xl border border-border bg-muted/30 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-primary">
        Thông tin tài khoản · {contact.name}
      </summary>
      <dl className="mt-3 space-y-2 text-sm">
        {contact.bank_name && (
          <div>
            <dt className="text-xs text-muted-foreground">Ngân hàng</dt>
            <dd className="mt-1 font-semibold">{contact.bank_name}</dd>
          </div>
        )}
        {contact.bank_account && (
          <div>
            <dt className="text-xs text-muted-foreground">Số tài khoản</dt>
            <dd className="mt-1 select-all break-all font-semibold tabular-nums">
              {contact.bank_account}
            </dd>
          </div>
        )}
        {contact.account_holder && (
          <div>
            <dt className="text-xs text-muted-foreground">Chủ tài khoản</dt>
            <dd className="mt-1 font-semibold">{contact.account_holder}</dd>
          </div>
        )}
      </dl>
      {src && (
        <div className="mt-3 space-y-2">
          <Image
            src={src}
            alt={`Mã QR của ${contact.name}`}
            width={240}
            height={240}
            unoptimized
            className="mx-auto max-h-60 w-full max-w-60 rounded-xl border border-border bg-white p-2 object-contain"
          />
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="block text-center text-xs font-semibold text-primary"
          >
            Mở ảnh QR
          </a>
        </div>
      )}
    </details>
  );
}
