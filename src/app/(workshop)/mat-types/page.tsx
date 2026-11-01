import { requireSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { getCatalog } from '@/features/shared/data';
import { saveMat, deleteMat } from '@/features/mat-types/actions';
import { ActionForm } from '@/components/ui/action-form';
import { Card } from '@/components/ui/card';
import { Denied, EmptyState } from '@/components/ui/states';
import type { MatType } from '@/types/domain';
export const metadata = { title: 'Loại chiếu' };
function Fields({ mat }: { mat?: MatType }) {
  return (
    <>
      <input type="hidden" name="id" value={mat?.id ?? ''} />
      <div>
        <label htmlFor={`code-${mat?.id ?? 'new'}`}>Mã loại chiếu</label>
        <input
          id={`code-${mat?.id ?? 'new'}`}
          name="code"
          defaultValue={mat?.code}
          required
          pattern="[A-Za-z0-9_-]{1,32}"
          maxLength={32}
          placeholder="VD: CHIEU_16"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Chữ không dấu, số, dấu gạch dưới hoặc gạch nối.
        </p>
      </div>
      <div>
        <label htmlFor={`name-${mat?.id ?? 'new'}`}>Tên loại chiếu</label>
        <input
          id={`name-${mat?.id ?? 'new'}`}
          name="name"
          defaultValue={mat?.name}
          required
          maxLength={120}
        />
      </div>
      <div>
        <label htmlFor={`dim-${mat?.id ?? 'new'}`}>
          Kích thước <span className="font-normal">(không bắt buộc)</span>
        </label>
        <input
          id={`dim-${mat?.id ?? 'new'}`}
          name="dimensions"
          defaultValue={mat?.dimensions ?? ''}
          maxLength={120}
        />
      </div>
      <div>
        <label htmlFor={`desc-${mat?.id ?? 'new'}`}>Ghi chú</label>
        <textarea
          id={`desc-${mat?.id ?? 'new'}`}
          name="description"
          defaultValue={mat?.description ?? ''}
          maxLength={1000}
        />
      </div>
      <label>
        <input name="active" type="checkbox" defaultChecked={mat?.active ?? true} />
        Đang sử dụng
      </label>
    </>
  );
}
export default async function MatTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  if (!can(session.roles, 'manage_catalog')) return <Denied />;
  const { mats } = await getCatalog();
  const { q = '' } = await searchParams;
  const filtered = mats.filter((m) =>
    `${m.name} ${m.code}`.toLocaleLowerCase('vi').includes(q.toLocaleLowerCase('vi')),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Loại chiếu</h1>
          <p>Danh mục dùng chung cho ghi công và thiết lập đơn giá.</p>
        </div>
        <span className="rounded-full bg-muted px-4 py-2 text-sm text-primary">
          {mats.filter((m) => m.active).length} loại đang dùng
        </span>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <h2 className="mb-6 text-xl font-semibold">Thêm loại chiếu</h2>
          <ActionForm action={saveMat} submitLabel="Thêm loại chiếu">
            <Fields />
          </ActionForm>
        </Card>
        <Card>
          <h2 className="text-xl font-semibold">Danh mục của xưởng</h2>
          <form className="mt-4 flex gap-2">
            <label htmlFor="q" className="sr-only">
              Tìm loại chiếu
            </label>
            <input id="q" name="q" defaultValue={q} placeholder="Tìm theo tên hoặc mã…" />
            <button className="min-h-12 rounded-xl bg-muted px-3 font-semibold">Tìm</button>
          </form>
          {filtered.length === 0 ? (
            <EmptyState
              title="Chưa tìm thấy loại chiếu"
              description="Thêm loại chiếu đầu tiên hoặc thử từ khóa khác."
            />
          ) : (
            <div className="mt-6 divide-y divide-border">
              {filtered.map((mat) => (
                <details key={mat.id} className="py-4">
                  <summary className="flex min-h-12 items-center justify-between gap-4">
                    <span>
                      <strong>{mat.name}</strong>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {mat.code}
                        {mat.dimensions ? ` · ${mat.dimensions}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs">
                      {mat.active ? 'Đang dùng' : 'Ngừng dùng'}
                    </span>
                  </summary>
                  <div className="mt-6 space-y-6">
                    <ActionForm action={saveMat}>
                      <Fields mat={mat} />
                    </ActionForm>
                    <details className="rounded-xl border border-border p-4">
                      <summary className="min-h-12 text-sm text-destructive">
                        Xóa loại chiếu chưa sử dụng
                      </summary>
                      <p className="my-4 text-sm">
                        Chỉ xóa được loại chiếu chưa có đơn giá hoặc nhật ký. Thao tác này không thể
                        hoàn tác.
                      </p>
                      <ActionForm
                        action={deleteMat}
                        submitLabel="Xác nhận xóa"
                        variant="destructive"
                      >
                        <input type="hidden" name="id" value={mat.id} />
                      </ActionForm>
                    </details>
                  </div>
                </details>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
