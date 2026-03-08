import { ALL_POKEMON } from './data/pokemon';
import { pickNextPokemon } from './pickNextPokemon';

/**
 * Process Pokemon unlocks from credit bank.
 * Every 10 credits unlocks a Pokemon chosen by weighted bucket probability
 * with evolution-chain bias toward base forms.
 * After 3 consecutive regular unlocks, shiny chance activates —
 * the next unlock also awards a bonus shiny version of a random collected Pokemon.
 */
export const unlockPokemon = ({ creditBank, consecutiveRegular, shinyEligible, collection }) => {
  const newUnlocks = [];
  let col = { ...collection };

  while (creditBank >= 10) {
    creditBank -= 10;
    // Pick next Pokemon using weighted bucket + evolution bias
    const nextPk = pickNextPokemon(col);
    if (nextPk) {
      col = { ...col, [nextPk.id]: { ...(col[nextPk.id] || {}), regular: true } };
      newUnlocks.push({ ...nextPk, shiny: false });
      consecutiveRegular = (consecutiveRegular || 0) + 1;
      if (consecutiveRegular >= 3) shinyEligible = true;
    }
    // Bonus shiny when eligible
    if (shinyEligible) {
      const eligible = Object.entries(col).filter(([, v]) => v.regular && !v.shiny).map(([id]) => parseInt(id));
      if (eligible.length > 0) {
        const shinyId = eligible[Math.floor(Math.random() * eligible.length)];
        const pk = ALL_POKEMON.find(p => p.id === shinyId);
        col = { ...col, [shinyId]: { ...col[shinyId], shiny: true } };
        newUnlocks.push({ ...pk, shiny: true });
      }
      shinyEligible = false;
      consecutiveRegular = 0;
    }
  }

  return { creditBank, consecutiveRegular, shinyEligible, collection: col, newUnlocks };
};
