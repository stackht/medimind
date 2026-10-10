import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';

const FeedbackCtx = createContext(null);
export const useToast = () => useContext(FeedbackCtx).toast;
export const useConfirm = () => useContext(FeedbackCtx).confirm;

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const id = useRef(0);

  const toast = useCallback((message, kind = 'success') => {
    const n = ++id.current;
    setToasts((t) => [...t.slice(-3), { id: n, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n)), 4200);
  }, []);
  const confirm = useCallback((opts) => new Promise((resolve) => setDialog({ ...opts, resolve })), []);
  const close = (v) => { dialog?.resolve(v); setDialog(null); };
  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  useEffect(() => {
    if (!dialog) return undefined;
    const k = (e) => { if (e.key === 'Escape') close(false); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  return (
    <FeedbackCtx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <Icon name={t.kind === 'error' ? 'alert' : t.kind === 'info' ? 'info' : 'check'} size={16} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
      {dialog && (
        <div className="overlay" onClick={() => close(false)}>
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="dlg-title">{dialog.title}</h3>
            <p>{dialog.message}</p>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
              <button className="btn" onClick={() => close(false)}>Cancel</button>
              <button className={`btn ${dialog.danger ? 'danger' : 'primary'}`} onClick={() => close(true)} autoFocus>{dialog.confirmLabel ?? 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </FeedbackCtx.Provider>
  );
}
