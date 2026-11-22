'use client';

/** Submit button that asks for confirmation before destructive actions. */
export function ConfirmSubmit({ label, confirm, className = 'btn danger sm' }: { label: string; confirm: string; className?: string }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      {label}
    </button>
  );
}
