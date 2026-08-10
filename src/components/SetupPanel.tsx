'use client';

import { useEffect, useRef, useState } from 'react';
import { ethLabel, titleCase, imgSrc } from '@/lib/client/api';
import { Field, Select } from './ui';
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
  style: 'european',
  framing: 'three_quarter',
  aspect: '4:5',
  resolution: '1K',
  backdrop: 'studio seamless',
  mood: 'clean',
  lighting: 'soft bright commercial',
};

interface Props {
  setup: SetupState;
  onSetup: (patch: Partial<SetupState>) => void;
  file: File | null;
  onFile: (f: File | null) => void;
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
  file,
  onFile,
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Object URLs must be revoked or the blob leaks for the life of the tab.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // "Extend" takes the model from the uploaded photo, so model choice is moot.
  const isExtend = setup.input_family === 'extend';
  const usingSaved = modelSource === 'saved' && !isExtend;
  const showResHint = (setup.resolution === '2K' || setup.resolution === '4K') && !usingSaved;

  function pick(f: File | undefined | null) {
    if (f) onFile(f);
  }

  return (
    <aside className="w-[336px] px-[22px] pb-[30px] pl-6 pt-[22px]">
      <div className="mb-[3px] text-[10.5px] font-bold uppercase tracking-[0.08em] text-brand">
        Step 1
      </div>
      <h2 className="mb-1 text-[17px] font-bold">Set up your shoot</h2>
      <div className="mb-[18px] text-xs leading-[1.5] text-muted">
        The front shot locks the model, lighting &amp; background. You add poses after.
      </div>

      {hasShoot && (
        <button
          onClick={onNewShoot}
          className="mb-[14px] w-full rounded-[9px] border border-line bg-surface2 p-[9px] text-[12.5px] font-bold text-ink"
        >
          + Start a new shoot
        </button>
      )}

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files?.[0]);
        }}
        className={`mb-4 cursor-pointer rounded-xl border-[1.5px] border-dashed p-[22px_14px] text-center text-[12.5px] transition ${
          dragging
            ? 'border-brand bg-brand-soft text-brand'
            : 'border-line bg-surface2 text-muted hover:border-brand hover:bg-brand-soft hover:text-brand'
        }`}
      >
        {!previewUrl && <span className="mb-1.5 block text-[22px] opacity-60">⤓</span>}
        Drop a <b className="text-ink">garment reference</b>
        <br />
        <span className="text-[11px]">flat-lay, on-model, or packshot</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Garment preview" className="mt-1 max-h-[170px] max-w-full rounded-lg" />
        )}
      </div>

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
            options={INPUT_FAMILIES}
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

      <div className="mb-[13px] flex gap-2.5">
        <div className="flex-1">
          <label className="lbl">Framing</label>
          <Select
            value={setup.framing}
            onChange={(v) => onSetup({ framing: v })}
            options={FRAMINGS}
          />
        </div>
        <div className="flex-1">
          <label className="lbl">Aspect</label>
          <Select value={setup.aspect} onChange={(v) => onSetup({ aspect: v })} options={ASPECTS} />
        </div>
      </div>

      <Field label="Resolution">
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

      {/* Full width: these option labels ("studio seamless", "soft bright
          commercial") are too long for a half-width select and get truncated. */}
      <Field label="Backdrop">
        <Select
          value={setup.backdrop}
          onChange={(v) => onSetup({ backdrop: v })}
          options={BACKDROPS}
        />
      </Field>

      <Field label="Mood">
        <Select value={setup.mood} onChange={(v) => onSetup({ mood: v })} options={MOODS} />
      </Field>

      <Field label="Lighting">
        <Select
          value={setup.lighting}
          onChange={(v) => onSetup({ lighting: v })}
          options={LIGHTINGS}
        />
      </Field>

      <button
        onClick={onGenerate}
        disabled={busy}
        className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-[11px] bg-brand p-[13px] text-[14.5px] font-bold text-white transition hover:-translate-y-px hover:shadow-[0_10px_26px_rgba(225,29,42,.3)] disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
      >
        {busy ? 'Generating…' : `Generate Hero image`}
      </button>

      <div className="mt-2.5 text-[11px] leading-[1.5] text-muted">
        Locks the model on this first shot, so every later pose is the same person.
      </div>
    </aside>
  );
}