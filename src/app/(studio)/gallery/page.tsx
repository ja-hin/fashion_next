'use client';

import { useRouter } from 'next/navigation';
import { useStudio } from '@/lib/client/StudioContext';
import { useDialog } from '@/components/Dialog';
import GalleryView from '@/components/GalleryView';

export default function GalleryPage() {
  const s = useStudio();
  const dialog = useDialog();
  const router = useRouter();

  return (
    <main className="flex-1 overflow-y-auto px-5 py-6 sm:px-7 flex justify-center">
      <GalleryView
        onZoom={s.openZoom}
        onSaveAsModel={s.openSaveModel}
        onContinueShoot={async (pid) => {
          try {
            await s.shoot.resume(pid);
            router.push('/generate');
          } catch {
            await dialog.alert('Could not load this shoot.');
          }
        }}
      />
    </main>
  );
}
