/** PokéBastion — etiqueta de tipo elemental estilo Pokémon. */
import type { PokemonType } from '../../core/types';
import { TYPE_CHIP, TYPE_LABEL_ES } from '../typeColors';

export function TypeChip({ type }: { type: PokemonType }) {
  return (
    <span class="pk-chip" style={{ backgroundColor: TYPE_CHIP[type] }}>
      {TYPE_LABEL_ES[type]}
    </span>
  );
}
