'use client';

import { useStudio } from '@/lib/client/StudioContext';
import GarmentsView from '@/components/GarmentsView';

export default function GarmentsPage() {
  const s = useStudio();
  return (
    <main className="flex-1 overflow-y-auto px-5 py-6 sm:px-7">
      <GarmentsView onZoom={s.openZoom} refreshKey={s.garmentsRefresh} />
    </main>
  );
}
