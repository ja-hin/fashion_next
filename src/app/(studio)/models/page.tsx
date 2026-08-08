'use client';

import { useStudio } from '@/lib/client/StudioContext';
import ModelsView from '@/components/ModelsView';

export default function ModelsPage() {
  const s = useStudio();
  return (
    <main className="flex-1 overflow-y-auto px-5 py-6 sm:px-7 flex justify-center">
      <ModelsView
        onZoom={s.openZoom}
        onBalance={s.setBalance}
        refreshKey={s.modelsRefresh}
      />
    </main>
  );
}
