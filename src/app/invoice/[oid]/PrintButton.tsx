'use client';

/** The one interactive bit of the invoice page — kept tiny so the rest stays a server component. */
export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        background: '#e11d2a',
        color: '#fff',
        border: 0,
        borderRadius: 9,
        padding: '9px 18px',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      Download / Print PDF
    </button>
  );
}