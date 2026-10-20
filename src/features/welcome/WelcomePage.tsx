import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight, Check, CloudOff, Database, HardDrive, Languages } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useI18n } from '@/hooks/useI18n'
import { useSettings } from '@/hooks/useData'
import { saveSettings } from '@/db/seed'
import { LANGUAGES } from '@/lib/i18n'
import { ACCENTS, type Theme } from '@/types/models'

const THEMES: Theme[] = ['light', 'dark', 'system']

export function WelcomePage() {
  const { settings } = useSettings()
  const { t, language } = useI18n()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const start = async (goToSettings = false) => {
    setBusy(true)
    await saveSettings({ onboarded: true })
    navigate(goToSettings ? '/settings' : '/', { replace: true })
  }

  const features = [
    { icon: HardDrive, title: t('welcome.localTitle'), desc: t('welcome.localDesc') },
    { icon: CloudOff, title: t('welcome.offlineTitle'), desc: t('welcome.offlineDesc') },
    { icon: Database, title: t('welcome.backupTitle'), desc: t('welcome.backupDesc') },
  ]

  return (
    <div className="min-h-dvh bg-canvas px-5 py-10">
      <div className="mx-auto flex w-full max-w-xl flex-col">
        <div className="animate-pop-in flex flex-col items-center text-center">
          <Logo size={64} />
          <span className="mt-5 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
            {t('welcome.badge')}
          </span>
          <h1 className="mt-3 text-[2rem] font-semibold leading-[1.1] tracking-[-0.04em]">
            {t('welcome.title')}
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">{t('welcome.subtitle')}</p>
        </div>

        <div className="mt-8 space-y-2.5">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <feature.icon size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold">{feature.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
          <div className="mb-1.5 flex items-center gap-2 text-sm font-medium">
            <Languages size={16} className="text-muted" /> {t('welcome.language')}
          </div>
          <SegmentedControl
            value={language}
            onChange={(value) => void saveSettings({ language: value })}
            options={LANGUAGES.map((item) => ({ value: item.value, label: item.label }))}
          />

          <div className="mb-2 mt-5 text-sm font-medium">{t('welcome.theme')}</div>
          <SegmentedControl
            value={settings.theme}
            onChange={(theme) => void saveSettings({ theme })}
            options={THEMES.map((theme) => ({
              value: theme,
              label: t(
                theme === 'light'
                  ? 'settings.themeLight'
                  : theme === 'dark'
                    ? 'settings.themeDark'
                    : 'settings.themeSystem',
              ),
            }))}
          />

          <div className="mt-4 flex items-center gap-2">
            {(Object.keys(ACCENTS) as (keyof typeof ACCENTS)[]).slice(0, 6).map((key) => {
              const accent = ACCENTS[key]
              const active = settings.accent === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => void saveSettings({ accent: key })}
                  aria-label={t('settings.accentAria', { name: accent.label })}
                  aria-pressed={active}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform ${
                    active ? 'scale-110 border-ink' : 'border-transparent'
                  }`}
                  style={{ background: accent.light }}
                >
                  {active ? <Check size={14} className="text-white" /> : null}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <Button full size="lg" disabled={busy} onClick={() => void start()}>
            {t('welcome.start')} <ArrowRight size={17} />
          </Button>
          <Button full variant="ghost" disabled={busy} onClick={() => void start(true)}>
            {t('welcome.importBackup')}
          </Button>
        </div>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-faint">{t('welcome.footer')}</p>
      </div>
    </div>
  )
}
