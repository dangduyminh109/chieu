export type Role = 'ADMIN' | 'OWNER' | 'WORKER';
export type WorkStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'LOCKED';
export interface Profile {
  avatar_path?: string | null;
  username: string | null;
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  active: boolean;
  zero_wage: boolean;
  created_at: string;
}
export interface MatType {
  image_path?: string | null;
  id: string;
  code: string;
  name: string;
  dimensions: string | null;
  description: string | null;
  active: boolean;
}
export interface Stage {
  id: string;
  code: string;
  name: string;
  active: boolean;
}
export interface LaborRate {
  id: string;
  mat_type_id: string | null;
  stage_id: string;
  worker_id: string | null;
  effective_from: string;
  created_at?: string;
  unit_rate: number;
}
export interface WorkLog {
  stock_mat_type_id?: string | null;
  version: number;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_reason: string | null;
  id: string;
  worker_id: string;
  work_date: string;
  stage_id: string;
  mat_type_id: string | null;
  quantity: number;
  unit_rate: number;
  total_amount: number;
  status: WorkStatus;
  zero_wage_applied: boolean;
  notes?: string | null;
  created_at: string;
}
export interface AuditEvent {
  id: string;
  actor_id: string | null;
  action: string;
  entity_name: string;
  entity_id: string | null;
  previous_values: unknown;
  new_values: unknown;
  reason: string | null;
  created_at: string;
}
export type ActionResult = { success: boolean; message: string; id?: string };
