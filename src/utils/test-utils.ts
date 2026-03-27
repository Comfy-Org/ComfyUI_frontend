import type { RenderResult } from '@testing-library/vue'
import type { ComponentMountingOptions } from '@vue/test-utils'

import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

/**
 * Creates the default set of Vue plugins for component tests.
 *
 * - Pinia with `stubActions: false` (actions execute, but are spied)
 * - vue-i18n with English locale
 *
 * Pass additional plugins via the `plugins` option in `renderWithDefaults`.
 */
function createDefaultPlugins() {
  return [
    createTestingPinia({ stubActions: false }),
    createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })
  ]
}

/**
 * Common directive stubs for components that use PrimeVue/custom directives.
 * Prevents "Failed to resolve directive" warnings in test output.
 */
const defaultDirectiveStubs: Record<string, () => void> = {
  tooltip: () => {}
}

type RenderWithDefaultsResult = RenderResult & {
  user: ReturnType<typeof userEvent.setup> | undefined
}

/**
 * Renders a Vue component with standard test infrastructure pre-configured:
 * - Pinia testing store (actions execute but are spied)
 * - vue-i18n with English messages
 * - Common directive stubs (tooltip)
 * - Optional userEvent instance
 *
 * @example
 * ```ts
 * import { render, screen } from '@/utils/test-utils'
 *
 * it('renders button text', async () => {
 *   const { user } = render(MyComponent, { props: { label: 'Click' } })
 *   expect(screen.getByRole('button')).toHaveTextContent('Click')
 *   await user!.click(screen.getByRole('button'))
 * })
 * ```
 */
function renderWithDefaults<C>(
  component: C,
  options?: ComponentMountingOptions<C> & { setupUser?: boolean }
): RenderWithDefaultsResult {
  const { setupUser = true, global: globalOptions, ...rest } = options ?? {}
  const user = setupUser ? userEvent.setup() : undefined

  const result = render(
    component as Parameters<typeof render>[0],
    {
      global: {
        plugins: [...createDefaultPlugins(), ...(globalOptions?.plugins ?? [])],
        stubs: globalOptions?.stubs,
        directives: {
          ...defaultDirectiveStubs,
          ...globalOptions?.directives
        }
      },
      ...rest
    } as Parameters<typeof render>[1]
  )

  return { ...result, user }
}

export { renderWithDefaults as render, screen }
