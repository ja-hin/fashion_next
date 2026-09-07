'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getJson, postMultipart, ApiError } from '@/lib/client/api';
import type { PublicGarment } from '@/lib/types';
import { useStudio } from '@/lib/client/StudioContext';
import { useDialog } from '@/components/Dialog';
import SetupPanel from '@/components/SetupPanel';
import GenerateView from '@/components/GenerateView';
import ModelPickerModal from '@/components/ModelPickerModal';
import EnsembleTagModal from '@/components/EnsembleTagModal';
import GarmentPickerModal from '@/components/GarmentPickerModal';
import VideoModal from '@/components/VideoModal';
import { garmentToRefs } from '@/lib/client/garment-refs';
import Link from 'next/link';
import { ChevronLeftIcon, DesktopIcon } from '@/components/icons';

export default function GeneratePage() {
  const s = useStudio();
  const dialog = useDialog();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [garmentPickerOpen, setGarmentPickerOpen] = useState(false);
  /** Straight-to-video from the uploads, before any shoot exists. */
  const [directVideo, setDirectVideo] = useState(false);

  /**
   * A garment picked from the library, pulled back into ordinary tagged refs.
   *
   * Rather than treating a saved garment as a special read-only thing, its
   * images are fetched and turned into real File refs , so the tagging window
   * opens on them exactly as it would on a fresh upload, and every angle can be
   * reviewed, retagged, added to or dropped before a credit is spent. Past that
   * point there is no "library shoot" vs "manual shoot": there is one path.
   *
   * They arrive already tagged, so they are marked confident and the window
   * does not re-run detection on work that was done when the garment was saved.
   */
  const params = useSearchParams();
  const garmentId = params.get('garment');

  /** Adopt a garment: hydrate its refs, match the panel to it, open tagging. */
  const adopt = useCallback(
    async (g: PublicGarment) => {
      const refs = await garmentToRefs(g);
      // The library entry carries the mode and category it was tagged under.
      s.patchSetup({ ref_mode: g.mode, category: g.category || s.setup.category });
      s.setEnsemble(refs);
      setGarmentPickerOpen(false);
      setTagOpen(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (!garmentId) return;
    let live = true;

    void (async () => {
      try {
        const j = await getJson<{ garments: PublicGarment[] }>('/api/garments');
        const g = j.garments?.find((x) => x.id === garmentId);
        if (!g || !live) return;
        await adopt(g);
      } catch {
        if (live) void dialog.alert('Could not open that garment.');
      } finally {
        // Drop the query param either way, so a refresh doesn't reload it over
        // whatever the user has since changed.
        if (live) window.history.replaceState(null, '', '/generate');
      }
    })();

    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [garmentId]);

  async function saveGarment() {
    if (!s.ensemble.length) return;
    const name = await dialog.prompt('Name this garment', '');
    if (!name?.trim()) return;

    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('mode', s.setup.ref_mode);
      fd.append('category', s.setup.category);
      for (const r of s.ensemble) fd.append('refs', r.file);
      fd.append('roles', JSON.stringify(s.ensemble.map((r) => r.role)));

      await postMultipart('/api/garments', fd);
      s.bumpGarments();
      await dialog.alert(`"${name.trim()}" saved to My Garments.`);
    } catch (e) {
      await dialog.alert(
        e instanceof ApiError ? e.message : 'Could not save this garment.',
      );
    }
  }

  const usingSaved = s.modelSource === 'saved' && s.setup.input_family !== 'extend';
  const isEnsemble = s.setup.ref_mode === 'ensemble';

  async function generateHero() {
    if (!s.ensemble.length) {
      await dialog.alert(
        isEnsemble
          ? 'Add at least one product image for an ensemble.'
          : 'Add at least one garment photo first.',
      );
      return;
    }
    if (usingSaved && !s.selectedModel) {
      s.setNoModelError(true);
      return;
    }
    s.setNoModelError(false);
    // The results grid is what matters from here on, so give it the width. The
    // nav is still a hover away, and the user's own preference is what this
    // writes , reopening it sticks.
    s.setNavRailed(true);

    const fd = new FormData();
    // Files and roles are paired POSITIONALLY on the server , the prompt numbers
    // them "Image 1", "Image 2"… , so both go in the same order.
    for (const r of s.ensemble) fd.append('refs', r.file);
    fd.append('roles', JSON.stringify(s.ensemble.map((r) => r.role)));
    fd.append('ref_mode', s.setup.ref_mode);
    for (const k of [
      'style',
      'category',
      'backdrop',
      'lighting',
      'mood',
      'aspect',
      'framing',
      'input_family',
      'resolution',
    ] as const) {
      fd.append(k, s.setup[k]);
    }
    fd.append('model_id', usingSaved && s.selectedModel ? s.selectedModel.id : '');

    await s.shoot.startShoot(fd, s.setBalance);
  }

  return (
    <>
      {/* A column, not a plain scroller: the toggle has to stay put while the
          form scrolls under it, which it cannot do inside the scrolling box. */}
      <aside
        className={`hidden max-h-full flex-shrink-0 flex-col border-r border-line bg-bg transition-[width] duration-200 lg:flex ${
          s.setupCollapsed ? 'w-[46px]' : 'w-[336px]'
        }`}
      >
        <div
          className={`flex flex-shrink-0 items-center gap-2 pt-3 ${
            s.setupCollapsed ? 'justify-center px-0' : 'px-[22px] pl-6'
          }`}
        >
          {!s.setupCollapsed && (
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
              Shoot setup
            </span>
          )}
          <button
            onClick={() => s.setSetupCollapsed(!s.setupCollapsed)}
            title={s.setupCollapsed ? 'Show shoot setup' : 'Hide shoot setup'}
            aria-label={s.setupCollapsed ? 'Show shoot setup' : 'Hide shoot setup'}
            aria-expanded={!s.setupCollapsed}
            className={`flex h-[28px] w-[28px] flex-shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface2 hover:text-ink ${
              s.setupCollapsed ? '' : 'ml-auto'
            }`}
          >
            <ChevronLeftIcon className={`h-4 w-4 ${s.setupCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Folded away, the strip still says what it is and re-opens on click ,
            a bare chevron gives no clue what is behind it. */}
        {s.setupCollapsed && (
          <button
            onClick={() => s.setSetupCollapsed(false)}
            className="flex flex-1 items-start justify-center pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-muted transition hover:text-ink"
            style={{ writingMode: 'vertical-rl' }}
          >
            Shoot setup
          </button>
        )}

        <div className={`min-h-0 flex-1 overflow-y-auto ${s.setupCollapsed ? 'hidden' : ''}`}>
        <SetupPanel
          setup={s.setup}
          onSetup={s.patchSetup}
          ensemble={s.ensemble}
          // Dropping on the panel appends the files and opens the tagging
          // window on them , the modal runs detection for whatever is new.
          onEnsembleAdd={(files) => {
            s.setEnsemble([
              ...s.ensemble,
              ...files.map((file) => ({
                file,
                role: 'garment' as const,
                url: URL.createObjectURL(file),
                detecting: true,
                unsure: true,
              })),
            ]);
            setTagOpen(true);
          }}
          onEnsembleOpen={() => setTagOpen(true)}
          onSaveGarment={saveGarment}
          onPickGarment={() => setGarmentPickerOpen(true)}
          modelSource={s.modelSource}
          onModelSource={(v) => {
            s.setModelSource(v);
            s.setNoModelError(false);
          }}
          selectedModel={s.selectedModel}
          onOpenPicker={() => setPickerOpen(true)}
          noModelError={s.noModelError}
          heroCost={s.priceFor('')}
          videoCost={s.me.video_price ?? 0}
          onGenerateVideo={() => setDirectVideo(true)}
          busy={s.shoot.generating}
          onGenerate={generateHero}
          hasShoot={!!s.shoot.pid || s.shoot.generating}
          onNewShoot={() => {
            s.shoot.reset();
            s.setEnsemble([]);
          }}
        />
        </div>
      </aside>

      {directVideo && (
        <VideoModal
          // No shoot yet , the route creates one around the finished video.
          pid={null}
          frames={[]}
          uploads={s.ensemble.map((e) => e.file)}
          price={s.me.video_price ?? 0}
          onClose={() => setDirectVideo(false)}
          onBalance={s.setBalance}
          // Nothing to add to a results grid that is not showing this shoot ,
          // the clip lives on the shoot the route just made, and the Gallery is
          // where it is found.
          onCreated={() => {}}
        />
      )}

      {/* Below `lg` the shoot setup panel above is hidden outright, so on a phone
          this page would be a results area with no way to configure or start a
          shoot , a tab that looks live and does nothing. Say so instead, and
          point at the two things that DO work at this width.
          Done with breakpoints rather than a width check in JS: it costs no
          hydration mismatch and it answers a rotation immediately. */}
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-12 lg:hidden">
        <div className="max-w-[340px] text-center">
          <DesktopIcon className="mx-auto mb-4 h-10 w-10 text-muted" />
          <h2 className="text-[17px] font-bold">Generate needs a bigger screen</h2>
          <p className="mt-2 text-[13.5px] leading-[1.6] text-muted">
            Setting up a shoot means the garment upload, the model, the backdrop, lighting and
            framing side by side with the results. That does not fit on a phone, so we have not
            tried to squeeze it in , open this page on a laptop or desktop.
          </p>
          <p className="mt-4 text-[13.5px] leading-[1.6] text-muted">
            Everything you have already shot is here though:
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link
              href="/gallery"
              className="rounded-[9px] bg-ink px-4 py-2.5 text-[12.5px] font-bold text-surface"
            >
              Open Gallery
            </Link>
            <Link
              href="/models"
              className="rounded-[9px] border border-line px-4 py-2.5 text-[12.5px] font-bold text-ink"
            >
              My Models
            </Link>
          </div>
        </div>
      </div>

      <main className="hidden flex-1 overflow-y-auto px-5 py-6 sm:px-7 lg:block">
        <GenerateView
          shoot={s.shoot}
          category={s.setup.category}
          geniePrice={s.me.genie?.price ?? 0}
          videoPrice={s.me.video_price ?? 0}
          priceFor={s.priceFor}
          onBalance={s.setBalance}
          onZoom={s.openZoom}
          onSaveAsModel={s.openSaveModel}
        />
      </main>

      {garmentPickerOpen && (
        <GarmentPickerModal
          onClose={() => setGarmentPickerOpen(false)}
          onPick={(g) => {
            void adopt(g).catch(() => dialog.alert('Could not open that garment.'));
          }}
        />
      )}

      {tagOpen && (
        <EnsembleTagModal
          mode={isEnsemble ? 'ensemble' : 'same_garment'}
          refs={s.ensemble}
          onRefs={s.setEnsemble}
          onClose={() => setTagOpen(false)}
        />
      )}

      {pickerOpen && (
        <ModelPickerModal
          category={s.setup.category}
          current={s.selectedModel}
          onClose={() => setPickerOpen(false)}
          onBalance={s.setBalance}
          onConfirm={(m) => {
            s.setSelectedModel(m);
            s.setNoModelError(false);
            setPickerOpen(false);
          }}
        />
      )}
    </>
  );
}
