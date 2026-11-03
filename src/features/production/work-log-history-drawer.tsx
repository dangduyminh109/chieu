'use client';

import { useState } from 'react';
import { History, Clock, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { getWorkLogHistory, type WorkLogHistoryItem } from './actions';

export function WorkLogHistoryDrawer({
  logId,
  date,
  currentQuantity,
}: {
  logId: string;
  date: string;
  currentQuantity: number;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<WorkLogHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  async function handleToggleHistory() {
    const next = !showHistory;
    setShowHistory(next);
    if (next && logId && historyList.length === 0) {
      setIsLoadingHistory(true);
      try {
        const res = await getWorkLogHistory(logId);
        if (res.success) {
          setHistoryList(res.history);
        } else {
          toast.error(res.message || 'Không thể tải lịch sử sửa đổi.');
        }
      } catch {
        toast.error('Có lỗi xảy ra khi tải lịch sử sửa đổi.');
      } finally {
        setIsLoadingHistory(false);
      }
    }
  }

  const formattedDate = date ? date.split('-').reverse().join('/') : '';

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 overflow-hidden transition-all shadow-2xs">
      {/* Clickable Header Banner */}
      <button
        type="button"
        onClick={handleToggleHistory}
        className="w-full p-2.5 text-left flex items-center justify-between gap-2 hover:bg-primary/10 transition-colors cursor-pointer"
        title="Bấm để xem lịch sử sửa đổi"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <History className="size-4 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-foreground text-xs whitespace-nowrap">
              Đang sửa ngày <span className="text-primary font-bold">{formattedDate}</span>
            </p>
            <p className="text-[11px] text-muted-foreground whitespace-nowrap mt-0.5">
              Số lượng hiện tại: <strong className="font-bold text-foreground">{currentQuantity} chiếc</strong>
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary shrink-0 bg-primary/15 hover:bg-primary/25 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap">
          <span>Lịch sử</span>
          <ChevronDown
            className={`size-3 transition-transform duration-200 ${showHistory ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {/* Collapsible History Drawer */}
      {showHistory && (
        <div className="border-t border-primary/20 bg-card p-3 space-y-2 text-xs animate-in fade-in-50 duration-150">
          <div className="flex items-center justify-between pb-1 border-b border-border/40">
            <span className="font-bold text-foreground flex items-center gap-1.5 text-[11px]">
              <Clock className="size-3.5 text-primary" />
              Lịch sử các lần chỉnh sửa
            </span>
            {isLoadingHistory && (
              <span className="text-[10px] text-muted-foreground animate-pulse">
                Đang tải...
              </span>
            )}
          </div>

          {isLoadingHistory ? (
            <div className="py-3 text-center text-xs text-muted-foreground">
              Đang lấy lịch sử chỉnh sửa...
            </div>
          ) : historyList.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              Chưa ghi nhận lần chỉnh sửa nào trước đây.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {historyList.map((h, i) => (
                <div
                  key={h.id || i}
                  className="flex items-start gap-2 p-2 rounded-lg bg-muted/40 border border-border/50 text-xs"
                >
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary mt-0.5 text-[10px] font-bold">
                    {h.action === 'INSERT' ? '★' : `#${h.version || historyList.length - i}`}
                  </div>
                  <div className="min-w-0 flex-1 leading-tight space-y-0.5">
                    <div className="flex items-center justify-between gap-1 text-[11px]">
                      <span className="font-bold text-foreground">
                        {h.action === 'INSERT' ? 'Khởi tạo ban đầu' : 'Chỉnh sửa'}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(h.createdAt).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Quantity change */}
                    <div className="text-[11px] text-foreground flex items-center gap-1">
                      <span className="text-muted-foreground">Số lượng:</span>
                      {h.oldQuantity !== undefined && h.oldQuantity !== h.newQuantity ? (
                        <span className="flex items-center gap-1">
                          <span className="line-through text-muted-foreground">
                            {h.oldQuantity}
                          </span>
                          <span>➔</span>
                          <strong className="font-bold text-primary">
                            {h.newQuantity} chiếc
                          </strong>
                        </span>
                      ) : (
                        <strong className="font-bold text-foreground">
                          {h.newQuantity} chiếc
                        </strong>
                      )}
                    </div>

                    {/* Stage & Mat change if any */}
                    {(h.newStageName || h.newMatName) && (
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <span>Thay đổi:</span>
                        <span className="font-medium text-foreground">
                          {[h.newStageName, h.newMatName].filter(Boolean).join(' • ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
