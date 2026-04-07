/* eslint-disable vue/one-component-per-file, vue/require-prop-types */
import type { RenderResult } from '@testing-library/vue'
import type { ComponentMountingOptions } from '@vue/test-utils'

import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { defineComponent, h } from 'vue'
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

/**
 * PrimeVue component stubs for unit/component tests.
 *
 * Use via `global.stubs` in render options:
 * ```ts
 * render(MyComponent, { global: { stubs: { Skeleton: stubs.Skeleton } } })
 * ```
 *
 * Or use `renderWithDefaults` which provides plugins and directives.
 * Import `stubs` and pass them via `global.stubs` when needed.
 */
const SkeletonStub = defineComponent({
  name: 'Skeleton',
  setup() {
    return () => h('div', { 'data-testid': 'skeleton' })
  }
})

const TagStub = defineComponent({
  name: 'Tag',
  props: ['value', 'severity'],
  setup(props, { slots }) {
    return () =>
      h('span', { 'data-testid': 'tag' }, slots.default?.() ?? props.value)
  }
})

const BadgeStub = defineComponent({
  name: 'Badge',
  props: ['value', 'severity'],
  setup(props) {
    return () => h('span', { 'data-testid': 'badge' }, props.value)
  }
})

const MessageStub = defineComponent({
  name: 'Message',
  props: ['severity', 'closable'],
  setup(_, { slots }) {
    return () =>
      h('div', { 'data-testid': 'message', role: 'alert' }, slots.default?.())
  }
})

const stubs = {
  Skeleton: SkeletonStub,
  Tag: TagStub,
  Badge: BadgeStub,
  Message: MessageStub
} as const

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
        ...globalOptions,
        plugins: [...createDefaultPlugins(), ...(globalOptions?.plugins ?? [])],
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

export { renderWithDefaults as render, screen, stubs }
