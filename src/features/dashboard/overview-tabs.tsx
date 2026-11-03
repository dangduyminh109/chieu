'use client';

import { useId, useRef, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Layers3, Receipt, Wallet } from 'lucide-react';

const tabs = [
  { id: 'stock', label: 'Kho chiếu', icon: Layers3 },
  { id: 'cashflow', label: 'Thu chi', icon: Receipt },
  { id: 'payroll', label: 'Công & lương', icon: Wallet },
] as const;

export function OverviewTabs({
  stock,
  cashflow,
  payroll,
}: {
  stock: ReactNode;
  cashflow: ReactNode;
  payroll: ReactNode;
}) {
  const params = useSearchParams();
  const path = usePathname();
  const router = useRouter();
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = tabs.find((tab) => tab.id === params.get('tab'))?.id ?? 'stock';
  const panels = { stock, cashflow, payroll };
  function select(index: number, focus = false) {
    const query = new URLSearchParams(params.toString());
    query.set('tab', tabs[index].id);
    router.replace(`${path}?${query}`, { scroll: false });
    if (focus) buttons.current[index]?.focus();
  }
  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Tổng quan cơ sở"
        className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-muted p-1"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            id={`${id}-${tab.id}-tab`}
            type="button"
            role="tab"
            aria-selected={selected === tab.id}
            aria-controls={`${id}-${tab.id}-panel`}
            tabIndex={selected === tab.id ? 0 : -1}
            onClick={() => select(index)}
            onKeyDown={(event) => {
              const target =
                event.key === 'ArrowRight'
                  ? (index + 1) % tabs.length
                  : event.key === 'ArrowLeft'
                    ? (index + tabs.length - 1) % tabs.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? tabs.length - 1
                        : null;
              if (target !== null) {
                event.preventDefault();
                select(target, true);
              }
            }}
            className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs font-semibold sm:flex-row sm:gap-2 sm:text-sm ${selected === tab.id ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <tab.icon size={17} aria-hidden />
            <span className="whitespace-nowrap">{tab.label}</span>
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${id}-${tab.id}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-${tab.id}-tab`}
          hidden={selected !== tab.id}
          tabIndex={0}
          className="space-y-4"
        >
          {panels[tab.id]}
        </div>
      ))}
    </div>
  );
}
