'use client';

import { useStudio } from '@/lib/client/StudioContext';
import BillingView from '@/components/BillingView';

export default function BillingPage() {
  const s = useStudio();
  return (
    <main className="flex-1 overflow-y-auto px-5 py-6 sm:px-7 flex justify-center">
      <BillingView balance={s.balance} />
    </main>
  );
}