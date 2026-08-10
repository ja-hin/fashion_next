'use client';

import { useEffect, useState } from 'react';
import { getJson, del, ApiError, imgSrc } from '@/lib/client/api';
import { CopyIcon, DownloadIcon, TrashIcon, PersonPlusIcon, PlayIcon } from './icons';
import { useDialog } from './Dialog';
import type { ShootImage, LbItem, ResumePayload } from '@/lib/client/types';

interface Props {
  pid: string;
  onClose: () => void;
  onZoom: (items: LbItem[], index: number) => void;
  onContinue: (pid: string) => void;
  onSaveAsModel: (pid: string) => void;
  onChanged: () => void;
}

/** Opens one shoot from the Gallery: every image, with per-image actions. */
export default function FolderModal({
  pid,
  onClose,
  onZoom,
  onContinue,
  onSaveAsModel,
  onChanged,
}: Props) {
  const dialog = useDialog();
  const [title, setTitle] = useState('');
  const [shootNo, setShootNo] = useState('');
  const [images, setImages] = useState<ShootImage[]>([]);

  useEffect(() => {
    getJson<{ title: string; shoot: string; images: ShootImage[] }>(
      `/api/product/${pid}/images`,
    )
      .then((j) => {
        setTitle(j.title);
        setShootNo(j.shoot);
        setImages(j.images ?? []);
      })
      .catch(() => setImages([]));
  }, [pid]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const lbItems: LbItem[] = images.map((im) => ({
    url: im.url,
    dl: im.dlurl,
    name: im.dl,
    pose: im.pose,
  }));

  async function removeImage(url: string) {
    const file = url.split('?')[0].split('/').pop() ?? '';
    if (
      !(await dialog.confirm(
        'Delete this image? It will be removed from the shoot, the gallery and the ZIP.',
        { title: 'Delete image' },
      ))
    )
      return;

    try {
      await del(`/api/product/${pid}/image/${encodeURIComponent(file)}`);
      setImages((prev) => prev.filter((im) => im.url !== url));
      onChanged();
    } catch (e) {
      await dialog.alert(e instanceof ApiError ? e.message : 'Could not delete this image.');
    }
  }

  /** A shoot can only be continued while its hero (the locked model) survives. */
  async function tryContinue() {
    try {
      const j = await getJson<ResumePayload>(`/api/product/${pid}/resume`);
      if (!j.images?.length) {
        await dialog.alert('This shoot has no images to continue.');
        return;
      }
      if (!j.hero_exists) {
        await dialog.alert(
          "The hero image for this shoot is missing, so it can't be continued.",
        );
        return;
      }
      onContinue(pid);
    } catch {
      await dialog.alert('Could not load this shoot.');
    }
  }

  const iconBtn =
    'relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-line bg-surface2 transition hover:scale-105';

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-[30px]"
      onClick={onClose}
    >
      <div
        className="max-h-[86vh] w-full max-w-[1000px] overflow-auto rounded-2xl bg-surface p-6 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-[18px] flex items-center gap-3">
          <h3 className="text-[18px] font-bold">
            {title} · {shootNo} · {images.length} images
          </h3>

          <button
            title="Save as model"
            onClick={() => onSaveAsModel(pid)}
            className={`${iconBtn} ml-auto text-accent hover:border-accent hover:bg-accent hover:text-white`}
          >
            <PersonPlusIcon />
          </button>
          <button
            title="Continue shoot"
            onClick={tryContinue}
            className={`${iconBtn} hover:border-brand hover:bg-brand hover:text-white`}
          >
            <PlayIcon />
          </button>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface2 text-base"
          >
            ×
          </button>
        </div>

        <div className="flex flex-wrap items-start gap-4">
          {images.map((im, i) => (
            <div
              key={im.url}
              className="w-[212px] overflow-hidden rounded-card border border-line bg-surface shadow-card"
            >
              <div className="relative aspect-[4/5] bg-surface2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgSrc(im.url, 'thumb')}
                  alt={im.pose}
                  onClick={() => onZoom(lbItems, i)}
                  className="block h-full w-full cursor-zoom-in object-cover"
                />
              </div>
              <div className="flex items-center justify-between gap-1.5 px-[11px] py-[9px]">
                <span className="truncate text-xs font-semibold" title={im.pose}>
                  {im.pose}
                </span>
                <span className="flex flex-shrink-0 items-center gap-2 text-muted">
                  <button
                    title="Copy prompt"
                    onClick={() => navigator.clipboard?.writeText(im.pose)}
                    className="hover:text-brand"
                  >
                    <CopyIcon />
                  </button>
                  <a title="Download" href={im.dlurl} className="hover:text-brand">
                    <DownloadIcon />
                  </a>
                  <button
                    title="Delete"
                    onClick={() => removeImage(im.url)}
                    className="hover:text-brand"
                  >
                    <TrashIcon />
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}