import { describe, expect, it } from 'vitest'
import { accentTokens, palette, neutralHover, type Color } from '../src/lib/appearance'

describe('accent tokens', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const color of Object.keys(palette) as Color[]) {
      it(`${theme}/${color} keeps the selected shade and theme-specific label color`, () => {
        const tokens = accentTokens(color, theme)
        expect(tokens.primary).toBe(palette[color][theme === 'light' ? 1 : 0])
        expect(tokens.ink).toBe(tokens.primary)
        expect(tokens.foreground).toBe(theme === 'light' ? '#ffffff' : '#172128')
        expect(tokens.hover).toBe(neutralHover[theme])
        expect(tokens.selected).toMatch(/^#[0-9a-f]{6}$/)
        expect(tokens.selected).not.toBe(tokens.primary)
      })
    }
  }
})
