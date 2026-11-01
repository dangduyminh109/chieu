'use client';
import { create } from 'zustand';

type ProductionSelection = { workerId: string; matTypeId: string; stageId: string };
interface UiState {
  productionSelection: ProductionSelection | null;
  setProductionSelection: (selection: ProductionSelection) => void;
}
// Deliberately memory-only. Never store sessions, roles, work records or money here.
export const useUiStore = create<UiState>()((set) => ({
  productionSelection: null,
  setProductionSelection: (productionSelection) => set({ productionSelection }),
}));
