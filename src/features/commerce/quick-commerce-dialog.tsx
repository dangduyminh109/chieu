'use client';

import { NumberStepper } from '@/components/ui/number-stepper';
import { getSuggestedSalePrice } from '@/features/pricing/quote-actions';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBusinessOptions } from './options';
import { TradePaymentFields } from './trade-payment-fields';
import type { Contact } from './business-types';
import { toast } from 'sonner';
import {
  ShoppingCart,
  PackageCheck,
  Receipt,
  X,
  Check,
  ArrowLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { MatSelect } from '@/components/ui/mat-select';
import { money, cn } from '@/lib/utils';
import { postDocument } from './actions';
import { expenseCategories, expenseCategoryImages } from '@/features/expenses/categories';
import { recordQuickExpense } from '@/features/expenses/quick-action';
import type { MatType } from '@/types/domain';

type CommerceActionTab = 'SALE' | 'FINISHED_PURCHASE' | 'EXPENSE';

export function QuickCommerceDialog({
  open,
  onOpenChange,
  mats,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mats: MatType[];
  today: string;
}) {
  const router = useRouter();
  // Starts at null so user sees the 3 big selection cards when opened
  const [activeTab, setActiveTab] = useState<CommerceActionTab | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Common Form States
  const date = today;
  const notes = '';

  // 1. Sale states
  const [saleMatId, setSaleMatId] = useState(mats[0]?.id || '');
  const [saleQty, setSaleQty] = useState(10);
  const priceEdited = useRef(false);
  const [salePrice, setSalePrice] = useState(100000);
  const [saleType, setSaleType] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL');
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK'>('CASH');
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [suppliers, setSuppliers] = useState<Contact[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [salePlan, setSalePlan] = useState('PAID');
  const [buyPlan, setBuyPlan] = useState('PAID');
  const [salePaid, setSalePaid] = useState(0);
  const [buyPaid, setBuyPaid] = useState(0);
  const saleRequest = useRef<{ payload: string; key: string } | null>(null);
  const buyRequest = useRef<{ payload: string; key: string } | null>(null);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getBusinessOptions()
      .then((options) => {
        if (!cancelled) {
          setCustomers(options.customers);
          setSuppliers(options.suppliers);
        }
      })
      .catch(() => {
        if (!cancelled)
          toast.error('Chưa tải được danh bạ. Bạn vẫn có thể ghi giao dịch đã trả đủ.');
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // 2. Finished Receipt states
  const [receiptMatId, setReceiptMatId] = useState(mats[0]?.id || '');
  const [receiptQty, setReceiptQty] = useState(20);
  const [purchasePrice, setPurchasePrice] = useState(50000);
  const [purchaseStage, setPurchaseStage] = useState<'WOVEN' | 'TIED' | 'CUT' | 'SEWN'>('SEWN');
  const [receiptRef, setReceiptRef] = useState('');

  // 3. Expense states
  const [expenseAmount, setExpenseAmount] = useState(100000);
  const [expenseReason, setExpenseReason] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('SEDGE');
  const expenseRequest = useRef<{ payload: string; key: string } | null>(null);

  async function handlePostExpense() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const payload = JSON.stringify([expenseCategory, expenseAmount, expenseReason, paymentMethod]);
    if (expenseRequest.current?.payload !== payload)
      expenseRequest.current = { payload, key: crypto.randomUUID() };
    try {
      const result = await recordQuickExpense({
        category: expenseCategory,
        amount: expenseAmount,
        notes: expenseReason,
        method: paymentMethod,
        key: expenseRequest.current.key,
      });
      if (result.success) {
        expenseRequest.current = null;
        toast.success(`Đã ghi chi phí ${money(expenseAmount)}.`);
        setExpenseReason('');
        handleClose();
        router.refresh();
      } else toast.error(result.message);
    } catch {
      toast.error('Chưa xác nhận được kết quả lưu. Hãy thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    setActiveTab(null);
    onOpenChange(false);
  }

  useEffect(() => {
    if (!open || activeTab !== 'SALE' || !saleMatId) return;
    priceEdited.current = false;
    let cancelled = false;
    getSuggestedSalePrice(saleMatId, saleType, date)
      .then((price) => {
        if (!cancelled && !priceEdited.current && price !== null) setSalePrice(price);
      })
      .catch(() => {
        if (!cancelled)
          toast.error('Chưa tải được giá bán mặc định. Bạn có thể nhập giá trực tiếp.');
      });
    return () => {
      cancelled = true;
    };
  }, [open, activeTab, saleMatId, saleType, date]);

  async function handlePostSale() {
    if (isSubmitting) return;
    const total = saleQty * salePrice;
    const amountPaid = salePlan === 'PAID' ? total : salePlan === 'DEBT' ? 0 : salePaid;
    if (amountPaid > total) {
      toast.error('Số tiền đã thu vượt tổng tiền bán.');
      return;
    }
    if (amountPaid < total && !customerId) {
      toast.error('Chọn khách hàng để ghi nợ.');
      return;
    }
    const payload = JSON.stringify([
      date,
      saleMatId,
      saleQty,
      salePrice,
      saleType,
      customerId,
      amountPaid,
      paymentMethod,
      customerName,
    ]);
    if (saleRequest.current?.payload !== payload)
      saleRequest.current = { payload, key: crypto.randomUUID() };
    setIsSubmitting(true);
    try {
      const total = saleQty * salePrice;
      const res = await postDocument({
        kind: 'SALE',
        business_date: date,
        sale_type: saleType,
        customer_id: customerId || undefined,
        items: [
          {
            mat_type_id: saleMatId,
            quantity: saleQty,
            unit_price: salePrice,
            override_reason: 'Giá bán thực tế do người quản lý nhập',
          },
        ],
        amount_paid: amountPaid,
        method: paymentMethod,
        notes: customerName ? `Khách: ${customerName}. ${notes}` : notes,
        idempotency_key: saleRequest.current.key,
      });

      if (res.success) {
        saleRequest.current = null;
        setSalePlan('PAID');
        setSalePaid(0);
        setCustomerId('');
        toast.success(`Đã ghi nhận bán ${saleQty} chiếu (${money(total)})!`);
        handleClose();
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error('Có lỗi xảy ra khi tạo chứng từ bán hàng.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePostFinishedReceipt() {
    if (isSubmitting) return;
    const total = receiptQty * purchasePrice;
    const amountPaid = buyPlan === 'PAID' ? total : buyPlan === 'DEBT' ? 0 : buyPaid;
    if (amountPaid > total) {
      toast.error('Số tiền đã trả vượt tổng tiền mua.');
      return;
    }
    if (amountPaid < total && !supplierId) {
      toast.error('Chọn nhà cung cấp để ghi nợ.');
      return;
    }
    const payload = JSON.stringify([
      date,
      receiptMatId,
      receiptQty,
      purchasePrice,
      purchaseStage,
      supplierId,
      amountPaid,
      paymentMethod,
      receiptRef,
    ]);
    if (buyRequest.current?.payload !== payload)
      buyRequest.current = { payload, key: crypto.randomUUID() };
    setIsSubmitting(true);
    try {
      const res = await postDocument({
        kind: 'FINISHED_PURCHASE',
        receipt_stage: purchaseStage,
        business_date: date,
        reference: receiptRef || undefined,
        amount_paid: amountPaid,
        supplier_id: supplierId || undefined,
        method: paymentMethod,
        items: [
          {
            mat_type_id: receiptMatId,
            quantity: receiptQty,
            unit_price: purchasePrice,
            override_reason: 'Giá mua do người quản lý nhập trực tiếp',
          },
        ],
        notes,
        idempotency_key: buyRequest.current.key,
      });

      if (res.success) {
        buyRequest.current = null;
        setBuyPlan('PAID');
        setBuyPaid(0);
        setSupplierId('');
        toast.success(`Đã mua ${receiptQty} chiếu!`);
        handleClose();
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error('Có lỗi xảy ra khi ghi nhận chiếu mua.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={handleClose}
        aria-hidden
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl transition-all"
      >
        {/* Fixed Header */}
        <div className="flex flex-none items-center justify-between border-b border-border/60 bg-card p-4 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {activeTab !== null && (
              <button
                type="button"
                onClick={() => setActiveTab(null)}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground hover:bg-muted/80 active:scale-95 transition-all cursor-pointer"
                title="Chọn lại nghiệp vụ"
                aria-label="Quay lại chọn nghiệp vụ"
              >
                <ArrowLeft size={18} />
              </button>
            )}

            <div className="min-w-0 flex-1">
              <h2 className="flex items-center gap-2 text-base font-bold text-foreground sm:text-lg min-w-0">
                {activeTab === 'SALE' ? (
                  <>
                    <ShoppingCart className="size-5 shrink-0 text-primary" />
                    <span className="truncate">Bán chiếu</span>
                  </>
                ) : activeTab === 'FINISHED_PURCHASE' ? (
                  <>
                    <PackageCheck className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="truncate">Mua chiếu</span>
                  </>
                ) : activeTab === 'EXPENSE' ? (
                  <>
                    <Receipt className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span className="truncate">Ghi nhận chi phí</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart className="size-5 shrink-0 text-primary" />
                    <span className="truncate">Mua bán chiếu</span>
                  </>
                )}
              </h2>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {activeTab === null
                  ? 'Chọn nghiệp vụ cần thực hiện'
                  : activeTab === 'SALE'
                    ? 'Bán sỉ hoặc bán lẻ cho khách hàng'
                    : activeTab === 'FINISHED_PURCHASE'
                      ? 'Chọn loại, số lượng và tình trạng chiếu mua'
                      : 'Mua lát, chỉ, vải may chiếu, màu nhuộm, sửa máy hoặc chi phí khác'}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            type="button"
            className="ml-2 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* =============================================================== */}
        {/* VIEW 1: LANDING SELECTION - 3 Ô TO ĐỂ CHỌN BÁN, MUA, HOẶC CHI PHÍ */}
        {/* =============================================================== */}
        {activeTab === null ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 sm:p-6 animate-in fade-in-50 duration-150">
            <div className="text-xs font-semibold text-primary">
              <Link
                href="/transactions"
                onClick={handleClose}
                className="flex min-h-10 items-center justify-center rounded-xl border border-border px-2 py-2"
              >
                Lịch sử & công nợ
              </Link>
            </div>
            {/* Ô 1: Bán chiếu */}
            <button
              type="button"
              onClick={() => setActiveTab('SALE')}
              className="group w-full flex items-center gap-3.5 p-3.5 sm:p-4 rounded-2xl border-2 border-border/80 bg-card hover:border-primary hover:bg-primary/5 active:scale-[0.98] transition-all text-left shadow-2xs cursor-pointer"
            >
              <div className="flex size-13 sm:size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors shadow-2xs">
                <ShoppingCart className="size-6 sm:size-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-sm sm:text-base text-foreground">Bán chiếu</span>
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                    Thu tiền
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  Bán lẻ hoặc bán sỉ chiếu cho khách, ghi nhận tiền thu
                </p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </button>

            {/* Ô 2: Mua chiếu */}
            <button
              type="button"
              onClick={() => setActiveTab('FINISHED_PURCHASE')}
              className="group w-full flex items-center gap-3.5 p-3.5 sm:p-4 rounded-2xl border-2 border-border/80 bg-card hover:border-emerald-500 hover:bg-emerald-500/5 active:scale-[0.98] transition-all text-left shadow-2xs cursor-pointer"
            >
              <div className="flex size-13 sm:size-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-2xs">
                <PackageCheck className="size-6 sm:size-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-sm sm:text-base text-foreground">Mua chiếu</span>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full shrink-0">
                    Nhập kho
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  Nhập mua chiếu thành phẩm hoàn thiện từ bên ngoài
                </p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground group-hover:text-emerald-600 transition-colors shrink-0" />
            </button>

            {/* Ô 3: Chi phí */}
            <button
              type="button"
              onClick={() => setActiveTab('EXPENSE')}
              className="group w-full flex items-center gap-3.5 p-3.5 sm:p-4 rounded-2xl border-2 border-border/80 bg-card hover:border-amber-500 hover:bg-amber-500/5 active:scale-[0.98] transition-all text-left shadow-2xs cursor-pointer"
            >
              <div className="flex size-13 sm:size-14 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white transition-colors shadow-2xs">
                <Receipt className="size-6 sm:size-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-sm sm:text-base text-foreground">Chi phí</span>
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full shrink-0">
                    Sổ thu chi
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  Mua lát, chỉ, vải may chiếu, màu nhuộm, sửa máy hoặc chi phí khác
                </p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground group-hover:text-amber-600 transition-colors shrink-0" />
            </button>
          </div>
        ) : (
          /* =============================================================== */
          /* VIEW 2: FORM BODY KHI ĐÃ CHỌN NGHIỆP VỤ                         */
          /* =============================================================== */
          <div className="flex-1 overflow-y-auto p-4 space-y-4 sm:p-6 animate-in fade-in-50 duration-150">
            {/* Quick Switch Tabs */}
            <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted/60 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('SALE')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg px-1.5 py-2 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
                  activeTab === 'SALE'
                    ? 'bg-card text-primary shadow-xs font-bold ring-1 ring-primary/20'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <ShoppingCart size={14} className="shrink-0" />
                <span>Bán chiếu</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('FINISHED_PURCHASE')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg px-1.5 py-2 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
                  activeTab === 'FINISHED_PURCHASE'
                    ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-xs font-bold ring-1 ring-emerald-500/20'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <PackageCheck size={14} className="shrink-0" />
                <span>Mua chiếu</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('EXPENSE')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg px-1.5 py-2 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
                  activeTab === 'EXPENSE'
                    ? 'bg-card text-amber-600 dark:text-amber-400 shadow-xs font-bold ring-1 ring-amber-500/20'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Receipt size={14} className="shrink-0" />
                <span>Chi phí</span>
              </button>
            </div>

            {/* Tab 1: SALE FORM */}
            {activeTab === 'SALE' && (
              <div className="space-y-3.5">
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <Field id="sale-type" label="Hình thức">
                    <Select
                      id="sale-type"
                      value={saleType}
                      onValueChange={(val) => setSaleType(val as 'RETAIL' | 'WHOLESALE')}
                    >
                      <option value="RETAIL">Bán lẻ</option>
                      <option value="WHOLESALE">Bán sỉ</option>
                    </Select>
                  </Field>

                  <Field id="sale-payment" label="Thanh toán">
                    <Select
                      id="sale-payment"
                      align="end"
                      value={paymentMethod}
                      onValueChange={(val) => setPaymentMethod(val as 'CASH' | 'BANK')}
                    >
                      <option value="CASH">Tiền mặt</option>
                      <option value="BANK">Chuyển khoản</option>
                    </Select>
                  </Field>
                </div>

                <Field id="sale-mat" label="Loại chiếu bán">
                  <MatSelect
                    id="sale-mat"
                    mats={mats.filter((m) => m.active)}
                    value={saleMatId}
                    onValueChange={(val) => setSaleMatId(val)}
                  />
                </Field>

                <div className="grid grid-cols-1 gap-2 sm:gap-3">
                  <Field id="sale-qty" label="Số lượng">
                    <NumberStepper
                      id="sale-qty"
                      suffix="chiếc"
                      value={saleQty}
                      onChange={setSaleQty}
                      min={1}
                      max={10000}
                      increments={[5, 10, 20, 50]}
                    />
                  </Field>

                  <Field id="sale-price" label="Đơn giá (đ)">
                    <NumberStepper
                      id="sale-price"
                      suffix="đ/chiếc"
                      value={salePrice}
                      onChange={(value) => {
                        priceEdited.current = true;
                        setSalePrice(value);
                      }}
                      max={1000000000}
                      step={50000}
                      increments={[10000, 50000, 100000]}
                      money
                    />
                  </Field>
                </div>

                <TradePaymentFields
                  kind="SALE"
                  contacts={customers}
                  contactId={customerId}
                  onContact={setCustomerId}
                  plan={salePlan}
                  onPlan={setSalePlan}
                  paid={salePaid}
                  onPaid={setSalePaid}
                  total={saleQty * salePrice}
                  onNavigate={handleClose}
                />
                {/* Total Sale Preview */}
                <div className="flex items-center justify-between rounded-xl bg-primary/10 border border-primary/20 px-3.5 py-2.5 text-sm">
                  <span className="font-semibold text-foreground text-xs sm:text-sm">
                    Tổng tiền bán:
                  </span>
                  <strong className="text-lg sm:text-xl font-black text-primary">
                    {money(saleQty * salePrice)}
                  </strong>
                </div>

                <Field id="sale-customer" label="Khách hàng / Ghi chú (tùy chọn)">
                  <input
                    id="sale-customer"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="VD: Chị Lan chợ Tân An…"
                    className="rounded-xl text-sm"
                  />
                </Field>
              </div>
            )}

            {/* Tab 2: FINISHED RECEIPT FORM */}
            {activeTab === 'FINISHED_PURCHASE' && (
              <div className="space-y-3.5">
                <Field id="receipt-mat" label="Loại chiếu mua">
                  <MatSelect
                    id="receipt-mat"
                    mats={mats.filter((m) => m.active)}
                    value={receiptMatId}
                    onValueChange={(val) => setReceiptMatId(val)}
                  />
                </Field>

                <Field id="purchase-stage" label="Tình trạng chiếu mua">
                  <Select
                    id="purchase-stage"
                    value={purchaseStage}
                    onValueChange={(value) => setPurchaseStage(value as typeof purchaseStage)}
                  >
                    <option value="WOVEN">Đã dệt, chưa buộc</option>
                    <option value="TIED">Đã buộc, chưa cắt</option>
                    <option value="CUT">Đã cắt, có thể bán</option>
                    <option value="SEWN">Đã may, có thể bán</option>
                  </Select>
                </Field>
                <Field id="receipt-qty" label="Số lượng mua (chiếc)">
                  <NumberStepper
                    id="receipt-qty"
                    suffix="chiếc"
                    value={receiptQty}
                    onChange={setReceiptQty}
                    min={1}
                    max={10000}
                    increments={[5, 10, 20, 50]}
                  />
                </Field>

                <Field id="purchase-price" label="Đơn giá mua (đ)">
                  <NumberStepper
                    id="purchase-price"
                    suffix="đ/chiếc"
                    value={purchasePrice}
                    onChange={setPurchasePrice}
                    max={1000000000}
                    step={50000}
                    increments={[10000, 50000, 100000]}
                    money
                  />
                </Field>
                <div className="flex items-center justify-between rounded-xl bg-muted p-3 text-sm">
                  <span>Tổng tiền mua</span>
                  <strong className="text-lg text-primary">
                    {money(receiptQty * purchasePrice)}
                  </strong>
                </div>
                <TradePaymentFields
                  kind="PURCHASE"
                  contacts={suppliers}
                  contactId={supplierId}
                  onContact={setSupplierId}
                  plan={buyPlan}
                  onPlan={setBuyPlan}
                  paid={buyPaid}
                  onPaid={setBuyPaid}
                  total={receiptQty * purchasePrice}
                  onNavigate={handleClose}
                />
                <Field id="buy-payment-method" label="Hình thức trả tiền">
                  <Select
                    id="buy-payment-method"
                    value={paymentMethod}
                    onValueChange={(value) => setPaymentMethod(value as 'CASH' | 'BANK')}
                  >
                    <option value="CASH">Tiền mặt</option>
                    <option value="BANK">Chuyển khoản</option>
                  </Select>
                </Field>
                <Field id="receipt-ref" label="Ghi chú phiếu mua (không bắt buộc)">
                  <input
                    id="receipt-ref"
                    value={receiptRef}
                    onChange={(e) => setReceiptRef(e.target.value)}
                    placeholder="VD: NK-DET-HOMNAY"
                    className="rounded-xl text-sm"
                  />
                </Field>
              </div>
            )}

            {/* Tab 3: EXPENSE FORM */}
            {activeTab === 'EXPENSE' && (
              <div className="space-y-3.5 rounded-2xl bg-muted/40 p-4 text-center">
                <Receipt className="size-8 mx-auto text-amber-600 dark:text-amber-400" />
                <h4 className="font-bold text-foreground text-sm">Ghi nhận chi phí</h4>
                <p className="text-xs text-muted-foreground">
                  Mua lát, chỉ, vải may chiếu, màu nhuộm, sửa máy hoặc chi phí khác.
                </p>
                <div className="text-left mt-3 space-y-3">
                  <Field id="expense-category" label="Loại chi phí">
                    <Select
                      id="expense-category"
                      optionImages={expenseCategoryImages}
                      value={expenseCategory}
                      onValueChange={setExpenseCategory}
                    >
                      {expenseCategories.map((category) => (
                        <option key={category.code} value={category.code}>
                          {category.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field id="expense-amt" label="Số tiền chi (đ)">
                    <NumberStepper
                      id="expense-amt"
                      suffix="đ"
                      value={expenseAmount}
                      onChange={setExpenseAmount}
                      max={1000000000}
                      step={10000}
                      increments={[50000, 100000]}
                      money
                    />
                  </Field>
                  <Field id="expense-reason" label="Lý do / Nội dung chi">
                    <input
                      id="expense-reason"
                      value={expenseReason}
                      onChange={(e) => setExpenseReason(e.target.value)}
                      placeholder="Ghi chú thêm (nếu có)"
                      maxLength={1000}
                      className="rounded-xl text-sm"
                    />
                  </Field>
                  <Field id="expense-method" label="Thanh toán">
                    <Select
                      id="expense-method"
                      value={paymentMethod}
                      onValueChange={(value) => setPaymentMethod(value as 'CASH' | 'BANK')}
                    >
                      <option value="CASH">Tiền mặt</option>
                      <option value="BANK">Chuyển khoản</option>
                    </Select>
                  </Field>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Fixed Pinned Footer */}
        <div className="flex flex-none items-center justify-between border-t border-border/60 bg-card p-3 sm:px-6">
          {activeTab === null ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="ml-auto rounded-xl px-4 py-2 text-xs sm:text-sm"
            >
              Đóng
            </Button>
          ) : (
            <div className="flex items-center justify-end gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm"
              >
                Hủy
              </Button>

              {activeTab === 'SALE' && (
                <Button
                  type="button"
                  onClick={handlePostSale}
                  disabled={isSubmitting || saleQty <= 0 || salePrice <= 0}
                  className="rounded-xl px-4 py-2 text-xs sm:text-sm font-bold shadow-md shadow-primary/25"
                >
                  {isSubmitting ? (
                    'Đang lưu…'
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Xác nhận bán chiếu</span>
                    </>
                  )}
                </Button>
              )}

              {activeTab === 'FINISHED_PURCHASE' && (
                <Button
                  type="button"
                  onClick={handlePostFinishedReceipt}
                  disabled={isSubmitting || receiptQty <= 0}
                  className="rounded-xl px-4 py-2 text-xs sm:text-sm font-bold shadow-md shadow-primary/25"
                >
                  {isSubmitting ? (
                    'Đang lưu…'
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Mua {receiptQty} chiếc</span>
                    </>
                  )}
                </Button>
              )}

              {activeTab === 'EXPENSE' && (
                <Button
                  type="button"
                  onClick={handlePostExpense}
                  disabled={isSubmitting || expenseAmount <= 0}
                  className="rounded-xl px-4 py-2 text-xs sm:text-sm font-bold shadow-md shadow-primary/25"
                >
                  <Check size={16} />
                  <span>{isSubmitting ? 'Đang lưu…' : 'Ghi nhận chi phí'}</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
