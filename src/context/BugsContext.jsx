import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { INITIAL_BUGS } from '../data/bugs';

const BugsContext = createContext(null);

export function BugsProvider({ children }) {
  const [bugs, setBugs] = useState(INITIAL_BUGS);

  const updateBug = useCallback((id, patch) => {
    setBugs((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, []);

  const addBug = useCallback((bug) => {
    setBugs((prev) => [bug, ...prev]);
  }, []);

  const addNote = useCallback((id, note) => {
    setBugs((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, notes: [...b.notes, note] } : b
      )
    );
  }, []);

  const logETARequest = useCallback((id) => {
    const requestedAt = new Date().toISOString();
    setBugs((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              etaRequests: [...b.etaRequests, { requestedAt, answered: false }],
            }
          : b
      )
    );
  }, []);

  const value = useMemo(
    () => ({ bugs, updateBug, addBug, addNote, logETARequest }),
    [bugs, updateBug, addBug, addNote, logETARequest]
  );

  return <BugsContext.Provider value={value}>{children}</BugsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBugs() {
  const ctx = useContext(BugsContext);
  if (!ctx) {
    throw new Error('useBugs must be used inside a BugsProvider');
  }
  return ctx;
}
