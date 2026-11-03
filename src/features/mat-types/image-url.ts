export function matImageUrl(path?: string | null): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/mat-images/${path.split('/').map(encodeURIComponent).join('/')}`;
}
