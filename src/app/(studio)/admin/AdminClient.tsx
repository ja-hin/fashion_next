'use client';

import { useStudio } from '@/lib/client/StudioContext';
import AdminView from '@/components/AdminView';

export default function AdminClient() {
  const s = useStudio();
  return (
    <main className="flex-1 overflow-y-auto px-5 py-6 sm:px-7">
      <AdminView me={s.me} onMe={s.patchMe} onBalance={s.setBalance} />
    </main>
  );
}
