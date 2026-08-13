'use client';

import { DialogProvider } from './Dialog';
import { StudioProvider, useStudio } from '@/lib/client/StudioContext';
import TopBar from './TopBar';
import SideNav from './SideNav';
import Lightbox from './Lightbox';
import SaveModelModal from './SaveModelModal';
import type { Me } from '@/lib/client/types';

/**
 * The persistent studio chrome: top bar, the shared state provider, and the
 * overlays that any page can open.
 *
 * This is a layout, so it stays mounted while you navigate between /generate,
 * /gallery and the rest — which is what keeps an in-progress shoot alive.
 */
export default function StudioShell({
  me,
  children,
}: {
  me: Me;
  children: React.ReactNode;
}) {
  return (
    <DialogProvider>
      <StudioProvider initialMe={me}>
        <Chrome>{children}</Chrome>
      </StudioProvider>
    </DialogProvider>
  );
}

function Chrome({ children }: { children: React.ReactNode }) {
  const s = useStudio();

  return (
    <div className="flex h-screen flex-col">
      <TopBar me={s.me} balance={s.balance} />

      {s.me.provider === 'mock' && (
        <div className="border-b border-line bg-amber-soft px-4 py-[9px] text-center text-[12.5px] font-bold text-amber">
          ⚠ DEMO mode — no AI key found. These are placeholder images. Set{' '}
          <b>GEMINI_API_KEY</b> in your environment and restart for real generation.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <SideNav me={s.me} />
        {children}
      </div>

      {s.saveModelPid && (
        <SaveModelModal
          pid={s.saveModelPid}
          onClose={s.closeSaveModel}
          onSaved={s.bumpModels}
        />
      )}

      {s.lightbox && (
        <Lightbox
          items={s.lightbox.items}
          index={s.lightbox.index}
          onIndex={s.setLightboxIndex}
          onClose={s.closeZoom}
        />
      )}
    </div>
  );
}
