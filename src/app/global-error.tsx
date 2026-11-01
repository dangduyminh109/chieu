'use client';
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="vi">
      <body>
        <main style={{ padding: 32, fontFamily: 'sans-serif' }}>
          <h1>Chưa thể mở ứng dụng</h1>
          <p>Kiểm tra kết nối rồi thử lại. Nếu vẫn gặp lỗi, liên hệ người quản lý xưởng.</p>
          <button onClick={reset}>Thử lại</button>
        </main>
      </body>
    </html>
  );
}
