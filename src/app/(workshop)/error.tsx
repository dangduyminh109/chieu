'use client';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-border bg-white p-8">
      <h1 className="text-2xl font-semibold">Chưa thể tải dữ liệu</h1>
      <p className="my-4 text-muted-foreground">
        Kiểm tra kết nối mạng rồi thử lại. Nếu vừa gửi công, hãy xem lịch sử trước khi nhập lại.
      </p>
      <Button onClick={reset}>Thử lại</Button>
    </div>
  );
}
