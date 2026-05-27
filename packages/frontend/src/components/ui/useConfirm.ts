import { createContext, useContext } from 'react';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export type Confirmer = (opts: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<Confirmer | null>(null);

export function useConfirm(): Confirmer {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
