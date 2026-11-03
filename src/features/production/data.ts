import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { businessDate } from '@/lib/utils';
import type { WorkLog, Stage } from '@/types/domain';

export interface DaySchedule {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  dayOfWeek: number; // 0 = Mon, 6 = Sun
  dayLabel: string; // 'T2', 'T3', ...
  quantity: number;
  totalAmount: number;
  logs: WorkLog[];
  status: 'APPROVED' | 'SUBMITTED' | 'REJECTED' | 'NONE';
  isToday: boolean;
  isPastOrToday: boolean;
}

export interface WorkerMonthlySummary {
  month: string; // YYYY-MM
  year: number;
  monthNumber: number;
  stageName: string;
  stageId?: string;
  days: DaySchedule[];
  paddingDaysStart: number; // Empty slots before the 1st
  totalQuantity: number;
  totalAmount: number;
  workedDaysCount: number;
  avgQuantityPerDay: number;
  weeklyChart: { name: string; quantity: number; amount: number; fullDate?: string }[];
  monthlyChart: { name: string; quantity: number; amount: number; fullDate?: string }[];
  yearlyChart: { name: string; quantity: number; amount: number; fullDate?: string }[];
  recentMatId?: string | null;
}

const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export async function getWorkerMonthlyDashboard(
  workerId: string,
  targetMonth?: string,
  targetStageId?: string,
): Promise<WorkerMonthlySummary> {
  const db = await createClient();
  const today = businessDate();
  const month = targetMonth && /^\d{4}-\d{2}$/.test(targetMonth) ? targetMonth : today.slice(0, 7);
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const monthNumber = Number(monthStr);

  // 1. Fetch worker skills & stage name
  const [stagesRes, skillsRes] = await Promise.all([
    db.from('production_stages').select('*').order('sort_order'),
    db.from('worker_skills').select('stage_id').eq('user_id', workerId),
  ]);

  const allStages = (stagesRes.data || []) as Stage[];
  const workerStageIds = (skillsRes.data || []).map((s) => s.stage_id);
  const activeWorkerStages = allStages.filter((s) => s.active && workerStageIds.includes(s.id));

  const currentStage =
    activeWorkerStages.find((s) => s.id === targetStageId) || activeWorkerStages[0] || allStages[0];

  const stageId = currentStage?.id;
  const stageName = currentStage?.name || 'Sản xuất';

  // 2. Fetch full year's work logs for this worker to power schedule + charts
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  let query = db
    .from('work_logs')
    .select('*')
    .eq('worker_id', workerId)
    .gte('work_date', yearStart)
    .lte('work_date', yearEnd)
    .order('work_date', { ascending: true });

  if (targetStageId) {
    query = query.eq('stage_id', targetStageId);
  }

  const { data: logsData } = await query;
  const allYearLogs = (logsData || []) as WorkLog[];

  // Also fetch most recent mat type used by worker
  const { data: recentLog } = await db
    .from('work_logs')
    .select('mat_type_id,stock_mat_type_id')
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const recentMatId = recentLog?.stock_mat_type_id ?? recentLog?.mat_type_id;

  // 3. Build days of the target month
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const firstDayOfWeek = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7; // 0=Mon, 6=Sun

  const monthLogs = allYearLogs.filter((l) => l.work_date.startsWith(month));

  const days: DaySchedule[] = [];
  let totalQuantity = 0;
  let totalAmount = 0;
  let workedDaysCount = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = String(d).padStart(2, '0');
    const dateStr = `${month}-${dStr}`;
    const dayOfWeek = (firstDayOfWeek + d - 1) % 7;

    const dayLogs = monthLogs.filter((l) => l.work_date === dateStr);
    const dayQty = dayLogs.reduce((sum, l) => sum + l.quantity, 0);
    const dayAmt = dayLogs.reduce((sum, l) => sum + Number(l.total_amount), 0);

    let status: DaySchedule['status'] = 'NONE';
    if (dayLogs.length > 0) {
      if (dayLogs.some((l) => l.status === 'APPROVED' || l.status === 'LOCKED')) {
        status = 'APPROVED';
      } else if (dayLogs.some((l) => l.status === 'SUBMITTED')) {
        status = 'SUBMITTED';
      } else {
        status = 'REJECTED';
      }
      totalQuantity += dayQty;
      totalAmount += dayAmt;
      workedDaysCount += 1;
    }

    days.push({
      date: dateStr,
      dayNumber: d,
      dayOfWeek,
      dayLabel: DAY_LABELS[dayOfWeek],
      quantity: dayQty,
      totalAmount: dayAmt,
      logs: dayLogs,
      status,
      isToday: dateStr === today,
      isPastOrToday: dateStr <= today,
    });
  }

  const avgQuantityPerDay =
    workedDaysCount > 0 ? Math.round((totalQuantity / workedDaysCount) * 10) / 10 : 0;

  // 4. Build Weekly chart: 7 ngày trong tuần (T2 -> CN)
  const refDateStr = month === today.slice(0, 7) ? today : `${month}-01`;
  const [refY, refM, refD] = refDateStr.split('-').map(Number);
  const refDate = new Date(refY, refM - 1, refD);

  const dayOfWeekIndex = (refDate.getDay() + 6) % 7; // 0 = Mon, ..., 6 = Sun
  const mondayDate = new Date(refDate);
  mondayDate.setDate(refDate.getDate() - dayOfWeekIndex);

  const DAY_LABELS_FULL = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
  const DAY_LABELS_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  const weeklyChart: { name: string; quantity: number; amount: number; fullDate?: string }[] = [];

  for (let i = 0; i < 7; i++) {
    const cur = new Date(mondayDate);
    cur.setDate(mondayDate.getDate() + i);
    const yStr = cur.getFullYear();
    const mStr = String(cur.getMonth() + 1).padStart(2, '0');
    const dStr = String(cur.getDate()).padStart(2, '0');
    const curDateStr = `${yStr}-${mStr}-${dStr}`;

    const dayLogs = allYearLogs.filter((l) => l.work_date === curDateStr);
    const dayQty = dayLogs.reduce((sum, l) => sum + l.quantity, 0);
    const dayAmt = dayLogs.reduce((sum, l) => sum + Number(l.total_amount), 0);

    weeklyChart.push({
      name: DAY_LABELS_SHORT[i],
      quantity: dayQty,
      amount: dayAmt,
      fullDate: `${DAY_LABELS_FULL[i]}, ${dStr}/${mStr}/${yStr}`,
    });
  }

  // One point for every calendar day, including days without recorded work.
  const monthlyChart = days.map((day) => ({
    name: String(day.dayNumber),
    quantity: day.quantity,
    amount: day.totalAmount,
    fullDate: `Ngày ${day.dayNumber}/${monthNumber}/${year}`,
  }));

  // 6. Build Yearly chart: 12 tháng trong năm (T1 -> T12)
  const yearlyChart: { name: string; quantity: number; amount: number; fullDate?: string }[] = [];
  for (let m = 1; m <= 12; m++) {
    const mStr = String(m).padStart(2, '0');
    const prefix = `${year}-${mStr}`;
    const mLogs = allYearLogs.filter((l) => l.work_date.startsWith(prefix));
    const mQty = mLogs.reduce((sum, l) => sum + l.quantity, 0);
    const mAmt = mLogs.reduce((sum, l) => sum + Number(l.total_amount), 0);
    yearlyChart.push({
      name: `T${m}`,
      quantity: mQty,
      amount: mAmt,
      fullDate: `Tháng ${m}/${year}`,
    });
  }

  return {
    month,
    year,
    monthNumber,
    stageName,
    stageId,
    days,
    paddingDaysStart: firstDayOfWeek,
    totalQuantity,
    totalAmount,
    workedDaysCount,
    avgQuantityPerDay,
    weeklyChart,
    monthlyChart,
    yearlyChart,
    recentMatId,
  };
}
