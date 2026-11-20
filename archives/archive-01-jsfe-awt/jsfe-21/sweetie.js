// ============================================================================
// sweetie.js — Sweetie-16 Palette (Sweet Color Names) & Dark/Light Themes
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

export const SWEETIE_16_LIST = [
  SWEETIE_16.licorice,
  SWEETIE_16.plum,
  SWEETIE_16.raspberry,
  SWEETIE_16.peach,
  SWEETIE_16.butterscotch,
  SWEETIE_16.pistachio,
  SWEETIE_16.mint,
  SWEETIE_16.spearmint,
  SWEETIE_16.blueberry,
  SWEETIE_16.blueRaspberry,
  SWEETIE_16.cottonCandy,
  SWEETIE_16.frosting,
  SWEETIE_16.marshmallow,
  SWEETIE_16.sugarDust,
  SWEETIE_16.earlGrey,
  SWEETIE_16.darkChocolate
];

const s = SWEETIE_16;

export const sweetieDarkTheme = {
  bg: s.licorice,
  panel: s.darkChocolate,
  winTitle: s.blueberry,
  winBody: s.darkChocolate,
  btn: s.earlGrey,
  btnHover: s.blueRaspberry,
  btnActive: s.blueberry,
  text: s.marshmallow,
  mutedText: s.sugarDust,
  border: s.sugarDust,
  disabled: s.blueberry,
  scrollbarTrack: s.licorice,
  scrollbarThumb: s.earlGrey,
  scrollbarThumbHover: s.frosting,
  menuBar: s.blueberry,
  menuBg: s.darkChocolate,
  menuHighlight: s.blueRaspberry,
  menuSeparator: s.earlGrey
};

export const sweetieLightTheme = {
  bg: s.marshmallow,
  panel: s.sugarDust,
  winTitle: s.cottonCandy,
  winBody: s.marshmallow,
  btn: s.frosting,
  btnHover: s.pistachio,
  btnActive: s.mint,
  text: s.licorice,
  mutedText: s.earlGrey,
  border: s.darkChocolate,
  disabled: s.sugarDust,
  scrollbarTrack: s.marshmallow,
  scrollbarThumb: s.sugarDust,
  scrollbarThumbHover: s.blueRaspberry,
  menuBar: s.sugarDust,
  menuBg: s.marshmallow,
  menuHighlight: s.cottonCandy,
  menuSeparator: s.earlGrey
};

export function applySweetieThemes(themesTarget) {
  if (!themesTarget || typeof themesTarget !== 'object') {
    return { sweetieDark: sweetieDarkTheme, sweetieLight: sweetieLightTheme };
  }
  themesTarget.sweetieDark = sweetieDarkTheme;
  themesTarget.sweetieLight = sweetieLightTheme;
  return themesTarget;
}
