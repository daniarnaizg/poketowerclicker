/**
 * PokéBastion — botón de sonido (silenciar / activar). Atajo de teclado: M.
 */

import { useEffect, useState } from 'preact/hooks';
import { audio } from '../../audio';

/** Altavoz pixel-art 8×8; con "X" cuando está silenciado. */
function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 10 10" shape-rendering="crispEdges" aria-hidden="true">
      <path d="M1 4h2l2-2v6L3 6H1z" fill="#303030" />
      {muted ? (
        <path d="M6 3h1v1h1V3h1v1H8v1h1v1H8V5H7v1H6V5h1V4H6z" fill="#e03828" />
      ) : (
        <path d="M6 4h1v2H6zM7 3h1v4H7zM8 2h1v6H8z" fill="#303030" />
      )}
    </svg>
  );
}

export function AudioToggle() {
  const [muted, setMuted] = useState(audio.isMuted());
  useEffect(() => audio.subscribe(() => setMuted(audio.isMuted())), []);

  return (
    <button
      type="button"
      class="pk-btn flex h-8 w-8 shrink-0 items-center justify-center p-0"
      style={{ minHeight: 0 }}
      data-sfx="none"
      aria-label={muted ? 'Activar sonido (M)' : 'Silenciar (M)'}
      title={muted ? 'Activar sonido (M)' : 'Silenciar (M)'}
      onClick={() => audio.toggleMute()}
    >
      <SpeakerIcon muted={muted} />
    </button>
  );
}
