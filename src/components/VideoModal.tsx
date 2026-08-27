'use client';

import { useEffect, useRef, useState } from 'react';
import { imgSrc, ApiError } from '@/lib/client/api';
import { useDialog } from './Dialog';
import { GenieIcon } from './icons';
import {
  VIDEO_PRESETS,
  VIDEO_ASPECTS,
  CUSTOM_KEY,
  CUSTOM_SKELETON,
  type VideoBrief,
} from '@/lib/video-presets';
import type { VideoItem } from '@/lib/client/types';

/** More references sharpen the identity lock; past a handful they just cost. */
const MAX_FRAMES = 4;

interface Props {
  /**
   * The shoot to build from, or null when starting from uploads.
   *
   * With a shoot the references are stills that already show the model in the
   * garment, so the video keeps that person. From uploads there is no person
   * yet, so the guarantee is the garment and the model is invented — the server
   * swaps the lock accordingly. Same modal, because the choices are identical.
   */
  pid: string | null;
  /**
   * The shoot's finished frames. Empty when starting from uploads.
   *
   * Deliberately a plain shape rather than the results grid's CardItem: the
   * gallery's folder lists images in a different type, and the picker only ever
   * needs a filename, a thumbnail and a label from either of them.
   */
  frames: Array<{ file: string; url: string; label: string }>;
  /** Uploaded garment photos, when there is no shoot yet. */
  uploads?: File[];
  price: number;
  onClose: () => void;
  onBalance: (b: number) => void;
  /** Hand the finished clip to the results grid so it appears without a reload. */
  onCreated: (v: VideoItem) => void;
}

type Phase = 'setup' | 'working' | 'done';

/**
 * Turn a shoot into a 10-second video.
 *
 * The frames a customer picks here are the reference lock: the video keeps the
 * face and the garment from stills they have already approved, rather than
 * inventing a model of its own. That is why this opens from inside a shoot and
 * offers no upload — an unrelated photo has nothing to stay consistent with.
 */
export default function VideoModal({
  pid,
  frames,
  uploads = [],
  price,
  onClose,
  onBalance,
  onCreated,
}: Props) {
  const dialog = useDialog();

  // One list either way: a shoot frame is keyed by its filename, an upload by
  // its index, so the picker below does not care which it is looking at.
  const fromShoot = !!pid;
  const sources = fromShoot
    ? frames.map((f) => ({ key: f.file, thumb: imgSrc(f.url, 'thumb'), label: f.label }))
    : uploads.map((f, i) => ({ key: String(i), thumb: URL.createObjectURL(f), label: f.name }));
  const [picked, setPicked] = useState<string[]>(() =>
    sources.slice(0, fromShoot ? 1 : Math.min(sources.length, MAX_FRAMES)).map((x) => x.key),
  );
  const [presetKey, setPresetKey] = useState('studio_pdp');
  const [aspect, setAspect] = useState('9:16');
  const [instruction, setInstruction] = useState('');
  const [brief, setBrief] = useState<VideoBrief>(VIDEO_PRESETS.studio_pdp.brief);
  const [gist, setGist] = useState(VIDEO_PRESETS.studio_pdp.gist);
  const [tuning, setTuning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [ref, setRef] = useState<File | null>(null);
  /** Custom mode only: whether the description has been turned into a brief. */
  const [authored, setAuthored] = useState(false);
  const [phase, setPhase] = useState<Phase>('setup');
  const [result, setResult] = useState<{ url: string; seconds: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Only while idle: closing mid-generation would abandon a paid call.
      if (e.key === 'Escape' && phase !== 'working') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, phase]);

  /** Changing preset discards any tuning — the brief it edited is gone. */
  function pickPreset(key: string) {
    setPresetKey(key);
    setInstruction('');
    setAuthored(false);
    clearRef();
    if (key === CUSTOM_KEY) {
      setBrief(CUSTOM_SKELETON);
      setGist('Describe the video you want, then press Write it.');
      return;
    }
    setBrief(VIDEO_PRESETS[key].brief);
    setGist(VIDEO_PRESETS[key].gist);
  }

  function toggleFrame(file: string) {
    setPicked((cur) =>
      cur.includes(file)
        ? cur.filter((f) => f !== file)
        : cur.length >= MAX_FRAMES
          ? cur
          : [...cur, file],
    );
  }

  function clearRef() {
    setRef(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function tune() {
    const text = instruction.trim();
    // A photo on its own is a complete request — "make it look like this".
    if ((!text && !ref) || tuning) return;
    setTuning(true);
    try {
      // FormData rather than JSON so the reference photo can ride along. The
      // brief goes as a JSON string field; the server parses it back.
      const fd = new FormData();
      fd.append('preset', presetKey);
      fd.append('instruction', text);
      fd.append('brief', JSON.stringify(brief));
      if (ref) fd.append('image', ref);

      const res = await fetch('/api/video/customize', { method: 'POST', body: fd });
      const j = (await res.json()) as { brief?: VideoBrief; gist?: string; detail?: string };
      if (!res.ok) throw new Error(j.detail ?? 'Genie could not be reached');
      if (j.brief) setBrief(j.brief);
      if (j.gist) setGist(j.gist);
      if (custom) setAuthored(true);
      // The photo has been read into the brief — keeping it staged would send
      // it again on the next tweak and re-describe a scene already written in.
      clearRef();
    } catch (e) {
      // The brief simply stays as it was — nothing was charged for trying.
      await dialog.alert(e instanceof Error ? e.message : 'Could not reach Genie just now.');
    } finally {
      setTuning(false);
    }
  }

  async function generate() {
    if (!ready) return;
    setPhase('working');
    try {
      let res: Response;
      if (fromShoot) {
        // The frames are already on the server — sending filenames rather than
        // bytes keeps a caller from billing arbitrary images to this shoot.
        res = await fetch('/api/video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pid,
            files: picked,
            preset: presetKey,
            aspect,
            brief,
            gist,
            custom: instruction.trim(),
          }),
        });
      } else {
        // Nothing on the server yet, so the bytes go up with the request. The
        // route creates the shoot around the finished video.
        const fd = new FormData();
        picked.forEach((k) => fd.append('refs', uploads[Number(k)]));
        fd.append('preset', presetKey);
        fd.append('aspect', aspect);
        fd.append('brief', JSON.stringify(brief));
        res = await fetch('/api/video/direct', { method: 'POST', body: fd });
      }

      const j = await res.json();
      if (!res.ok) throw new ApiError(res.status, j?.detail ?? 'Video generation failed');
      setResult({ url: j.url, seconds: j.seconds });
      onCreated({
        file: j.file,
        url: j.url,
        preset: custom ? 'Custom' : VIDEO_PRESETS[presetKey].label,
        aspect: j.aspect,
        created: new Date().toISOString(),
      });
      if (typeof j.balance === 'number') onBalance(j.balance);
      setPhase('done');
    } catch (e) {
      setPhase('setup');
      await dialog.alert(e instanceof ApiError ? e.message : 'Video generation failed.');
    }
  }

  const custom = presetKey === CUSTOM_KEY;
  const vertical = aspect === '9:16';
  // In custom mode there is no shot list until the Genie has written one, so
  // generating first would spend 35 credits on the empty skeleton.
  const ready = picked.length > 0 && (!custom || authored);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-[26px]"
      onClick={() => phase !== 'working' && onClose()}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-[900px] flex-col overflow-hidden rounded-2xl bg-surface shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-line px-[22px] py-4">
          <h2 className="text-[17px] font-bold">Generate video</h2>
          <span className="rounded-[20px] bg-surface2 px-2.5 py-1 text-[11px] font-semibold text-muted">
            10 seconds · {price} credit{price === 1 ? '' : 's'}
          </span>
          <button
            onClick={onClose}
            disabled={phase === 'working'}
            aria-label="Close"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-surface2 text-[15px] disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-[22px] py-5">
          {phase === 'done' && result ? (
            <div className="flex flex-col items-center gap-4">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                src={result.url}
                controls
                autoPlay
                loop
                playsInline
                className={`rounded-xl bg-black ${vertical ? 'max-h-[54vh]' : 'w-full max-w-[640px]'}`}
              />
              <div className="text-[12px] text-muted">
                {custom ? 'Custom' : VIDEO_PRESETS[presetKey].label} · {aspect} · generated in{' '}
                {result.seconds}s
              </div>
              <div className="flex gap-2.5">
                <a
                  href={result.url}
                  download
                  className="rounded-[10px] bg-ink px-4 py-2.5 text-[13px] font-bold text-surface"
                >
                  Download
                </a>
                <button
                  onClick={() => {
                    setResult(null);
                    setPhase('setup');
                  }}
                  className="rounded-[10px] border border-line px-4 py-2.5 text-[13px] font-bold"
                >
                  Make another
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ── 1 · frames ── */}
              <div className="mb-5">
                <div className="mb-2 flex items-center gap-2">
                  <span className="lbl mb-0">
                    {fromShoot ? 'Frames that lock the look' : 'Garment photos'}
                  </span>
                  <span className="text-[11px] text-muted">
                    {picked.length}/{MAX_FRAMES} ·{' '}
                    {fromShoot
                      ? 'the model & garment come from these'
                      : 'the garment is locked to these; the model is generated'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sources.map((src) => {
                    const on = picked.includes(src.key);
                    const full = !on && picked.length >= MAX_FRAMES;
                    return (
                      <button
                        key={src.key}
                        type="button"
                        onClick={() => toggleFrame(src.key)}
                        disabled={full}
                        title={full ? `Pick at most ${MAX_FRAMES}` : src.label}
                        className={`relative h-[86px] w-[68px] overflow-hidden rounded-[9px] border-2 transition ${
                          on ? 'border-accent' : 'border-transparent opacity-60 hover:opacity-100'
                        } ${full ? 'cursor-not-allowed' : ''}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src.thumb} alt="" className="h-full w-full object-cover object-top" />
                        {on && (
                          <span className="absolute right-1 top-1 flex h-[17px] w-[17px] items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                            {picked.indexOf(src.key) + 1}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── 2 · format ── */}
              <div className="mb-5">
                <span className="lbl">Format</span>
                <div className="flex gap-1.5 rounded-[10px] bg-surface2 p-1">
                  {VIDEO_ASPECTS.map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setAspect(v)}
                      className={`flex-1 rounded-lg px-2 py-2 text-[12px] font-bold transition-colors ${
                        aspect === v
                          ? 'bg-surface text-accent shadow-[0_2px_6px_rgba(0,0,0,.08)]'
                          : 'text-muted hover:text-ink'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── 3 · type ── */}
              <div className="mb-5">
                <span className="lbl">Video type</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {Object.entries(VIDEO_PRESETS).map(([key, p]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => pickPreset(key)}
                      className={`rounded-[11px] border p-2.5 text-left transition ${
                        presetKey === key
                          ? 'border-accent bg-accent-soft'
                          : 'border-line hover:border-ink'
                      }`}
                    >
                      <div className="text-[12.5px] font-bold">{p.label}</div>
                      <div className="mt-0.5 text-[10.5px] leading-[1.35] text-muted">
                        {p.desc}
                      </div>
                    </button>
                  ))}

                  {/* Last, and dashed: the twelve above are the safe paths, and
                      this one only becomes a real brief once the Genie has
                      written it from your description. */}
                  <button
                    type="button"
                    onClick={() => pickPreset(CUSTOM_KEY)}
                    className={`rounded-[11px] border border-dashed p-2.5 text-left transition ${
                      custom ? 'border-accent bg-accent-soft' : 'border-line hover:border-ink'
                    }`}
                  >
                    <div className="text-[12.5px] font-bold">✎ Describe your own</div>
                    <div className="mt-0.5 text-[10.5px] leading-[1.35] text-muted">
                      Any scene, mood and music — written for you
                    </div>
                  </button>
                </div>
              </div>

              {/* ── 4 · Genie ── */}
              {/* Genie by name and by face, the same as on the results grid —
                  it is the same job (say it plainly, get direction back), so it
                  should not look like a different tool here. */}
              <div className="mb-5 rounded-[13px] border border-line bg-surface2 p-3">
                <div className="mb-2.5 flex items-start gap-2.5">
                  <GenieIcon className="mt-[1px] h-7 w-7 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold">Genie · video director</div>
                    <div className="text-[10.5px] leading-[1.5] text-muted">
                      {custom
                        ? 'Describe the film you want — Genie writes the shots, camera and music.'
                        : 'Change the scene, mood, pace or music. Your model and garment stay locked.'}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    value={instruction}
                    onChange={(e) => {
                      setInstruction(e.target.value);
                      // Editing the description invalidates the brief written
                      // from the old one — generating now would shoot the
                      // previous scene.
                      if (custom) setAuthored(false);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && tune()}
                    placeholder={
                      custom
                        ? 'e.g. monsoon-soaked Mumbai street at night, neon reflections, one slow-motion turn'
                        : 'e.g. shoot it at sunset on a rooftop, slower pace'
                    }
                    className="flex-1"
                  />
                  {/* A photo of a place is often easier to hand over than to
                      describe. It never reaches the video model — Genie reads
                      it into the brief as set and lighting notes, which is what
                      keeps the identity lock honest. */}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    title="Attach a photo of the look or location to match"
                    className={`flex-shrink-0 rounded-[10px] border px-3 text-[13px] font-bold transition ${
                      ref ? 'border-accent bg-accent-soft text-accent' : 'border-line'
                    }`}
                  >
                    ⛰
                  </button>
                  <button
                    type="button"
                    onClick={tune}
                    disabled={(!instruction.trim() && !ref) || tuning}
                    className="flex-shrink-0 rounded-[10px] bg-accent px-3.5 text-[12.5px] font-bold text-white transition hover:brightness-110 disabled:opacity-40"
                  >
                    {tuning ? 'Thinking…' : custom ? 'Write it' : 'Ask Genie'}
                  </button>
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => setRef(e.target.files?.[0] ?? null)}
                />

                {ref && (
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={URL.createObjectURL(ref)}
                      alt=""
                      className="h-9 w-9 rounded-md object-cover"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      Matching the look of <b>{ref.name}</b>
                    </span>
                    <button onClick={clearRef} className="font-bold text-muted hover:text-ink">
                      ✕
                    </button>
                  </div>
                )}

                {/* The gist is the only part of the brief a customer reads —
                    the JSON behind it is the model's business, not theirs. */}
                <div className="mt-2.5 rounded-[10px] bg-accent-soft p-[10px_12px] text-[12px] leading-[1.5] text-accent">
                  {gist}
                </div>
              </div>
            </>
          )}
        </div>

        {phase !== 'done' && (
          <div className="flex flex-shrink-0 items-center gap-3 border-t border-line px-[22px] py-4">
            <div className="text-[11.5px] leading-[1.4] text-muted">
              {phase === 'working'
                ? 'Generating — this takes about a minute. Keep this window open.'
                : custom && !authored
                  ? 'Describe the video and press “Write it” first'
                  : `${price} credits · charged only if the video comes back`}
            </div>
            <button
              onClick={generate}
              disabled={phase === 'working' || !ready}
              className="ml-auto flex-shrink-0 rounded-[11px] bg-brand px-5 py-3 text-[13.5px] font-bold text-white transition hover:-translate-y-px disabled:translate-y-0 disabled:opacity-50"
            >
              {phase === 'working' ? 'Generating…' : `Generate video · ${price}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
