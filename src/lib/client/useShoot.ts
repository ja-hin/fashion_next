'use client';

import { useCallback, useRef, useState } from 'react';
import { getJson, postForm, postMultipart, ApiError } from './api';
import type {
  CardItem,
  JobState,
  PoseSettings,
  ResumePayload,
  JobResult,
} from './types';

/**
 * Owns the current shoot: its images, the in-flight generation, and the
 * poll loop that streams results in as they land.
 *
 * Lives in one hook so the Generate view and the Gallery's "continue shoot"
 * action drive the same state rather than two copies of it.
 */

const POLL_MS = 700;

function toCard(res: JobResult, isHero: boolean, settings: PoseSettings = {}): CardItem {
  const img = res.img ?? '';
  return {
    pose: res.pose,
    img,
    cost: res.cost,
    warn: res.warn,
    error: res.error,
    isHero,
    file: img ? (img.split('?')[0].split('/').pop() ?? '') : '',
    settings,
  };
}

export interface ShootApi {
  pid: string | null;
  shootNo: string;
  cards: CardItem[];
  /** Number of images currently generating — rendered as shimmer placeholders. */
  pendingCount: number;
  generating: boolean;
  resumedBanner: { title: string; count: number } | null;

  startShoot: (fd: FormData, onBalance: (b: number) => void) => Promise<void>;
  addOne: (
    pose: string,
    settings: PoseSettings,
    onBalance: (b: number) => void,
  ) => Promise<void>;
  runBatch: (
    rows: Array<PoseSettings & { pose: string }>,
    onBalance: (b: number) => void,
  ) => Promise<void>;
  resume: (pid: string) => Promise<ResumePayload>;
  removeCard: (file: string) => void;
  reset: () => void;
  dismissBanner: () => void;
}

export function useShoot(onError: (msg: string) => void): ShootApi {
  const [pid, setPid] = useState<string | null>(null);
  const [shootNo, setShootNo] = useState('');
  const [cards, setCards] = useState<CardItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [resumedBanner, setResumedBanner] = useState<{ title: string; count: number } | null>(null);

  // Latest pid without re-creating callbacks that close over it.
  const pidRef = useRef<string | null>(null);
  const setPidBoth = (v: string | null) => {
    pidRef.current = v;
    setPid(v);
  };

  /**
   * Poll a job until it's done, appending each result as it appears.
   * `settingsFor` supplies the settings to stamp on card N (used by Retry).
   */
  const poll = useCallback(
    (
      jobId: string,
      opts: {
        heroFirst?: boolean;
        onBalance: (b: number) => void;
        settingsFor?: (i: number) => PoseSettings;
      },
    ) =>
      new Promise<void>((resolve) => {
        let seen = 0;

        const tick = async () => {
          let j: JobState;
          try {
            j = await getJson<JobState>(`/api/job/${jobId}`);
          } catch {
            // A transient poll failure shouldn't kill the run — try again.
            return;
          }

          if (typeof j.balance === 'number') opts.onBalance(j.balance);
          if (j.product_id) setPidBoth(j.product_id);
          if (j.shoot) setShootNo(j.shoot);

          while (seen < j.results.length) {
            const idx = seen;
            const res = j.results[idx];
            const isHero = !!opts.heroFirst && idx === 0;
            setCards((prev) => [...prev, toCard(res, isHero, opts.settingsFor?.(idx) ?? {})]);
            setPendingCount((n) => Math.max(0, n - 1));
            seen++;
          }

          if (j.status === 'done') {
            clearInterval(timer);
            // Any placeholder still standing had no matching result — clear it
            // rather than leaving a shimmer on screen forever.
            setPendingCount(0);
            resolve();
          }
        };

        const timer = setInterval(tick, POLL_MS);
        void tick();
      }),
    [],
  );

  const startShoot = useCallback(
    async (fd: FormData, onBalance: (b: number) => void) => {
      setGenerating(true);
      setCards([]);
      setResumedBanner(null);
      setPendingCount(1);
      try {
        const j = await postMultipart<{ job_id: string }>('/api/generate', fd);
        await poll(j.job_id, { heroFirst: true, onBalance });
      } catch (e) {
        setPendingCount(0);
        onError(e instanceof ApiError ? e.message : 'Could not start generation.');
      } finally {
        setGenerating(false);
      }
    },
    [poll, onError],
  );

  const addOne = useCallback(
    async (pose: string, settings: PoseSettings, onBalance: (b: number) => void) => {
      const id = pidRef.current;
      if (!id) return;
      setPendingCount((n) => n + 1);
      try {
        const j = await postForm<{ job_id: string }>(`/api/product/${id}/one`, {
          custom: pose,
          framing: settings.framing ?? '',
          aspect: settings.aspect ?? '',
          backdrop: settings.backdrop ?? '',
          mood: settings.mood ?? '',
          lighting: settings.lighting ?? '',
          resolution: settings.resolution ?? '',
        });
        await poll(j.job_id, { onBalance, settingsFor: () => settings });
      } catch (e) {
        setPendingCount((n) => Math.max(0, n - 1));
        onError(e instanceof ApiError ? e.message : 'Could not generate that pose.');
      }
    },
    [poll, onError],
  );

  const runBatch = useCallback(
    async (rows: Array<PoseSettings & { pose: string }>, onBalance: (b: number) => void) => {
      const id = pidRef.current;
      if (!id || !rows.length) return;
      setPendingCount((n) => n + rows.length);
      try {
        const j = await postForm<{ job_id: string }>(`/api/product/${id}/batch`, {
          rows: JSON.stringify(rows),
        });
        await poll(j.job_id, { onBalance, settingsFor: (i) => rows[i] ?? {} });
      } catch (e) {
        setPendingCount((n) => Math.max(0, n - rows.length));
        onError(e instanceof ApiError ? e.message : 'Could not start the batch.');
      }
    },
    [poll, onError],
  );

  const resume = useCallback(async (targetPid: string): Promise<ResumePayload> => {
    const j = await getJson<ResumePayload>(`/api/product/${targetPid}/resume`);
    setPidBoth(j.pid);
    setShootNo(j.shoot);
    setGenerating(false);
    setPendingCount(0);
    setCards(
      j.images.map((im) => ({
        pose: im.pose,
        img: im.img,
        isHero: im.is_hero,
        file: im.file,
        settings: {
          framing: im.framing,
          aspect: im.aspect,
          backdrop: im.backdrop,
          mood: im.mood,
          lighting: im.lighting,
        },
      })),
    );
    setResumedBanner({ title: j.title, count: j.images.length });
    return j;
  }, []);

  const removeCard = useCallback((file: string) => {
    setCards((prev) => prev.filter((c) => c.file !== file));
  }, []);

  const reset = useCallback(() => {
    setPidBoth(null);
    setShootNo('');
    setCards([]);
    setPendingCount(0);
    setGenerating(false);
    setResumedBanner(null);
  }, []);

  return {
    pid,
    shootNo,
    cards,
    pendingCount,
    generating,
    resumedBanner,
    startShoot,
    addOne,
    runBatch,
    resume,
    removeCard,
    reset,
    dismissBanner: () => setResumedBanner(null),
  };
}