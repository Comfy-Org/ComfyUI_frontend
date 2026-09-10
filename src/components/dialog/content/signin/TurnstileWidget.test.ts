import { render } from '@testing-library/vue'
import { defineComponent, h, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

import TurnstileWidget from './TurnstileWidget.vue'

const { sharedProps, sharedReset, sharedEmit } = vi.hoisted(() => ({
  sharedProps: { value: {} },
  sharedReset: vi.fn(),
  sharedEmit: {
    value: undefined as
      | ((event: 'update:token' | 'update:unavailable', value: unknown) => void)
      | undefined
  }
}))

vi.mock<unknown>(import('@comfyorg/account/vue'), async () => {
  const { defineComponent, h } = await import('vue')
  return {
    TurnstileWidget: defineComponent({
      props: {
        siteKey: String,
        theme: String,
        expiredMessage: String,
        failedMessage: String,
        loader: Function,
        token: String,
        unavailable: Boolean
      },
      emits: ['update:token', 'update:unavailable'],
      setup(props, { expose, emit }) {
        sharedProps.value = props
        sharedEmit.value = emit
        expose({ reset: sharedReset })
        return () => h('div', { 'data-testid': 'shared-turnstile' })
      }
    })
  }
})

vi.mock(import('@comfyorg/account/turnstileScript'), () => ({
  loadTurnstile: vi.fn()
}))

vi.mock(import('@/config/turnstile'), () => ({
  getTurnstileSiteKey: () => 'site-key'
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
  useColorPaletteStore().activePaletteId = isLightTheme ? 'light' : 'dark'
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

  it("surfaces the shared widget's token and unavailable models on the adapter", () => {
    const { emitted } = renderWidget(true)

    sharedEmit.value?.('update:token', 'token-abc')
    sharedEmit.value?.('update:unavailable', true)

    expect(emitted('update:token').at(-1)).toEqual(['token-abc'])
    expect(
      emitted('update:unavailable').at(-1),
      'without this channel a slow or blocked widget could block sign-up for good'
    ).toEqual([true])
  })

  it('forwards reset to the shared widget', () => {
    const adapter = ref<{ reset: () => void }>()
    const Host = defineComponent(
      () => () => h(TurnstileWidget, { ref: adapter })
    )
    useColorPaletteStore().activePaletteId = 'light'
    render(Host, { global: { plugins: [i18n] } })

    adapter.value?.reset()

    expect(sharedReset).toHaveBeenCalledOnce()
  })
})
