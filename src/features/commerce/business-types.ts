export type Contact = {
  bank_name?: string | null;
  bank_account?: string | null;
  account_holder?: string | null;
  qr_path?: string | null;
  id: string;
  name: string;
  phone?: string | null;
  notes?: string | null;
  active: boolean;
};
export type Material = {
  id: string;
  name: string;
  code: string;
  unit: 'BUNDLE' | 'KG' | 'METER' | 'PIECE' | 'LITER';
  is_sedge: boolean;
  active: boolean;
};
export const unitLabels = { BUNDLE: 'bó', KG: 'kg', METER: 'mét', PIECE: 'cái', LITER: 'lít' };
export const documentLabels: Record<string, string> = {
  SALE: 'Bán chiếu',
  FINISHED_PURCHASE: 'Mua chiếu',
  MATERIAL_PURCHASE: 'Mua nguyên liệu',
  MATERIAL_ISSUE: 'Xuất nguyên liệu',
  FINISHED_RECEIPT: 'Nhập chiếu',
  EXPENSE: 'Chi phí',
};
export const exactMoney = (n: string | number | bigint) => `${BigInt(n).toLocaleString('vi-VN')} đ`;
