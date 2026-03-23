import type { RenderResult } from '@testing-library/vue'
import { render } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import type { ComponentMountingOptions } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import PrimeVue from 'primevue/config'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

function createDefaultPlugins() {
  return [
    PrimeVue,
    createTestingPinia({ stubActions: false }),
    createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })
  ]
}

function renderWithDefaults<C>(
  component: C,
  options?: ComponentMountingOptions<C> & { setupUser?: boolean }
): RenderResult & { user: ReturnType<typeof userEvent.setup> | undefined } {
  const { setupUser = true, global: globalOptions, ...rest } = options ?? {}
  const user = setupUser ? userEvent.setup() : undefined

  const result = render(
    component as Parameters<typeof render>[0],
    {
      global: {
        plugins: [...createDefaultPlugins(), ...(globalOptions?.plugins ?? [])],
        stubs: globalOptions?.stubs,
        directives: globalOptions?.directives
      },
      ...rest
    } as Parameters<typeof render>[1]
  )

  return {
    ...result,
    user
  }
}

export { renderWithDefaults as render }
export { screen } from '@testing-library/vue'
