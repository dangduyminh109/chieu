'use client';

import {
  Wallet,
  CheckCheck,
  Clock,
  ChevronDown,
  CalendarDays,
  Receipt,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { ActionForm } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table';
import { Avatar } from '@/components/ui/avatar';
import { displayDate } from '@/lib/utils';
import { payMonthlyWages } from './manager-actions';

export type Log = {
  id: string;
  date: string;
  stage: string;
  mat: string | null;
  quantity: number;
  rate: string;
  earned: string;
  paid: string;
  received: string;
};

export type Payment = {
  id: string;
  date: string;
  amount: string;
  method: string;
  notes: string;
};

export type WorkerWithPayroll = {
  id: string;
  name: string;
  avatar_path?: string | null;
  active: boolean;
  logs: Log[];
  payments: Payment[];
};

export const cash = (value: bigint | string | number) =>
  `${BigInt(value).toLocaleString('vi-VN')} đ`;

export function calculateTotals(logs: Log[]) {
  return logs.reduce(
    (a, l) => {
      const earned = BigInt(l.earned);
      const paid = BigInt(l.paid);
      const received = BigInt(l.received);
      a.earned += earned;
      a.paid += paid;
      a.received += received;
      a.remaining += earned - (paid > received ? paid : received);
      return a;
    },
    { earned: 0n, paid: 0n, received: 0n, remaining: 0n },
  );
}

export function ManagerWorkerCard({
  worker,
  month,
}: {
  worker: WorkerWithPayroll;
  month: string;
}) {
  const t = calculateTotals(worker.logs);
  const stages = new Map<string, number>();
  worker.logs.forEach((l) => stages.set(l.stage, (stages.get(l.stage) ?? 0) + l.quantity));

  const hasLogs = worker.logs.length > 0;
  const isPaidInFull = hasLogs && t.remaining === 0n;
  const hasRemaining = t.remaining > 0n;
  const receivedPct =
    t.earned > 0n ? Math.min(100, Math.round(Number((t.received * 100n) / t.earned))) : 0;

  return (
    <Card className="overflow-hidden border border-border/80 bg-card p-4 sm:p-5 shadow-xs transition-shadow hover:shadow-sm">
      {/* Top Header: Worker Identity & Payment Action */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 pb-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar
            path={worker.avatar_path}
            name={worker.name}
            className="size-11 shrink-0 rounded-2xl text-sm shadow-2xs"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-foreground truncate">
                {worker.name}
              </h2>
              {!worker.active && (
                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                  Ngừng hoạt động
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              {!hasLogs ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Chưa ghi công
                </span>
              ) : isPaidInFull ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[11px] font-bold">
                  <CheckCheck size={13} className="stroke-[2.5]" />
                  Đã nhận đủ
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-[11px] font-bold">
                  <Clock size={13} className="stroke-[2.5]" />
                  Còn nợ {cash(t.remaining)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Trả công Action Button */}
        {hasRemaining && (
          <Dialog
            title={`Trả công · ${worker.name}`}
            trigger="Trả công"
            triggerIcon={<Wallet size={15} />}
            triggerClassName="btn btn-primary btn-sm font-semibold shadow-xs"
          >
            <ActionForm action={payMonthlyWages} submitLabel="Xác nhận đã chi trả">
              <input type="hidden" name="worker" value={worker.id} />
              <input type="hidden" name="month" value={month} />
              <input type="hidden" name="key" value={crypto.randomUUID()} />

              <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 text-sm">
                <p className="text-xs text-muted-foreground">Tháng {month.slice(5)}/{month.slice(0, 4)}</p>
                <p className="mt-0.5 text-sm font-medium">
                  Số tiền còn phải trả:{' '}
                  <strong className="text-base text-primary font-bold">{cash(t.remaining)}</strong>
                </p>
              </div>

              <Field id={`amount-${worker.id}`} label="Số tiền trả (đ)">
                <input
                  id={`amount-${worker.id}`}
                  name="amount"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max={String(t.remaining)}
                  step="1"
                  defaultValue={String(t.remaining)}
                  required
                />
              </Field>

              <Field id={`method-${worker.id}`} label="Hình thức thanh toán">
                <Select id={`method-${worker.id}`} name="method" defaultValue="CASH">
                  <option value="CASH">Tiền mặt</option>
                  <option value="BANK">Chuyển khoản</option>
                </Select>
              </Field>

              <Field id={`notes-${worker.id}`} label="Ghi chú (tùy chọn)">
                <input
                  id={`notes-${worker.id}`}
                  name="notes"
                  maxLength={900}
                  placeholder="Ví dụ: Ứng trước đợt 1, chuyển qua Vietcombank..."
                />
              </Field>

              <label className="flex items-start gap-2.5 rounded-lg border border-border/80 bg-muted/30 p-2.5 text-xs text-foreground cursor-pointer">
                <input type="checkbox" name="confirmed" required className="mt-0.5 rounded border-border" />
                <span>Tôi xác nhận đã chi trả số tiền này cho thợ {worker.name}.</span>
              </label>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Có thể trả một phần. Tiền chi trả được ghi nhận vào sổ theo dõi và thợ sẽ xác nhận đã nhận trên trang Tiền công cá nhân.
              </p>
            </ActionForm>
          </Dialog>
        )}
      </div>

      {/* Production Stages Chips */}
      <div className="mt-3.5">
        {hasLogs ? (
          <div className="flex flex-wrap gap-1.5">
            {Array.from(stages, ([stage, quantity]) => (
              <span
                key={stage}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground"
              >
                <span className="text-muted-foreground">{stage}:</span>
                <strong className="font-semibold text-foreground">{quantity.toLocaleString('vi-VN')} chiếc</strong>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs italic text-muted-foreground">
            Chưa có ngày công nào được ghi nhận trong tháng này.
          </p>
        )}
      </div>

      {/* 4-Cell Wages Breakdown Grid */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
          <p className="text-[11px] font-medium text-muted-foreground">Tổng tiền công</p>
          <p className="mt-1 font-bold text-foreground text-sm sm:text-base break-words">
            {cash(t.earned)}
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
          <p className="text-[11px] font-medium text-muted-foreground">Đã chi trả</p>
          <p className="mt-1 font-bold text-blue-600 dark:text-blue-400 text-sm sm:text-base break-words">
            {cash(t.paid)}
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
          <p className="text-[11px] font-medium text-muted-foreground">Thợ đã nhận</p>
          <p className="mt-1 font-bold text-emerald-600 dark:text-emerald-400 text-sm sm:text-base break-words">
            {cash(t.received)}
          </p>
        </div>

        <div
          className={`rounded-xl border p-2.5 ${
            hasRemaining
              ? 'border-amber-500/40 bg-amber-500/5'
              : 'border-border/60 bg-muted/20'
          }`}
        >
          <p
            className={`text-[11px] font-medium ${
              hasRemaining ? 'text-amber-700 dark:text-amber-400 font-semibold' : 'text-muted-foreground'
            }`}
          >
            Còn phải trả
          </p>
          <p
            className={`mt-1 font-bold text-sm sm:text-base break-words ${
              hasRemaining ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {cash(t.remaining)}
          </p>
        </div>
      </div>

      {/* Progress Bar (if earned > 0) */}
      {t.earned > 0n && (
        <div className="mt-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Tiến độ thợ đã nhận:</span>
            <span className="font-semibold text-foreground">
              {receivedPct}% ({cash(t.received)} / {cash(t.earned)})
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all duration-300 ${
                isPaidInFull ? 'bg-emerald-500' : 'bg-primary'
              }`}
              style={{ width: `${receivedPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Collapsible: Work Logs Details */}
      {hasLogs && (
        <details className="group mt-4 border-t border-border/60 pt-3">
          <summary className="flex cursor-pointer items-center justify-between py-1 text-xs font-semibold text-primary transition-colors hover:text-primary/80 list-none select-none">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={14} />
              Chi tiết ngày công ({worker.logs.length} bản ghi)
            </span>
            <ChevronDown
              size={15}
              className="text-muted-foreground transition-transform duration-200 group-open:rotate-180"
            />
          </summary>
          <div className="mt-2.5 pt-1">
            <DataTable
              rows={worker.logs}
              rowKey={(l) => l.id}
              caption={`Công của ${worker.name}`}
              columns={[
                { key: 'date', header: 'Ngày', cell: (l) => displayDate(l.date) },
                {
                  key: 'stage',
                  header: 'Công đoạn / Chiếu',
                  cell: (l) => (
                    <div>
                      <span className="font-medium text-foreground">{l.stage}</span>
                      {l.mat && (
                        <span className="block text-[11px] text-muted-foreground">{l.mat}</span>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'quantity',
                  header: 'Số lượng',
                  cell: (l) => (
                    <span className="whitespace-nowrap font-semibold">
                      {l.quantity.toLocaleString('vi-VN')} chiếc
                    </span>
                  ),
                },
                {
                  key: 'rate',
                  header: 'Đơn giá',
                  cell: (l) => <span className="whitespace-nowrap">{cash(l.rate)}</span>,
                },
                {
                  key: 'earned',
                  header: 'Tiền công',
                  cell: (l) => (
                    <span className="whitespace-nowrap font-bold text-foreground">
                      {cash(l.earned)}
                    </span>
                  ),
                },
              ]}
            />
          </div>
        </details>
      )}

      {/* Collapsible: Payment History */}
      {worker.payments.length > 0 && (
        <details className="group mt-2 border-t border-border/60 pt-3">
          <summary className="flex cursor-pointer items-center justify-between py-1 text-xs font-semibold text-primary transition-colors hover:text-primary/80 list-none select-none">
            <span className="flex items-center gap-1.5">
              <Receipt size={14} />
              Lịch sử chi trả ({worker.payments.length} lần)
            </span>
            <ChevronDown
              size={15}
              className="text-muted-foreground transition-transform duration-200 group-open:rotate-180"
            />
          </summary>
          <ul className="mt-2.5 divide-y divide-border/60 rounded-xl border border-border/70 bg-muted/20 px-3">
            {worker.payments.map((p) => (
              <li key={p.id} className="py-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{displayDate(p.date)}</span>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {p.method === 'BANK' ? 'Chuyển khoản' : 'Tiền mặt'}
                    </span>
                  </div>
                  <strong className="font-bold text-primary text-sm">{cash(p.amount)}</strong>
                </div>
                {p.notes && (
                  <p className="mt-1 text-[11px] text-muted-foreground break-words">{p.notes}</p>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
