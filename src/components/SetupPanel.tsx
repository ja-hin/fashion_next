'use client';

import { ethLabel, titleCase, imgSrc } from '@/lib/client/api';
import { Field, Select } from './ui';
import EnsembleUploader from './EnsembleUploader';
import type { EnsembleRef } from '@/lib/client/ensemble-types';
import {
  CATEGORIES,
  INPUT_FAMILIES,
  ETHNICITIES,
  FRAMINGS,
  ASPECTS,
  RESOLUTIONS,
  BACKDROPS,
  MOODS,
  LIGHTINGS,
} from '@/lib/client/constants';
import type { SavedModel } from '@/lib/client/types';

export interface SetupState {
  category: string;
  input_family: string;
  /** Several angles of one garment, or several different items. */
  ref_mode: 'same_garment' | 'ensemble';
  style: string;
  framing: string;
  aspect: string;
  resolution: string;
  backdrop: string;
  mood: string;
  lighting: string;
}

export const DEFAULT_SETUP: SetupState = {
  category: 'womenswear',
  input_family: 'garment_in',
  ref_mode: 'same_garment',
  style: 'european',
  framing: 'full_body',
  aspect: '4:5',
  resolution: '1K',
  backdrop: 'studio seamless',
  mood: 'clean',
  lighting: 'soft bright commercial',
};

interface Props {
  setup: SetupState;
  onSetup: (patch: Partial<SetupState>) => void;
  /** Tagged references for both modes, in upload order. */
  ensemble: EnsembleRef[];
  /** Files dropped on the panel — the page opens the tagging window for them. */
  onEnsembleAdd: (files: File[]) => void;
  /** Reopen the tagging window for what is already there. */
  onEnsembleOpen: () => void;
  /** Keep the tagged references as a reusable garment. */
  onSaveGarment: () => void;
  /** Open the library and start from something already tagged. */
  onPickGarment: () => void;
  modelSource: 'imagine' | 'saved';
  onModelSource: (s: 'imagine' | 'saved') => void;
  selectedModel: SavedModel | null;
  onOpenPicker: () => void;
  noModelError: boolean;
  heroCost: number;
  busy: boolean;
  onGenerate: () => void;
  hasShoot: boolean;
  onNewShoot: () => void;
}

/**
 * Step 1 — the shoot setup panel.
 *
 * The front shot generated from here locks the model, lighting and background
 * for every pose that follows, which is why the whole panel is one form.
 */
export default function SetupPanel({
  setup,
  onSetup,
  ensemble,
  onEnsembleAdd,
  onEnsembleOpen,
  onSaveGarment,
  onPickGarment,
  modelSource,
  onModelSource,
  selectedModel,
  onOpenPicker,
  noModelError,
  heroCost,
  busy,
  onGenerate,
  hasShoot,
  onNewShoot,
}: Props) {
  // "Extend" takes the model from the uploaded photo, so model choice is moot.
  const isExtend = setup.input_family === 'extend';
  const usingSaved = modelSource === 'saved' && !isExtend;
  const showResHint = (setup.resolution === '2K' || setup.resolution === '4K') && !usingSaved;

  const isEnsemble = setup.ref_mode === 'ensemble';

  return (
    <aside className="w-[336px] px-[22px] pb-[30px] pl-6 pt-[22px]">
      {/* <div className="mb-[3px] text-[10.5px] font-bold uppercase tracking-[0.08em] text-brand">
        Step 1
      </div>
      <h2 className="mb-1 text-[17px] font-bold">Set up your shoot</h2>
      <div className="mb-[18px] text-xs leading-[1.5] text-muted">
        The front shot locks the model, lighting &amp; background. You add poses after.
      </div> */}

      {hasShoot && (
        <button
          onClick={onNewShoot}
          className="mb-[14px] w-full rounded-[9px] border border-line bg-surface2 p-[9px] text-[12.5px] font-bold text-ink"
        >
          + Start a new shoot
        </button>
      )}

      {/* Both modes send several tagged references; only the question changes —
          which VIEW of one garment, or which ITEM of a look. The single-photo
          dropzone is gone: one photo is just a same-garment shoot with one
          front image, and it goes through the same path. */}
      <div className="mb-3 flex gap-1 rounded-[10px] bg-surface2 p-1">
        {(
          [
            ['same_garment', 'Same garment'],
            ['ensemble', 'Ensemble'],
          ] as const
        ).map(([value, label]) => {
          const on = setup.ref_mode === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() =>
                onSetup({
                  ref_mode: value,
                  // "Extend" means the uploaded photo IS already the hero, which
                  // cannot be true of several separate product shots. Move off it
                  // rather than leaving a combination that silently skips assembly.
                  ...(value === 'ensemble' && isExtend ? { input_family: 'garment_in' } : {}),
                })
              }
              className={`flex-1 rounded-[7px] px-2 py-[7px] text-[12px] font-bold transition ${
                on ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <EnsembleUploader
        mode={isEnsemble ? 'ensemble' : 'same_garment'}
        refs={ensemble}
        onAdd={onEnsembleAdd}
        onOpen={onEnsembleOpen}
        onPickSaved={onPickGarment}
      />

      {ensemble.length > 0 && (
        <button
          onClick={onSaveGarment}
          className="mb-4 -mt-2 w-full rounded-[9px] border border-line bg-surface2 p-[8px] text-[11.5px] font-bold text-ink hover:border-accent hover:text-accent"
        >
          ♡ Save to My Garments
        </button>
      )}

      <div className="mb-[13px] flex gap-2.5">
        <div className="flex-1">
          <label className="lbl">Category</label>
          <Select
            value={setup.category}
            onChange={(v) => onSetup({ category: v })}
            options={CATEGORIES}
          />
        </div>
        <div className="flex-1">
          <label className="lbl">Input</label>
          <Select
            value={setup.input_family}
            onChange={(v) => onSetup({ input_family: v })}
            // An ensemble has no single photo that already shows the model, so
            // "Extend" is not offered there — the rest apply to both modes.
            options={
              isEnsemble ? INPUT_FAMILIES.filter(([v]) => v !== 'extend') : INPUT_FAMILIES
            }
          />
        </div>
      </div>

      <Field label="Model" dim={isExtend}>
        {!isExtend && (
          <div className="mb-2.5 flex gap-1.5 rounded-[10px] bg-surface2 p-1">
            {(['imagine', 'saved'] as const).map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => onModelSource(src)}
                className={`flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-[11.5px] font-bold transition-colors ${
                  modelSource === src
                    ? 'bg-surface text-accent shadow-[0_2px_6px_rgba(0,0,0,.08)]'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {src === 'imagine' ? '✨ Imagine' : '★ Saved model'}
              </button>
            ))}
          </div>
        )}

        {(modelSource === 'imagine' || isExtend) && (
          <Select
            value={setup.style}
            onChange={(v) => onSetup({ style: v })}
            options={ETHNICITIES}
            disabled={isExtend}
          />
        )}

        {isExtend && (
          <div className="mt-[5px] text-[10.5px] leading-[1.4] text-muted">
            Model comes from your uploaded photo in Extend mode.
          </div>
        )}

        {usingSaved && !selectedModel && (
          <button
            type="button"
            onClick={onOpenPicker}
            className="mt-2 flex w-full items-center justify-center gap-[7px] rounded-[10px] border-[1.5px] border-dashed border-accent-soft bg-accent-soft p-[11px] text-[12.5px] font-bold text-accent"
          >
            + Choose a saved model
          </button>
        )}

        {usingSaved && selectedModel && (
          <div className="mt-2 flex items-center gap-2.5 rounded-[10px] border-[1.5px] border-accent-soft bg-accent-soft p-[8px_10px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc(selectedModel.thumb, 'thumb')}
              alt=""
              className="h-[38px] w-[38px] flex-shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-bold">{selectedModel.name}</div>
              <div className="text-[10.5px] text-muted">
                {ethLabel(selectedModel.tags.ethnicity)} · {titleCase(selectedModel.tags.gender ?? '')}
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenPicker}
              className="text-[11px] font-bold text-accent"
            >
              Change
            </button>
          </div>
        )}

        {noModelError && (
          <div className="mt-2 rounded-lg bg-brand-soft px-2.5 py-[7px] text-[11px] font-semibold text-brand">
            Please choose a saved model, or switch to &quot;Imagine a model,&quot; before generating.
          </div>
        )}
      </Field>

      {/* One grid for all six selects so every control is the same width and
          the columns line up across rows. min-w-0 keeps a long option label
          from stretching its column. */}
      <div className="mb-[13px] grid grid-cols-2 items-start gap-x-2.5 gap-y-[13px] relative">
        <Field label="Resolution" className="mb-0 min-w-0" float>
          <Select
            value={setup.resolution}
            onChange={(v) => onSetup({ resolution: v })}
            options={RESOLUTIONS}
          />
          {showResHint && (
            <div className="mt-1.5 text-[11px] font-semibold text-muted">
              2K / 4K render on the higher-quality flash-image model.
            </div>
          )}
        </Field>

        <Field label="Aspect" className="mb-0 min-w-0" float>
          <Select value={setup.aspect} onChange={(v) => onSetup({ aspect: v })} options={ASPECTS} />
        </Field>

        <Field label="Framing" className="mb-0 min-w-0" float>
          <Select
            value={setup.framing}
            onChange={(v) => onSetup({ framing: v })}
            options={FRAMINGS}
          />
        </Field>

        <Field label="Backdrop" className="mb-0 min-w-0" float>
          <Select
            value={setup.backdrop}
            onChange={(v) => onSetup({ backdrop: v })}
            options={BACKDROPS}
          />
        </Field>

        <Field label="Mood" className="mb-0 min-w-0" float>
          <Select value={setup.mood} onChange={(v) => onSetup({ mood: v })} options={MOODS} />
        </Field>

        <Field label="Lighting" className="mb-0 min-w-0" float>
          <Select
            value={setup.lighting}
            onChange={(v) => onSetup({ lighting: v })}
            options={LIGHTINGS}
          />
        </Field>
      </div>

      <button
        onClick={onGenerate}
        disabled={busy}
        className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-[11px] bg-brand p-[13px] text-[14.5px] font-bold text-white transition hover:-translate-y-px hover:shadow-[0_10px_26px_rgba(225,29,42,.3)] disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
      >
        {busy
          ? 'Generating…'
          : ensemble.length
            ? `Generate Hero from ${ensemble.length} image${ensemble.length === 1 ? '' : 's'}`
            : 'Generate Hero image'}
        {/* The hero is one image whatever the reference count, so the quote is
            the single-image rate for the chosen resolution × model source. */}
        {!busy && heroCost > 0 && ` · ${heroCost} credit${heroCost === 1 ? '' : 's'}`}
      </button>

      {/* <div className="mt-2.5 text-[11px] leading-[1.5] text-muted">
        {isEnsemble
          ? 'Assembles every item onto one model and locks that model, so each later pose keeps the whole look.'
          : 'Each photo is the truth for the side it shows, so the back is never invented. Locks the model too.'}
      </div> */}
    </aside>
  );
}