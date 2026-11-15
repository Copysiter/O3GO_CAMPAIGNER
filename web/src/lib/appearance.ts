import type { Language } from './messages'

// Material colors match native-gray-themes.html. Keep the CSS boot defaults in
// globals.css in sync so the initial frame has the same surfaces as the app.
export const materialThemes = {
  light: {
    material: 'Серебро',
    subtitle: 'Серебро · нейтральный серый',
    colors: {
      canvas: '#bfc3c5',
      surface: '#cdd0d1',
      sidebar: '#c3c7c9',
      topbar: '#c6cacc',
      heading: '#cbd0d2',
      toolbar: '#bec3c6',
      tablehead: '#c3c8ca',
      footer: '#c2c7c9',
      'control-top': '#d3d7d9',
      'control-bottom': '#c3c8cb',
      field: '#c2c8cb',
      text: '#2e353a',
      muted: '#46515a',
      'edge-dark': '#9aa3a9',
      'edge-light': '#dde1e3',
      outer: '#a1a9ae',
    },
  },
  dark: {
    material: 'Графит',
    subtitle: 'Графит · холодный подтон',
    colors: {
      canvas: '#26272a',
      surface: '#2f3033',
      sidebar: '#2a2b2e',
      topbar: '#2c2d30',
      heading: '#323336',
      toolbar: '#26272a',
      tablehead: '#2b2c2f',
      footer: '#2b2c2f',
      'control-top': '#3c3d40',
      'control-bottom': '#313235',
      field: '#242528',
      text: '#dddee1',
      muted: '#b1b2b5',
      'edge-dark': '#16171a',
      'edge-light': '#4d4e51',
      outer: '#1c1d20',
    },
  },
} as const

// Four stable slots pair the explicitly requested dark and light accents.
// [dark color, light color, dark label, light label]
export const palette = {
  preset1: ['#b5d276', '#217cb2', 'Лаймовый', 'Синий'],
  preset2: ['#61b3d5', '#049a70', 'Синий', 'Зелёный'],
  preset3: ['#e5c565', '#cd2d2d', 'Жёлтый', 'Красный'],
  preset4: ['#56c47d', '#4a535c', 'Зелёный', 'Графитовый'],
} as const
export const neutralHover = { dark: '#38393c', light: '#c5c9cb' } as const
export type Color = keyof typeof palette
export type MaterialTheme = keyof typeof materialThemes

function rgb(hex: string) {
  return [1, 3, 5].map((start) =>
    Number.parseInt(hex.slice(start, start + 2), 16),
  )
}
function mix(from: string, to: string, ratio: number) {
  const other = rgb(to)
  return (
    '#' +
    rgb(from)
      .map((channel, index) =>
        Math.round(channel + (other[index] - channel) * ratio)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  )
}
export function accentTokens(color: Color, theme: MaterialTheme) {
  const material = materialThemes[theme].colors
  const primary = palette[color][theme === 'dark' ? 0 : 1]
  return {
    primary,
    // Light accents use white labels; pastel dark accents use dark labels.
    // Keep branding, links and selection outlines identical to the swatch,
    // rather than silently mixing the chosen accent with the material text.
    foreground: theme === 'light' ? '#ffffff' : '#172128',
    ink: primary,
    selected: mix(material.sidebar, primary, theme === 'dark' ? 0.22 : 0.24),
    hover: neutralHover[theme],
  }
}

export type Preferences = {
  version: 2
  theme: 'dark' | 'light'
  accent: Color
  language: Language
  tableMode: 'auto' | 'compact' | 'scroll'
}
export const defaults: Preferences = {
  version: 2,
  theme: 'dark',
  accent: 'preset1',
  language: 'ru',
  tableMode: 'auto',
}
export function normalizePreferences(value: unknown): Preferences {
  const saved =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    ...defaults,
    // Legacy system mode is deliberately migrated to a fixed dark theme.
    theme: saved.theme === 'light' ? 'light' : 'dark',
    accent:
      typeof saved.accent === 'string' && Object.hasOwn(palette, saved.accent)
        ? (saved.accent as Color)
        : defaults.accent,
    language: saved.language === 'en' ? 'en' : 'ru',
    tableMode:
      saved.version === 2 &&
      (saved.tableMode === 'compact' || saved.tableMode === 'scroll')
        ? saved.tableMode
        : 'auto',
  }
}

