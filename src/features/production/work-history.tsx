import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { displayDate, money, number, statusLabel } from '@/lib/utils';
import type { MatType, Stage, WorkLog } from '@/types/domain';
import { Badge } from '@/components/ui/badge';
import { TextWithBadge } from '@/components/ui/text-with-badge';
export function WorkHistory({
  logs,
  mats,
  stages,
  names,
}: {
  logs: WorkLog[];
  mats: MatType[];
  stages: Stage[];
  names?: Record<string, string>;
}) {
  return (
    <Card className="min-w-0">
      <h2 className="text-xl font-semibold">
        <TextWithBadge
          text={names ? 'Nhật ký của xưởng' : 'Lịch sử công của bạn'}
          badge={`${logs.length} bản ghi`}
        />
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">Tiền công được giữ theo đơn giá lúc gửi.</p>
      {logs.length === 0 ? (
        <EmptyState
          title="Chưa có công trong khoảng này"
          description="Công đã gửi sẽ xuất hiện ở đây. Bạn có thể chọn khoảng ngày khác để xem lại."
        />
      ) : (
        <div className="mt-6 divide-y divide-border">
          {logs.map((log) => (
            <article key={log.id} className="flex flex-wrap justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="font-semibold">
                  {mats.find((m) => m.id === log.mat_type_id)?.name ?? 'Loại chiếu'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {stages.find((s) => s.id === log.stage_id)?.name} · {displayDate(log.work_date)}
                </p>
                {names && <p className="mt-1 text-sm">{names[log.worker_id] ?? 'Thành viên'}</p>}
                <p className="mt-2 text-sm">
                  {number(log.quantity)} chiếu × {money(log.unit_rate)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold">{money(log.total_amount)}</p>
                <Badge
                  className="mt-2"
                  variant={
                    log.status === 'SUBMITTED'
                      ? 'warning'
                      : log.status === 'REJECTED'
                        ? 'destructive'
                        : log.status === 'APPROVED' || log.status === 'LOCKED'
                          ? 'success'
                          : 'secondary'
                  }
                >
                  {statusLabel[log.status]}
                </Badge>
              </div>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}
