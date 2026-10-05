'use client';

import { useStudio } from '@/lib/client/StudioContext';
import LogsView from '@/components/LogsView';

export default function LogsClient() {
  const s = useStudio();
  return (
    <main className="flex-1 overflow-y-auto pl-5 pr-3 py-5 sm:px-7 flex">
      <LogsView variant="logs" onZoom={s.openZoom} />
    </main>
  );
}
