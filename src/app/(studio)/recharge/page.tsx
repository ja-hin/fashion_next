'use client';

import { useStudio } from '@/lib/client/StudioContext';
import RechargeView from '@/components/RechargeView';

export default function RechargePage() {
  const s = useStudio();
  return (
    <main className="flex-1 overflow-y-auto px-5 py-6 sm:px-7">
      <RechargeView balance={s.balance} onBalance={s.setBalance} />
    </main>
  );
}
