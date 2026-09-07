'use client';

import { useEffect, useState } from 'react';
import { getJson, del, ApiError, imgSrc } from '@/lib/client/api';
import {
  CopyIcon,
  DownloadIcon,
  TrashIcon,
  PersonPlusIcon,
  PlayIcon,
  VideoCameraIcon,
} from './icons';
import VideoModal from './VideoModal';
import { useDialog } from './Dialog';
import type {
  ShootImage,
  LbItem,
  ResumePayload,
  FolderVideo,
  FolderRef,
} from '@/lib/client/types';

interface Props {
  pid: string;
  /** Credits for one 10-second video, shown on the action's tooltip. */
  videoPrice: number;
  onBalance: (b: number) => void;
  onClose: () => void;
  onZoom: (items: LbItem[], index: number) => void;
  onContinue: (pid: string) => void;
  onSaveAsModel: (pid: string) => void;
  onChanged: () => void;
}

/** Opens one shoot from the Gallery: every image, with per-image actions. */
export default function FolderModal({
  pid,
  videoPrice,
  onBalance,
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
  const [videos, setVideos] = useState<FolderVideo[]>([]);
  const [refs, setRefs] = useState<FolderRef[]>([]);
  const [videoOpen, setVideoOpen] = useState(false);

  useEffect(() => {
    getJson<{
      title: string;
      shoot: string;
      images: ShootImage[];
      videos?: FolderVideo[];
      refs?: FolderRef[];
    }>(
      `/api/product/${pid}/images`,
    )
      .then((j) => {
        setTitle(j.title);
        setShootNo(j.shoot);
        setImages(j.images ?? []);
        setVideos(j.videos ?? []);
        setRefs(j.refs ?? []);
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

  /*
   * What a new video can lock onto: this shoot's generated stills if it has
   * any, otherwise the garment photos it was built from. A shoot made straight
   * to video only has the latter, and it is enough , the server swaps to the
   * garment lock when no still is picked.
   */
  const videoFrames = images.length
    ? images.map((im) => ({ file: im.file, url: im.url, label: im.pose }))
    : refs.map((r) => ({ file: r.file, url: r.url, label: r.role }));

  const iconBtn =
    'group relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-line bg-surface2 transition hover:scale-105 disabled:opacity-40 disabled:hover:scale-100';

  /**
   * The label under an icon button.
   *
   * A real element rather than the `title` attribute: the native tooltip takes
   * about a second to appear and cannot be styled, which is no help to someone
   * scanning a row of four unlabelled circles.
   *
   * The buttons carry `aria-label`, NOT `title` , `title` would paint the
   * browser's own tooltip on top of this one a second later, and the two say
   * different things when an action is unavailable.
   */
  const Tip = ({ children }: { children: React.ReactNode }) => (
    <span
      className="pointer-events-none absolute left-1/2 top-full z-10 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[10.5px] font-semibold text-surface opacity-0 shadow-card transition-opacity group-hover:opacity-100"
      role="tooltip"
    >
      {children}
    </span>
  );

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
            {/* An unnamed shoot's title IS its number, so printing both reads
                "S0107 · S0107". And a shoot generated straight to video has no
                images at all , saying "0 images" describes what it is not. */}
            {[
              title,
              title === shootNo ? null : shootNo,
              images.length ? `${images.length} image${images.length === 1 ? '' : 's'}` : null,
              videos.length ? `${videos.length} video${videos.length === 1 ? '' : 's'}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </h3>

          {/* Four actions, in the order you would reach for them: make more of
              this shoot, then leave. Each is disabled rather than hidden when it
              cannot apply, so the row does not reflow between shoots and the
              tooltip can say WHY it is unavailable. */}
          <button
            aria-label="Save as model"
            onClick={() => onSaveAsModel(pid)}
            disabled={!images.length}
            className={`${iconBtn} ml-auto text-accent hover:border-accent hover:bg-accent hover:text-white`}
          >
            <PersonPlusIcon />
            <Tip>{images.length ? 'Save as model' : 'Needs a generated image'}</Tip>
          </button>

          {/* Continuing generates more poses from the hero, so it needs one. */}
          <button
            aria-label="Continue shoot"
            onClick={tryContinue}
            disabled={!images.length}
            className={`${iconBtn} hover:border-brand hover:bg-brand hover:text-white`}
          >
            <PlayIcon />
            <Tip>{images.length ? 'Continue shoot' : 'Needs a generated image'}</Tip>
          </button>

          {/* Enabled on a video-only shoot too , see `videoFrames`. */}
          <button
            aria-label="Generate video"
            onClick={() => setVideoOpen(true)}
            disabled={!videoFrames.length}
            className={`${iconBtn} hover:border-ink hover:bg-ink hover:text-surface`}
          >
            <VideoCameraIcon />
            <Tip>
              {videoFrames.length
                ? `Generate video · ${videoPrice} credits`
                : 'Nothing here to build a video from'}
            </Tip>
          </button>

          <button
            onClick={onClose}
            aria-label="Close"
            className={iconBtn}
          >
            ×
            <Tip>Close</Tip>
          </button>
        </div>

        {videoOpen && (
          <VideoModal
            pid={pid}
            frames={videoFrames}
            price={videoPrice}
            onClose={() => setVideoOpen(false)}
            onBalance={onBalance}
            // Straight into the grid behind the modal, and onChanged so the
            // gallery card's ▶ count is right when this closes.
            onCreated={(v) => {
              setVideos((cur) => [
                ...cur,
                {
                  file: v.file,
                  url: v.url,
                  dlurl: `/api/product/${pid}/file/${v.file}`,
                  dl: v.file,
                  preset: v.preset,
                  aspect: v.aspect,
                  created: v.created,
                },
              ]);
              onChanged();
            }}
          />
        )}

        <div className="flex flex-wrap items-start gap-4">
          {/* Clips first: on a shoot generated straight to video they are the
              only thing in here, and on a mixed shoot they are the newest work.
              Same card footprint as a still so the grid stays even. */}
          {videos.map((v) => (
            <div
              key={v.file}
              className="w-[212px] overflow-hidden rounded-card border border-line bg-surface shadow-card transition hover:-translate-y-[3px] hover:shadow-pop"
            >
              {/* Matches the still cards beside it , see the note in
                  GenerateView: the clip's own ratio would make the grid ragged. */}
              <div className="relative aspect-[4/5] bg-black">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  src={v.url}
                  controls
                  loop
                  playsInline
                  preload="metadata"
                  className="absolute inset-0 h-full w-full object-contain"
                />
                <span className="pointer-events-none absolute left-2 top-2 rounded-[5px] bg-black/70 px-[7px] py-[3px] text-[9px] font-bold text-white">
                  {v.aspect} · 10s
                </span>
              </div>
              {/* Matches the still card's footer exactly , same padding, same
                  icon slot , so the two card types end at the same height. */}
              <div className="flex items-center justify-between gap-1.5 px-[11px] py-[9px]">
                <span className="truncate text-xs font-semibold" title={v.preset}>
                  {v.preset}
                </span>
                <span className="flex flex-shrink-0 items-center gap-2 text-muted">
                  <a title="Download" href={v.dlurl} download className="hover:text-brand">
                    <DownloadIcon />
                  </a>
                </span>
              </div>
            </div>
          ))}

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
                  className="block h-full w-full cursor-zoom-in object-cover object-top"
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