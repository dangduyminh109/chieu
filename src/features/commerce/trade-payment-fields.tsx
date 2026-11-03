'use client';
import Link from 'next/link';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { NumberStepper } from '@/components/ui/number-stepper';
import { exactMoney, type Contact } from './business-types';
import { ContactPaymentDetails } from './contact-payment-details';

export function TradePaymentFields({
  kind,
  contacts,
  contactId,
  onContact,
  plan,
  onPlan,
  paid,
  onPaid,
  total,
  onNavigate,
}: {
  kind: 'SALE' | 'PURCHASE';
  contacts: Contact[];
  contactId: string;
  onContact: (value: string) => void;
  plan: string;
  onPlan: (value: string) => void;
  paid: number;
  onPaid: (value: number) => void;
  total: number;
  onNavigate: () => void;
}) {
  const prefix = kind === 'SALE' ? 'trade-sale' : 'trade-buy';
  const amount = plan === 'PAID' ? total : plan === 'DEBT' ? 0 : paid;
  const selected = contacts.find((person) => person.id === contactId);
  return (
    <div className="space-y-3 border-t border-border pt-3">
      <Field id={`${prefix}-person`} label={kind === 'SALE' ? 'Khách hàng' : 'Nhà cung cấp'}>
        <Select id={`${prefix}-person`} value={contactId} onValueChange={onContact}>
          <option value="">Chưa chọn</option>
          {contacts.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </Select>
      </Field>
      {selected && <ContactPaymentDetails contact={selected} />}
      <Link
        href={`/contacts?kind=${kind === 'SALE' ? 'CUSTOMER' : 'SUPPLIER'}`}
        onClick={onNavigate}
        className="inline-block text-xs font-semibold text-primary"
      >
        Thêm / sửa {kind === 'SALE' ? 'khách hàng' : 'nhà cung cấp'}
      </Link>
      <Field id={`${prefix}-plan`} label="Tình trạng thanh toán">
        <Select id={`${prefix}-plan`} value={plan} onValueChange={onPlan}>
          <option value="PAID">{kind === 'SALE' ? 'Đã thu đủ' : 'Đã trả đủ'}</option>
          <option value="PARTIAL">{kind === 'SALE' ? 'Thu một phần' : 'Trả một phần'}</option>
          <option value="DEBT">
            {kind === 'SALE' ? 'Khách chưa trả, ghi nợ' : 'Chưa trả, ghi nợ'}
          </option>
        </Select>
      </Field>
      {plan === 'PARTIAL' && (
        <Field id={`${prefix}-paid`} label={kind === 'SALE' ? 'Đã thu (đ)' : 'Đã trả (đ)'}>
          <NumberStepper
            id={`${prefix}-paid`}
            value={paid}
            onChange={onPaid}
            min={0}
            max={1000000000000000}
            step={50000}
            increments={[10000, 50000, 100000]}
            money
            suffix="đ"
          />
        </Field>
      )}
      {plan !== 'PAID' && (
        <p className="rounded-xl bg-muted p-3 text-sm">
          Còn nợ: <strong>{exactMoney(Math.max(0, total - amount))}</strong>
          <span className="mt-1 block text-xs text-muted-foreground">
            Chọn {kind === 'SALE' ? 'khách hàng' : 'nhà cung cấp'} để lưu và theo dõi khoản nợ.
          </span>
        </p>
      )}
    </div>
  );
}
