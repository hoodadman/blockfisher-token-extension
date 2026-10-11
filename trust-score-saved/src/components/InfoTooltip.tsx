import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

interface InfoTooltipProps {
  label: string;
  children: ReactNode;
}

/** Opens on mouse hover or keyboard focus, and stays open when clicked or tapped. */
export function InfoTooltip({ label, children }: InfoTooltipProps) {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || focused || pinned;

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setHovered(false);
      setFocused(false);
      setPinned(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!anchor.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <span
      ref={anchor}
      className="tip-anchor"
      onPointerEnter={(event) => event.pointerType === 'mouse' && setHovered(true)}
      onPointerLeave={(event) => event.pointerType === 'mouse' && setHovered(false)}
    >
      <button
        type="button"
        className="tip-trigger"
        data-open={open || undefined}
        aria-label={`More about: ${label}`}
        aria-describedby={id}
        onClick={() => setPinned((value) => !value)}
        onFocus={(event) => event.currentTarget.matches(':focus-visible') && setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setPinned(false);
        }}
      >
        <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 9v4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="10" cy="6.3" r="1.05" fill="currentColor" />
        </svg>
      </button>
      <span role="tooltip" id={id} className="tip" hidden={!open}>
        {children}
      </span>
    </span>
  );
}
