import Link from 'next/link';
import { requireSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { displayDate } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Denied, EmptyState } from '@/components/ui/states';
import type { AuditEvent } from '@/types/domain';
const entityLabels: Record<string, string> = {
  profiles: 'Hồ sơ',
  user_roles: 'Vai trò',
  worker_skills: 'Công đoạn được giao',
  mat_types: 'Loại chiếu',
  labor_rate_history: 'Đơn giá công',
  work_logs: 'Nhật ký sản xuất',
};
const actionLabels: Record<string, string> = {
  INSERT: 'Thêm mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
};
export const metadata = { title: 'Nhật ký hệ thống' };
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await requireSession();
  if (!can(session.roles, 'view_audit')) return <Denied />;
  const params = await searchParams;
  const page = Math.max(1, Math.min(10000, Math.trunc(Number(params.page) || 1)));
  const db = await createClient();
  const result = await db
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id')
    .range((page - 1) * 30, page * 30 - 1);
  if (result.error) throw new Error('AUDIT_QUERY_FAILED');
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Nhật ký hệ thống</h1>
          <p>Lịch sử thay đổi được ghi cùng giao dịch. Chỉ quản trị viên được xem.</p>
        </div>
      </div>
      <Card>
        {result.data.length === 0 ? (
          <EmptyState
            title="Chưa có sự kiện"
            description="Thay đổi danh mục, đơn giá và nhật ký sản xuất sẽ được ghi ở đây."
          />
        ) : (
          <div className="divide-y divide-border">
            {(result.data as AuditEvent[]).map((event) => (
              <details key={event.id} className="py-4">
                <summary className="min-h-12">
                  <strong className="text-sm">
                    {actionLabels[event.action] ?? 'Thay đổi'} ·{' '}
                    {entityLabels[event.entity_name] ?? 'Dữ liệu'}
                  </strong>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {displayDate(event.created_at)} ·{' '}
                    {new Date(event.created_at).toLocaleTimeString('vi-VN', {
                      timeZone: 'Asia/Ho_Chi_Minh',
                    })}
                  </span>
                </summary>
                <div className="mt-4 space-y-3 text-sm">
                  <p>
                    Người thực hiện:{' '}
                    <span className="break-all">{event.actor_id ?? 'Khởi tạo hệ thống'}</span>
                  </p>
                  {event.reason && <p>Lý do: {event.reason}</p>}
                  <p className="break-all text-xs text-muted-foreground">
                    Mã dữ liệu: {event.entity_id}
                  </p>
                  <h3 className="font-semibold">Trước thay đổi</h3>
                  <pre className="max-h-64 overflow-auto rounded-xl bg-muted p-4 text-xs">
                    {JSON.stringify(event.previous_values, null, 2) ?? 'Không có'}
                  </pre>
                  <h3 className="font-semibold">Sau thay đổi</h3>
                  <pre className="max-h-64 overflow-auto rounded-xl bg-muted p-4 text-xs">
                    {JSON.stringify(event.new_values, null, 2) ?? 'Không có'}
                  </pre>
                </div>
              </details>
            ))}
          </div>
        )}
        <div className="mt-6 flex items-center justify-between text-sm">
          <span>Trang {page}</span>
          <div className="flex gap-4">
            {page > 1 && (
              <Link className="p-3 underline" href={`/audit?page=${page - 1}`}>
                Trang trước
              </Link>
            )}
            {page * 30 < (result.count ?? 0) && (
              <Link className="p-3 underline" href={`/audit?page=${page + 1}`}>
                Trang sau
              </Link>
            )}
          </div>
        </div>
      </Card>
    </>
  );
}
