'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { businessDate } from '@/lib/utils';
import { mutationMessage } from '@/features/shared/errors';
import { workSchema, workDateSchema, type WorkInput } from './schemas';
import type { ActionResult } from '@/types/domain';

export async function submitWork(input: WorkInput): Promise<ActionResult> {
  await requirePermission('submit_work');
  const v = workSchema.safeParse(input);
  if (!v.success || v.data.work_date > businessDate())
    return { success: false, message: 'Kiểm tra ngày làm việc và số lượng chiếu.' };
  const db = await createClient();
  const { data, error } = await db.rpc('submit_work_stock', {
    p_date: v.data.work_date,
    p_stage: v.data.stage_id,
    p_mat: v.data.mat_type_id,
    p_quantity: v.data.quantity,
    p_key: v.data.idempotency_key,
    p_expected_rate: v.data.expected_rate,
    p_notes: v.data.notes ? v.data.notes.trim() : null,
  });
  if (!error) {
    revalidatePath('/production');
    revalidatePath('/');
  }
  return {
    success: !error,
    message: error ? mutationMessage(error) : 'Đã ghi nhận công.',
    id: data ?? undefined,
  };
}

export async function updateWorkLog(input: {
  id: string;
  quantity: number;
  stage_id?: string;
  mat_type_id?: string | null;
  work_date?: string;
  version?: number;
  notes?: string | null;
}): Promise<ActionResult> {
  const session = await requirePermission('submit_work');
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > 1000000)
    return { success: false, message: 'Số lượng chiếu không hợp lệ.' };
  if (input.work_date && !workDateSchema.safeParse(input.work_date).success)
    return { success: false, message: 'Không thể ghi công cho ngày trong tương lai.' };
  const db = await createClient();
  const { data: log, error } = await db
    .from('work_logs')
    .select('worker_id,version,mat_type_id,stock_mat_type_id')
    .eq('id', input.id)
    .single();
  if (error || !log || log.worker_id !== session.userId)
    return { success: false, message: 'Không tìm thấy công của bạn.' };
  const originalMat = log.stock_mat_type_id ?? log.mat_type_id;
  if (input.mat_type_id && originalMat && input.mat_type_id !== originalMat)
    return {
      success: false,
      message: 'Chỉ sửa số lượng của bản ghi này. Ghi công mới nếu làm loại chiếu khác.',
    };
  const result = await db.rpc('edit_work_quantity', {
    p_id: input.id,
    p_version: input.version ?? log.version,
    p_quantity: input.quantity,
    p_stage: input.stage_id ?? null,
    p_mat: log.mat_type_id,
    p_date: input.work_date ?? null,
    p_notes: input.notes !== undefined ? (input.notes ? input.notes.trim() : null) : null,
  });
  if (!result.error) revalidatePath('/', 'layout');
  return {
    success: !result.error,
    message: result.error ? mutationMessage(result.error) : 'Đã cập nhật số lượng và tiền công.',
  };
}

export async function deleteWorkLog(id: string): Promise<ActionResult> {
  const session = await requirePermission('delete_records');
  const db = await createClient();
  const { data: log, error: fetchErr } = await db
    .from('work_logs')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !log) return { success: false, message: 'Không tìm thấy bản ghi.' };
  if (log.worker_id !== session.userId)
    return { success: false, message: 'Không có quyền thao tác.' };
  if (log.status === 'APPROVED' || log.status === 'LOCKED') {
    return { success: false, message: 'Công đã ghi nhận vào tiền lương, không thể xóa.' };
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();
  const { error } = await admin.from('work_logs').delete().eq('id', id);

  if (error) return { success: false, message: 'Không thể xóa: ' + error.message };

  revalidatePath('/production');
  revalidatePath('/');
  return { success: true, message: 'Đã xóa bản ghi công việc.' };
}

export interface WorkLogHistoryItem {
  id: string;
  action: string;
  createdAt: string;
  actorName: string;
  isSelf: boolean;
  oldQuantity?: number;
  newQuantity?: number;
  oldStageName?: string;
  newStageName?: string;
  oldMatName?: string | null;
  newMatName?: string | null;
  version?: number;
}

export async function getWorkLogHistory(logId: string): Promise<{
  success: boolean;
  message?: string;
  history: WorkLogHistoryItem[];
}> {
  const session = await requirePermission('submit_work');
  const db = await createClient();

  const { data: log, error: logErr } = await db
    .from('work_logs')
    .select(
      'id, worker_id, created_at, quantity, version, stage_id, mat_type_id, stock_mat_type_id',
    )
    .eq('id', logId)
    .single();

  if (logErr || !log) {
    return { success: false, message: 'Không tìm thấy bản ghi công việc.', history: [] };
  }

  if (
    log.worker_id !== session.userId &&
    !session.roles.includes('ADMIN') &&
    !session.roles.includes('OWNER')
  ) {
    return { success: false, message: 'Bạn không có quyền xem bản ghi này.', history: [] };
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();

  const [{ data: audits }, { data: stages }, { data: mats }, { data: profiles }] =
    await Promise.all([
      admin
        .from('audit_logs')
        .select('id, action, previous_values, new_values, reason, created_at, actor_id')
        .eq('entity_name', 'work_logs')
        .eq('entity_id', logId)
        .order('created_at', { ascending: false }),
      admin.from('production_stages').select('id, name'),
      admin.from('mat_types').select('id, name'),
      admin.from('profiles').select('id, full_name'),
    ]);

  const stageMap = new Map((stages ?? []).map((s) => [s.id, s.name]));
  const matMap = new Map((mats ?? []).map((m) => [m.id, m.name]));
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const history: WorkLogHistoryItem[] = (audits ?? []).map((a) => {
    const prev = (a.previous_values ?? {}) as Record<string, unknown>;
    const curr = (a.new_values ?? {}) as Record<string, unknown>;

    const oldQty = typeof prev.quantity === 'number' ? prev.quantity : undefined;
    const newQty = typeof curr.quantity === 'number' ? curr.quantity : undefined;

    const oldStageId = typeof prev.stage_id === 'string' ? prev.stage_id : undefined;
    const newStageId = typeof curr.stage_id === 'string' ? curr.stage_id : undefined;

    const oldMatId = typeof prev.mat_type_id === 'string' ? prev.mat_type_id : undefined;
    const newMatId = typeof curr.mat_type_id === 'string' ? curr.mat_type_id : undefined;

    const isSelf = a.actor_id === session.userId;
    const actorName = isSelf ? 'Bạn' : (profileMap.get(a.actor_id ?? '') ?? 'Người quản lý');

    return {
      id: a.id,
      action: a.action,
      createdAt: a.created_at,
      actorName,
      isSelf,
      oldQuantity: oldQty,
      newQuantity: newQty,
      oldStageName: oldStageId ? stageMap.get(oldStageId) : undefined,
      newStageName: newStageId ? stageMap.get(newStageId) : undefined,
      oldMatName: oldMatId ? matMap.get(oldMatId) : undefined,
      newMatName: newMatId ? matMap.get(newMatId) : undefined,
      version: typeof curr.version === 'number' ? curr.version : undefined,
    };
  });

  if (history.length === 0) {
    history.push({
      id: 'init-' + log.id,
      action: 'INSERT',
      createdAt: log.created_at,
      actorName: 'Bạn',
      isSelf: true,
      newQuantity: log.quantity,
      newStageName: stageMap.get(log.stage_id),
      newMatName:
        (log.stock_mat_type_id ?? log.mat_type_id)
          ? matMap.get((log.stock_mat_type_id ?? log.mat_type_id)!)
          : undefined,
      version: log.version ?? 1,
    });
  }

  return { success: true, history };
}
