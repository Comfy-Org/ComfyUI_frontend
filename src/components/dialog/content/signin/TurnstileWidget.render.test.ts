import { render, screen } from '@testing-library/vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

import { loadTurnstile } from '@comfyorg/account/turnstileScript'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

import TurnstileWidget from './TurnstileWidget.vue'

vi.mock(import('@/config/turnstile'), () => ({
  getTurnstileSiteKey: () => 'site-key'
}))

// The only real network boundary: the Cloudflare script itself. Everything
// else in this render, the app adapter and the shared @comfyorg/account
// component, is the real code, unmocked, unlike SignUpForm.test.ts and
// TurnstileWidget.test.ts, which both stub the shared component away.
vi.mock<unknown>(import('@comfyorg/account/turnstileScript'), () => ({
  loadTurnstile: vi.fn(() => new Promise(() => {}))
}))

function i18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })
}

describe('TurnstileWidget, mounted through the real @comfyorg/account component', () => {
  it('mounts the shared widget, not a stub', () => {
    const store = useColorPaletteStore()
    store.completedActivePalette.light_theme = true
    vi.mocked(loadTurnstile).mockClear()

    render(TurnstileWidget, { global: { plugins: [i18n()] } })

    expect(
      loadTurnstile,
      'only the shared component calls the loader; a stub or a broken import never would'
    ).toHaveBeenCalledOnce()
  })

  it('renders no error alert before the challenge reports one', () => {
    const store = useColorPaletteStore()
    store.completedActivePalette.light_theme = true

    render(TurnstileWidget, { global: { plugins: [i18n()] } })

    expect(screen.queryByRole('alert')).toBeNull()
  })
})
