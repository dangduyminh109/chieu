'use client';
import { useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/browser';
import { updateAvatar } from './avatar-actions';

export function AvatarUpload({ name, initialPath }: { name: string; initialPath?: string | null }) {
  const [path, setPath] = useState(initialPath ?? null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const id = useId();
  async function upload(file?: File) {
    if (!file || busy) return;
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    if (!extensions[file.type] || file.size > 5 * 1024 * 1024) {
      toast.error('Chọn ảnh JPG, PNG hoặc WebP, tối đa 5 MB.');
      if (input.current) input.current.value = '';
      return;
    }
    setBusy(true);
    try {
      const db = createClient();
      const { data, error } = await db.auth.getUser();
      if (error || !data.user) throw new Error('AUTH');
      const imagePath = `${data.user.id}/${crypto.randomUUID()}.${extensions[file.type]}`;
      const uploaded = await db.storage
        .from('avatars')
        .upload(imagePath, file, {
          contentType: file.type,
          upsert: false,
          cacheControl: '31536000',
        });
      if (uploaded.error) throw uploaded.error;
      const saved = await updateAvatar(imagePath);
      if (!saved.success) {
        toast.error(saved.message);
        return;
      }
      setPath(imagePath);
      toast.success(saved.message);
      router.refresh();
    } catch {
      toast.error('Không tải được ảnh đại diện. Vui lòng thử lại.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
  return (
    <div className="mb-6 flex items-center gap-4">
      <Avatar path={path} name={name} className="size-16 sm:size-20 shrink-0 text-xl sm:text-2xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <input
          ref={input}
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          aria-label="Chọn ảnh đại diện"
          disabled={busy}
          onChange={(event) => void upload(event.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <Camera size={16} />
          {busy ? 'Đang cập nhật…' : path ? 'Đổi ảnh đại diện' : 'Thêm ảnh đại diện'}
        </Button>
        <p role="status" className="text-xs text-muted-foreground break-words leading-relaxed">
          JPG, PNG, WebP · Tối đa 5 MB · Tự lưu khi chọn
        </p>
      </div>
    </div>
  );
}
