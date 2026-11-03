'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ContactPaymentDetails } from '@/features/commerce/contact-payment-details';
import { ActionForm } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Button } from '@/components/ui/button';
import {
  exactMoney,
  unitLabels,
  type Material,
  type Contact,
} from '@/features/commerce/business-types';
import { decimalMilli } from '@/features/commerce/amounts';
import { saveMaterialMovement } from './movement-action';

export function MaterialMovementForm({
  materials,
  suppliers,
  today,
  kind,
  initialMaterial,
}: {
  materials: Material[];
  suppliers: Contact[];
  today: string;
  kind: 'MATERIAL_PURCHASE' | 'MATERIAL_ISSUE';
  initialMaterial?: string;
}) {
  const [materialId, setMaterialId] = useState(initialMaterial ?? materials[0]?.id ?? '');
  const [quantity, setQuantity] = useState('1');
  const [weight, setWeight] = useState('');
  const [price, setPrice] = useState(50000);
  const [plan, setPlan] = useState('PAID');
  const [paid, setPaid] = useState(0);
  const [supplierId, setSupplierId] = useState('');
  const supplier = suppliers.find((person) => person.id === supplierId);
  const [key] = useState(() => crypto.randomUUID());
  const [bundles, setBundles] = useState([{ id: crypto.randomUUID(), weight: '', price: 50000 }]);
  const material = materials.find((m) => m.id === materialId);
  const buying = kind === 'MATERIAL_PURCHASE';
  const sedge = material?.is_sedge;
  const milli = decimalMilli(quantity);
  const subtotal =
    sedge && buying
      ? bundles.reduce((sum, b) => sum + BigInt(b.price), 0n)
      : ((milli ?? 0n) * BigInt(price)) / 1000n;
  return (
    <ActionForm
      action={saveMaterialMovement}
      submitLabel={buying ? 'Lưu mua & nhập kho' : 'Lưu xuất dùng'}
    >
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="key" value={key} />
      <input
        type="hidden"
        name="bundles"
        value={JSON.stringify(
          bundles.map((b) => ({ weight_kg: b.weight.replace(',', '.'), purchase_price: b.price })),
        )}
      />
      <Field id="move-date" label="Ngày">
        <DatePicker id="move-date" name="date" defaultValue={today} max={today} required />
      </Field>
      <Field id="move-material" label="Nguyên liệu">
        <Select id="move-material" name="material" value={materialId} onValueChange={setMaterialId}>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({unitLabels[m.unit]})
            </option>
          ))}
        </Select>
      </Field>
      {buying && sedge ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold">Cân nặng và giá từng bó</p>
          {bundles.map((bundle, index) => (
            <div key={bundle.id} className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <strong className="text-sm">Bó {index + 1}</strong>
                {bundles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setBundles((old) => old.filter((b) => b.id !== bundle.id))}
                    className="min-h-9 px-2 text-xs text-muted-foreground"
                  >
                    Bỏ bó
                  </button>
                )}
              </div>
              <Field id={`bundle-weight-${bundle.id}`} label="Cân nặng (kg)">
                <input
                  id={`bundle-weight-${bundle.id}`}
                  inputMode="decimal"
                  value={bundle.weight}
                  onChange={(e) =>
                    setBundles((old) =>
                      old.map((b) => (b.id === bundle.id ? { ...b, weight: e.target.value } : b)),
                    )
                  }
                  placeholder="VD: 25,5"
                  required
                />
              </Field>
              <Field id={`bundle-price-${bundle.id}`} label="Giá cả bó (đ)">
                <NumberStepper
                  id={`bundle-price-${bundle.id}`}
                  value={bundle.price}
                  onChange={(value) =>
                    setBundles((old) =>
                      old.map((b) => (b.id === bundle.id ? { ...b, price: value } : b)),
                    )
                  }
                  min={0}
                  max={1000000000}
                  step={50000}
                  increments={[10000, 50000, 100000]}
                  money
                  suffix="đ"
                />
              </Field>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={bundles.length >= 1000}
            onClick={() =>
              setBundles((old) => [...old, { id: crypto.randomUUID(), weight: '', price: 50000 }])
            }
          >
            Thêm bó
          </Button>
          <input name="quantity" type="hidden" value="1" />
          <input name="weight" type="hidden" value="" />
          <input name="price" type="hidden" value="0" />
        </div>
      ) : (
        <>
          <Field
            id="move-quantity"
            label={`Số lượng (${material ? unitLabels[material.unit] : ''})`}
          >
            <input
              id="move-quantity"
              name="quantity"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value.replace(',', '.'))}
              required
            />
          </Field>
          {sedge ? (
            <Field id="move-weight" label="Tổng cân nặng xuất (kg)">
              <input
                id="move-weight"
                name="weight"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value.replace(',', '.'))}
                required
              />
            </Field>
          ) : (
            <input name="weight" type="hidden" value="" />
          )}
          {buying ? (
            <Field
              id="move-price"
              label={`Đơn giá (đ/${material ? unitLabels[material.unit] : ''})`}
            >
              <NumberStepper
                id="move-price"
                value={price}
                onChange={setPrice}
                min={0}
                max={1000000000}
                step={50000}
                increments={[10000, 50000, 100000]}
                money
                suffix="đ"
              />
              <input name="price" type="hidden" value={price} />
            </Field>
          ) : (
            <input name="price" type="hidden" value="0" />
          )}
        </>
      )}
      {buying ? (
        <>
          <p className="rounded-xl bg-muted p-3 text-sm">
            Tổng tiền: <strong>{exactMoney(subtotal)}</strong>
          </p>
          <Field id="move-supplier" label="Nhà cung cấp">
            <Select
              id="move-supplier"
              name="supplier"
              value={supplierId}
              onValueChange={setSupplierId}
            >
              <option value="">Chưa chọn</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Link
            href="/contacts?kind=SUPPLIER"
            className="inline-block text-xs font-semibold text-primary"
          >
            Thêm / sửa nhà cung cấp
          </Link>
          {supplier && <ContactPaymentDetails contact={supplier} />}
          <Field id="move-plan" label="Thanh toán">
            <Select id="move-plan" name="plan" value={plan} onValueChange={setPlan}>
              <option value="PAID">Đã trả đủ</option>
              <option value="PARTIAL">Trả một phần</option>
              <option value="DEBT">Chưa trả, ghi nợ</option>
            </Select>
          </Field>
          {plan === 'PARTIAL' ? (
            <Field id="move-paid" label="Đã trả (đ)">
              <input
                id="move-paid"
                name="paid"
                type="number"
                inputMode="numeric"
                min={0}
                max={String(subtotal)}
                step={1}
                value={paid}
                onChange={(e) => setPaid(Number(e.target.value))}
                required
              />
            </Field>
          ) : (
            <input name="paid" type="hidden" value="0" />
          )}
          <Field id="move-method" label="Hình thức trả tiền">
            <Select id="move-method" name="method" defaultValue="CASH">
              <option value="CASH">Tiền mặt</option>
              <option value="BANK">Chuyển khoản</option>
            </Select>
          </Field>
          <p className="text-xs text-muted-foreground">
            Kho tăng ngay khi lưu. Chỉ số tiền đã trả được ghi vào Thu chi; không ghi lại khoản chi
            này ở mục Chi phí.
          </p>
        </>
      ) : (
        <>
          <input name="supplier" type="hidden" value="" />
          <input name="plan" type="hidden" value="PAID" />
          <input name="paid" type="hidden" value="0" />
          <input name="method" type="hidden" value="CASH" />
          <p className="text-xs text-muted-foreground">
            Xuất nguyên liệu để sử dụng, không tạo thêm khoản chi tiền.
          </p>
        </>
      )}
      <Field id="move-notes" label="Ghi chú">
        <input id="move-notes" name="notes" maxLength={1000} />
      </Field>
    </ActionForm>
  );
}
