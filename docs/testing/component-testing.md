# Component testing guide

Use `@testing-library/vue` and `@testing-library/user-event` for component
tests. An ESLint rule bans `@vue/test-utils` in new `*.test.ts` files.

Test behavior through accessible roles, names, and visible content. Do not
assert implementation details such as internal component instances or CSS
classes.

## Render a component

Pass props, attributes, and slots to `render`. Query the rendered component by
its accessible role and name.

```typescript
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import Button from '@/components/ui/button/Button.vue'

describe('Button', () => {
  it('renders its label and disabled state', () => {
    render(Button, {
      props: { disabled: true },
      slots: { default: 'Submit' }
    })

    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
  })
})
```

Components under `src/components/ui` do not require a global UI plugin. Import
the component directly and render it.

## Test user interaction and emitted events

Create a `userEvent` instance in each interactive test. Pass event listeners
through `attrs` or `props`, then assert the behavior visible to the caller.

```typescript
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import Switch from '@/components/ui/switch/Switch.vue'

describe('Switch', () => {
  it('requests the opposite value when clicked', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()

    render(Switch, {
      props: {
        modelValue: false,
        'onUpdate:modelValue': onUpdate
      },
      attrs: { 'aria-label': 'Notifications' }
    })

    const control = screen.getByRole('switch', { name: 'Notifications' })
    expect(control).not.toBeChecked()

    await user.click(control)

    expect(onUpdate).toHaveBeenCalledWith(true)
  })
})
```

## Test portalled components

Testing Library queries search `document.body`, so they can find content that
Reka UI portals outside the render container. Interact with the trigger, then
query the portalled role.

```typescript
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import Tooltip from '@/components/ui/tooltip/Tooltip.vue'

describe('Tooltip', () => {
  it('describes its trigger on keyboard focus', async () => {
    const user = userEvent.setup()

    render(Tooltip, {
      props: { config: 'Helpful text' },
      slots: { default: '<button>Trigger</button>' }
    })

    await user.tab()

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Helpful text')
    expect(screen.getByRole('button')).toHaveAccessibleDescription(
      'Helpful text'
    )
  })
})
```

Use `findByRole` when the element appears asynchronously. Use `waitFor` when an
assertion must be retried. Do not add fixed delays.

## Provide app dependencies

Pass required plugins through `global.plugins`. Keep the setup local unless
several test files need the same harness.

```typescript
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { clear: 'Clear' }
    }
  }
})

render(SearchInput, {
  global: { plugins: [i18n] }
})
```

Prefer real project plugins and stores over substitutes. Mock only boundaries
that the project does not own, such as a network service.

## Wait for Vue updates

`userEvent` awaits the DOM updates caused by an interaction. If a test changes
reactive state directly, call `await nextTick()` before asserting the rendered
result.

For promise-driven UI, resolve the controlled promise and use a `findBy*` query
or `waitFor`. Keep the assertion tied to behavior instead of flushing an
arbitrary number of microtasks.

```typescript
const request = Promise.withResolvers<string[]>()
const searcher = vi.fn(() => request.promise)

render(AsyncResults, { props: { searcher } })
request.resolve(['KSampler'])

expect(await screen.findByText('KSampler')).toBeInTheDocument()
```

## Common mistakes

- Do not use `mount`, `wrapper.find`, `findComponent`, or `wrapper.emitted`.
- Do not query PrimeIcons or Tailwind classes when a role or visible label
  expresses the behavior.
- Do not add `setTimeout` calls to wait for rendering.
- Do not test defaults, utility classes, or other non-behavioral details.
- Do not mock a local UI component only to assert that the mock rendered.
