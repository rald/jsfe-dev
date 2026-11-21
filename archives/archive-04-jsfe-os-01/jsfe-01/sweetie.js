// Sweetie-16 Color Palette
// Author: GrafxKid (https://lospec.com/palette-list/sweetie-16)

export const SWEETIE_16 = Object.freeze({
  black:       '#1a1c2c',
  purple:      '#5d275d',
  red:         '#b13e53',
  orange:      '#ef7d57',
  yellow:      '#ffcd75',
  lime:        '#a7f070',
  green:       '#38b764',
  darkTeal:    '#257179',
  navy:        '#29366f',
  blue:        '#3b5dc9',
  lightBlue:   '#41a6f6',
  cyan:        '#73eff7',
  white:       '#f4f4f4',
  lightGrey:   '#94b0c2',
  grey:        '#566c86',
  darkGrey:    '#333c57',
});

export const SWEETIE_LIST = Object.freeze(Object.values(SWEETIE_16));

export function getSweetieHex(name) {
  return SWEETIE_16[name] ?? SWEETIE_16.white;
}
