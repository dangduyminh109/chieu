import { Sprout, ShieldX } from 'lucide-react';
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <div className="mb-4 rounded-2xl bg-muted p-4 text-primary">
        <Sprout aria-hidden="true" size={28} />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
export function Denied() {
  return (
    <div className="rounded-2xl border border-border bg-white p-8">
      <ShieldX aria-hidden className="mb-4 text-primary" />
      <h1 className="text-2xl font-semibold">Bạn chưa có quyền truy cập</h1>
      <p className="mt-2 text-muted-foreground">
        Liên hệ quản trị viên để kiểm tra quyền tài khoản.
      </p>
    </div>
  );
}
