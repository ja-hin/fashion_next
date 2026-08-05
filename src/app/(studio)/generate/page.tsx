'use client';

import { useState } from 'react';
import { useStudio } from '@/lib/client/StudioContext';
import { useDialog } from '@/components/Dialog';
import SetupPanel from '@/components/SetupPanel';
import GenerateView from '@/components/GenerateView';
import ModelPickerModal from '@/components/ModelPickerModal';

export default function GeneratePage() {
  const s = useStudio();
  const dialog = useDialog();
  const [pickerOpen, setPickerOpen] = useState(false);

  const usingSaved = s.modelSource === 'saved' && s.setup.input_family !== 'extend';

  async function generateHero() {
    if (!s.file) {
      await dialog.alert('Add a garment image first.');
      return;
    }
    if (usingSaved && !s.selectedModel) {
      s.setNoModelError(true);
      return;
    }
    s.setNoModelError(false);

    const fd = new FormData();
    fd.append('garment', s.file);
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
          file={s.file}
          onFile={s.setFile}
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
            s.setFile(null);
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
