# Shared UI and state conventions

The app has one global Sonner toaster in the root layout. Notifications appear at
**top-center** with success/error colors and Vietnamese accessible labels. All
action forms use it, while preserving inline results for readability. Production
submission also reports transport failures without claiming that unsaved work succeeded.

```tsx
import { toast } from 'sonner';
toast.success('Đã lưu thay đổi.');
toast.error('Không thể lưu. Vui lòng thử lại.');
```

## Components

Components are source-owned under `src/components/ui` with Tailwind/CVA variants,
shadcn configuration, typed props, and Lucide icons. Use these before duplicating styles.

```tsx
import { Badge } from '@/components/ui/badge';
import { TextWithBadge } from '@/components/ui/text-with-badge';
import { Field } from '@/components/ui/field';

<Badge variant="success">Đã duyệt</Badge>
<Badge variant="warning">Chờ duyệt</Badge>
<TextWithBadge text="Sản xuất" badge="12 bản ghi" />
<TextWithBadge text="Công đã gửi" badge="Chờ duyệt" badgeVariant="warning" />
<Field id="quantity" label="Số chiếu" hint="Nhập số nguyên lớn hơn 0.">
  <input id="quantity" name="quantity" type="number" inputMode="numeric"
    min={1} step={1} aria-describedby="quantity-hint" />
</Field>
```

Badge variants: `default`, `secondary`, `outline`, `success`, `warning`,
`destructive`. TextWithBadge accepts React nodes for text and badge and supports
wrapping instead of overflowing on narrow screens. It deliberately does not
impose heading semantics: wrap it in the appropriate heading when needed.

Field renders a label, optional hint and error. Connect input `id`,
`aria-describedby`, and `aria-invalid` explicitly. Button supports default,
outline, ghost and destructive variants; `asChild` allows accessible navigation
links with the same appearance. Card, EmptyState, Denied, ActionForm and
SubmitButton cover the common page/form states.

## Forms

Use React Hook Form with `zodResolver` for interactive forms. The production form
uses `useWatch` for live rate and wage calculation. Server Actions and database
functions always revalidate; browser validation is never the security boundary.
Use ActionForm for simpler server-backed forms and shared pending/toast/inline results.

## Zustand

`src/lib/stores/ui-store.ts` holds only the latest successfully used mat/stage
selection, scoped to the current worker ID. It makes the next entry faster within
the same browser session. It is **memory-only**: no persistence middleware,
localStorage, session tokens, authorization state, work records, or financial data.

The database remains authoritative. Always validate a remembered selection against
the current server-provided active catalog and assigned skills before reuse.
Do not add a global cache of roles or wages to this store.

## Dialog and data table

Use Dialog for creation/editing forms. It uses native modal focus containment,
Escape handling and focus restoration. ActionForm closes its containing dialog
only after a successful action, preserving validation errors on failure.
Production entry uses the same close context after successful submission.
DataTable is a generic Server Component with typed columns, stable row keys,
caption, scoped headers, empty state and a keyboard-focusable horizontal region.
Use it for catalog, pricing, members and production history; keep queries,
permissions and pagination in the calling server page. No deletion controls exist.

## Compact mobile controls

Select and DatePicker render themed dropdown choices and a Vietnamese calendar,
including month/year controls and date bounds. Server forms submit hidden field
values; React Hook Form uses Controller with onValueChange. Pickers dismiss on
outside pointer input or Escape and retain form reset behavior. No browser-native
select/date popup is used in pricing or production. Tables stack into compact
labeled records on phones and retain desktop columns. Touch controls remain at
least 44px high; inputs keep 16px text to avoid iOS focus zoom.
