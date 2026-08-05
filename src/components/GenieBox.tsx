'use client';

import { useState } from 'react';
import { postForm, ApiError } from '@/lib/client/api';
import { GenieIcon } from './icons';

/**
 * The Prompt Genie button that sits inside a prompt textarea, plus the
 * suggestion panel it opens.
 */
export default function GenieBox({
  text,
  onUse,
  onBalance,
  geniePrice,
  compact = false,
}: {
  text: string;
  onUse: (improved: string) => void;
  onBalance: (b: number) => void;
  geniePrice: number;
  /** Batch rows apply the suggestion straight into the row, with no panel. */
  compact?: boolean;
}) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [charged, setCharged] = useState(0);
  const [busy, setBusy] = useState(false);

  async function run() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setNote('');
    try {
      const j = await postForm<{
        improved: string;
        charged: number;
        balance: number;
        next_charged: boolean;
        capped: boolean;
      }>('/api/genie', { prompt: t });

      onBalance(j.balance);
      if (j.capped) {
        setNote('Genie cap reached for this prompt.');
        return;
      }
      setCharged(j.charged);
      if (compact) onUse(j.improved);
      else setSuggestion(j.improved);
    } catch (e) {
      setNote(
        e instanceof ApiError && e.status === 402
          ? 'Not enough balance for a paid improvement.'
          : 'Genie is unavailable right now.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        title="Prompt Genie — sharpen your wording"
        className={`group absolute bottom-[7px] right-[7px] flex items-center justify-center rounded-lg transition hover:scale-110 disabled:opacity-50 ${
          compact ? 'h-[26px] w-[26px]' : 'h-[30px] w-[30px]'
        }`}
      >
        <GenieIcon className={compact ? 'h-6 w-6' : 'h-7 w-7'} />
        <span className="pointer-events-none absolute bottom-[38px] right-0 z-[9] w-[184px] rounded-lg bg-ink px-2.5 py-2 text-[11px] leading-[1.45] text-surface opacity-0 transition group-hover:opacity-100">
          <b className="text-[#c9a8ff]">✦ Prompt Genie</b> — sharpen your wording.{' '}
          {geniePrice > 0 ? `${geniePrice} credit each.` : 'Free.'}
        </span>
      </button>

      {!compact && suggestion && (
        <div className="mt-2.5 overflow-hidden rounded-[11px] border border-line bg-surface2">
          <div className="border-b border-line px-[11px] py-2 text-[10.5px] font-bold text-genie">
            ✦ Genie suggestion{charged ? ` · charged ${charged} cr` : ' · free'}
          </div>
          <div className="p-[11px]">
            <div className="mb-1 text-[10px] font-bold uppercase text-muted">
              Genie&apos;s version
            </div>
            <p className="mb-2.5 text-[12.5px] leading-[1.5]">{suggestion}</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onUse(suggestion);
                  setSuggestion(null);
                }}
                className="rounded-lg bg-brand px-[11px] py-[7px] text-xs font-bold text-white"
              >
                Use this
              </button>
              <button
                onClick={() => setSuggestion(null)}
                className="rounded-lg bg-line px-[11px] py-[7px] text-xs font-bold text-ink"
              >
                Keep mine
              </button>
            </div>
          </div>
        </div>
      )}

      {note && <div className="mt-2 text-[11px] font-semibold text-amber">{note}</div>}
    </>
  );
}