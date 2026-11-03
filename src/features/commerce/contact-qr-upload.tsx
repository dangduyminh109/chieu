'use client';
import { useRef, useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/browser';

export function ContactQrUpload({ id, initialPath }: { id: string; initialPath?: string | null }) {
  const [path, setPath] = useState(initialPath ?? '');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function upload(file?: File) {
    if (!file || busy) return;
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    if (!extensions[file.type] || file.size > 5 * 1024 * 1024) {
      toast.error('Chọn ảnh QR JPG, PNG hoặc WebP, tối đa 5 MB.');
      if (input.current) input.current.value = '';
      return;
    }
    setBusy(true);
    input.current?.setCustomValidity('Ảnh QR đang tải. Vui lòng chờ trước khi lưu.');
    try {
      const db = createClient();
      const { data, error } = await db.auth.getUser();
      if (error || !data.user) throw new Error('AUTH');
      const imagePath = `${data.user.id}/${crypto.randomUUID()}.${extensions[file.type]}`;
      const result = await db.storage
        .from('contact-payment-qr')
        .upload(imagePath, file, { upsert: false, contentType: file.type, cacheControl: '0' });
      if (result.error) throw result.error;
      setPath(imagePath);
      toast.success('Đã tải QR. Bấm Lưu để cập nhật thông tin.');
    } catch {
      toast.error('Không tải được ảnh QR. Vui lòng chọn lại.');
    } finally {
      setBusy(false);
      input.current?.setCustomValidity('');
      if (input.current) input.current.value = '';
    }
  }
  return (
    <div className="space-y-2">
      <label htmlFor={id}>Ảnh mã QR chuyển khoản</label>
      {path && (
        <Image
          src={`/api/contact-qr?path=${encodeURIComponent(path)}`}
          alt="Mã QR chuyển khoản"
          width={240}
          height={240}
          unoptimized
          className="mx-auto max-h-60 w-full max-w-60 rounded-xl border border-border bg-white p-2 object-contain"
        />
      )}
      <input
        ref={input}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-disabled={busy}
        onChange={(event) => void upload(event.target.files?.[0])}
        className="block w-full min-w-0 text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-primary"
      />
      <input type="hidden" name="qr_path" value={path} />
      <p role="status" className="text-xs text-muted-foreground">
        {busy ? 'Đang tải QR…' : 'JPG, PNG, WebP · Tối đa 5 MB'}
      </p>
    </div>
  );
}
