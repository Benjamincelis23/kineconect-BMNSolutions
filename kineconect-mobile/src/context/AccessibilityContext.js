import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { cacheGet, cacheSet } from '../services/offline';

const STORAGE_A11Y_MOBILE = 'kc_mobile_a11y_v1';

const DEFAULT_PREFS = {
  fontScale: 1, // 1 | 1.15 | 1.28
  highContrast: false,
  largeTargets: false,
  reduceMotion: false,
  visualSupport: true,
};

const AccessibilityContext = createContext({
  prefs: DEFAULT_PREFS,
  panelVisible: false,
  openPanel: () => {},
  closePanel: () => {},
  updatePref: () => {},
  applyPreset: () => {},
  resetPrefs: () => {},
  fs: (size) => size,
});

export function AccessibilityProvider({ children }) {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [panelVisible, setPanelVisible] = useState(false);

  useEffect(() => {
    cacheGet(STORAGE_A11Y_MOBILE).then((saved) => {
      if (saved && typeof saved === 'object') {
        setPrefs({ ...DEFAULT_PREFS, ...saved });
      }
    });
  }, []);

  const persist = useCallback((next) => {
    setPrefs(next);
    cacheSet(STORAGE_A11Y_MOBILE, next);
  }, []);

  const updatePref = useCallback(
    (key, value) => {
      persist({ ...prefs, [key]: value });
    },
    [prefs, persist],
  );

  const applyPreset = useCallback(
    (preset) => {
      if (preset === 'adulto_mayor') {
        persist({
          fontScale: 1.18,
          highContrast: true,
          largeTargets: true,
          reduceMotion: false,
          visualSupport: true,
        });
      } else if (preset === 'motricidad') {
        persist({
          fontScale: 1.08,
          highContrast: true,
          largeTargets: true,
          reduceMotion: true,
          visualSupport: true,
        });
      } else if (preset === 'auditivo') {
        persist({
          fontScale: 1.15,
          highContrast: false,
          largeTargets: false,
          reduceMotion: false,
          visualSupport: true,
        });
      } else {
        persist(DEFAULT_PREFS);
      }
    },
    [persist],
  );

  const resetPrefs = useCallback(() => persist(DEFAULT_PREFS), [persist]);
  const openPanel = useCallback(() => setPanelVisible(true), []);
  const closePanel = useCallback(() => setPanelVisible(false), []);
  const fs = useCallback((baseSize) => Math.round(baseSize * (prefs.fontScale || 1)), [prefs.fontScale]);

  return (
    <AccessibilityContext.Provider
      value={{
        prefs,
        panelVisible,
        openPanel,
        closePanel,
        updatePref,
        applyPreset,
        resetPrefs,
        fs,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  return useContext(AccessibilityContext);
}