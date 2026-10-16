/** PokéBastion — fila de estrellas de Despertar (1★ a 5★); 5★ = dorada (Aura Apex). */
import { MAX_STARS } from '../../config/balance.config';

export function StarRow({ stars, size = 10 }: { stars: number; size?: number }) {
  const apex = stars >= MAX_STARS;
  return (
    <span
      class="inline-flex leading-none"
      style={{ fontSize: `${size}px`, color: apex ? '#e0a000' : '#303030', letterSpacing: '1px' }}
      aria-label={`${stars} estrellas`}
    >
      {Array.from({ length: MAX_STARS }, (_, i) => (
        <span key={i} style={{ opacity: i < stars ? 1 : 0.22 }}>★</span>
      ))}
    </span>
  );
}
