import Image from 'next/image';
import { Receipt } from 'lucide-react';
import { expenseCategories } from './categories';

export function ExpenseCategoryLabel({ name }: { name: string }) {
  const category = expenseCategories.find(
    (category) => category.name === name || (category.code === 'OTHER' && name === 'Chi phí khác'),
  );
  if (!category) return <>{name}</>;
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {category.image ? (
        <Image
          src={category.image}
          alt=""
          width={36}
          height={36}
          className="size-9 shrink-0 rounded-lg border border-border object-cover"
        />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
          <Receipt size={18} aria-hidden />
        </span>
      )}
      <span className="min-w-0 break-words">{name}</span>
    </span>
  );
}
