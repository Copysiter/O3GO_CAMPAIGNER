import { describe, expect, it } from 'vitest'
import { english, messages, translate } from '../src/lib/messages'
import { accentTokens, defaults, normalizePreferences, neutralHover, palette, type Color } from '../src/lib/appearance'
describe('central interface translations', () => {
  it('covers both languages with identical message keys', () => {
    expect(Object.keys(english).length).toBeGreaterThan(400)
    expect(Object.keys(messages.ru)).toEqual(Object.keys(messages.en))
    for (const text of Object.values(english)) expect(text.trim()).not.toBe('')
  })
  it('translates the full theme and navigation controls', () => {
    expect(translate('en', 'Кампании')).toBe('Campaigns')
    expect(translate('en', 'Тёмная')).toBe('Dark')
    expect(translate('en', 'Светлая')).toBe('Light')
    expect(translate('en', 'Обновить')).toBe('Refresh')
    expect(translate('ru', 'Обновить')).toBe('Обновить')
  })
  it('interpolates values without translating user data', () => {
    expect(translate('en', 'Цвет: {name}', { name: 'Cobalt' })).toBe('Color: Cobalt')
    expect(translate('en', 'Произвольное имя кампании')).toBe('Произвольное имя кампании')
  })
  it('retains all named placeholders across translations', () => {
    const names = (value: string) => [...new Set([...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]))].sort()
    for (const [key, value] of Object.entries(english)) expect(names(value), key).toEqual(names(key))
  })
})


describe('fixed appearance preferences', () => {
  it('offers only the four requested accent pairs', () => {
    expect(Object.values(palette).map(([dark, light]) => [dark, light])).toEqual([
      ['#b5d276', '#217cb2'],
      ['#61b3d5', '#049a70'],
      ['#e5c565', '#cd2d2d'],
      ['#56c47d', '#4a535c'],
    ])
  })
  it('migrates automatic themes and removed accent colors to safe fixed defaults', () => {
    expect(normalizePreferences({ version: 2, theme: 'system', accent: 'cobalt', language: 'en', tableMode: 'scroll' })).toEqual({
      ...defaults, language: 'en', tableMode: 'scroll',
    })
    expect(normalizePreferences({ version: 2, theme: 'light', accent: 'orange', tableMode: 'compact' })).toEqual({
      ...defaults, theme: 'light', tableMode: 'compact',
    })
    for (const value of [null, 'corrupt', { accent: '__proto__' }, { accent: 'constructor' }]) {
      expect(normalizePreferences(value)).toEqual(defaults)
    }
  })
  it('retains a valid paired slot and table mode when switching fixed themes', () => {
    for (const theme of ['dark', 'light'] as const) {
      for (const accent of Object.keys(palette) as Color[]) {
        expect(normalizePreferences({ version: 2, theme, accent, tableMode: 'compact' })).toEqual({
          ...defaults, theme, accent, tableMode: 'compact',
        })
      }
    }
  })
  it('keeps hover surfaces neutral for every accent in each theme', () => {
    for (const theme of ['dark', 'light'] as const) {
      for (const accent of Object.keys(palette) as Color[]) {
        expect(accentTokens(accent, theme).hover).toBe(neutralHover[theme])
        expect(accentTokens(accent, theme).primary).toBe(palette[accent][theme === 'dark' ? 0 : 1])
      }
    }
  })
})
