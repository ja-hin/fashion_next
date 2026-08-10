'use client';

import { useEffect, useMemo, useState } from 'react';
import { getJson, postForm, ethLabel, titleCase, fmt, ApiError, imgSrc } from '@/lib/client/api';
import { GENDER_BY_CAT } from '@/lib/client/constants';
import { useDialog } from './Dialog';
import { AlertIcon, SearchIcon } from './icons';
import CharsheetResult from './CharsheetResult';
import type { SavedModel, CharsheetPromptInfo } from '@/lib/client/types';

interface Props {
  category: string;
  current: SavedModel | null;
  onConfirm: (m: SavedModel) => void;
  onClose: () => void;
  onBalance: (b: number) => void;
}

type Phase = 'browse' | 'generating' | 'result';

/**
 * "Choose a saved model" — browse, filter, and (if the model has no character
 * sheet yet) generate one inline without leaving the flow.
 */
export default function ModelPickerModal({
  category,
  current,
  onConfirm,
  onClose,
  onBalance,
}: Props) {
  const dialog = useDialog();
  const [models, setModels] = useState<SavedModel[]>([]);
  const [pending, setPending] = useState<string | null>(current?.id ?? null);
  const [phase, setPhase] = useState<Phase>('browse');
  const [csModel, setCsModel] = useState<SavedModel | null>(null);
  const [csBatch, setCsBatch] = useState<string | null>(null);

  const expectedGender = GENDER_BY_CAT[category] ?? '';
  const [fGender, setFGender] = useState(expectedGender);
  const [fEth, setFEth] = useState('');
  const [fSearch, setFSearch] = useState('');

  useEffect(() => {
    getJson<{ models: SavedModel[] }>('/api/models')
      .then((j) => setModels(j.models ?? []))
      .catch(() => setModels([]));
  }, []);

  const ethOptions = useMemo(
    () => [...new Set(models.map((m) => m.tags?.ethnicity).filter(Boolean))].sort() as string[],
    [models],
  );

  const filtered = useMemo(
    () =>
      models.filter((m) => {
        const t = m.tags ?? {};
        if (fGender && (t.gender ?? '').toLowerCase() !== fGender) return false;
        if (fEth && t.ethnicity !== fEth) return false;
        if (fSearch && !(m.name ?? '').toLowerCase().includes(fSearch.toLowerCase())) return false;
        return true;
      }),
    [models, fGender, fEth, fSearch],
  );

  const pendingModel = models.find((m) => m.id === pending) ?? null;
  const needsSheet = !!pendingModel && !pendingModel.has_character_sheet;
  const genderMismatch =
    !!pendingModel &&
    pendingModel.has_character_sheet &&
    !!expectedGender &&
    (pendingModel.tags?.gender ?? '').toLowerCase() !== expectedGender;

  async function startCharsheet() {
    if (!pendingModel) return;
    let info: CharsheetPromptInfo;
    try {
      info = await getJson<CharsheetPromptInfo>(`/api/models/${pendingModel.id}/charsheet/prompt`);
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
      { title: 'Generate character sheet', okLabel: `Generate ${fmt(info.cost)} credits`, danger: false },
    );
    if (!ok) return;

    setPhase('generating');
    try {
      const j = await postForm<{ model: SavedModel; balance: number; batch: string }>(
        `/api/models/${pendingModel.id}/charsheet`,
      );
      if (typeof j.balance === 'number') onBalance(j.balance);
      setModels((prev) => prev.map((m) => (m.id === j.model.id ? j.model : m)));
      setCsModel(j.model);
      setCsBatch(j.batch);
      setPhase('result');
    } catch (e) {
      await dialog.alert(
        e instanceof ApiError ? e.message : 'Character sheet generation failed.',
      );
      setPhase('browse');
    }
  }

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-[30px]"
      onClick={onClose}
    >
      <div
        className="max-h-[86vh] w-full max-w-[980px] overflow-auto rounded-2xl bg-surface p-6 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-[18px] flex items-center gap-3">
          <h3 className="text-[18px] font-bold">Choose a saved model</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-surface2 text-base"
          >
            ×
          </button>
        </div>

        {phase === 'browse' && (
          <>
            <div className="mb-[14px] text-xs leading-[1.5] text-muted">
              This model&apos;s identity anchors the shoot. Backdrop, lighting, mood and the garment
              still apply normally on top.
            </div>

            <div className="mb-[14px] flex flex-wrap gap-2">
              <select
                value={fGender}
                onChange={(e) => setFGender(e.target.value)}
                className="w-auto px-2.5 py-2 text-xs"
              >
                <option value="">Any gender</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="child">Child</option>
              </select>
              <select
                value={fEth}
                onChange={(e) => setFEth(e.target.value)}
                className="w-auto px-2.5 py-2 text-xs"
              >
                <option value="">Any ethnicity</option>
                {ethOptions.map((e) => (
                  <option key={e} value={e}>
                    {ethLabel(e)}
                  </option>
                ))}
              </select>
              <div className="relative min-w-[140px] flex-1">
                <span className="absolute left-[9px] top-1/2 -translate-y-1/2 text-muted">
                  <SearchIcon />
                </span>
                <input
                  value={fSearch}
                  onChange={(e) => setFSearch(e.target.value)}
                  placeholder="Search by name…"
                  className="py-2 pl-[30px] pr-2.5 text-xs"
                />
              </div>
            </div>

            {expectedGender && (
              <div className="-mt-1.5 mb-3 text-[10.5px] font-semibold text-accent">
                Pre-filtered to <b>{titleCase(expectedGender)}</b> based on your{' '}
                {titleCase(category)} category — change anytime.
              </div>
            )}

            <div className="mb-1.5 grid min-h-[100px] grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
              {filtered.length === 0 && (
                <div className="col-span-full px-2.5 py-[30px] text-center text-[12.5px] text-muted">
                  No saved models match these filters.
                </div>
              )}
              {filtered.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPending(m.id)}
                  className={`relative overflow-hidden rounded-[10px] border-2 bg-surface2 text-left ${
                    pending === m.id ? 'border-accent' : 'border-line hover:border-accent-soft'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgSrc(m.thumb, 'thumb')}
                    alt=""
                    className="block aspect-[3/4] w-full bg-line object-cover"
                  />
                  <span
                    className={`absolute right-1.5 top-1.5 rounded px-[5px] py-0.5 text-[7.5px] font-extrabold text-white ${
                      m.has_character_sheet ? 'bg-accent' : 'bg-muted'
                    }`}
                  >
                    {m.has_character_sheet ? 'CHAR SHEET' : 'NO SHEET'}
                  </span>
                  <div className="truncate px-[7px] pt-1.5 text-[11px] font-bold">{m.name}</div>
                  <div className="truncate px-[7px] pb-1.5 text-[9.5px] text-muted">
                    {ethLabel(m.tags?.ethnicity)} · {titleCase(m.tags?.gender ?? '')}
                  </div>
                </button>
              ))}
            </div>

            {genderMismatch && (
              <div className="mt-2 rounded-[9px] bg-amber-soft px-3 py-[9px] text-[11.5px] font-semibold text-amber">
                ⚠ This model is tagged <b>{titleCase(pendingModel!.tags?.gender ?? '')}</b>, but
                you&apos;ve selected <b>{titleCase(category)}</b>. You can proceed, but double check
                this is intentional.
              </div>
            )}

            {needsSheet && (
              <div className="mt-2 rounded-xl border-[1.5px] border-dashed border-line bg-surface2 p-[18px] text-center">
                <div className="mx-auto mb-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-amber-soft text-amber">
                  <AlertIcon />
                </div>
                <h4 className="mb-1.5 text-[13px] font-bold">No character sheet yet</h4>
                <p className="mb-3 text-[11.5px] leading-[1.5] text-muted">
                  This model needs a character sheet before it can anchor a new shoot — it keeps the
                  same face and body consistent across every pose.
                </p>
                <button
                  onClick={startCharsheet}
                  className="rounded-[9px] bg-accent px-4 py-2 text-[11.5px] font-bold text-white"
                >
                  Generate character sheet
                </button>
              </div>
            )}

            <div className="mt-[22px] flex items-center gap-3 border-t border-line pt-[18px]">
              <button onClick={onClose} className="text-[13px] font-bold text-muted">
                Cancel
              </button>
              <button
                disabled={!pendingModel || needsSheet}
                onClick={() => pendingModel && onConfirm(pendingModel)}
                className="ml-auto inline-flex items-center gap-2 rounded-[10px] bg-accent px-[22px] py-[11px] text-[13.5px] font-bold text-white shadow-[0_6px_16px_rgba(109,59,209,.32)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                Use this model
              </button>
            </div>
          </>
        )}

        {phase === 'generating' && (
          <div className="rounded-[14px] bg-surface2 px-5 py-10 text-center">
            <div className="animate-spin-cs mx-auto mb-4 h-8 w-8 rounded-full border-[3px] border-accent-soft border-t-accent" />
            <h4 className="mb-1 text-sm font-bold">Generating character sheet…</h4>
            <div className="text-xs text-muted">This usually takes 15–25 seconds.</div>
          </div>
        )}

        {phase === 'result' && csModel && (
          <div className="rounded-[14px] bg-surface2 p-5">
            <h4 className="mb-1 text-sm font-bold">Character sheet ready</h4>
            <div className="mb-4 text-xs text-muted">Added to this model&apos;s references.</div>
            <CharsheetResult model={csModel} batch={csBatch} />
            <div className="mt-4 flex gap-2.5">
              <button
                onClick={() => {
                  setPhase('browse');
                  if (csModel) setPending(csModel.id);
                }}
                className="rounded-[9px] bg-accent px-4 py-[9px] text-[12.5px] font-bold text-white"
              >
                ✓ Continue with this model
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}