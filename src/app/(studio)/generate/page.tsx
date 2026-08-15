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
import { garmentToRefs } from '@/lib/client/garment-refs';

export default function GeneratePage() {
  const s = useStudio();
  const dialog = useDialog();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [garmentPickerOpen, setGarmentPickerOpen] = useState(false);

  /**
   * A garment picked from the library, pulled back into ordinary tagged refs.
   *
   * Rather than treating a saved garment as a special read-only thing, its
   * images are fetched and turned into real File refs — so the tagging window
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
    // writes — reopening it sticks.
    s.setNavRailed(true);

    const fd = new FormData();
    // Files and roles are paired POSITIONALLY on the server — the prompt numbers
    // them "Image 1", "Image 2"… — so both go in the same order.
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
      <aside className="hidden max-h-full flex-shrink-0 overflow-y-auto border-r border-line bg-bg lg:block">
        <SetupPanel
          setup={s.setup}
          onSetup={s.patchSetup}
          ensemble={s.ensemble}
          // Dropping on the panel appends the files and opens the tagging
          // window on them — the modal runs detection for whatever is new.
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
          busy={s.shoot.generating}
          onGenerate={generateHero}
          hasShoot={!!s.shoot.pid || s.shoot.generating}
          onNewShoot={() => {
            s.shoot.reset();
            s.setEnsemble([]);
          }}
        />
      </aside>

      <main className="flex-1 overflow-y-auto px-5 py-6 sm:px-7">
        <GenerateView
          shoot={s.shoot}
          category={s.setup.category}
          geniePrice={s.me.genie?.price ?? 0}
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
