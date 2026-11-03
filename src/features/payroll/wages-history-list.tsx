'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Check, CheckCheck, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ActionForm } from '@/components/ui/action-form';
import { EmptyState } from '@/components/ui/states';
import { displayDate } from '@/lib/utils';
import { confirmWageReceipt } from './receipt-actions';
import { vnd, type WageMonth } from './types';

export function WagesHistoryList({
  historyMonths = [],
  currentMonthStr,
}: {
  historyMonths: WageMonth[];
  currentMonthStr: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const PAGE_SIZE = 6;
  const pageParam = Number(searchParams.get('page') || '1');
  const totalPages = Math.max(1, Math.ceil(historyMonths.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, isNaN(pageParam) ? 1 : pageParam), totalPages);
  const paginatedMonths = historyMonths.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  function setPage(newPage: number) {
    const params = new URLSearchParams(window.location.search);
    if (newPage <= 1) {
      params.delete('page');
    } else {
      params.set('page', String(newPage));
    }
    router.replace('?' + params.toString(), { scroll: false });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Lịch sử các tháng
        </h3>
      </div>

      {historyMonths.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="Chưa có dữ liệu tiền công"
            description="Các công việc đã hoàn thành sẽ được tổng hợp tự động theo từng tháng tại đây."
          />
        </Card>
      ) : (
        paginatedMonths.map((m) => {
          const earned = BigInt(m.earned || '0');
          const received = BigInt(m.received || '0');
          const remaining = BigInt(m.remaining || '0');
          const complete = remaining === 0n;
          const mNum = Number(m.month.slice(5));
          const mYear = Number(m.month.slice(0, 4));
          const pct =
            earned > 0n ? Math.min(100, Math.round(Number((received * 100n) / earned))) : 0;
          const isCurrentMonth = m.month === currentMonthStr;

          return (
            <Card
              key={m.month}
              className={`p-4 sm:p-5 transition-all hover:border-primary/40 ${
                isCurrentMonth ? 'border-primary/40 bg-card' : ''
              }`}
            >
              {/* Header: Title row with check button / status on top right */}
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary font-black text-base shadow-2xs">
                    T{mNum}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base font-bold text-foreground whitespace-nowrap">
                        Tháng {mNum}/{mYear}
                      </h4>
                      {isCurrentMonth && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary whitespace-nowrap">
                          Tháng này
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {m.records} lượt ghi công
                    </p>
                  </div>
                </div>

                {/* Right: Check button or Đã nhận đủ aligned directly with title */}
                <div className="shrink-0 flex items-center gap-1.5">
                  {complete ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 text-xs font-bold shadow-2xs whitespace-nowrap">
                      <CheckCheck size={14} className="stroke-[2.5]" />
                      Đã nhận đủ
                    </span>
                  ) : (
                    <Dialog
                      title="Xác nhận nhận tiền công"
                      trigger="Xác nhận đã nhận"
                      triggerIcon={<Check size={16} aria-hidden />}
                      variant="outline"
                    >
                      <ActionForm action={confirmWageReceipt} submitLabel="Xác nhận đã nhận">
                        <input type="hidden" name="month" value={m.month} />
                        <input type="hidden" name="amount" value={m.remaining} />
                        <input type="hidden" name="key" value={crypto.randomUUID()} />

                        <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-center">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                            Tiền công Tháng {mNum}/{mYear}
                          </span>
                          <p className="text-3xl font-black text-primary">{vnd(remaining)}</p>
                          <div className="mt-2 flex items-center justify-center gap-3 text-xs text-muted-foreground">
                            <span>Tổng công: {vnd(earned)}</span>
                            <span>•</span>
                            <span>Đã nhận: {vnd(received)}</span>
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
                  )}
                </div>
              </div>

              {/* Pending amount badge if not complete */}
              {!complete && remaining > 0n && (
                <div className="mt-2.5 flex items-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2.5 py-1 text-xs font-bold shadow-2xs">
                    <Clock size={13} className="stroke-[2.5]" />
                    Còn {vnd(remaining)}
                  </span>
                </div>
              )}

              {/* Progress Bar & Summary */}
              <div className="mt-4 pt-3 border-t border-border/60">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Tổng tiền công:{' '}
                    <strong className="text-sm font-bold text-foreground lowercase">
                      {vnd(earned)}
                    </strong>
                  </span>
                </div>

                <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      complete ? 'bg-emerald-600' : 'bg-primary'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {complete ? 'Đã thanh toán đủ toàn bộ' : `Còn lại: ${vnd(remaining)}`}
                  </span>
                  {m.last_received_at && (
                    <span className="hidden sm:inline">
                      Nhận gần nhất: {displayDate(m.last_received_at)}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          );
        })
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 px-1">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
            className="text-xs font-semibold gap-1 rounded-xl"
          >
            <ChevronLeft size={15} /> Tháng mới hơn
          </Button>

          <span className="text-xs font-bold text-muted-foreground">
            Trang {currentPage} / {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(currentPage + 1)}
            className="text-xs font-semibold gap-1 rounded-xl"
          >
            Tháng trước đó <ChevronRight size={15} />
          </Button>
        </div>
      )}
    </div>
  );
}
