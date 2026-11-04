'use client'

import { Modal } from './common'
import { usePreferences, palette, defaults, type Color } from './providers'
import { useI18n } from '@/lib/i18n'
import { Button } from './ui/button'
import { accentTokens, materialThemes } from '@/lib/appearance'
import { Moon, Sun, Check } from 'lucide-react'
export function Settings({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { preferences: p, resolvedTheme, setPreferences } = usePreferences()
  const { t } = useI18n()
  const labelIndex = resolvedTheme === 'dark' ? 2 : 3
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('Внешний вид')}
      description={t(
        'Тема, основной цвет и язык. Настройки сохраняются в этом браузере.',
      )}
      footer={
        <>
          <Button
            variant="outline"
            onClick={() =>
              setPreferences({ ...defaults, language: p.language })
            }
          >
            {t('Сбросить')}
          </Button>
          <Button onClick={() => onOpenChange(false)}>{t('Готово')}</Button>
        </>
      }
    >
      <div className="settings-form space-y-5">
        <section>
          <h3 className="mb-2 text-xs font-medium">{t('Оформление')}</h3>
          <div className="theme-choice-grid theme-choice-grid-fixed">
            {(
              [
                { value: 'dark', label: 'Тёмная', icon: Moon },
                { value: 'light', label: 'Светлая', icon: Sun },
              ] as const
            ).map((item) => (
              <button
                key={item.value}
                type="button"
                aria-label={t(item.label)}
                aria-pressed={p.theme === item.value}
                className="theme-choice"
                onClick={() => setPreferences({ ...p, theme: item.value })}
              >
                <span className="theme-choice-top">
                  <item.icon size={16} className="theme-mode-icon" />
                  <span className="theme-choice-title">{t(item.label)}</span>
                  <Check size={14} className="theme-check" aria-hidden="true" />
                </span>
                <span className="theme-choice-description">
                  {t(materialThemes[item.value].subtitle)}
                </span>
                <span className="theme-material" aria-hidden="true">
                  {(['sidebar', 'canvas', 'surface'] as const).map((key) => (
                    <span
                      key={key}
                      style={{
                        background: materialThemes[item.value].colors[key],
                      }}
                    />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </section>
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-medium">{t('Основной цвет')}</h3>
            <span className="text-xs text-muted-foreground">
              {t(palette[p.accent][labelIndex])}
            </span>
          </div>
          <div
            className="accent-grid accent-grid-four"
            role="group"
            aria-label={t('Основной цвет')}
          >
            {(Object.keys(palette) as Color[]).map((color) => (
              <button
                key={color}
                type="button"
                title={t(palette[color][labelIndex])}
                aria-label={t('Цвет: {name}', {
                  name: t(palette[color][labelIndex]),
                })}
                aria-pressed={p.accent === color}
                data-color={color}
                className={`accent-swatch accent-rectangle ${p.accent === color ? 'is-selected' : ''}`}
                style={{
                  backgroundColor:
                    palette[color][resolvedTheme === 'dark' ? 0 : 1],
                  color: accentTokens(color, resolvedTheme).foreground,
                }}
                onClick={() => setPreferences({ ...p, accent: color })}
              >
                {p.accent === color && <Check size={17} />}
              </button>
            ))}
          </div>
        </section>
        <div className="settings-inline-controls grid min-w-0 grid-cols-2 gap-3">
          <label className="form-field min-w-0">
            <span className="text-xs font-medium">{t('Режим таблиц')}</span>
            <select
              aria-label={t('Режим таблиц')}
              className="native-select w-full min-w-0"
              value={p.tableMode}
              onChange={(event) =>
                setPreferences({
                  ...p,
                  tableMode: event.target.value as
                    'auto' | 'compact' | 'scroll',
                })
              }
            >
              <option value="auto">{t('Автоматически')}</option>
              <option value="compact">{t('Компактно')}</option>
              <option value="scroll">{t('Прокрутка')}</option>
            </select>
          </label>
          <label className="form-field min-w-0">
            <span className="text-xs font-medium">{t('Язык')}</span>
            <select
              aria-label={t('Язык')}
              className="native-select w-full min-w-0"
              value={p.language}
              onChange={(event) =>
                setPreferences({
                  ...p,
                  language: event.target.value as 'ru' | 'en',
                })
              }
            >
              <option value="ru">{t('Русский')}</option>
              <option value="en">{t('English')}</option>
            </select>
          </label>
        </div>
      </div>
    </Modal>
  )
}
