'use client';

import { useRef, useState, type DragEvent } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/browser';
import { matImageUrl } from './image-url';
import { ImagePlus, Pencil, Trash2, Loader2, Sparkles } from 'lucide-react';

export function MatImageUpload({ id, initialPath }: { id: string; initialPath?: string | null }) {
  const [path, setPath] = useState(initialPath ?? '');
  const [busy, setBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const url = matImageUrl(path);

  async function upload(file?: File) {
    if (busy || !file) return;

    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };

    if (!extensions[file.type] || file.size > 5 * 1024 * 1024) {
      toast.error('Vui lòng chọn ảnh JPG, PNG hoặc WebP dung lượng dưới 5 MB.');
      if (input.current) input.current.value = '';
      return;
    }

    setBusy(true);
    input.current?.setCustomValidity('Ảnh đang tải lên. Vui lòng chờ trước khi lưu.');

    try {
      const db = createClient();
      const { data, error } = await db.auth.getUser();
      if (error || !data.user) throw new Error('AUTH');

      const imagePath = `${data.user.id}/${crypto.randomUUID()}.${extensions[file.type]}`;
      const result = await db.storage
        .from('mat-images')
        .upload(imagePath, file, {
          contentType: file.type,
          upsert: false,
          cacheControl: '31536000',
        });

      if (result.error) throw result.error;

      setPath(imagePath);
      toast.success('Đã tải ảnh lên thành công. Bấm lưu để hoàn tất.');
    } catch {
      toast.error('Không thể tải ảnh. Vui lòng kiểm tra lại kết nối và thử lại.');
    } finally {
      setBusy(false);
      input.current?.setCustomValidity('');
      if (input.current) input.current.value = '';
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      void upload(file);
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Ảnh mẫu loại chiếu
        </label>
        {url && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
            <Sparkles size={12} />
            Đã có ảnh mẫu
          </span>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={input}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-disabled={busy}
        onChange={(event) => void upload(event.target.files?.[0])}
        className="sr-only"
      />
      <input name="image_path" type="hidden" value={path} />

      {url ? (
        /* Preview State */
        <div className="relative group overflow-hidden rounded-2xl border border-border/80 bg-muted/20 shadow-2xs aspect-[16/9] w-full">
          <Image
            src={url}
            alt="Ảnh loại chiếu"
            fill
            unoptimized
            className="object-cover transition-transform duration-300 group-hover:scale-102"
          />

          {/* Action buttons overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col justify-between p-3 transition-opacity">
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => input.current?.click()}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card/90 hover:bg-card text-foreground font-semibold text-xs shadow-md backdrop-blur-md transition-all active:scale-95 cursor-pointer"
              >
                <Pencil size={13} />
                <span>Đổi ảnh</span>
              </button>
              <button
                type="button"
                onClick={() => setPath('')}
                disabled={busy}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-red-500/80 hover:bg-red-600 text-white font-semibold text-xs shadow-md backdrop-blur-md transition-all active:scale-95 cursor-pointer"
                title="Xóa ảnh"
              >
                <Trash2 size={13} />
              </button>
            </div>

            <div className="text-white text-xs font-medium drop-shadow-sm flex items-center justify-between">
              <span>Ảnh mẫu hiển thị thực tế</span>
              <span className="text-[10px] text-white/80 font-mono">Bấm &ldquo;Đổi ảnh&rdquo; để thay thế</span>
            </div>
          </div>

          {busy && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white">
              <Loader2 size={24} className="animate-spin text-primary" />
              <span className="text-xs font-semibold">Đang tải ảnh lên…</span>
            </div>
          )}
        </div>
      ) : (
        /* Empty Upload Dropzone State */
        <div
          onClick={() => !busy && input.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`flex flex-col items-center justify-center gap-2.5 p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer select-none ${
            isDragging
              ? 'border-primary bg-primary/10 scale-[1.01]'
              : 'border-border/80 bg-card hover:border-primary/50 hover:bg-muted/30 active:scale-[0.99]'
          }`}
        >
          {busy ? (
            <div className="flex flex-col items-center gap-2 py-3 text-muted-foreground">
              <Loader2 size={26} className="animate-spin text-primary" />
              <span className="text-xs font-medium">Đang tải ảnh lên…</span>
            </div>
          ) : (
            <>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-2xs">
                <ImagePlus size={24} />
              </div>
              <div className="text-center space-y-0.5">
                <p className="text-sm font-semibold text-foreground">
                  Tải ảnh mẫu loại chiếu lên
                </p>
                <p className="text-xs text-muted-foreground">
                  Bấm để chọn file hoặc kéo thả ảnh vào đây
                </p>
              </div>
              <div className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground font-mono">
                JPG, PNG, WebP · Tối đa 5 MB
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
