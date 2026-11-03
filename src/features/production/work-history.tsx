import { Dialog } from '@/components/ui/dialog';
import { ActionForm } from '@/components/ui/action-form';
import { overrideWorkRate } from '@/features/pricing/quote-actions';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TextWithBadge } from '@/components/ui/text-with-badge';
import { DataTable, type TableColumn } from '@/components/ui/data-table';
import { displayDate, money, number, statusLabel } from '@/lib/utils';
import type { MatType, Stage, WorkLog } from '@/types/domain';

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
  const columns: TableColumn<WorkLog>[] = [
    { key: 'date', header: 'Ngày làm', cell: (r) => displayDate(r.work_date) },
    ...(names
      ? [
          {
            key: 'worker',
            header: 'Thành viên',
            cell: (r: WorkLog) => names[r.worker_id] ?? 'Thành viên',
          },
        ]
      : []),
    {
      key: 'mat',
      header: 'Loại chiếu',
      cell: (r) =>
        mats.find((m) => m.id === (r.stock_mat_type_id ?? r.mat_type_id))?.name ?? 'Loại chiếu',
    },
    {
      key: 'stage',
      header: 'Công đoạn',
      cell: (r) => stages.find((s) => s.id === r.stage_id)?.name,
    },
    {
      key: 'quantity',
      header: 'Số chiếu',
      className: 'text-right',
      cell: (r) => number(r.quantity),
    },
    { key: 'rate', header: 'Đơn giá', className: 'text-right', cell: (r) => money(r.unit_rate) },
    {
      key: 'amount',
      header: 'Tiền công',
      className: 'text-right',
      cell: (r) => <strong>{money(r.total_amount)}</strong>,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      cell: (r) => (
        <Badge
          variant={
            r.status === 'SUBMITTED'
              ? 'warning'
              : r.status === 'REJECTED'
                ? 'destructive'
                : r.status === 'APPROVED' || r.status === 'LOCKED'
                  ? 'success'
                  : 'secondary'
          }
        >
          {statusLabel[r.status]}
        </Badge>
      ),
    },
  ];
  if (names)
    columns.push({
      key: 'rate-edit',
      header: 'Điều chỉnh',
      cell: (r) => (
        <Dialog title="Điều chỉnh tiền công" trigger="Sửa đơn giá" variant="outline">
          <ActionForm action={overrideWorkRate}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="version" value={r.version} />
            <div>
              <label htmlFor={`rate-${r.id}`}>Đơn giá công (đ/chiếc)</label>
              <input
                id={`rate-${r.id}`}
                name="rate"
                type="number"
                inputMode="numeric"
                min={0}
                max={1000000000}
                defaultValue={r.unit_rate}
                required
              />
            </div>
            <div>
              <label htmlFor={`reason-${r.id}`}>Lý do</label>
              <input id={`reason-${r.id}`} name="reason" minLength={5} maxLength={1000} required />
            </div>
          </ActionForm>
        </Dialog>
      ),
    });
  return (
    <Card className="min-w-0">
      <h2 className="text-xl font-semibold">
        <TextWithBadge
          text={names ? 'Nhật ký chung' : 'Lịch sử sản lượng của bạn'}
          badge={`${logs.length} bản ghi`}
        />
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">Tiền công được giữ theo đơn giá lúc gửi.</p>
      <DataTable
        caption={names ? 'Nhật ký chung' : 'Lịch sử sản lượng của bạn'}
        rows={logs}
        columns={columns}
        rowKey={(r) => r.id}
        emptyMessage="Chưa có bản ghi trong khoảng này. Nhập số lượng hoặc chọn khoảng ngày khác."
      />
    </Card>
  );
}
