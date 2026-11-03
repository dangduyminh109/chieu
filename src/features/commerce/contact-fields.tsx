import { Field } from '@/components/ui/field';
import { ContactQrUpload } from './contact-qr-upload';
import type { Contact } from './business-types';
export function ContactFields({
  kind,
  contact,
}: {
  kind: 'CUSTOMER' | 'SUPPLIER';
  contact?: Contact;
}) {
  const id = contact?.id ?? 'new';
  return (
    <>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={contact?.id ?? ''} />
      <Field
        id={`person-name-${id}`}
        label={kind === 'CUSTOMER' ? 'Tên khách hàng' : 'Tên nhà cung cấp'}
      >
        <input
          id={`person-name-${id}`}
          name="name"
          defaultValue={contact?.name ?? ''}
          maxLength={120}
          required
        />
      </Field>
      <Field id={`person-phone-${id}`} label="Số điện thoại">
        <input
          id={`person-phone-${id}`}
          name="phone"
          type="tel"
          inputMode="tel"
          defaultValue={contact?.phone ?? ''}
          maxLength={30}
        />
      </Field>
      <Field id={`person-notes-${id}`} label="Ghi chú / địa chỉ">
        <textarea
          id={`person-notes-${id}`}
          name="notes"
          defaultValue={contact?.notes ?? ''}
          maxLength={1000}
        />
      </Field>
      <fieldset className="space-y-3 rounded-xl border border-border p-3">
        <legend className="px-1 text-sm font-semibold">
          Thông tin thanh toán (không bắt buộc)
        </legend>
        <Field id={`person-bank-${id}`} label="Tên ngân hàng">
          <input
            id={`person-bank-${id}`}
            name="bank_name"
            defaultValue={contact?.bank_name ?? ''}
            maxLength={120}
            placeholder="VD: Vietcombank, MB Bank…"
          />
        </Field>
        <Field id={`person-account-${id}`} label="Số tài khoản">
          <input
            id={`person-account-${id}`}
            name="bank_account"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={contact?.bank_account ?? ''}
            maxLength={64}
          />
        </Field>
        <Field id={`person-holder-${id}`} label="Tên chủ tài khoản">
          <input
            id={`person-holder-${id}`}
            name="account_holder"
            defaultValue={contact?.account_holder ?? ''}
            maxLength={120}
          />
        </Field>
        <ContactQrUpload id={`person-qr-${id}`} initialPath={contact?.qr_path} />
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={contact?.active ?? true} />
        Đang giao dịch
      </label>
    </>
  );
}
