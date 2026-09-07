'use client';

import { useRouter } from 'next/navigation';
import { useStudio } from '@/lib/client/StudioContext';
import ModelsView from '@/components/ModelsView';
import type { SavedModel } from '@/lib/client/types';

export default function ModelsPage() {
  const s = useStudio();
  const router = useRouter();

  /**
   * "Use this model" , arm the Generate tab with this model and go there, so
   * the next thing the user does is add garments rather than hunt for the
   * picker they have already made their choice in.
   */
  function useModel(m: SavedModel) {
    s.setModelSource('saved');
    s.setSelectedModel(m);
    s.setNoModelError(false);
    // "Extend" takes the model from the uploaded photo, so a saved model is
    // ignored in that mode and the button would look like it did nothing.
    // Choosing a model is the clearer signal of intent, so the input moves
    // back to the default to let that choice land.
    if (s.setup.input_family === 'extend') s.patchSetup({ input_family: 'garment_in' });
    router.push('/generate');
  }

  return (
    <main className="flex-1 overflow-y-auto px-5 py-6 sm:px-7">
      <ModelsView
        onZoom={s.openZoom}
        onBalance={s.setBalance}
        onUseModel={useModel}
        refreshKey={s.modelsRefresh}
      />
    </main>
  );
}
