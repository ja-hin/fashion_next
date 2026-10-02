'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { postMultipart, ApiError } from '@/lib/client/api';
import { useStudio } from '@/lib/client/StudioContext';
import { useDialog } from '@/components/Dialog';
import SetupPanel from '@/components/SetupPanel';
import GenerateView from '@/components/GenerateView';
import ModelPickerModal from '@/components/ModelPickerModal';
import EnsembleTagModal from '@/components/EnsembleTagModal';
import PersonChoiceModal from '@/components/PersonChoiceModal';
import GarmentPickerModal from '@/components/GarmentPickerModal';
import VideoModal from '@/components/VideoModal';
import { garmentToRefs } from '@/lib/client/garment-refs';
import type { PublicGarment } from '@/lib/types';
import type { EnsembleRef } from '@/lib/client/ensemble-types';
import { ChevronLeftIcon, DesktopIcon, ShieldCheckIcon } from '@/components/icons';

/**
 * /special , the Special Category desk.
 *
 * A second Generate screen, not a view of the first. Images arrive here when
 * /api/ensemble/detect flags an upload as a special category: /generate moves
 * them off its own ensemble and sends you here (see the handover in
 * EnsembleTagModal and `specialDesk` in StudioContext).
 *
 * Everything it drives , references, settings, model, shoot , comes from
 * `s.specialDesk`, so starting a shoot here does not touch whatever is on the
 * ordinary Generate screen, and either can be left running while you use the
 * other.
 *
 * The layout is deliberately the same as /generate: this is the same job on a
 * different set of images, and a second, differently-shaped Generate screen
 * would be a thing to re-learn for no reason. The two pages are kept separate
 * rather than merged because /generate also carries garment adoption from a
 * query param and resume-from-gallery, neither of which belongs here.
 */
export default function SpecialPage() {
  const s = useStudio();
  const dialog = useDialog();
  const desk = s.specialDesk;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [garmentPickerOpen, setGarmentPickerOpen] = useState(false);
  const [directVideo, setDirectVideo] = useState(false);
  /* Dismissed by hand. Not persisted: it explains where THIS set of images
     came from, so the next handoff has to be able to say it again. */
  const [noteHidden, setNoteHidden] = useState(false);

  const usingSaved = desk.modelSource === 'saved' && desk.setup.input_family !== 'extend';

  /*
   * Saved models are live here again, on the heaviest engine.
   *
   * They were locked because both flash engines refuse to put an identifiable
   * person's photograph into these garments , every such run in the logs came
   * back IMAGE_SAFETY. Two things changed since: the default engine for this
   * one job is now the pro image model (see DEFAULT_ENGINES), and a refusal no
   * longer ends the shoot , gen.ts falls back to generating from the saved
   * model's own description and flags the card, so the worst case is a close
   * likeness with a warning rather than "Not permitted".
   */
  const isEnsemble = desk.setup.ref_mode === 'ensemble';

  /*
   * Photos with someone in them that nobody has decided about yet.
   *
   * Derived rather than stored, so it is right however the images arrived ,
   * handed over from /generate already classified, or uploaded and tagged here.
   * An answer sets `garment_plan`, which is what takes a row out of this list;
   * that is also why the modal cannot be dismissed unanswered.
   *
   * Held back while the tagging window is open: it is the window that runs
   * detection, and stacking a second modal on top of it asks the user two
   * questions about the same image at once. Closing it brings this up.
   */
  const needChoice = desk.refs.filter((r) => r.has_person && !r.garment_plan);
  const askPerson = !tagOpen && needChoice.length > 0;

  const extracting = desk.refs.some((r) => r.extracting);
  /* Marked for extraction and no longer showing a person , i.e. it worked. A
     ref still mid-flight has `extracting` set and is counted by the strip. */
  const extracted = desk.refs.filter((r) => r.garment_plan === 'extract' && !r.extracting);

  /**
   * Pull a saved garment onto THIS desk , the same hydration /generate does,
   * pointed at `specialDesk` instead. Its images arrive already tagged, so the
   * window opens without re-running detection over settled work.
   */
  async function adopt(g: PublicGarment) {
    const refs = await garmentToRefs(g);
    desk.patchSetup({ ref_mode: g.mode, category: g.category || desk.setup.category });
    desk.setRefs(refs);
    setGarmentPickerOpen(false);
    setTagOpen(true);
  }

  /**
   * Apply the answers from the "person in this photo" window.
   *
   * 'own'     , the customer's garment-only image takes the slot. The old
   *             object URL is revoked (nothing renders it after this) and the
   *             detection verdict is cleared, because it described a different
   *             picture , the role is kept and flagged for confirmation rather
   *             than thrown away, since the item has not changed.
   * 'extract' , the photo stays as it is and is marked for extraction.
   * 'none'    , the classifier was wrong. That is recorded by correcting
   *             has_person rather than by setting a plan: there is no person, so
   *             there is nothing to plan for, and a later re-detect that agrees
   *             will not re-ask.
   *
   * Every branch takes the ref out of `needChoice`, which is what closes the
   * window , and why it can refuse to close while anything is unanswered.
   */
  function resolvePerson(
    answers: Map<string, { plan: 'own' | 'extract' | 'none'; file?: File; preview?: string }>,
  ) {
    const next = desk.refs.map((r) => {
      const a = answers.get(r.url);
      if (!a) return r;
      if (a.plan === 'none') return { ...r, has_person: false };
      if (a.plan === 'extract') return { ...r, garment_plan: 'extract' as const };
      if (!a.file || !a.preview) return r;

      URL.revokeObjectURL(r.url);
      return {
        ...r,
        file: a.file,
        url: a.preview,
        garment_plan: 'own' as const,
        has_person: false,
        confidence: undefined,
        reason: undefined,
        unsure: true,
      };
    });

    desk.setRefs(next);

    const queued = next.filter((r) => r.garment_plan === 'extract' && r.has_person);
    if (queued.length) {
      /* Hand straight over to the tagging window rather than closing onto the
         page behind. Extraction replaces the picture on a tile, so the tile is
         where it should be watched happening , closing here left the customer
         on a dimmed panel with a progress strip and no sign of their image. */
      setTagOpen(true);
    }
    // Answering "extract" IS the request , there is no second confirm step, so
    // the work starts here rather than waiting for Generate.
    void runExtract(queued);
  }

  /**
   * Replace each photo with the packshot pulled out of it.
   *
   * One photo in, one reference out. Every piece the person was wearing comes
   * back in that single image, laid out as the set it is , so the reference
   * count is unchanged, nothing is split, and the shoot's mode is left alone.
   *
   * Every write is an updater, never a captured array. The tagging window sits
   * open over this while it runs, so the customer can remove or add an image
   * mid-flight , and writing back a snapshot taken before the request would
   * silently undo that.
   *
   * Matched by object URL rather than position , stable here because the only
   * thing that rewrites a url is this function, at the end, and a ref that has
   * since been removed simply is not found.
   */
  async function runExtract(targets: EnsembleRef[]) {
    if (!targets.length) return;
    const keys = new Set(targets.map((r) => r.url));
    desk.setRefs((cur) => cur.map((r) => (keys.has(r.url) ? { ...r, extracting: true } : r)));

    type Extracted = { image: string; label: string; role: string };
    let results: Array<{ item?: Extracted; error?: string }> = [];
    try {
      const fd = new FormData();
      for (const r of targets) fd.append('refs', r.file);
      const j = await postMultipart<{
        results: Array<{ item?: Extracted; error?: string }>;
        balance?: number;
      }>('/api/ensemble/extract', fd);
      results = j.results ?? [];
      // Extraction spends credits, so the pill has to move with it , otherwise
      // the header keeps showing a balance that was true before the call.
      if (typeof j.balance === 'number') s.setBalance(j.balance);
    } catch (e) {
      // The whole call failed, so nothing was extracted. Clear the plan rather
      // than leaving every photo marked for work that is not going to happen.
      desk.setRefs((cur) =>
        cur.map((r) => (keys.has(r.url) ? { ...r, extracting: false, garment_plan: undefined } : r)),
      );
      await dialog.alert(
        e instanceof ApiError ? e.message : 'Could not extract the garment right now.',
      );
      return;
    }

    /* Data URL in, File out , the rest of the desk deals in Files, so an
       extracted packshot has to become one or it cannot be uploaded with the
       shoot. Done before the state write so a decode failure cannot leave a ref
       stuck mid-swap. */
    const swapped = await Promise.all(
      targets.map(async (r, i) => {
        const got = results[i]?.item;
        if (!got?.image) return null;
        try {
          const blob = await (await fetch(got.image)).blob();
          const file = new File([blob], `garment-${Date.now()}-${i}.jpg`, { type: 'image/jpeg' });
          return { source: r.url, file, preview: URL.createObjectURL(file), label: got.label };
        } catch {
          return null;
        }
      }),
    );

    const bySource = new Map(
      swapped.filter((x) => x !== null).map((x) => [x.source, x]),
    );

    /* One photo in, one reference out. The pieces in a set come back in a
       single packshot, so nothing is split, the reference count does not move,
       and the shoot's mode is left exactly as the customer set it. */
    desk.setRefs((cur) =>
      cur.map((r) => {
        if (!keys.has(r.url)) return r;
        const done = bySource.get(r.url);
        if (!done) {
          // This one failed. The plan is cleared so the window asks again
          // rather than leaving a person-photo silently in the shoot.
          return { ...r, extracting: false, garment_plan: undefined };
        }
        URL.revokeObjectURL(r.url);
        return {
          ...r,
          file: done.file,
          url: done.preview,
          extracting: false,
          has_person: false,
          is_flat_lay: true,
          garment_type: done.label || r.garment_type,
          reason: done.label ? `extracted , ${done.label}` : 'garment extracted from your photo',
        };
      }),
    );

    const failed = targets.filter((r) => !bySource.has(r.url));
    if (failed.length) {
      const why = results.find((x) => x.error)?.error;
      await dialog.alert(
        failed.length === targets.length
          ? (why ?? 'Could not extract the garment from that photo.')
          : `${failed.length} of ${targets.length} photos could not be extracted. ` +
              'They have been left as they were , choose again for those.',
      );
    }
  }

  async function saveGarment() {
    if (!desk.refs.length) return;
    const name = await dialog.prompt('Name this garment', '');
    if (!name?.trim()) return;

    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('mode', desk.setup.ref_mode);
      fd.append('category', desk.setup.category);
      for (const r of desk.refs) fd.append('refs', r.file);
      fd.append('roles', JSON.stringify(desk.refs.map((r) => r.role)));

      await postMultipart('/api/garments', fd);
      s.bumpGarments();
      await dialog.alert(`"${name.trim()}" saved to My Garments.`);
    } catch (e) {
      await dialog.alert(e instanceof ApiError ? e.message : 'Could not save this garment.');
    }
  }

  /**
   * Same request as an ordinary hero , same endpoint, same fields.
   *
   * No special-category flag is sent. What should actually differ about a
   * special shoot has not been decided, and inventing a server behaviour to
   * match a panel name would be a guess to unpick later. The separation that
   * exists today is the desk, not the call.
   */
  async function generateHero() {
    if (!desk.refs.length) {
      await dialog.alert(
        isEnsemble
          ? 'Add at least one product image for an ensemble.'
          : 'Add at least one photo first.',
      );
      return;
    }
    if (usingSaved && !desk.selectedModel) {
      desk.setNoModelError(true);
      return;
    }
    desk.setNoModelError(false);
    s.setNavRailed(true);

    const fd = new FormData();
    // Files and roles are paired POSITIONALLY on the server , the prompt numbers
    // them "Image 1", "Image 2"… , so both go in the same order.
    for (const r of desk.refs) fd.append('refs', r.file);
    fd.append('roles', JSON.stringify(desk.refs.map((r) => r.role)));
    fd.append('ref_mode', desk.setup.ref_mode);
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
      fd.append(k, desk.setup[k]);
    }
    fd.append('model_id', usingSaved && desk.selectedModel ? desk.selectedModel.id : '');
    /*
     * The one field that makes this desk different from /generate.
     *
     * The hero prompt's default rule is "the model must be fully dressed , add
     * a plain neutral piece for anything the garment does not cover". On a
     * bra-and-briefs shoot that instruction is followed to the letter and comes
     * back as a white vest over the product. This swaps it for "wears the
     * supplied items and nothing else" and relaxes the explicit-content
     * threshold, which is what this desk is for. gen.ts forces it back off for
     * kidswear whatever is sent here.
     */
    fd.append('allow_revealing', '1');
    /* Bills this shoot from the Special Category grid rather than the ordinary
       one , see `special_prices` in settings, editable on the admin page. */
    fd.append('special', '1');

    await desk.shoot.startShoot(fd, s.setBalance);
  }

  return (
    <>
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
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-brand">
              <ShieldCheckIcon className="h-3.5 w-3.5 flex-shrink-0" />
              Special Category
              {/* Flagged as beta because it is: extraction quality and what the
                  image model will accept here are both still moving. Says so
                  where the panel is named rather than in a banner nobody reads
                  twice. */}
              {/* A real element, not the `title` attribute , the native tooltip
                  takes about a second to appear and cannot be styled, which is
                  the same reason FolderModal grew its own Tip. No `title` here
                  either, or the browser paints its version on top a second
                  after this one. */}
              <span className="group relative flex-shrink-0">
                <span className="block cursor-help rounded-full border border-brand/40 px-1.5 py-[1px] text-[8px] font-bold uppercase tracking-[0.06em] text-brand">
                  beta
                </span>
                {/* normal-case and tracking-normal are load-bearing: the header
                    this sits in is uppercase with wide tracking, and a sentence
                    inherits both. */}
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 w-[208px] -translate-x-1/2 rounded-lg bg-ink px-2.5 py-2 text-[10.5px] font-semibold normal-case leading-[1.45] tracking-normal text-surface opacity-0 shadow-pop transition-opacity group-hover:opacity-100"
                >
                  This is a beta feature , it can get things wrong. Check the garment and
                  the result before you use them.
                </span>
              </span>
            </span>
          )}
          <button
            onClick={() => s.setSetupCollapsed(!s.setupCollapsed)}
            title={s.setupCollapsed ? 'Show Special Category' : 'Hide Special Category'}
            aria-label={s.setupCollapsed ? 'Show Special Category' : 'Hide Special Category'}
            aria-expanded={!s.setupCollapsed}
            className={`flex h-[28px] w-[28px] flex-shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface2 hover:text-ink ${
              s.setupCollapsed ? '' : 'ml-auto'
            }`}
          >
            <ChevronLeftIcon className={`h-4 w-4 ${s.setupCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {s.setupCollapsed && (
          <button
            onClick={() => s.setSetupCollapsed(false)}
            className="flex flex-1 items-start justify-center pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-brand transition hover:text-ink"
            style={{ writingMode: 'vertical-rl' }}
          >
            Special Category · beta
          </button>
        )}

        <div className={`min-h-0 flex-1 overflow-y-auto ${s.setupCollapsed ? 'hidden' : ''}`}>
          <SetupPanel
            ensembleSoon
            setup={desk.setup}
            onSetup={desk.patchSetup}
            ensemble={desk.refs}
            onEnsembleAdd={(files) => {
              desk.setRefs([
                ...desk.refs,
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
            modelSource={desk.modelSource}
            onModelSource={(v) => {
              desk.setModelSource(v);
              desk.setNoModelError(false);
            }}
            selectedModel={desk.selectedModel}
            onOpenPicker={() => setPickerOpen(true)}
            noModelError={desk.noModelError}
            heroCost={desk.priceFor('')}
            videoCost={s.me.video_price ?? 0}
            onGenerateVideo={() => setDirectVideo(true)}
            busy={desk.shoot.generating || extracting}
            onGenerate={generateHero}
            hasShoot={!!desk.shoot.pid || desk.shoot.generating}
            onNewShoot={() => {
              desk.shoot.reset();
              desk.setRefs([]);
            }}
            // Every reference on this desk is flagged by definition, so the
            // upload gate would block the one screen built to handle them.
            allowRestricted
          />
        </div>
      </aside>

      {directVideo && (
        <VideoModal
          pid={null}
          frames={[]}
          uploads={desk.refs.map((e) => e.file)}
          price={s.me.video_price ?? 0}
          onClose={() => setDirectVideo(false)}
          onBalance={s.setBalance}
          onCreated={() => {}}
        />
      )}

      {/* Same reasoning as /generate: the setup panel is hidden below `lg`, so
          without this the page would be a results area with no way to start
          anything. */}
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-12 lg:hidden">
        <div className="max-w-[340px] text-center">
          <DesktopIcon className="mx-auto mb-4 h-10 w-10 text-muted" />
          <h2 className="text-[17px] font-bold">Special Category needs a bigger screen</h2>
          <p className="mt-2 text-[13.5px] leading-[1.6] text-muted">
            This is a full shoot setup , the references, the model, the backdrop and
            framing side by side with the results. Open it on a laptop or desktop.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link
              href="/gallery"
              className="rounded-[9px] bg-ink px-4 py-2.5 text-[12.5px] font-bold text-surface"
            >
              Open Gallery
            </Link>
          </div>
        </div>
      </div>

      <main className="hidden flex-1 overflow-y-auto px-5 py-6 sm:px-7 lg:block">
        {extracting && (
          <div className="mb-5 flex items-center gap-2.5 rounded-card border border-accent-soft bg-accent-soft p-[13px] text-[12.5px] font-semibold text-accent">
            <span className="animate-spin-cs inline-block h-[13px] w-[13px] flex-shrink-0 rounded-full border-2 border-accent/30 border-t-accent" />
            Taking the garment out of your{' '}
            {desk.refs.filter((r) => r.extracting).length === 1 ? 'photo' : 'photos'}… a few
            seconds per image
            {(s.me.extract_price ?? 0) > 0 && `, ${s.me.extract_price} credits each`}.
          </div>
        )}

        {/* Says where these came from. Only while nothing has been generated:
            once the grid has results, the banner is answering a question the
            user stopped asking. */}
        {desk.refs.length > 0 && !noteHidden && !desk.shoot.pid && !desk.shoot.generating && (
          <div className="mb-5 flex items-start gap-2.5 rounded-card border border-brand-soft bg-brand-soft p-[13px] text-[12.5px] leading-[1.6] text-brand">
            <ShieldCheckIcon className="mt-[2px] h-4 w-4 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <b>
                {desk.refs.length} {desk.refs.length === 1 ? 'image was' : 'images were'} moved
                here by detection.
              </b>{' '}
              They are no longer part of the shoot on Generate. Set this one up on the
              left and run it on its own.
              {extracted.length > 0 && (
                <div className="mt-1.5 font-semibold">
                  The garment was extracted from {extracted.length}{' '}
                  {extracted.length === 1 ? 'photo' : 'photos'}.
                </div>
              )}
            </div>
            {/* Dismisses the note only , the images stay. Nothing here is an
                action on the shoot, so it must not read as one. */}
            <button
              onClick={() => setNoteHidden(true)}
              aria-label="Dismiss this note"
              title="Dismiss"
              className="-mr-1 -mt-1 flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full text-[15px] leading-none text-brand/60 transition hover:bg-brand/10 hover:text-brand"
            >
              ×
            </button>
          </div>
        )}

        <GenerateView
          shoot={desk.shoot}
          category={desk.setup.category}
          geniePrice={s.me.genie?.price ?? 0}
          videoPrice={s.me.video_price ?? 0}
          priceFor={desk.priceFor}
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

      {askPerson && (
        <PersonChoiceModal
          refs={needChoice}
          price={s.me.extract_price ?? 0}
          onResolve={resolvePerson}
        />
      )}

      {tagOpen && (
        <EnsembleTagModal
          mode={isEnsemble ? 'ensemble' : 'same_garment'}
          refs={desk.refs}
          onRefs={desk.setRefs}
          onClose={() => setTagOpen(false)}
          extractPrice={s.me.extract_price ?? 0}
          // No `onSpecial` , this IS the special panel. Flagged images stay.
        />
      )}

      {pickerOpen && (
        <ModelPickerModal
          category={desk.setup.category}
          current={desk.selectedModel}
          onClose={() => setPickerOpen(false)}
          onBalance={s.setBalance}
          onConfirm={(m) => {
            desk.setSelectedModel(m);
            desk.setNoModelError(false);
            setPickerOpen(false);
          }}
        />
      )}
    </>
  );
}
