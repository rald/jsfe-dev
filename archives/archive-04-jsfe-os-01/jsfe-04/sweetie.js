// ============================================================================
// sweetie.js — Sweetie-16 Palette (Sweet Color Names)
// ============================================================================

export const SWEETIE_16 = {
  licorice: '#1a1c2c',
  plum: '#5d275d',
  raspberry: '#b13e53',
  peach: '#ef7d57',
  butterscotch: '#ffcd75',
  pistachio: '#a7f070',
  mint: '#38b764',
  spearmint: '#257179',
  blueberry: '#29366f',
  blueRaspberry: '#3b5dc9',
  cottonCandy: '#41a6f6',
  frosting: '#73eff7',
  marshmallow: '#f4f4f4',
  sugarDust: '#94b0c2',
  earlGrey: '#566c86',
  darkChocolate: '#333c57'
};

export const SWEETIE_THEME = Object.freeze({
  bgPrimary: SWEETIE_16.licorice,
  bgElevated: SWEETIE_16.blueberry,
  bgSurface: SWEETIE_16.darkChocolate,
  border: SWEETIE_16.earlGrey,
  textPrimary: SWEETIE_16.marshmallow,
  textMuted: SWEETIE_16.sugarDust,
  accentPrompt: SWEETIE_16.cottonCandy,
  accentResult: SWEETIE_16.pistachio,
  accentPrint: SWEETIE_16.frosting,
  accentError: SWEETIE_16.raspberry,
  accentWarn: SWEETIE_16.butterscotch,
  accentKeyword: SWEETIE_16.peach,
  accentBadge: SWEETIE_16.plum,
  accentSuccess: SWEETIE_16.mint,
  accentLink: SWEETIE_16.blueRaspberry
});
