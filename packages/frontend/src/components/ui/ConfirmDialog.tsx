import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Btn } from './Btn';
import { ConfirmContext, type ConfirmOptions, type Confirmer } from './useConfirm';

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<
    (ConfirmOptions & { resolve: (v: boolean) => void }) | null
  >(null);

  const confirm = useCallback<Confirmer>((opts) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, resolve });
    });
  }, []);

  const handle = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={state !== null}
        onClose={() => handle(false)}
        size="sm"
        title={state?.title}
        description={state?.description}
        footer={
          <>
            <Btn variant="ghost" onClick={() => handle(false)}>
              {state?.cancelLabel || 'Abbrechen'}
            </Btn>
            <Btn
              variant={state?.destructive ? 'danger' : 'primary'}
              onClick={() => handle(true)}
            >
              {state?.confirmLabel || 'Bestätigen'}
            </Btn>
          </>
        }
      >
        {state?.destructive && (
          <div className="flex items-start gap-3 text-sm text-ink-2">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md"
              style={{ background: 'rgba(244, 63, 94, 0.12)', color: 'var(--neg)' }}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <p>Diese Aktion kann nicht rückgängig gemacht werden.</p>
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}
