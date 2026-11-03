export const expenseCategories = [
  { code: 'SEDGE', name: 'Mua lát', image: '/images/expenses/mua-lat.png' },
  { code: 'THREAD', name: 'Mua chỉ', image: '/images/expenses/mua-chi.png' },
  { code: 'FABRIC', name: 'Mua vải may chiếu', image: '/images/expenses/vai-may-chieu.png' },
  { code: 'DYE', name: 'Mua màu nhuộm lát', image: '/images/expenses/mau-nhuom.png' },
  { code: 'REPAIR', name: 'Sửa máy', image: '/images/expenses/sua-may.png' },
  { code: 'OTHER', name: 'Khác', image: null },
] as const;

export const expenseCategoryImages = Object.fromEntries(
  expenseCategories.map((category) => [category.code, category.image]),
);
