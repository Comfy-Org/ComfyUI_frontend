import { render } from '@testing-library/vue'
import { defineComponent, h, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

import TurnstileWidget from './TurnstileWidget.vue'

const { lightTheme, sharedProps, sharedReset } = vi.hoisted(() => ({
  lightTheme: { value: true },
  sharedProps: { value: {} },
  sharedReset: vi.fn()
}))

vi.mock('@comfyorg/auth-core/TurnstileWidget.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      props: {
        siteKey: String,
        theme: String,
        expiredMessage: String,
        failedMessage: String,
        loader: Function
      },
      setup(props, { expose }) {
        sharedProps.value = props
        expose({ reset: sharedReset })
        return () => h('div', { 'data-testid': 'shared-turnstile' })
      }
    })
  }
})

vi.mock('@comfyorg/auth-core/turnstileScript', () => ({
  loadTurnstile: vi.fn()
}))

vi.mock('@/config/turnstile', () => ({
  getTurnstileSiteKey: () => 'site-key'
}))

vi.mock('@/stores/workspace/colorPaletteStore', () => ({
  useColorPaletteStore: () => ({
    completedActivePalette: {
      get light_theme() {
        return lightTheme.value
      }
    }
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      auth: {
        turnstile: {
          expired: 'Challenge expired',
          failed: 'Verification failed'
        }
      }
    }
  }
})

function renderWidget(isLightTheme: boolean) {
  lightTheme.value = isLightTheme
  return render(TurnstileWidget, {
    global: { plugins: [i18n] }
  })
}

describe('TurnstileWidget app adapter', () => {
  it.for([
    { light: true, theme: 'light' },
    { light: false, theme: 'dark' }
  ])(
    'maps a $light light palette to the $theme challenge theme',
    ({ light, theme }) => {
      renderWidget(light)

      expect(sharedProps.value).toMatchObject({ theme, siteKey: 'site-key' })
    }
  )

  it('passes the translated status messages to the shared widget', () => {
    renderWidget(true)

    expect(sharedProps.value).toMatchObject({
      expiredMessage: 'Challenge expired',
      failedMessage: 'Verification failed'
    })
  })

  it('forwards reset to the shared widget', () => {
    const adapter = ref<{ reset: () => void }>()
    const Host = defineComponent(
      () => () => h(TurnstileWidget, { ref: adapter })
    )
    lightTheme.value = true
    render(Host, { global: { plugins: [i18n] } })

    adapter.value?.reset()

    expect(sharedReset).toHaveBeenCalledOnce()
  })
})
