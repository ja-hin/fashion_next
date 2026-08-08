'use client';

import { useStudio } from '@/lib/client/StudioContext';
import LogsView from '@/components/LogsView';

export default function UsagePage() {
  const s = useStudio();
  return (
    <main className="flex-1 overflow-y-auto px-5 py-6 sm:px-7 flex justify-center">
      <LogsView variant="usage" onZoom={s.openZoom} />
    </main>
  );
}
