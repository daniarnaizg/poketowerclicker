/**
 * PokéBastion — controles de sonido: botones independientes para Música (BGM) y Efectos (SFX).
 * Atajo de teclado: M (alterna efectos de sonido).
 */

import { useEffect, useState } from 'preact/hooks';
import { audio } from '../../audio';

/** Nota musical pixel-art 10×10; con marca roja cuando está silenciada. */
function MusicIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 10 10" shape-rendering="crispEdges" aria-hidden="true">
      <path
        d="M3 1h4v2H5v3H2v3h3V4h2V1H3z"
        fill={muted ? '#888888' : '#303030'}
      />
      {muted && (
        <path
          d="M1 9l8-8"
          stroke="#e03828"
          stroke-width="1.5"
          stroke-linecap="square"
        />
      )}
    </svg>
  );
}

/** Altavoz pixel-art 10×10; con "X" roja cuando está silenciado. */
function SfxIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 10 10" shape-rendering="crispEdges" aria-hidden="true">
      <path d="M1 4h2l2-2v6L3 6H1z" fill={muted ? '#888888' : '#303030'} />
      {muted ? (
        <path d="M6 3h1v1h1V3h1v1H8v1h1v1H8V5H7v1H6V5h1V4H6z" fill="#e03828" />
      ) : (
        <path d="M6 4h1v2H6zM7 3h1v4H7zM8 2h1v6H8z" fill="#303030" />
      )}
    </svg>
  );
}

export function AudioToggle() {
  const [musicMuted, setMusicMuted] = useState(audio.isMusicMuted());
  const [sfxMuted, setSfxMuted] = useState(audio.isSfxMuted());

  useEffect(() => {
    const update = () => {
      setMusicMuted(audio.isMusicMuted());
      setSfxMuted(audio.isSfxMuted());
    };
    return audio.subscribe(update);
  }, []);

  return (
    <div class="flex items-center gap-1 shrink-0">
      <button
        type="button"
        class={`pk-btn flex h-8 w-8 shrink-0 items-center justify-center p-0 transition-all ${
          musicMuted ? 'opacity-60 bg-[#e0e0e0]' : 'pk-btn-active'
        }`}
        style={{ minHeight: 0 }}
        data-sfx="none"
        aria-label={musicMuted ? 'Activar música (BGM)' : 'Silenciar música (BGM)'}
        title={musicMuted ? 'Música: Silenciada (clic para activar)' : 'Música: Activa (clic para silenciar)'}
        onClick={() => audio.toggleMusic()}
      >
        <MusicIcon muted={musicMuted} />
      </button>

      <button
        type="button"
        class={`pk-btn flex h-8 w-8 shrink-0 items-center justify-center p-0 transition-all ${
          sfxMuted ? 'opacity-60 bg-[#e0e0e0]' : 'pk-btn-active'
        }`}
        style={{ minHeight: 0 }}
        data-sfx="none"
        aria-label={sfxMuted ? 'Activar efectos (SFX, tecla M)' : 'Silenciar efectos (SFX, tecla M)'}
        title={sfxMuted ? 'Efectos: Silenciados (clic o M para activar)' : 'Efectos: Activos (clic o M para silenciar)'}
        onClick={() => audio.toggleSfx()}
      >
        <SfxIcon muted={sfxMuted} />
      </button>
    </div>
  );
}
