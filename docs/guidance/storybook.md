---
globs:
  - '**/*.stories.ts'
---

# Storybook Conventions

A story is a named **scenario**: one rendered state a designer, reviewer, or
Chromatic snapshot looks at by name. Props with a finite domain are
**controls**, not stories. Fewer, configurable stories beat an export per prop
value.

## Scope

Write stories for shared presentational components: `src/components/ui/**`,
design-system pieces, widgets, cards, banners. Skip containers that own data
fetching or orchestration; story their presentational child instead. Skip
PrimeVue wrappers that add no visual behavior.

## File Placement

Place `*.stories.ts` files alongside their components:

```
src/components/MyComponent/
├── MyComponent.vue
└── MyComponent.stories.ts
```

## Story Structure

```typescript
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'

import ComponentName from './ComponentName.vue'

const meta: Meta<typeof ComponentName> = {
  title: 'Category/ComponentName',
  component: ComponentName,
  tags: ['autodocs'],
  args: { size: 'md', bordered: true, onDismiss: fn() },
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg', 'xl'] }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
```

- Put defaults in `meta.args`; a story lists only what differs from them.
- Give every enum and boolean prop an `argTypes` control. Reviewers walk the
  prop space from the Controls panel; the URL (`&args=size:lg`) links any
  combination without a dedicated export.
- Wire emits as `on<Event>` args with `fn()` from `storybook/test` so the
  Actions panel logs them.
- Match the nearest sibling's `title` pattern; see the
  `writing-storybook-stories` skill for the table.

## One Story Per Scenario

Export a story when the rendered state is one of:

- a **named design state**: `Loading`, `Empty`, `Error`, `Disabled`, `Invalid`
- a **data shape** that stresses layout: `LongTitle`, `ManyItems`, `NoThumbnail`
- an **environment**: mocked store state, feature flag, locale, theme
- an **interaction**: a `play` function reaches a state props cannot (menu
  open, form filled, drag in progress)
- a **comparison grid**: `AllSizes`, `AllVariants`, when side-by-side review is
  the point

A story that sets one enum or boolean prop and nothing else is a control.
Replace the exports with `argTypes`, and keep a grid only when side-by-side
comparison matters:

```diff
 const meta: Meta<typeof Loader> = {
   component: Loader,
+  args: { size: 'md', bordered: true },
+  argTypes: {
+    size: { control: 'select', options: ['sm', 'md', 'lg', 'xl'] }
+  }
 }

 export const Default: Story = {}
-export const Small: Story = { args: { size: 'sm' } }
-export const Large: Story = { args: { size: 'lg' } }
-export const ExtraLarge: Story = { args: { size: 'xl' } }
-export const NoBorder: Story = { args: { bordered: false } }
 export const AllSizes: Story = { render: /* grid of every size */ }
```

## Compose, Don't Copy

- Set `render` on `meta` when every story shares the same wrapper or template.
  A story-level `render` is for a structurally different template.
- Derive one story from another: `args: { ...Primary.args, label: '…' }`.
- Build parent stories from child story args:
  `import * as TagStories from './Tag.stories'`.
- Keep realistic ComfyUI fixtures (node definitions, assets, jobs) in one named
  constant per shape and spread variations from it, as in
  `BillingStatusBanner.stories.ts`.
- A helper that returns a `Story` from scenario inputs is fine when the
  scenario is store or mock state rather than props.

## Stateful and Slot-Driven Components

`v-model` components need local state. Write the `render` once on `meta`, read
props through `toRefs(args)`, and let stories vary `args`:

```typescript
const meta: Meta<typeof TextInput> = {
  component: TextInput,
  args: { disabled: false, size: 'md' },
  render: (args) => ({
    components: { TextInput },
    setup() {
      const value = ref('Hello world')
      return { value, ...toRefs(args) }
    },
    template: '<TextInput v-model="value" :disabled="disabled" :size="size" />'
  })
}

export const Disabled: Story = { args: { disabled: true } }
```

For slot content, add a slot-shaped arg (`default`) with a `text` control and
render it through `v-bind="args"`; type `meta` as
`Meta<ComponentPropsAndSlots<typeof Component>>`.

## Mocks and Environment

- `src/storybook/mocks/*` replace composables and stores through aliases in
  `.storybook/main.ts`. Set their state in the story's `beforeEach`, as
  `BillingStatusBanner.stories.ts` does.
- Cloud-only components render empty unless Storybook runs with
  `DISTRIBUTION=cloud pnpm storybook`; say so in the file's doc comment.
- Use semantic theme tokens (`bg-base-background`) in decorators. Theme is a
  toolbar global; never a story.

## Interaction Tests

Reach interaction-only states with `play`, using `canvas`, `userEvent`, and
`expect` from `storybook/test`. One `play` per interaction scenario; assert the
visible result, not internals.

```typescript
export const MenuOpen: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open' }))
    await expect(canvas.getByRole('menu')).toBeVisible()
  }
}
```

## Running Storybook

```bash
pnpm storybook                     # Development server
DISTRIBUTION=cloud pnpm storybook  # Cloud-only components
pnpm build-storybook               # Production build
```

Chromatic snapshots every story. It runs on `version-bump-*` branches and on
manual dispatch, so each extra export is a recurring snapshot cost; the
per-PR workflow only builds and deploys a preview.
