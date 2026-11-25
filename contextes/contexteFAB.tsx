//FAB fix Gabriel
//8 octobre

import { Href } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export type FabConfig = {
  icon: React.ReactNode | null;
  href?: Href;
  params?: any;
  visible: boolean;
  /**
   * When set, pressing the FAB shows this error instead of navigating / acting
   * (e.g. a past day).
   *
   * @author Philip — rectification for a more conventional display:
   *   a clear message instead of opening a form that can't be submitted
   */
  bloque?: string;
} | undefined;

type FabState = { owner: string; config: FabConfig } | null;

type FabActions = {
  setFabConfig: (owner: string, config: FabConfig, action?: () => void) => void;
  release: (owner: string) => void;
  actionRef: React.MutableRefObject<(() => void) | null>;
};

//Separation of contexts means less renders and better fade out animation for the FAB
const FabStateContext = createContext<FabConfig>(undefined);
const FabActionsContext = createContext<FabActions | null>(null);

/**
 * Looks if both configs (a and b) are the same
 * @param { FabConfig } a 
 * @param { FabConfig } b 
 * @returns True if both configs are the same. False otherwise
 */
function sameConfig(a: FabConfig, b: FabConfig) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.visible === b.visible &&
    (a.href ?? null) === (b.href ?? null) &&
    a.icon === b.icon &&
    (a.bloque ?? null) === (b.bloque ?? null) &&
    JSON.stringify(a.params ?? null) === JSON.stringify(b.params ?? null)
  );
}

export function FabProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FabState>(null);
  const actionRef = useRef<(() => void) | null>(null);
  const ownerRef = useRef<string | null>(null); // owner courant, lisible sans re-render

  const setFabConfig = useCallback((owner: string, config: FabConfig, action?: () => void) => {
    ownerRef.current = owner;
    actionRef.current = action ?? null;
    setState(prev =>
      prev && prev.owner === owner && sameConfig(prev.config, config)
        ? prev                       // rien n'a changé → pas de re-render
        : { owner, config }
    );
  }, []);

  const release = useCallback((owner: string) => {
    if (ownerRef.current !== owner) return;  // un autre écran a déjà pris la main
    ownerRef.current = null;
    actionRef.current = null;
    setState(null);
  }, []);

  // Ne change jamais → les écrans qui utilisent les hooks ne re-rendent plus
  const actions = useMemo(() => ({ setFabConfig, release, actionRef }), [setFabConfig, release]);

  return (
    <FabActionsContext.Provider value={actions}>
      <FabStateContext.Provider value={state?.config}>
        {children}
      </FabStateContext.Provider>
    </FabActionsContext.Provider>
  );
}

export const useFabState = () => useContext(FabStateContext);
export const useFabActions = () => {
  const ctx = useContext(FabActionsContext);
  if (!ctx) throw new Error('useFabActions doit être utilisé dans un FabProvider');
  return ctx;
};