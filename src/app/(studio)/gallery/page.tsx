'use client';

import { useRouter } from 'next/navigation';
import { useStudio } from '@/lib/client/StudioContext';
import { useDialog } from '@/components/Dialog';
import GalleryView from '@/components/GalleryView';
import { getJson, ApiError } from '@/lib/client/api';
import { shootSourceToRefs } from '@/lib/client/garment-refs';
import type { ResumePayload } from '@/lib/client/types';

export default function GalleryPage() {
  const s = useStudio();
  const dialog = useDialog();
  const router = useRouter();

  return (
    <main className="flex-1 overflow-y-auto px-5 py-6 sm:px-7 flex justify-center">
      <GalleryView
        onZoom={s.openZoom}
        onSaveAsModel={s.openSaveModel}
        videoPrice={s.me.video_price ?? 0}
        onBalance={s.setBalance}
        onContinueShoot={async (pid) => {
          try {
            const j = await s.shoot.resume(pid);
            /*
             * Show what this shoot was made FROM, alongside the restored
             * results , resume() rehydrates the output and used to leave the
             * uploader empty, which read as "no garment" on a shoot that
             * plainly had one.
             *
             * Context only. Extra poses are generated from the locked hero, not
             * from these files, so changing them here does not change what
             * Continue produces , it is the same garment either way.
             *
             * resume() already returned the payload, so this costs no second
             * request. A failure to read the images is swallowed: it must never
             * stop a shoot being continued, which is what the customer asked
             * for.
             */
            if (j.source?.refs?.length) {
              try {
                s.setEnsemble(await shootSourceToRefs(j.source.refs, j.title || j.shoot));
                s.patchSetup({
                  ref_mode: j.source.ref_mode as never,
                  category: j.source.category || s.setup.category,
                });
              } catch {
                s.setEnsemble([]);
              }
            }
            router.push('/generate');
          } catch {
            await dialog.alert('Could not load this shoot.');
          }
        }}
      />
    </main>
  );
}
