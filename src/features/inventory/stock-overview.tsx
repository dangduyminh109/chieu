import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { MatStageForm } from './stage-form';
import Image from 'next/image';
import { matImageUrl } from '@/features/mat-types/image-url';
import { StageIcon } from '@/features/production/stage-icon';
import {
  ArrowRightLeft,
  Plus,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Info,
  Layers,
} from 'lucide-react';

export type StockOverview = {
  date: string;
  mats: {
    id: string;
    name: string;
    image_path?: string | null;
    dimensions?: string | null;
    quantity: string;
    woven: string;
    tied: string;
    cut: string;
    sewn: string;
    added_today: string;
    sold_today: string;
    woven_today: string;
  }[];
  stages: { code: string; name: string; today: string; recorded: string }[];
};

const number = (value: string | bigint | number) => {
  try {
    return BigInt(value ?? 0).toLocaleString('vi-VN');
  } catch {
    return '0';
  }
};

export function StockOverviewCard({ data }: { data: StockOverview }) {
  const sum = (
    key: 'quantity' | 'added_today' | 'sold_today' | 'woven' | 'tied' | 'cut' | 'sewn',
  ) => data.mats.reduce((a, m) => a + BigInt(m[key] || 0), 0n);

  const total = sum('quantity'),
    woven = sum('woven'),
    tied = sum('tied'),
    cut = sum('cut'),
    sewn = sum('sewn');

  const readyToSell = cut + sewn;
  const addedToday = sum('added_today');
  const soldToday = sum('sold_today');

  const pending = [
    { name: 'Buộc', done: tied + cut + sewn, pending: woven },
    { name: 'Cắt', done: cut + sewn, pending: woven + tied },
    { name: 'May', done: sewn, pending: woven + tied + cut },
  ];

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-4 sm:p-5 border border-border/80 shadow-xs">
        {/* Top Header & Main Overview Metrics */}
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <Image
              src="/images/kho-chieu-moi.png"
              alt="Chiếu tại cơ sở"
              width={56}
              height={56}
              className="size-14 shrink-0 rounded-xl object-cover"
            />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">Chiếu đang có</h2>
              <p className="text-[11px] text-muted-foreground">
                Tồn kho theo từng công đoạn hoàn thiện
              </p>
            </div>
          </div>

          {/* 2 Main Hero Metric Blocks */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 sm:p-3.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block truncate">
                Tổng tồn kho
              </span>
              <p className="mt-1 text-2xl sm:text-3xl font-black text-primary tabular-nums">
                {number(total)} <span className="text-xs font-semibold text-foreground">chiếc</span>
              </p>
              <span className="mt-0.5 text-[10px] text-muted-foreground block truncate">
                Tất cả công đoạn
              </span>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 sm:p-3.5">
              <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 size={13} className="shrink-0" />
                <span className="text-[11px] font-semibold uppercase tracking-wider block truncate">
                  Có thể bán
                </span>
              </div>
              <p className="mt-1 text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                {number(readyToSell)}{' '}
                <span className="text-xs font-semibold text-foreground">chiếc</span>
              </p>
              <span className="mt-0.5 text-[10px] text-muted-foreground block truncate">
                Đã cắt hoặc đã may
              </span>
            </div>
          </div>

          {/* Today Flow: Nhập & Bán */}
          <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-border/70 bg-muted/30 p-2.5 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <TrendingUp size={14} />
              </span>
              <div className="min-w-0">
                <span className="text-[10px] text-muted-foreground block truncate">
                  Nhập hôm nay
                </span>
                <strong className="text-emerald-600 dark:text-emerald-400 font-bold block truncate">
                  +{number(addedToday)} chiếc
                </strong>
              </div>
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <TrendingDown size={14} />
              </span>
              <div className="min-w-0">
                <span className="text-[10px] text-muted-foreground block truncate">
                  Bán hôm nay
                </span>
                <strong className="text-blue-600 dark:text-blue-400 font-bold block truncate">
                  {soldToday > 0n ? `−${number(soldToday)}` : `${number(soldToday)}`} chiếc
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Tiến độ công đoạn */}
        <div className="rounded-2xl border border-border/80 bg-muted/30 p-3.5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Tiến độ công đoạn
            </h3>
            <span className="text-[11px] text-muted-foreground">chiếc</span>
          </div>

          <div className="divide-y divide-border/60">
            {pending.map((s) => {
              const sumAll = s.done + s.pending;
              const pct =
                sumAll > 0n ? Math.min(100, Math.round(Number((s.done * 100n) / sumAll))) : 0;

              return (
                <div key={s.name} className="py-2.5 space-y-1.5 first:pt-0.5 last:pb-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <StageIcon name={s.name} size={18} className="rounded-md object-cover" />
                      <span className="font-semibold text-foreground truncate">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-muted-foreground">
                        Chưa làm: <strong className="text-foreground">{number(s.pending)}</strong>
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Đã xong: <strong className="font-bold">{number(s.done)}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Mini Progress Bar */}
                  {sumAll > 0n && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Mats List */}
        <div className="space-y-2.5 pt-2 border-t border-border/60">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Chi tiết theo loại chiếu ({data.mats.length})
            </span>
          </div>

          {data.mats.map((m) => {
            const hasActivity = BigInt(m.added_today || 0) > 0n || BigInt(m.sold_today || 0) > 0n;

            return (
              <div
                key={m.id}
                className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-2.5 shadow-2xs transition-colors hover:border-primary/40"
              >
                {/* Mat Title & Total Count */}
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {m.image_path ? (
                      <Image
                        src={matImageUrl(m.image_path)!}
                        alt={m.name}
                        width={48}
                        height={48}
                        unoptimized
                        className="size-12 rounded-xl border border-border/80 object-cover shrink-0 shadow-2xs"
                      />
                    ) : (
                      <div className="size-12 rounded-xl border border-border/70 bg-muted/40 flex items-center justify-center shrink-0 text-muted-foreground/60">
                        <Layers size={22} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-foreground truncate">{m.name}</h3>
                      {m.dimensions && (
                        <p className="text-xs text-muted-foreground truncate leading-tight">
                          {m.dimensions}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex items-center rounded-xl bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                    {number(m.quantity)} chiếc
                  </span>
                </div>

                {/* 4 Stages Grid */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl border border-amber-300/90 bg-amber-50/80 dark:border-amber-700/60 dark:bg-amber-950/40 p-2 sm:p-2.5 flex items-center gap-2.5 shadow-2xs">
                    <StageIcon
                      name="buộc"
                      size={32}
                      className="size-8 rounded-lg object-cover shadow-2xs shrink-0 ring-1 ring-amber-500/40"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-amber-950 dark:text-amber-200 block truncate">
                        Chờ buộc
                      </span>
                      <strong className="text-base font-black text-amber-950 dark:text-amber-50 block leading-tight mt-0.5">
                        {number(m.woven)}{' '}
                        <span className="text-xs font-medium text-amber-900/80 dark:text-amber-300">chiếc</span>
                      </strong>
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-300/90 bg-blue-50/80 dark:border-blue-700/60 dark:bg-blue-950/40 p-2 sm:p-2.5 flex items-center gap-2.5 shadow-2xs">
                    <StageIcon
                      name="cắt"
                      size={32}
                      className="size-8 rounded-lg object-cover shadow-2xs shrink-0 ring-1 ring-blue-500/40"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-blue-950 dark:text-blue-200 block truncate">
                        Chờ cắt
                      </span>
                      <strong className="text-base font-black text-blue-950 dark:text-blue-50 block leading-tight mt-0.5">
                        {number(m.tied)}{' '}
                        <span className="text-xs font-medium text-blue-900/80 dark:text-blue-300">chiếc</span>
                      </strong>
                    </div>
                  </div>

                  <div className="rounded-xl border border-teal-300/90 bg-teal-50/80 dark:border-teal-700/60 dark:bg-teal-950/40 p-2 sm:p-2.5 flex items-center gap-2.5 shadow-2xs">
                    <StageIcon
                      name="cắt"
                      size={32}
                      className="size-8 rounded-lg object-cover shadow-2xs shrink-0 ring-1 ring-teal-500/40"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-teal-950 dark:text-teal-200 block truncate">
                        Đã cắt
                      </span>
                      <strong className="text-base font-black text-teal-950 dark:text-teal-50 block leading-tight mt-0.5">
                        {number(m.cut)}{' '}
                        <span className="text-xs font-medium text-teal-900/80 dark:text-teal-300">chiếc</span>
                      </strong>
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-300/90 bg-emerald-50/80 dark:border-emerald-700/60 dark:bg-emerald-950/40 p-2 sm:p-2.5 flex items-center gap-2.5 shadow-2xs">
                    <StageIcon
                      name="may"
                      size={32}
                      className="size-8 rounded-lg object-cover shadow-2xs shrink-0 ring-1 ring-emerald-500/40"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200 block truncate">
                        Đã may
                      </span>
                      <strong className="text-base font-black text-emerald-950 dark:text-emerald-50 block leading-tight mt-0.5">
                        {number(m.sewn)}{' '}
                        <span className="text-xs font-medium text-emerald-900/80 dark:text-emerald-300">chiếc</span>
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Today Status Note */}
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40">
                  {hasActivity ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      Hôm nay: +{number(m.added_today)} nhập · {number(m.sold_today)} bán
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Hôm nay chưa biến động</span>
                  )}
                  <span className="text-muted-foreground">
                    Có thể bán:{' '}
                    <strong className="text-foreground">
                      {number(BigInt(m.cut) + BigInt(m.sewn))}
                    </strong>
                  </span>
                </div>
              </div>
            );
          })}

          {!data.mats.length && (
            <div className="py-6 text-center text-sm text-muted-foreground rounded-2xl border border-dashed border-border">
              Chưa có loại chiếu trong kho.
            </div>
          )}
        </div>

        {/* Action Buttons: Nhập tồn đầu kỳ & Cập nhật ngoài ghi công */}
        <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
          <Dialog
            title="Thêm chiếu có sẵn"
            trigger="Thêm chiếu có sẵn"
            triggerIcon={<Plus size={16} />}
            triggerClassName="flex w-full items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-primary text-primary-foreground font-bold text-xs sm:text-sm shadow-xs hover:bg-primary/90 active:scale-[0.98] transition-all cursor-pointer"
          >
            <MatStageForm mats={data.mats} mode="ADD" />
          </Dialog>

          <Dialog
            title="Cập nhật bước đã làm"
            trigger="Cập nhật bước đã làm"
            triggerIcon={<ArrowRightLeft size={16} />}
            triggerClassName="flex w-full items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-border/80 bg-card hover:bg-muted text-foreground font-semibold text-xs sm:text-sm shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
          >
            <MatStageForm mats={data.mats} mode="ADVANCE" />
          </Dialog>
        </div>

        {/* Informative Note */}
        <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/30 p-2.5 text-xs text-muted-foreground">
          <Info size={14} className="shrink-0 text-muted-foreground/80 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            Thợ ghi công mới sẽ tự thêm hoặc chuyển chiếu trong kho. Không nhập lại thủ công. Chiếu
            mua cũng tự cộng kho.
          </p>
        </div>
      </Card>
    </div>
  );
}
