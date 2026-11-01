export default function Loading() {
  return (
    <div role="status" aria-label="Đang tải dữ liệu" className="animate-pulse space-y-6">
      <div className="h-10 w-48 rounded-xl bg-muted" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-2xl border border-border bg-white" />
        ))}
      </div>
      <div className="h-80 rounded-2xl border border-border bg-white" />
      <span className="sr-only">Đang tải dữ liệu…</span>
    </div>
  );
}
