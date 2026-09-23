'use client';

/** localStorage key behind the nav's collapsed preference. */
const NAV_RAIL_KEY = 'studio.navRailed';
/** localStorage key behind the Generate tab's collapsed setup panel. */
const SETUP_KEY = 'studio.setupCollapsed';

import type { EnsembleRef } from './ensemble-types';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { getJson } from './api';
import { useShoot, type ShootApi } from './useShoot';
import { useShootDesk, type ShootDesk } from './useShootDesk';
import { useDialog } from '@/components/Dialog';
import type { Me, SavedModel, LbItem } from './types';
import type { SetupState } from '@/components/SetupPanel';
import { DEFAULT_SETUP } from '@/components/SetupPanel';

/**
 * Studio-wide state.
 *
 * Each view is now a real route (/generate, /gallery, …) rather than a hash, so
 * anything that must survive navigation lives here in the layout's provider ,
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
  /** Takes an updater as well as a value , see EnsembleTagModal's onRefs. */
  setEnsemble: Dispatch<SetStateAction<EnsembleRef[]>>;
  /**
   * The Special Category panel's own Generate desk , its references, settings,
   * model and shoot, all separate from the ones above.
   *
   * Uploads the classifier reads as a special category (see
   * /api/ensemble/detect and the `restricted` flag) are moved OUT of `ensemble`
   * and into `specialDesk.refs`, and /special generates from them on its own.
   *
   * Lives in the provider rather than on the page because the handover is a
   * real navigation: the tagging window is on /generate and the desk is on
   * /special, and a File has no URL to be re-fetched from , as page state the
   * images would be gone on arrival. It is also what lets a special shoot keep
   * running while you go back to /generate, and vice versa.
   */
  specialDesk: ShootDesk;
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

  garmentsRefresh: number;
  bumpGarments: () => void;

  /**
   * Whether the left nav is collapsed to its icon rail.
   *
   * Lives here rather than inside SideNav because pages need to close it ,
   * starting a shoot hands the screen over to the results grid, and the nav is
   * not what you are looking at next.
   */
  navRailed: boolean;
  setNavRailed: (v: boolean) => void;

  /**
   * Whether the Generate tab's shoot-setup panel is folded away.
   *
   * Here rather than in the page so it survives a trip to Gallery and back ,
   * a panel that re-opened on every navigation would be worse than no toggle.
   */
  setupCollapsed: boolean;
  setSetupCollapsed: (v: boolean) => void;
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
  const [garmentsRefresh, setGarmentsRefresh] = useState(0);

  // Starts open and adopts the stored preference after mount: reading
  // localStorage during render would desync the server and client markup.
  const [navRailed, setNavRailed] = useState(false);
  const [setupCollapsed, setSetupCollapsed] = useState(false);
  const [navReady, setNavReady] = useState(false);
  useEffect(() => {
    setNavRailed(localStorage.getItem(NAV_RAIL_KEY) === '1');
    setSetupCollapsed(localStorage.getItem(SETUP_KEY) === '1');
    setNavReady(true);
  }, []);
  useEffect(() => {
    if (!navReady) return;
    localStorage.setItem(NAV_RAIL_KEY, navRailed ? '1' : '0');
    localStorage.setItem(SETUP_KEY, setupCollapsed ? '1' : '0');
  }, [navRailed, setupCollapsed, navReady]);

  const onError = useCallback((msg: string) => void dialog.alert(msg), [dialog]);
  const shoot = useShoot(onError);
  const specialDesk = useShootDesk(me, onError);

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
      specialDesk,
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
      garmentsRefresh,
      bumpGarments: () => setGarmentsRefresh((n) => n + 1),
      navRailed,
      setNavRailed,
      setupCollapsed,
      setSetupCollapsed,
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
      specialDesk,
      modelSource,
      selectedModel,
      noModelError,
      priceFor,
      lightbox,
      saveModelPid,
      modelsRefresh,
      garmentsRefresh,
      navRailed,
      setupCollapsed,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
