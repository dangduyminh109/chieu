export type StatisticsPoint = {
  bucket: string;
  quantity: string;
  earned: string;
  paid: string;
  remaining: string;
  income: string;
  expense: string;
};
export type ManagerStatistics = {
  points: StatisticsPoint[];
  workers: { id: string; name: string; avatar_path?: string | null }[];
  stages: { id: string; name: string; code: string }[];
  comparison: { id: string; name: string; quantity: string; earned: string }[];
  records: number;
  work_days: number;
};
export type StatisticsTab = 'productivity' | 'cashflow' | 'payroll';
