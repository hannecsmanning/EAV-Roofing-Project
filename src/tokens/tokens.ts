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
  scrim: 'rgba(0, 0, 0, 0.48)', // Map lock dim: black 80% at 60% opacity
} as const

// Object proximity heat map (Figma "Object Detection Flows"): gray out of range, light amber, orange (alert), red-orange (danger).
export const heat = {
  base: '#dbdbdb',
  light: '#f7cc8c',
  orange: '#ed8c26',
  hot: '#c7401a',
} as const

// 3D world colors. Placeholders, not in Figma yet. Swap these when the world gets its own palette.
export const scene = {
  sky: '#dfe6ee',
  grass: '#c3cbb9',
  grassSlope: '#a9b394',
  gravel: '#b9b4aa',
  wall: '#e7e2d8',
  roof: '#8a8a8a',
  trim: '#5b5b5b',
  window: '#9fb3c4',
  bush: '#7d8f6a',
  bushDark: '#647556',
  post: '#6b6259',
  pallet: '#b08a5a',
  shingles: '#4a4a4f',
  shinglesHeavy: '#3a3330',
  skyLight: '#ffffff',
  groundLight: '#b8c2a8',
  operator: '#eef0e6',
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
