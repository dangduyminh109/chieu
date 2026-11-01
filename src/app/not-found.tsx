import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-3xl font-bold">Không tìm thấy trang</h1>
      <p className="my-4">Đường dẫn này không còn tồn tại.</p>
      <Link className="text-primary underline" href="/">
        Về trang chủ
      </Link>
    </main>
  );
}
