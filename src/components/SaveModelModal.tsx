'use client';

import { useEffect, useState } from 'react';
import { getJson, postMultipart, ethLabel, ApiError, imgSrc } from '@/lib/client/api';
import { SaveIcon } from './icons';
import { useDialog } from './Dialog';
import type { ResumePayload, SavedModel } from '@/lib/client/types';

/**
 * "Save as model" — pick the shots that best show this person.
 *
 * The chosen images are copied server-side into the model's own reference set,
 * so the model survives deletion of this shoot.
 */
export default function SaveModelModal({
  pid,
  onClose,
  onSaved,
}: {
  pid: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useDialog();
  const [data, setData] = useState<ResumePayload | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [warn, setWarn] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const j = await getJson<ResumePayload>(`/api/product/${pid}/resume`);
        if (cancelled) return;
        if (!j.images?.length) {
          await dialog.alert('This shoot has no images to save.');
          onClose();
          return;
        }
        setData(j);
        // The hero is pre-selected: it's the shot that defined the model.
        setSelected(new Set(j.images.filter((im) => im.is_hero).map((im) => im.file)));
        setName(/^S\d+$/.test(j.title) ? '' : j.title);
      } catch {
        if (!cancelled) {
          await dialog.alert('Could not load this shoot.');
          onClose();
        }
      }

      try {
        const w = await getJson<{ model: SavedModel | null }>(`/api/models/by-shoot/${pid}`);
        if (!cancelled && w.model) {
          setWarn(
            `Already saved as "${w.model.name}" from this shoot. You can save again with a ` +
              `different name, or open that model to manage it.`,
          );
        }
      } catch {
        // A missing duplicate-check just means no warning is shown.
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid]);

  function toggle(file: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  }

  async function submit() {
    if (!selected.size || busy) return;
    setBusy(true);
    setErr('');

    const fd = new FormData();
    fd.append('pid', pid);
    fd.append('files', JSON.stringify([...selected]));
    fd.append('name', name.trim());
    fd.append('ethnicity', data?.style ?? '');

    try {
      await postMultipart('/api/models/save', fd);
      onSaved();
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setErr(e.message);
      else await dialog.alert(e instanceof ApiError ? e.message : 'Could not save the model.');
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-[30px]"
      onClick={onClose}
    >
      <div
        className="max-h-[86vh] w-full max-w-[760px] overflow-auto rounded-2xl bg-surface p-6 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-[18px] flex items-center gap-3">
          <h3 className="text-[18px] font-bold">Save as model</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-surface2 text-base"
          >
            ×
          </button>
        </div>

        <div className="mb-4 text-[12.5px] leading-[1.5] text-muted">
          Pick the shots that best show this model — face, body, a couple of angles. They&apos;re{' '}
          <b>copied</b> into the model&apos;s own reference set, so the model stays even if you later
          delete this shoot.
        </div>

        <div className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.05em] text-muted">
          From this shoot — tap to add / remove
        </div>

        <div className="mb-5 flex flex-wrap gap-[11px]">
          {data?.images.map((im) => {
            const sel = selected.has(im.file);
            return (
              <div
                key={im.file}
                onClick={() => toggle(im.file)}
                className={`relative w-[104px] cursor-pointer overflow-hidden rounded-[10px] border-2 bg-surface2 ${
                  sel ? 'border-accent' : 'border-transparent'
                }`}
              >
                {im.is_hero && (
                  <span className="absolute left-1.5 top-1.5 z-[2] rounded-[5px] bg-black/70 px-1.5 py-0.5 text-[8.5px] font-bold text-white">
                    HERO
                  </span>
                )}
                <span
                  className={`absolute right-1.5 top-1.5 z-[2] flex h-[21px] w-[21px] items-center justify-center rounded-full border text-xs font-extrabold ${
                    sel ? 'border-accent bg-accent text-white' : 'border-line bg-white'
                  }`}
                >
                  {sel ? '✓' : ''}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgSrc(im.img, 'thumb')} alt={im.pose} className="block h-[130px] w-full object-cover" />
                <div className="truncate px-1.5 py-[5px] text-[10px] font-semibold text-muted">
                  {im.pose}
                </div>
              </div>
            );
          })}
        </div>

        {warn && (
          <div className="mb-[14px] rounded-[9px] bg-accent-soft px-3 py-[9px] text-[12.5px] font-semibold text-accent">
            {warn}
          </div>
        )}

        <div className="mb-2">
          <label className="lbl">Model name</label>
          {err && (
            <div className="mb-2.5 rounded-[9px] bg-brand-soft px-3 py-[9px] text-[12.5px] font-semibold text-brand">
              {err}
            </div>
          )}
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErr('');
            }}
            placeholder="e.g. Aria — tall, warm Indian"
          />
        </div>

        <div className="mb-2">
          <label className="lbl">Auto-tags (from this shoot)</label>
          <div className="mt-2 flex flex-wrap gap-[7px]">
            <span className="rounded-[20px] border border-line bg-surface2 px-[11px] py-[5px] text-[11.5px] font-semibold">
              <b className="font-semibold text-muted">Ethnicity:</b> {ethLabel(data?.style)}
            </span>
            <span className="rounded-[20px] border border-line bg-surface2 px-[11px] py-[5px] text-[11.5px] font-semibold">
              <b className="font-semibold text-muted">Source:</b> {data?.shoot}
            </span>
          </div>
        </div>

        <div className="mt-[22px] flex items-center gap-3 border-t border-line pt-[18px]">
          <span className="text-xs text-muted">
            <b className="text-ink">{selected.size}</b> reference image
            {selected.size === 1 ? '' : 's'} selected
          </span>
          <button onClick={onClose} className="ml-auto text-[13px] font-bold text-muted">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!selected.size || busy}
            className="inline-flex items-center gap-2 rounded-[10px] bg-accent px-[22px] py-[11px] text-[13.5px] font-bold text-white shadow-[0_6px_16px_rgba(109,59,209,.32)] disabled:opacity-40 disabled:shadow-none"
          >
            <SaveIcon /> {busy ? 'Saving…' : 'Save model'}
          </button>
        </div>
      </div>
    </div>
  );
}