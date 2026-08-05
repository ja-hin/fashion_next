'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getJson,
  postForm,
  patchForm,
  del,
  bust,
  ethLabel,
  titleCase,
  fmt,
  ApiError,
} from '@/lib/client/api';
import { ETHNICITIES } from '@/lib/client/constants';
import { useDialog } from './Dialog';
import { GridIcon, TrashIcon } from './icons';
import CharsheetResult from './CharsheetResult';
import type { SavedModel, LbItem, CharsheetPromptInfo } from '@/lib/client/types';

type CsPhase = 'idle' | 'generating';

/**
 * A saved model's folder: its reference images, editable tags, and the
 * character-sheet section that makes it usable as a shoot anchor.
 */
export default function ModelFolderModal({
  mid,
  onClose,
  onZoom,
  onBalance,
  onChanged,
}: {
  mid: string;
  onClose: () => void;
  onZoom: (items: LbItem[], index: number) => void;
  onBalance: (b: number) => void;
  onChanged: () => void;
}) {
  const dialog = useDialog();
  const [model, setModel] = useState<SavedModel | null>(null);
  const [phase, setPhase] = useState<CsPhase>('idle');

  const load = useCallback(async () => {
    try {
      setModel(await getJson<SavedModel>(`/api/models/${mid}`));
    } catch {
      await dialog.alert('Could not open model.');
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mid]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!model) return null;

  const regularRefs = model.refs.filter((r) => !r.charsheet);
  const grids = model.refs.filter((r) => r.charsheet === 'grid');
  const hasSheet = grids.length > 0;
  const activeBatch = hasSheet ? grids[grids.length - 1].batch : null;
  const isKept = !!model.kept_batch && model.kept_batch === activeBatch;
  const olderCount = Math.max(0, grids.length - 1);

  const refLbItems: LbItem[] = regularRefs.map((r) => ({
    url: r.url,
    dl: r.url,
    name: `${model.name || 'model'}_${r.file}`,
    pose: r.pose,
  }));

  async function patchTag(field: string, value: string) {
    try {
      const j = await patchForm<{ model: SavedModel }>(`/api/models/${mid}`, { [field]: value });
      setModel(j.model);
      onChanged();
    } catch {
      // A failed tag edit leaves the previous value — nothing destructive.
    }
  }

  async function rename() {
    let attempt = model!.name;
    let errMsg = '';

    // Loops so a duplicate-name rejection re-opens the prompt with the error
    // shown, instead of silently dropping what the user typed.
    for (;;) {
      const nn = await dialog.prompt('Enter a new name for this model:', attempt, {
        title: 'Rename model',
        inputError: errMsg,
      });
      if (nn === null) return;
      if (!nn) {
        errMsg = 'Name cannot be empty.';
        attempt = nn;
        continue;
      }
      try {
        const j = await patchForm<{ model: SavedModel }>(`/api/models/${mid}`, { name: nn });
        setModel(j.model);
        onChanged();
        return;
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          errMsg = e.message;
          attempt = nn;
          continue;
        }
        await dialog.alert('Rename failed.');
        return;
      }
    }
  }

  async function removeModel() {
    const ok = await dialog.confirm(
      'Delete this model and its reference images? This cannot be undone.',
      { title: 'Delete model' },
    );
    if (!ok) return;
    try {
      await del(`/api/models/${mid}`);
      onChanged();
      onClose();
    } catch {
      await dialog.alert('Delete failed.');
    }
  }

  async function removeRef(file: string) {
    const ok = await dialog.confirm('Remove this reference image from the model?', {
      title: 'Remove reference',
    });
    if (!ok) return;
    try {
      const j = await del<{ model: SavedModel }>(
        `/api/models/${mid}/ref/${encodeURIComponent(file)}`,
      );
      setModel(j.model);
      onChanged();
    } catch (e) {
      await dialog.alert(e instanceof ApiError ? e.message : 'Could not remove.');
    }
  }

  async function generateSheet(replaceBatch?: string) {
    let info: CharsheetPromptInfo;
    try {
      info = await getJson<CharsheetPromptInfo>(`/api/models/${mid}/charsheet/prompt`);
    } catch (e) {
      await dialog.alert(
        e instanceof ApiError ? e.message : 'Could not prepare character sheet.',
      );
      return;
    }

    if (info.balance < info.cost) {
      await dialog.alert(
        `Insufficient balance to generate a character sheet. This costs ${fmt(info.cost)} credits ` +
          `(${info.num_images} × ${fmt(info.cost_per_image)}), you have ${fmt(info.balance)}.`,
      );
      return;
    }

    const ok = await dialog.confirm(
      `Generates ${info.num_images} individual hi-res photos (front, back, left knee-up, right knee-up, ` +
        `close-up front, close-up 45°), each anchored to this model's primary reference. Neutral outfit ` +
        `so the sheet is reusable across any garment.\n\nTotal cost: ${fmt(info.cost)} credits ` +
        `(${info.num_images} × ${fmt(info.cost_per_image)}) from your balance of ${fmt(info.balance)}.`,
      {
        title: 'Generate character sheet',
        okLabel: `Generate ${fmt(info.cost)} credits`,
        danger: false,
      },
    );
    if (!ok) return;

    setPhase('generating');
    try {
      const j = await postForm<{ model: SavedModel; balance: number }>(
        `/api/models/${mid}/charsheet`,
        replaceBatch ? { replace_batch: replaceBatch } : {},
      );
      if (typeof j.balance === 'number') onBalance(j.balance);
      setModel(j.model);
      onChanged();
    } catch (e) {
      await dialog.alert(
        e instanceof ApiError ? e.message : 'Character sheet generation failed.',
      );
      await load();
    } finally {
      setPhase('idle');
    }
  }

  /** Regenerating over a kept sheet asks whether to replace it or keep both. */
  async function regenerate() {
    if (!activeBatch || !isKept) {
      generateSheet();
      return;
    }
    const replace = await dialog.confirm(
      'You already kept a character sheet for this model. Replace it with the new one, or keep both?',
      { title: 'Regenerate character sheet', okLabel: 'Replace', danger: false },
    );
    generateSheet(replace ? activeBatch : undefined);
  }

  async function keepSheet() {
    if (!activeBatch) return;
    try {
      const j = await postForm<{ model: SavedModel }>(
        `/api/models/${mid}/charsheet/${activeBatch}/keep`,
      );
      setModel(j.model);
      onChanged();
    } catch {
      // Non-fatal: the sheet itself is already saved either way.
    }
  }

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-[30px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[86vh] min-h-[520px] w-full max-w-[1000px] overflow-hidden rounded-2xl bg-surface shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── side panel ── */}
        <div className="flex w-[270px] flex-shrink-0 flex-col border-r border-line bg-surface2 p-[22px_20px]">
          <div className="mb-[14px] aspect-[4/5] w-full overflow-hidden rounded-xl bg-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bust(model.thumb)}
              alt=""
              onClick={() => {
                const pi = regularRefs.findIndex((r) => r.primary);
                onZoom(refLbItems, pi < 0 ? 0 : pi);
              }}
              className="h-full w-full cursor-pointer object-cover"
            />
          </div>

          <h2 className="flex items-center gap-2 text-[18px] font-bold">
            <span className="truncate">{model.name}</span>
            <button title="Rename" onClick={rename} className="text-[13px] text-muted">
              ✎
            </button>
          </h2>

          <span className="mt-2 inline-block self-start rounded-[5px] bg-black/70 px-2 py-[3px] text-[9.5px] font-bold text-white">
            {model.source === 'studio'
              ? 'Created in Studio'
              : `Saved from shoot ${model.source_shoot}`}
          </span>

          <div className="mt-4">
            <div className="flex items-center justify-between border-b border-line py-2 text-[12.5px]">
              <span className="text-muted">Ethnicity</span>
              <select
                value={model.tags?.ethnicity ?? ''}
                onChange={(e) => patchTag('ethnicity', e.target.value)}
                className="w-auto border-none bg-transparent p-0 text-right text-[12.5px] font-bold"
              >
                {ETHNICITIES.map(([v]) => (
                  <option key={v} value={v}>
                    {ethLabel(v)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between border-b border-line py-2 text-[12.5px]">
              <span className="text-muted">Gender</span>
              <select
                value={model.tags?.gender ?? ''}
                onChange={(e) => patchTag('gender', e.target.value)}
                className="w-auto border-none bg-transparent p-0 text-right text-[12.5px] font-bold"
              >
                {['female', 'male', 'child'].map((g) => (
                  <option key={g} value={g}>
                    {titleCase(g)}
                  </option>
                ))}
              </select>
            </div>
            {model.tags?.vibe && (
              <div className="flex items-center justify-between border-b border-line py-2 text-[12.5px]">
                <span className="text-muted">Vibe</span>
                <b className="capitalize">{model.tags.vibe}</b>
              </div>
            )}
            <div className="flex items-center justify-between border-b border-line py-2 text-[12.5px]">
              <span className="text-muted">References</span>
              <b>
                {model.ref_count} image{model.ref_count === 1 ? '' : 's'}
              </b>
            </div>
          </div>

          <button
            onClick={removeModel}
            className="mt-auto pt-2 text-xs font-bold text-brand"
          >
            Delete model
          </button>
        </div>

        {/* ── main panel ── */}
        <div className="flex-1 overflow-auto p-[22px_24px]">
          <div className="mb-[14px] flex items-center text-[13px] font-bold uppercase tracking-[0.03em] text-muted">
            Reference images
            <button
              onClick={onClose}
              aria-label="Close"
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-surface2 text-[15px]"
            >
              ×
            </button>
          </div>

          <div className="flex flex-wrap gap-[13px]">
            {regularRefs.map((r, i) => (
              <div
                key={r.file}
                className="relative w-[148px] overflow-hidden rounded-[11px] border border-line bg-surface"
              >
                {r.primary && (
                  <span className="absolute left-1.5 top-1.5 z-[2] rounded-[5px] bg-accent/90 px-1.5 py-0.5 text-[8.5px] font-bold text-white">
                    PRIMARY
                  </span>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bust(r.url)}
                  alt={r.pose}
                  onClick={() => onZoom(refLbItems, i)}
                  className="block h-[185px] w-full cursor-pointer object-cover"
                />
                <div className="flex items-center justify-between gap-1.5 px-[9px] py-[7px] text-[11px] font-semibold text-muted">
                  <span className="min-w-0 flex-1 truncate">{r.pose}</span>
                  {regularRefs.length > 1 && !r.primary && (
                    <button
                      title="Remove"
                      onClick={() => removeRef(r.file)}
                      className="text-brand"
                    >
                      <TrashIcon className="h-[13px] w-[13px]" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── character sheet ── */}
          <div className="mt-[22px] border-t border-line pt-[22px]">
            {phase === 'generating' && (
              <div className="rounded-[14px] bg-surface2 px-5 py-10 text-center">
                <div className="animate-spin-cs mx-auto mb-4 h-8 w-8 rounded-full border-[3px] border-accent-soft border-t-accent" />
                <h4 className="mb-1 text-sm font-bold">Generating character sheet…</h4>
                <div className="text-xs text-muted">This usually takes 15–25 seconds.</div>
              </div>
            )}

            {phase === 'idle' && !hasSheet && (
              <div className="rounded-[14px] border-[1.5px] border-dashed border-line bg-surface2 px-5 py-7 text-center">
                <div className="mx-auto mb-[14px] flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <GridIcon />
                </div>
                <h4 className="mb-1.5 text-[14.5px] font-bold">No character sheet yet</h4>
                <p className="mx-auto mb-[18px] max-w-[420px] text-[12.5px] leading-[1.5] text-muted">
                  Generate a multi-angle character sheet from this model&apos;s references — front,
                  side, and close-up views in one consistent set. This becomes the model&apos;s
                  identity anchor for future shoots.
                </p>
                <button
                  onClick={() => generateSheet()}
                  className="inline-flex items-center gap-2 rounded-[10px] bg-accent px-6 py-3 text-[13.5px] font-bold text-white shadow-[0_6px_16px_rgba(109,59,209,.28)]"
                >
                  <GridIcon className="h-[15px] w-[15px]" /> Generate character sheet
                </button>
                <div className="mt-2.5 text-[11px] text-muted">
                  Works with as few as 2 reference images — we&apos;ll fill in the missing angles.
                </div>
              </div>
            )}

            {phase === 'idle' && hasSheet && (
              <div className="rounded-[14px] bg-surface2 p-5">
                <h4 className="mb-1 text-sm font-bold">
                  {isKept ? 'Saved ✓' : 'Character sheet ready'}
                </h4>
                <div className="mb-4 text-xs text-muted">
                  {isKept
                    ? "This character sheet is now part of the model's references."
                    : "Added to this model's references — your original images are untouched."}
                  {olderCount > 0 &&
                    ` (${olderCount} earlier version${olderCount === 1 ? '' : 's'} kept — manage them in the reference grid above.)`}
                </div>

                <CharsheetResult
                  model={model}
                  batch={activeBatch}
                  onZoom={onZoom}
                  onDeleteFrame={removeRef}
                />

                <div className="mt-4 flex gap-2.5">
                  <button
                    onClick={regenerate}
                    className="rounded-[9px] border-[1.5px] border-accent-soft bg-surface px-4 py-[9px] text-[12.5px] font-bold text-accent"
                  >
                    ↻ Regenerate
                  </button>
                  {!isKept && (
                    <button
                      onClick={keepSheet}
                      className="rounded-[9px] bg-accent px-4 py-[9px] text-[12.5px] font-bold text-white"
                    >
                      ✓ Keep these references
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}