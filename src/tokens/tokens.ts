// Pulled from Figma variables (Simulator Screen section).
// Add more here when they get pulled from Figma. Never hard code colors in components.
export const color = {
  textPrimary: '#0a0a0a',
  textSecondary: '#262626',
  surfaceCanvas: '#ffffff',
  surfaceNeutral: '#f5f5f5',
  borderDivider: '#d4d4d4',
  borderControl: '#737373',
  neutral200: '#e5e5e5',
  actionDisabled: '#e5e5e5',
  interactiveAction: '#0f766e',
  interactiveFocus: '#0d9488',
  feedbackSuccess: '#428015',
  feedbackWarning: '#d97706',
  feedbackError: '#b91c1c',
  successSurface: '#f0fdf4',
  warningSurface: '#fffbeb',
  warningText: '#92400e',
  errorSurface: '#fef2f2',
  actionOn: '#ffffff',
  actionSecondary: '#f5f5f5',
  screenOff: '#141414', // Figma "Screen off"
  idleDim: 'rgba(255, 255, 255, 0.5)', // Figma "Idle dim": white at 50%
  scrim: 'rgba(0, 0, 0, 0.48)', // Map lock dim: black 80% at 60% opacity
} as const

// Object proximity heat map (Figma "Object Detection Flows"): gray out of range, light amber, orange (alert), red-orange (danger).
export const heat = {
  base: '#dbdbdb',
  light: '#f7cc8c',
  orange: '#ed8c26',
  hot: '#c7401a',
} as const

// 3D world colors. Not in Figma yet: a warm autumn palette, toned down so it reads less like a video game
// (Figma "References for Environment in the simulator": Animal Crossing adjacent, fewer objects, softer colors).
export const scene = {
  // Sky: hazy blue overhead, warm haze at the horizon (also the fog color)
  sky: '#b9cbd6',
  skyHorizon: '#efe2c9',
  // Ground: golden autumn grass, with a slightly deeper bank on the slope
  grass: '#bcb38f',
  grassSlope: '#a69c74',
  grassStamp: '#f3eee4', // the faint triangle pattern on the grass (multiplies the grass color)
  tuft: '#aa9e68',
  tuftTip: '#d6bf82',
  gravel: '#cbbca0',
  // House
  wall: '#f2e8d8',
  roof: '#9e6553', // warm terracotta red (Hanne liked the red roof)
  trim: '#fbf6ec',
  door: '#8a5c3e',
  window: '#a7c0cc',
  sidingLine: '#e2d6c2', // the faint horizontal siding lines (multiplies the wall color)
  base: '#d9cab1', // foundation strip along the bottom of the walls
  gutter: '#a0715f',
  garage: '#f6efe3',
  garageLine: '#ddd2bf',
  chimney: '#9b5e4a',
  chimneyCap: '#6f4b3d',
  vent: '#8f8f8a',
  ventCap: '#6e6f6b',
  // Plants
  bush: '#8c8f4f',
  bushDark: '#767c43',
  treeOrange: '#d98a40',
  treeGold: '#dcae55',
  treeRust: '#bf6a3a',
  pine: '#566b4c',
  pineDark: '#47593f',
  trunk: '#8f6142',
  flowerYellow: '#ecd27a',
  flowerCoral: '#e39a72',
  flowerWhite: '#f4efe4',
  leaf: '#8d9256',
  // Posts and the mailbox
  post: '#8a6446',
  postCap: '#6e4f37',
  mailbox: '#b65f45',
  lamp: '#f6e6b8',
  pallet: '#b08a5a',
  shingles: '#4a4a4f',
  shinglesHeavy: '#3a3330',
  // Light: warm sun, warm bounce from the grass
  sun: '#fff1dc',
  skyLight: '#fff3df',
  groundLight: '#b9ac85',
  // The operator: a Smiski-style figure, pale glowy yellow-green, in a green hard hat (Figma "Operator references")
  operator: '#e6eba4',
  operatorFace: '#2e4a2b',
  hardHat: '#5e9a4b',
  hardHatDark: '#4c8040',
  tabletBody: '#2b2b2b',
  // The crew (same Smiski figure): roofers in orange hard hats, the foreman in white with a clipboard
  rooferHat: '#e0893c',
  rooferHatDark: '#c2702a',
  foremanHat: '#f3efe6',
  foremanHatDark: '#d6cfc1',
  clipboard: '#9a6f4c',
  paper: '#f7f3ea',
  hammer: '#5d5d5a',
  tabletScreen: '#d7e8e4',
  truckCab: '#139488',
  truckBoom: '#0b5e58',
  tire: '#2f3336',
  rim: '#9aa3a7',
} as const

export const space ={ xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48 } as const
export const radius = { sm: 4, md: 8, lg: 16, full: 999 } as const

export const font = {
  words: "'Be Vietnam Pro', system-ui, sans-serif",
  numbers: "'Roboto Mono', ui-monospace, monospace",
} as const
