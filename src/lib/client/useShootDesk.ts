'use client';

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { useShoot, type ShootApi } from './useShoot';
import type { EnsembleRef } from './ensemble-types';
import type { Me, SavedModel } from './types';
import type { SetupState } from '@/components/SetupPanel';
import { DEFAULT_SETUP } from '@/components/SetupPanel';

/**
 * Everything one Generate screen needs to stand on its own: its references,
 * its shoot settings, its model choice and its in-flight shoot.
 *
 * Exists because the Special Category panel is a second Generate screen, not a
 * view of the first one. Sharing state between them would mean starting a
 * special shoot wipes the ordinary one off the results grid , two desks, two
 * sets of everything, and either can be left mid-generation while you work on
 * the other.
 *
 * /generate still holds its state directly on the provider rather than through
 * this hook. That is deliberate for now: the working path is not worth churning
 * to make the two look alike, and nothing here depends on it.
 */
export interface ShootDesk {
  /** Tagged product images, in upload order , the manifest the prompt numbers. */
  refs: EnsembleRef[];
  /**
   * Takes an updater as well as a value, on purpose.
   *
   * Extraction is a network round trip with the tagging window open on top of
   * it, so the customer can remove or add an image while it is in flight. A
   * plain `setRefs(captured.map(...))` would write back the array as it was
   * when the call started and quietly undo whatever they did in between.
   */
  setRefs: Dispatch<SetStateAction<EnsembleRef[]>>;

  setup: SetupState;
  patchSetup: (patch: Partial<SetupState>) => void;

  modelSource: 'imagine' | 'saved';
  setModelSource: (s: 'imagine' | 'saved') => void;
  selectedModel: SavedModel | null;
  setSelectedModel: (m: SavedModel | null) => void;
  noModelError: boolean;
  setNoModelError: (v: boolean) => void;

  shoot: ShootApi;

  /** Credits for one image on THIS desk; '' means "the desk's own resolution". */
  priceFor: (resolution: string) => number;
}

export function useShootDesk(me: Me, onError: (msg: string) => void): ShootDesk {
  const [refs, setRefs] = useState<EnsembleRef[]>([]);
  const [setup, setSetup] = useState<SetupState>(DEFAULT_SETUP);
  const [modelSource, setModelSource] = useState<'imagine' | 'saved'>('imagine');
  const [selectedModel, setSelectedModel] = useState<SavedModel | null>(null);
  const [noModelError, setNoModelError] = useState(false);

  const shoot = useShoot(onError);

  const patchSetup = useCallback((patch: Partial<SetupState>) => {
    setSetup((s) => ({ ...s, ...patch }));
  }, []);

  // "Extend" takes the model from the uploaded photo, so a saved model is not
  // in play and the cheaper imagine grid applies , same rule as /generate.
  const usingSaved = modelSource === 'saved' && setup.input_family !== 'extend';

  /*
   * Quoted from the SPECIAL grid, because this hook backs the Special Category
   * desk and that is what /api/generate will bill it from. Falls back to the
   * ordinary grid when no special one is configured, which keeps the button
   * honest on a settings document written before the grid existed.
   */
  const priceFor = useCallback(
    (resolution: string) => {
      const mode = usingSaved ? 'saved' : 'imagine';
      const r = resolution || setup.resolution || '1K';
      const grid = (me.special_prices ?? me.prices)?.[mode] ?? {};
      const v = grid[r] ?? grid['1K'];
      return Number(v ?? 0);
    },
    [usingSaved, setup.resolution, me.special_prices, me.prices],
  );

  return {
    refs,
    setRefs,
    setup,
    patchSetup,
    modelSource,
    setModelSource,
    selectedModel,
    setSelectedModel,
    noModelError,
    setNoModelError,
    shoot,
    priceFor,
  };
}
