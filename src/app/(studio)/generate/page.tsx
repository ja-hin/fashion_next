'use client';

import { useState } from 'react';
import { useStudio } from '@/lib/client/StudioContext';
import { useDialog } from '@/components/Dialog';
import SetupPanel from '@/components/SetupPanel';
import GenerateView from '@/components/GenerateView';
import ModelPickerModal from '@/components/ModelPickerModal';
import EnsembleTagModal from '@/components/EnsembleTagModal';

export default function GeneratePage() {
  const s = useStudio();
  const dialog = useDialog();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);

  const usingSaved = s.modelSource === 'saved' && s.setup.input_family !== 'extend';
  const isEnsemble = s.setup.input_family === 'ensemble';

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

    const fd = new FormData();
    // Files and roles are paired POSITIONALLY on the server — the prompt numbers
    // them "Image 1", "Image 2"… — so both go in the same order.
    for (const r of s.ensemble) fd.append('refs', r.file);
    fd.append('roles', JSON.stringify(s.ensemble.map((r) => r.role)));
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
