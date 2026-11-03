import type { Stage } from '@/types/domain';

const quantities: Record<string, number> = { WEAVING: 10, TYING: 15, SEWING: 20, CUTTING: 20 };
export function defaultWorkQuantity(stages: Stage[], stageId: string): number {
  const code = stages.find((stage) => stage.id === stageId)?.code;
  return code ? (quantities[code] ?? 1) : 1;
}
