# Component Testing Guide

> **Note**: Component tests use `@testing-library/vue` with
> `@testing-library/user-event`. An ESLint rule enforces this — importing from
> `@vue/test-utils` in a `*.test.ts` file is an error
> (`no-restricted-imports`, see `eslint.config.ts`). There is no `mount()` /
> `wrapper` API in this codebase; render the component and query it the way a
> user would.

This guide covers patterns and examples for testing Vue components in the
ComfyUI Frontend codebase. The rules that apply at every test level
(behavioral assertions, tables over copied bodies, mock only what you own, no
sleeps) live in [`docs/guidance/testing-principles.md`](../guidance/testing-principles.md);
mocking and setup mechanics live in [`vitest-patterns.md`](./vitest-patterns.md).

## Table of Contents

1. [The render helper pattern](#the-render-helper-pattern)
2. [Querying the rendered output](#querying-the-rendered-output)
3. [PrimeVue components](#primevue-components)
4. [Tooltip directives](#tooltip-directives)
5. [Component events](#component-events)
6. [User interaction](#user-interaction)
7. [Asynchronous components](#asynchronous-components)
8. [Working with Vue reactivity](#working-with-vue-reactivity)

## The render helper pattern

Every component test file defines a local `render*` helper that applies the
default props and the global plugins/directives the component needs, calls
`userEvent.setup()`, and returns the render result spread together with `user`.
Typing the props off the component with `ComponentProps` keeps the defaults
honest when the component's interface changes.

```typescript
// Example from: src/components/sidebar/SidebarIcon.test.ts
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import SidebarIcon from './SidebarIcon.vue'

type SidebarIconProps = ComponentProps<typeof SidebarIcon>

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

describe('SidebarIcon', () => {
  const exampleProps: SidebarIconProps = {
    icon: 'pi pi-cog',
    selected: false
  }

  function renderSidebarIcon(props: Partial<SidebarIconProps> = {}) {
    const user = userEvent.setup()

    const result = render(SidebarIcon, {
      global: {
        plugins: [PrimeVue, i18n],
        directives: { tooltip: Tooltip }
      },
      props: { ...exampleProps, ...props }
    })

    return { ...result, user }
  }

  it('renders button element', () => {
    renderSidebarIcon()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('creates badge when iconBadge prop is set', () => {
    const badge = '2'
    renderSidebarIcon({ iconBadge: badge })
    expect(screen.getByText(badge)).toBeInTheDocument()
  })
})
```

Use a real `createI18n` plugin rather than mocking `vue-i18n` — see
[Don't Mock `vue-i18n`](./vitest-patterns.md#dont-mock-vue-i18n--use-a-real-plugin).

## Querying the rendered output

Prefer semantic queries (`getByRole`, `getByText`, `getByLabelText`) over
class-name or DOM traversal. `@testing-library/jest-dom` matchers are
registered globally in `vitest.setup.ts`, so `toBeInTheDocument`,
`toHaveAttribute`, `toHaveValue` and friends are available without an import.

An ESLint rule enforces the query rules. When a component genuinely has no
accessible handle — an iconify icon, or a PrimeVue internal that renders no
standard role — scope a single-line disable to that expression and say why:

```typescript
// Example from: src/components/sidebar/SidebarIcon.test.ts
it('renders icon', () => {
  const { container } = renderSidebarIcon()
  // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- Icon escape hatch: iconify icons have no ARIA role
  expect(container.querySelector('.side-bar-button-icon')).not.toBeNull()
})
```

## PrimeVue components

PrimeVue components are registered through `global.plugins` and
`global.components`. Because PrimeVue renders its own internal markup, assert
against the attributes it actually emits (`aria-pressed` on a `SelectButton`'s
toggle buttons) rather than reaching for component instances.

```typescript
// Example from: src/components/common/ColorCustomizationSelector.test.ts
import { render } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import SelectButton from 'primevue/selectbutton'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import ColorCustomizationSelector from './ColorCustomizationSelector.vue'

const colorOptions = [
  { name: 'Blue', value: '#0d6efd' },
  { name: 'Green', value: '#28a745' }
]

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { color: { hex: 'Hex', rgba: 'RGBA' } } }
})

function renderComponent(
  props: Record<string, unknown> = {},
  callbacks: { 'onUpdate:modelValue'?: (value: string | null) => void } = {}
) {
  const user = userEvent.setup()

  const result = render(ColorCustomizationSelector, {
    global: {
      plugins: [PrimeVue, i18n],
      components: { SelectButton }
    },
    props: { modelValue: null, colorOptions, ...props, ...callbacks }
  })

  return { ...result, user }
}

/** PrimeVue SelectButton renders toggle buttons with aria-pressed */
function getToggleButtons(container: Element) {
  return container.querySelectorAll<HTMLButtonElement>( // eslint-disable-line testing-library/no-node-access -- PrimeVue SelectButton renders toggle buttons without standard ARIA radiogroup roles
    '[data-pc-name="pctogglebutton"]'
  )
}

it('initializes with predefined color when provided', async () => {
  const { container } = renderComponent({ modelValue: '#0d6efd' })
  await nextTick()

  expect(getToggleButtons(container)[0]).toHaveAttribute('aria-pressed', 'true')
})
```

## Tooltip directives

Register the directive under `global.directives`, drive the hover with
`user.hover()`, and wait for the tooltip to appear with `waitFor` — never a
fixed `setTimeout` matching the show delay.

```typescript
// Example from: src/components/sidebar/SidebarIcon.test.ts
it('shows tooltip on hover', async () => {
  const tooltipText = 'Settings'
  const { user } = renderSidebarIcon({ tooltip: tooltipText })

  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

  await user.hover(screen.getByRole('button'))

  await waitFor(
    () => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
    },
    { timeout: 1000 }
  )
})

it('sets aria-label attribute when tooltip is provided', () => {
  const tooltipText = 'Settings'
  renderSidebarIcon({ tooltip: tooltipText })
  expect(screen.getByRole('button')).toHaveAttribute('aria-label', tooltipText)
})
```

## Component events

Testing Library has no `emitted()`. Pass a `vi.fn()` as the corresponding
`on*` prop and assert it was called. This works for both plain emits
(`edit` → `onEdit`) and `v-model` updates
(`update:modelValue` → `'onUpdate:modelValue'`).

```typescript
// Example from: src/components/common/EditableText.test.ts
it('emits edit event when input is submitted', async () => {
  const onEdit = vi.fn()
  const { user } = renderComponent(
    { modelValue: 'Test Text', isEditing: true },
    { onEdit }
  )

  const input = screen.getByRole('textbox')
  await user.clear(input)
  await user.type(input, 'New Text')
  await user.keyboard('{Enter}')

  expect(onEdit).toHaveBeenCalledWith('New Text')
})
```

```typescript
// Example from: src/components/common/ColorCustomizationSelector.test.ts
it('emits update when predefined color is selected', async () => {
  const onUpdate = vi.fn()
  const { container, user } = renderComponent(
    {},
    { 'onUpdate:modelValue': onUpdate }
  )

  await user.click(getToggleButtons(container)[0])

  expect(onUpdate).toHaveBeenCalledWith('#0d6efd')
})
```

## User interaction

Drive interactions through `user` from `userEvent.setup()` — it dispatches the
full event sequence a real user produces. Reach for `fireEvent` only for events
`user-event` does not model directly, such as a bare `blur`.

```typescript
// Example from: src/components/common/EditableText.test.ts
it('cancels editing on escape key', async () => {
  const onEdit = vi.fn()
  const onCancel = vi.fn()
  const { user } = renderComponent(
    { modelValue: 'Original Text', isEditing: true },
    { onEdit, onCancel }
  )

  const input = screen.getByRole('textbox')
  await user.clear(input)
  await user.type(input, 'Modified Text')
  await user.keyboard('{Escape}')

  expect(onCancel).toHaveBeenCalled()
  expect(onEdit).not.toHaveBeenCalled()
  expect(input).toHaveValue('Original Text')
})

it('finishes editing on blur', async () => {
  const onEdit = vi.fn()
  renderComponent({ modelValue: 'Test Text', isEditing: true }, { onEdit })

  await fireEvent.blur(screen.getByRole('textbox'))

  expect(onEdit).toHaveBeenCalledWith('Test Text')
})
```

## Asynchronous components

For a component that fetches on mount, prefer the `find*` queries — they retry
until the element appears, so no explicit wait helper is needed:

```typescript
// Example from: src/workbench/extensions/manager/components/manager/PackVersionSelectorPopover.test.ts
it('disables the Active default when the pack has no Active releases', async () => {
  mockGetPackVersions.mockResolvedValueOnce([])
  renderComponent()

  const latest = await screen.findByRole('option', { name: 'Latest' })

  expect(latest).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByRole('button', { name: 'Install' })).toBeDisabled()
})
```

When you must assert on something that is not a DOM query — that a mocked
service was called, for instance — flush the microtask queue and the render
cycle together:

```typescript
// Example from: src/workbench/extensions/manager/components/manager/PackVersionSelectorPopover.test.ts
const waitForPromises = async () => {
  await new Promise((resolve) => setTimeout(resolve, 16))
  await nextTick()
}

it('fetches versions on mount', async () => {
  mockGetPackVersions.mockResolvedValueOnce(defaultMockVersions)

  renderComponent()
  await waitForPromises()

  expect(mockGetPackVersions).toHaveBeenCalledWith(mockNodePack.id)
})
```

## Working with Vue reactivity

### Waiting for reactivity

`await nextTick()` after a state change is enough when nothing async is
pending. Use `waitFor` when the assertion depends on work that settles over an
unknown number of ticks, and `find*` queries when you are waiting for an
element.

### Testing prop changes

Testing Library returns `rerender` for updating props on an already-rendered
component:

```typescript
const { rerender } = renderComponent()
await rerender({ nodePack: { ...mockNodePack, id: 'new-test-pack' } })
await waitForPromises()

expect(mockGetPackVersions).toHaveBeenCalledWith('new-test-pack')
```

### Table-driven cases

When several scenarios differ only in data, use `it.for` with a `satisfies`
annotation rather than copying the body — see
[`testing-principles.md`](../guidance/testing-principles.md). The
`PackVersionSelectorPopover` suite covers "only Flagged releases", "an empty
version list" and "a failed version lookup" through one `it.for` table.

### Common reactivity pitfalls

1. **Not waiting for all promises**: an assertion on a mock call may run before
   the component's `onMounted` promise settles — flush with `waitForPromises`
   or assert through a `find*` query instead.
2. **Async lifecycle hooks**: components using async `onMounted` need the fetch
   mock primed _before_ `render`.
3. **PrimeVue components**: they carry their own internal state; assert on the
   attributes they render rather than on component internals.
4. **Computed properties depending on async data**: ensure the data has loaded
   before asserting, or the computed still holds its initial value.
5. **Fixed sleeps**: never `setTimeout` for a component's animation or show
   delay. Use `waitFor`, which retries until the condition holds.
