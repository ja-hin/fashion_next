import Link from 'next/link';

/** The centred card layout and logo shared by sign in, register, forgot and reset. */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-[380px]">
        <Link href="/" aria-label="Faishon.studio home" className="mb-6 flex justify-center">
          {/* eslint-disable @next/next/no-img-element */}
          <img
            className="brand-logo brand-logo-light !h-[42px]"
            src="/logo-black.png"
            alt="Faishon.studio"
          />
          <img
            className="brand-logo brand-logo-dark !h-[42px]"
            src="/logo-white.png"
            alt="Faishon.studio"
          />
          {/* eslint-enable @next/next/no-img-element */}
        </Link>
        {children}
      </div>
    </div>
  );
}