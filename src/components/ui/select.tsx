'use client';
import {
  Children,
  isValidElement,
  useRef,
  useState,
  useEffect,
  type ReactNode,
  type RefObject,
} from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export function useDismissPicker(ref: RefObject<HTMLDetailsElement | null>) {
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) ref.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && ref.current?.open) {
        event.preventDefault();
        event.stopPropagation();
        ref.current.open = false;
        ref.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    ref.current?.addEventListener('keydown', escape);
    const element = ref.current;
    return () => {
      document.removeEventListener('pointerdown', outside);
      element?.removeEventListener('keydown', escape);
    };
  }, [ref]);
}

export function Select({
  id,
  name,
  children,
  value,
  defaultValue,
  onValueChange,
  disabled,
  required,
  className,
  align = 'start',
  optionImages,
  optionIcons,
}: {
  id: string;
  name?: string;
  children: ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  align?: 'start' | 'end';
  optionImages?: Record<string, string | null>;
  optionIcons?: Record<string, ReactNode> | ((value: string, small?: boolean) => ReactNode);
}) {
  const options = Children.toArray(children)
    .filter(isValidElement)
    .map((child) => {
      const props = child.props as {
        value?: string;
        children: ReactNode;
        icon?: ReactNode;
        image?: string | null;
      };
      return {
        value: String(props.value ?? ''),
        label: props.children,
        icon: props.icon,
        image: props.image,
      };
    });
  const initial = defaultValue ?? options[0]?.value ?? '';
  const [internal, setInternal] = useState(initial);
  const selected = value ?? internal;
  function renderOptionIcon(optionValue: string, small = false) {
    if (typeof optionIcons === 'function') {
      const node = optionIcons(optionValue, small);
      if (node) return node;
    } else if (optionIcons && optionIcons[optionValue]) {
      return optionIcons[optionValue];
    }

    const opt = options.find((o) => o.value === optionValue);
    if (opt?.icon) {
      return opt.icon;
    }

    const src = opt?.image ?? (optionImages ? optionImages[optionValue] : null);
    if (src) {
      return (
        <Image
          src={src}
          alt=""
          width={32}
          height={32}
          unoptimized
          className={cn('shrink-0 rounded-md object-cover shadow-2xs', small ? 'size-7' : 'size-7')}
        />
      );
    }
    if (optionImages && optionImages[optionValue] === null) {
      return (
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground border border-border/60',
            small ? 'size-7' : 'size-7',
          )}
        >
          <ImageIcon size={small ? 14 : 16} aria-hidden />
        </span>
      );
    }
    return null;
  }
  const details = useRef<HTMLDetailsElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useDismissPicker(details);
  useEffect(() => {
    const form = input.current?.form;
    const reset = () => setInternal(initial);
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, [initial]);
  return (
    <details ref={details} className={cn('field-picker relative min-w-0', className)}>
      <summary
        id={id}
        aria-label={undefined}
        aria-required={required}
        aria-disabled={disabled}
        onClick={(e) => {
          if (disabled) e.preventDefault();
        }}
        className="picker-trigger !min-h-[44px] !h-[44px] !py-1.5 !px-3 cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
          {renderOptionIcon(selected, true)}
          <span className="font-semibold text-xs sm:text-sm text-foreground truncate">
            {options.find((o) => o.value === selected)?.label ?? 'Chọn một mục'}
          </span>
        </div>
        <ChevronDown size={16} aria-hidden className="shrink-0 text-muted-foreground ml-2" />
      </summary>
      <input ref={input} type="hidden" name={name} value={selected} />
      {!disabled && (
        <div
          className="picker-menu"
          style={align === 'end' ? { left: 'auto', right: 0 } : undefined}
          role="group"
          aria-label="Các lựa chọn"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={option.value === selected}
              className="picker-option"
              onClick={() => {
                setInternal(option.value);
                onValueChange?.(option.value);
                if (details.current) details.current.open = false;
                details.current?.querySelector('summary')?.focus();
              }}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                {renderOptionIcon(option.value, false)}
                <span className="min-w-0 break-words">{option.label}</span>
              </span>
              {option.value === selected && (
                <Check size={16} aria-hidden className="shrink-0 text-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </details>
  );
}
