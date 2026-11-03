'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Sparkles, Check, X, Layers } from 'lucide-react';
import Image from 'next/image';
import { matImageUrl } from '@/features/mat-types/image-url';
import { Button } from '@/components/ui/button';
import { NumberStepper } from '@/components/ui/number-stepper';
import { workDateSchema } from './schemas';
import { DatePicker } from '@/components/ui/date-picker';
import { money } from '@/lib/utils';
import { selectLaborRate, calculateWage } from './calculations';
import { submitWork, updateWorkLog } from './actions';
import { StageIcon } from './stage-icon';
import { WorkLogHistoryDrawer } from './work-log-history-drawer';
import { QuickWorkConfirmModal } from './quick-work-confirm-modal';
import type { MatType, Stage, LaborRate, WorkLog } from '@/types/domain';

export function QuickWorkDialog({
  open,
  onOpenChange,
  mats,
  stages,
  rates,
  workerId,
  today,
  recentMatId,
  existingLogs = [],
  initialDate,
  initialStageId,
  initialMatId,
  initialQuantity,
  initialLogId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mats: MatType[];
  stages: Stage[];
  rates: LaborRate[];
  workerId: string;
  today: string;
  recentMatId?: string | null;
  existingLogs?: WorkLog[];
  initialDate?: string;
  initialStageId?: string;
  initialMatId?: string | null;
  initialQuantity?: number;
  initialLogId?: string | null;
}) {
  const router = useRouter();

  // Form states
  const [date, setDate] = useState(initialDate || today);
  const [stageId, setStageId] = useState(initialStageId || stages[0]?.id || '');
  const [matId, setMatId] = useState(initialMatId || '');
  const [quantity, setQuantity] = useState(
    initialQuantity ?? defaultWorkQuantity(stages, initialStageId || stages[0]?.id || ''),
  );
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(initialLogId || null);

  // Track dialog open state with a ref so hydration only runs when dialog freshly opens
  const wasOpenRef = useRef(false);
  const requestRef = useRef<{ payload: string; key: string } | null>(null);

  const isWeaving = stages.find((s) => s.id === stageId)?.code === 'WEAVING';
  const tracksStock = ['WEAVING', 'TYING', 'CUTTING', 'SEWING'].includes(
    stages.find((s) => s.id === stageId)?.code ?? '',
  );

  // Confirm dialog state for edits
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Whenever the dialog opens (transition open: false -> true), hydrate form states
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }

    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      const targetDate = initialDate || today;
      setDate(targetDate);

      const defaultStage = initialStageId || stages[0]?.id || '';
      const cachedMat =
        typeof window !== 'undefined' ? localStorage.getItem('chieu_last_mat_id') : null;
      const defaultMat =
        initialMatId ||
        (cachedMat && mats.some((m) => m.id === cachedMat && m.active) ? cachedMat : '') ||
        (recentMatId && mats.some((m) => m.id === recentMatId && m.active) ? recentMatId : '') ||
        mats[0]?.id ||
        '';

      // 1. If explicit initialLogId passed, hydrate from that specific log
      let targetLog: WorkLog | undefined = undefined;
      if (initialLogId) {
        targetLog = existingLogs.find((l) => l.id === initialLogId);
      }
      // 2. Otherwise look for log on targetDate matching defaultStage
      if (!targetLog) {
        targetLog = existingLogs.find(
          (l) =>
            l.work_date === targetDate &&
            l.stage_id === defaultStage &&
            (l.stock_mat_type_id ?? l.mat_type_id) === defaultMat,
        );
      }

      if (targetLog) {
        setStageId(targetLog.stage_id);
        setMatId(targetLog.stock_mat_type_id ?? targetLog.mat_type_id ?? defaultMat);
        setQuantity(targetLog.quantity);
        setNotes(targetLog.notes ?? '');
        setEditingLogId(targetLog.id);
      } else {
        setStageId(defaultStage);
        setMatId(defaultMat);
        setQuantity(initialQuantity ?? defaultWorkQuantity(stages, defaultStage));
        setNotes('');
        setEditingLogId(null);
      }
    }
  }, [
    open,
    initialDate,
    initialStageId,
    initialMatId,
    initialQuantity,
    initialLogId,
    today,
    existingLogs,
    mats,
    stages,
    recentMatId,
  ]);

  // Check if there is an existing log being edited or matching current selection
  const existingLog = useMemo(() => {
    if (editingLogId) {
      return existingLogs.find((l) => l.id === editingLogId) || null;
    }
    return (
      existingLogs.find(
        (l) =>
          l.work_date === date &&
          l.stage_id === stageId &&
          (!tracksStock || (l.stock_mat_type_id ?? l.mat_type_id) === matId),
      ) || null
    );
  }, [existingLogs, editingLogId, date, stageId, matId, tracksStock]);

  // Handle stage selection (Role is default check, but user can freely choose any stage)
  function handleStageSelect(newStageId: string) {
    if (newStageId === stageId) return;
    setStageId(newStageId);
    const newStage = stages.find((s) => s.id === newStageId);
    const newTracksStock = ['WEAVING', 'TYING', 'CUTTING', 'SEWING'].includes(newStage?.code ?? '');

    // Check if there is already another log for this stage on that date
    const match = existingLogs.find(
      (l) =>
        l.work_date === date &&
        l.stage_id === newStageId &&
        (!newTracksStock || (l.stock_mat_type_id ?? l.mat_type_id) === matId),
    );

    if (match) {
      setQuantity(match.quantity);
      setNotes(match.notes ?? '');
      if (match.stock_mat_type_id ?? match.mat_type_id)
        setMatId((match.stock_mat_type_id ?? match.mat_type_id)!);
      setEditingLogId(match.id);
    } else {
      // New log for this stage
      setQuantity(defaultWorkQuantity(stages, newStageId));
      setNotes('');
      setEditingLogId(null);
    }
  }

  // Handle date selection
  function handleDateSelect(newDate: string) {
    setDate(newDate);
    const match = existingLogs.find(
      (l) =>
        l.work_date === newDate &&
        l.stage_id === stageId &&
        (!tracksStock || (l.stock_mat_type_id ?? l.mat_type_id) === matId),
    );
    if (match) {
      setQuantity(match.quantity);
      setNotes(match.notes ?? '');
      if (match.stock_mat_type_id ?? match.mat_type_id)
        setMatId((match.stock_mat_type_id ?? match.mat_type_id)!);
      setEditingLogId(match.id);
    } else {
      setEditingLogId(null);
      setQuantity(defaultWorkQuantity(stages, stageId));
      setNotes('');
    }
  }

  // Handle mat selection
  function handleMatSelect(newMatId: string) {
    setMatId(newMatId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('chieu_last_mat_id', newMatId);
    }
    const match = existingLogs.find(
      (l) =>
        l.work_date === date &&
        l.stage_id === stageId &&
        (l.stock_mat_type_id ?? l.mat_type_id) === newMatId,
    );
    if (match) {
      setQuantity(match.quantity);
      setNotes(match.notes ?? '');
      setEditingLogId(match.id);
    } else {
      setEditingLogId(null);
      setQuantity(defaultWorkQuantity(stages, stageId));
      setNotes('');
    }
  }

  // Calculate live rate
  const liveRate = selectLaborRate(rates, isWeaving ? matId : null, stageId, workerId, date);
  const isSameAsExisting =
    existingLog &&
    existingLog.stage_id === stageId &&
    (!tracksStock ||
      !(existingLog.stock_mat_type_id ?? existingLog.mat_type_id) ||
      (existingLog.stock_mat_type_id ?? existingLog.mat_type_id) === matId);
  const unitRate = isSameAsExisting ? existingLog.unit_rate : (liveRate?.unit_rate ?? 0);

  let estimatedAmount = 0;
  try {
    estimatedAmount = calculateWage(quantity, unitRate);
  } catch {
    estimatedAmount = 0;
  }

  async function handleExecuteSave() {
    if (!workDateSchema.safeParse(date).success) {
      toast.error('Chỉ ghi công cho hôm nay hoặc ngày trong quá khứ.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (existingLog) {
        // Edit existing log (supports changing stage, mat, quantity, notes)
        const res = await updateWorkLog({
          id: existingLog.id,
          version: existingLog.version,
          quantity,
          stage_id: stageId,
          mat_type_id: tracksStock ? matId : null,
          work_date: date,
          notes: notes.trim() || null,
        });
        if (res.success) {
          toast.success(res.message);
          setShowConfirmModal(false);
          onOpenChange(false);
          router.refresh();
        } else {
          toast.error(res.message);
        }
      } else {
        // Create new log
        const payload = JSON.stringify([date, stageId, matId, quantity, notes, unitRate]);
        if (requestRef.current?.payload !== payload)
          requestRef.current = { payload, key: crypto.randomUUID() };
        const res = await submitWork({
          work_date: date,
          stage_id: stageId,
          mat_type_id: tracksStock ? matId : null,
          quantity,
          idempotency_key: requestRef.current.key,
          expected_rate: unitRate,
          notes: notes.trim() || null,
        });
        if (res.success) {
          requestRef.current = null;
          toast.success(res.message);
          onOpenChange(false);
          router.refresh();
        } else {
          toast.error(res.message);
        }
      }
    } catch {
      toast.error('Có lỗi xảy ra khi lưu. Vui lòng thử lại!');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handlePrimaryButtonClick() {
    if (
      existingLog &&
      (existingLog.quantity !== quantity ||
        existingLog.stage_id !== stageId ||
        (tracksStock && (existingLog.stock_mat_type_id ?? existingLog.mat_type_id) !== matId))
    ) {
      // Need confirmation for editing
      setShowConfirmModal(true);
    } else {
      handleExecuteSave();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />

      {/* Main Dialog Modal */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl transition-all"
      >
        {/* Fixed Header */}
        <div className="flex flex-none items-center justify-between border-b border-border/60 bg-card px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="min-w-0 flex-1 pr-2">
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground sm:text-lg">
              <Sparkles className="size-5 shrink-0 text-primary" />
              <span className="truncate">
                {existingLog ? 'Chỉnh sửa số lượng' : 'Nhập số lượng'}
              </span>
            </h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            type="button"
            className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 sm:p-5 sm:space-y-3.5">
          {/* Existing Log Notice & Audit History Drawer */}
          {existingLog && (
            <WorkLogHistoryDrawer
              key={`${existingLog.id}-${open}`}
              logId={existingLog.id}
              date={date}
              currentQuantity={existingLog.quantity}
            />
          )}

          {/* Date Picker row */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Ngày làm việc
            </label>
            <DatePicker
              id="quick-work-date"
              value={date}
              onValueChange={handleDateSelect}
              max={today}
            />
          </div>

          {/* Stage pills (All active stages available, worker skill is initial default) */}
          {stages.length > 1 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Công đoạn làm
                </label>
                <span className="text-[10px] text-muted-foreground font-medium">
                  Có thể chọn đổi công đoạn
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {stages.map((st, idx) => {
                  const isSelected = stageId === st.id;
                  const isLastOdd = stages.length % 2 === 1 && idx === stages.length - 1;

                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => handleStageSelect(st.id)}
                      className={`flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all border cursor-pointer active:scale-[0.98] ${
                        isSelected
                          ? 'border-primary bg-primary text-white shadow-xs font-bold'
                          : 'border-border bg-card hover:bg-muted text-foreground'
                      } ${isLastOdd ? 'col-span-2' : ''}`}
                    >
                      <StageIcon name={st.name} size={18} className="rounded-md object-cover" />
                      <span>{st.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mat Type selector - SCROLL X TRÊN 1 DÒNG DUY NHẤT */}
          {tracksStock && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Loại chiếu
                </label>
                {mats.filter((m) => m.active).length > 2 && (
                  <span className="text-[10px] text-muted-foreground">Vuốt ngang →</span>
                )}
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar scroll-smooth snap-x">
                {mats
                  .filter((m) => m.active)
                  .map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleMatSelect(m.id)}
                      className={`flex shrink-0 min-w-[135px] sm:min-w-[150px] snap-start items-center gap-2 rounded-xl px-2.5 py-1.5 text-left border transition-all cursor-pointer active:scale-[0.98] ${
                        matId === m.id
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs ring-1 ring-primary/30'
                          : 'border-border bg-card hover:border-primary/50 text-foreground'
                      }`}
                    >
                      {m.image_path ? (
                        <Image
                          src={matImageUrl(m.image_path)!}
                          alt={m.name}
                          width={32}
                          height={32}
                          unoptimized
                          className="size-8 rounded-lg border border-border/80 object-cover shrink-0 shadow-2xs"
                        />
                      ) : (
                        <div className="size-8 rounded-lg border border-border/60 bg-muted/60 flex items-center justify-center shrink-0 text-muted-foreground/50">
                          <Layers size={15} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold line-clamp-1 block">{m.name}</span>
                        <span className="text-[10px] text-muted-foreground font-normal block truncate">
                          {m.dimensions || 'Chuẩn'}
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* SỐ LƯỢNG CHIẾU HOÀN THÀNH */}
          {existingLog && !existingLog.stock_mat_type_id && (
            <p className="text-xs text-muted-foreground">
              Bản ghi cũ: sửa công không tự cập nhật phần kho đã nhập trước đây.
            </p>
          )}
          <div className="rounded-xl border border-border bg-muted/30 p-2.5 sm:p-3">
            <label
              htmlFor="work-quantity"
              className="text-[11px] font-bold text-foreground uppercase tracking-wider block mb-2 text-center"
            >
              Số lượng chiếu hoàn thành
            </label>

            <NumberStepper
              id="work-quantity"
              value={quantity}
              onChange={setQuantity}
              min={1}
              max={1000}
              suffix="chiếc"
              increments={[1, 5, 10, 20]}
            />
          </div>

          {/* Wage Preview */}
          <div className="rounded-xl border border-border bg-muted/40 p-2.5 sm:p-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-semibold">
                  Đơn giá
                </span>
                <p className="mt-0.5 font-bold text-foreground">
                  {money(unitRate)}{' '}
                  <span className="font-normal text-muted-foreground">/ chiếc</span>
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-semibold">
                  Tiền công
                </span>
                <p className="mt-0.5 text-base sm:text-lg font-black text-primary truncate">
                  {money(estimatedAmount)}
                </p>
              </div>
            </div>
          </div>

          {/* Notes Input Field (Optional) */}
          <div>
            <label
              htmlFor="work-notes"
              className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1"
            >
              Ghi chú (Tùy chọn)
            </label>
            <input
              id="work-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Nhập ghi chú thêm nếu có..."
              maxLength={200}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Fixed Pinned Footer */}
        <div className="flex flex-none items-center justify-end gap-2 border-t border-border/60 bg-card p-3 sm:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-4 py-2 text-xs sm:text-sm"
          >
            Hủy
          </Button>

          <Button
            type="button"
            onClick={handlePrimaryButtonClick}
            disabled={isSubmitting || quantity <= 0}
            className="rounded-xl px-4 py-2 text-xs sm:text-sm font-bold shadow-md shadow-primary/25"
          >
            {isSubmitting ? (
              'Đang lưu…'
            ) : existingLog ? (
              <>
                <Check size={16} />
                <span>Lưu sửa đổi ({quantity} chiếc)</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>Lưu công ({quantity} chiếc)</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Confirmation Modal for Edit */}
      <QuickWorkConfirmModal
        open={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleExecuteSave}
        date={date}
        oldQuantity={existingLog?.quantity ?? 0}
        newQuantity={quantity}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

function defaultWorkQuantity(stages: Stage[], stageId: string): number {
  const stage = stages.find((s) => s.id === stageId);
  if (!stage) return 10;
  const code = stage.code.toUpperCase();
  if (code.includes('WEAVING')) return 10;
  if (code.includes('CUTTING')) return 50;
  if (code.includes('SEWING')) return 50;
  if (code.includes('TYING')) return 100;
  return 10;
}
