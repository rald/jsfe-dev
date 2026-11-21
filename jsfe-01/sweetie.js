// ============================================================================
// sweetie.js — Sweetie-16 Palette (Sweet Color Names)
// Strictly Sweetie-16: no other colors anywhere in jsfe Web OS.
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

export const SWEETIE_SWATCHES = [
  { name: 'licorice', hex: '#1a1c2c' },
  { name: 'plum', hex: '#5d275d' },
  { name: 'raspberry', hex: '#b13e53' },
  { name: 'peach', hex: '#ef7d57' },
  { name: 'butterscotch', hex: '#ffcd75' },
  { name: 'pistachio', hex: '#a7f070' },
  { name: 'mint', hex: '#38b764' },
  { name: 'spearmint', hex: '#257179' },
  { name: 'blueberry', hex: '#29366f' },
  { name: 'blueRaspberry', hex: '#3b5dc9' },
  { name: 'cottonCandy', hex: '#41a6f6' },
  { name: 'frosting', hex: '#73eff7' },
  { name: 'marshmallow', hex: '#f4f4f4' },
  { name: 'sugarDust', hex: '#94b0c2' },
  { name: 'earlGrey', hex: '#566c86' },
  { name: 'darkChocolate', hex: '#333c57' }
];

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
