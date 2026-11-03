'use client';

import { Sparkles, CheckCheck, Clock, Check } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { ActionForm } from '@/components/ui/action-form';
import { confirmWageReceipt } from './receipt-actions';
import { vnd, type WageMonth } from './types';

export function WagesHeroCard({
  currentMonth,
  currentDate,
}: {
  currentMonth?: WageMonth;
  currentDate: string;
}) {
  const currentMonthNum = Number(currentDate.slice(5, 7));
  const currentYearNum = Number(currentDate.slice(0, 4));

  const currentMonthEarned = BigInt(currentMonth?.earned || '0');
  const currentMonthReceived = BigInt(currentMonth?.received || '0');
  const currentMonthRemaining = BigInt(currentMonth?.remaining || '0');
  const currentMonthComplete = currentMonth ? currentMonthRemaining === 0n : false;

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-xs">
            <Sparkles size={18} />
          </span>
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary block whitespace-nowrap">
              Tháng hiện tại
            </span>
            <h2 className="text-base sm:text-lg font-black text-foreground whitespace-nowrap">
              Tháng {currentMonthNum}/{currentYearNum}
            </h2>
          </div>
        </div>

        {currentMonth ? (
          currentMonthComplete ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-600 text-white px-3 py-1 text-xs font-bold shadow-2xs whitespace-nowrap">
              <CheckCheck size={14} className="stroke-[2.5]" />
              Đã nhận đủ
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2.5 py-1 text-xs font-bold whitespace-nowrap">
              <Clock size={14} className="stroke-[2.5]" />
              Chưa nhận đủ
            </span>
          )
        ) : (
          <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground whitespace-nowrap">
            Chưa phát sinh
          </span>
        )}
      </div>

      {/* Current Month Amount */}
      <div className="mt-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
          Tổng tiền công tháng này
        </span>
        <p className="mt-1 text-3xl font-black text-primary sm:text-4xl">
          {vnd(currentMonthEarned)}
        </p>
      </div>

      {/* Confirm receipt button if remaining > 0 */}
      {currentMonth && !currentMonthComplete && currentMonthRemaining > 0n && (
        <div className="mt-5 pt-3 border-t border-border/60 flex items-center justify-between gap-3">
          <div className="text-xs">
            <span className="text-muted-foreground block">Cần xác nhận</span>
            <span className="text-sm font-bold text-primary">{vnd(currentMonthRemaining)}</span>
          </div>

          <Dialog
            title="Xác nhận nhận tiền công"
            trigger="Xác nhận đã nhận"
            triggerIcon={<Check size={16} aria-hidden />}
          >
            <ActionForm action={confirmWageReceipt} submitLabel="Xác nhận đã nhận">
              <input type="hidden" name="month" value={currentMonth.month} />
              <input type="hidden" name="amount" value={currentMonth.remaining} />
              <input type="hidden" name="key" value={crypto.randomUUID()} />

              <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Tiền công Tháng {currentMonthNum}/{currentYearNum}
                </span>
                <p className="text-3xl font-black text-primary">{vnd(currentMonthRemaining)}</p>
                <div className="mt-2 flex items-center justify-center gap-3 text-xs text-muted-foreground">
                  <span>Tổng công: {vnd(currentMonthEarned)}</span>
                  <span>•</span>
                  <span>Đã nhận: {vnd(currentMonthReceived)}</span>
                </div>
              </div>

              <label className="checkbox-card cursor-pointer">
                <input type="checkbox" name="confirmed" required />
                <span className="font-semibold text-foreground">
                  Tôi đã nhận được tiền công
                </span>
              </label>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Vui lòng chỉ xác nhận sau khi đã nhận tiền. Sau khi xác nhận, tiền công của tháng sẽ được ghi nhận đã tất toán.
              </p>
            </ActionForm>
          </Dialog>
        </div>
      )}
    </div>
  );
}
