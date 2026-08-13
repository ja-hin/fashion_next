'use client';

import type { EnsembleRef } from './ensemble-types';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { getJson } from './api';
import { useShoot, type ShootApi } from './useShoot';
import { useDialog } from '@/components/Dialog';
import type { Me, SavedModel, LbItem } from './types';
import type { SetupState } from '@/components/SetupPanel';
import { DEFAULT_SETUP } from '@/components/SetupPanel';

/**
 * Studio-wide state.
 *
 * Each view is now a real route (/generate, /gallery, …) rather than a hash, so
 * anything that must survive navigation lives here in the layout's provider —
 * most importantly the in-progress shoot, which would otherwise be lost the
 * moment you glanced at the Gallery mid-generation.
 */

interface StudioValue {
  me: Me;
  patchMe: (patch: Partial<Me>) => void;
  refreshMe: () => Promise<void>;

  balance: number;
  setBalance: (n: number) => void;

  shoot: ShootApi;

  setup: SetupState;
  patchSetup: (patch: Partial<SetupState>) => void;
  file: File | null;
  setFile: (f: File | null) => void;
  /** Ensemble mode's tagged product references, in upload order. */
  ensemble: EnsembleRef[];
  setEnsemble: (refs: EnsembleRef[]) => void;
  modelSource: 'imagine' | 'saved';
  setModelSource: (s: 'imagine' | 'saved') => void;
  selectedModel: SavedModel | null;
  setSelectedModel: (m: SavedModel | null) => void;
  noModelError: boolean;
  setNoModelError: (v: boolean) => void;

  /** Credits for one image; '' means "the shoot's own resolution". */
  priceFor: (resolution: string) => number;

  openZoom: (items: LbItem[], index: number) => void;
  lightbox: { items: LbItem[]; index: number } | null;
  setLightboxIndex: (i: number) => void;
  closeZoom: () => void;

  saveModelPid: string | null;
  openSaveModel: (pid: string) => void;
  closeSaveModel: () => void;

  modelsRefresh: number;
  bumpModels: () => void;
}

const Ctx = createContext<StudioValue | null>(null);

export function useStudio(): StudioValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStudio must be used inside <StudioProvider>');
  return v;
}

export function StudioProvider({
  initialMe,
  children,
}: {
  initialMe: Me;
  children: React.ReactNode;
}) {
  const dialog = useDialog();

  const [me, setMe] = useState<Me>(initialMe);
  const [balance, setBalance] = useState(Number(initialMe.balance ?? 0));

  const [setup, setSetup] = useState<SetupState>(DEFAULT_SETUP);
  const [file, setFile] = useState<File | null>(null);
  const [ensemble, setEnsemble] = useState<EnsembleRef[]>([]);
  const [modelSource, setModelSource] = useState<'imagine' | 'saved'>('imagine');
  const [selectedModel, setSelectedModel] = useState<SavedModel | null>(null);
  const [noModelError, setNoModelError] = useState(false);

  const [lightbox, setLightbox] = useState<{ items: LbItem[]; index: number } | null>(null);
  const [saveModelPid, setSaveModelPid] = useState<string | null>(null);
  const [modelsRefresh, setModelsRefresh] = useState(0);

  const onError = useCallback((msg: string) => void dialog.alert(msg), [dialog]);
  const shoot = useShoot(onError);

  const patchMe = useCallback((patch: Partial<Me>) => {
    setMe((m) => ({ ...m, ...patch }));
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const fresh = await getJson<Me>('/api/me');
      if (fresh.authed) {
        setMe(fresh);
        setBalance(Number(fresh.balance ?? 0));
      }
    } catch {
      // A failed refresh just leaves the previous values on screen.
    }
  }, []);

  const patchSetup = useCallback((patch: Partial<SetupState>) => {
    setSetup((s) => ({ ...s, ...patch }));
  }, []);

  const usingSaved = modelSource === 'saved' && setup.input_family !== 'extend';

  const priceFor = useCallback(
    (resolution: string) => {
      const mode = usingSaved ? 'saved' : 'imagine';
      const r = resolution || setup.resolution || '1K';
      const grid = me.prices?.[mode] ?? {};
      const v = grid[r] ?? grid['1K'];
      return Number(v ?? 0);
    },
    [usingSaved, setup.resolution, me.prices],
  );

  const value = useMemo<StudioValue>(
    () => ({
      me,
      patchMe,
      refreshMe,
      balance,
      setBalance,
      shoot,
      setup,
      patchSetup,
      file,
      setFile,
      ensemble,
      setEnsemble,
      modelSource,
      setModelSource,
      selectedModel,
      setSelectedModel,
      noModelError,
      setNoModelError,
      priceFor,
      lightbox,
      openZoom: (items, index) => setLightbox({ items, index }),
      setLightboxIndex: (i) => setLightbox((v) => (v ? { ...v, index: i } : v)),
      closeZoom: () => setLightbox(null),
      saveModelPid,
      openSaveModel: setSaveModelPid,
      closeSaveModel: () => setSaveModelPid(null),
      modelsRefresh,
      bumpModels: () => setModelsRefresh((n) => n + 1),
    }),
    [
      me,
      patchMe,
      refreshMe,
      balance,
      shoot,
      setup,
      patchSetup,
      file,
      ensemble,
      modelSource,
      selectedModel,
      noModelError,
      priceFor,
      lightbox,
      saveModelPid,
      modelsRefresh,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
