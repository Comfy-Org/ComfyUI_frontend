---
name: writing-storybook-stories
description: 'Write or update Storybook stories for Vue components in ComfyUI_frontend. Use when adding, modifying, reviewing, or debugging `.stories.ts` files, Storybook docs, component demos, or visual catalog entries.'
---

# Write Storybook Stories for ComfyUI_frontend

## Workflow

1. !!!!IMPORTANT Confirm the worktree is on a `feat/*` or `fix/*` branch. Base PRs on the local `main`, not a fork branch.
2. Read the component source first. Understand props, emits, slots, exposed methods, and any supporting types or composables.
3. Read nearby stories before writing anything.
   - Search stories: `rg --files src apps | rg '\.stories\.ts$'`
   - Inspect title patterns: `rg -n "title:\\s*'" src apps --glob '*.stories.ts'`
4. If a Figma link is provided, list the states you need to cover before writing stories.
5. Co-locate the story file with the component: `ComponentName.stories.ts`.
6. Sort every variation into a control or a scenario before writing exports (see "Controls Versus Scenarios"). Hover, focus, and active come from the implementation and never get a story.
7. Run Storybook and validation checks before handing off.

## Controls Versus Scenarios

`docs/guidance/storybook.md` holds the rule; apply it to each variation from step 4:

| Variation                                                   | Becomes                                        |
| ----------------------------------------------------------- | ---------------------------------------------- |
| One enum prop (`size`, `shape`)                             | `meta.args` default plus an `argTypes` control |
| One boolean prop (`bordered`, `disabled`)                   | `meta.args` default; the control is inferred   |
| Named design state (`Loading`, `Empty`, `Error`, `Invalid`) | A story                                        |
| Data shape that stresses layout (`LongTitle`, `ManyItems`)  | A story with a named fixture                   |
| Store, mock, flag, or locale state                          | A story with `beforeEach` setting the mock     |
| State reached only by interaction (menu open, form filled)  | A story with `play`                            |
| Side-by-side comparison of a prop's whole domain            | One grid story (`AllSizes`, `AllVariants`)     |

A file whose exports differ by one prop value each is the pattern to fix, not copy, even when the nearest sibling does it.

## Match Local Conventions

- Copy the closest neighboring story's title, decorators, and mock setup instead of forcing one universal template.
- Most repo stories use `@storybook/vue3-vite`.
- Add `tags: ['autodocs']` unless the surrounding stories in that area intentionally omit it.
- Put shared defaults in `meta.args`; a story's `args` lists only what differs. Derive stories with `...Other.args`.
- Put `render` on `meta` when every story shares the wrapper; a story-level `render` is for a structurally different template.
- Use `ComponentPropsAndSlots<typeof Component>` when it helps with prop and slot typing.
- Keep `render` functions stateful when needed. Use `ref()`, `computed()`, and `toRefs(args)` instead of mutating Storybook args directly.
- Use `args.default` or other slot-shaped args when the component content is provided through slots.
- Wire emits as `on<Event>: fn()` args from `storybook/test`.
- Use `ComponentExposed` only when a component's exposed API breaks the normal Storybook typing.
- Add decorators for realistic width or background context when the component needs it.

## Title Patterns

Do not invent titles from scratch when a close sibling story already exists. Match the nearest domain pattern.

| Component area                                          | Typical title pattern             |
| ------------------------------------------------------- | --------------------------------- |
| `src/components/ui/button/Button.vue`                   | `Components/Button/Button`        |
| `src/components/ui/input/Input.vue`                     | `Components/Input`                |
| `src/components/ui/search-input/SearchInput.vue`        | `Components/Input/SearchInput`    |
| `src/components/common/SearchBox.vue`                   | `Components/Input/SearchBox`      |
| `src/renderer/extensions/vueNodes/widgets/components/*` | `Widgets/<WidgetName>`            |
| `src/platform/assets/components/*`                      | `Platform/Assets/<ComponentName>` |

If multiple patterns seem plausible, follow the closest sibling story in the same folder tree.

## Common Story Shapes

### Stateful input or `v-model`

The `render` lives on `meta` so every story shares it and varies only `args`:

```typescript
const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
  args: { disabled: false, size: 'md' },
  argTypes: { size: { control: 'select', options: ['sm', 'md', 'lg'] } },
  render: (args) => ({
    components: { MyComponent },
    setup() {
      const value = ref('Hello world')
      return { value, ...toRefs(args) }
    },
    template:
      '<MyComponent v-model="value" :disabled="disabled" :size="size" />'
  })
}

export const Default: Story = {}
export const Disabled: Story = { args: { disabled: true } }
```

### Slot-driven content

```typescript
const meta: Meta<ComponentPropsAndSlots<typeof Button>> = {
  argTypes: {
    default: { control: 'text' }
  },
  args: {
    default: 'Button'
  },
  render: (args) => ({
    components: { Button },
    setup() {
      return { args }
    },
    template: '<Button v-bind="args">{{ args.default }}</Button>'
  })
}

export const Default: Story = {}
export const LongLabel: Story = {
  args: { default: 'A label long enough to wrap inside a narrow toolbar' }
}
```

### Store or mock-driven scenarios

```typescript
function story(billing: Partial<BillingContextMockState>): Story {
  return {
    beforeEach() {
      setBillingContextMock({ isTeamPlan: true, ...billing })
    }
  }
}

export const Paused: Story = story({ billingStatus: 'paused' })
export const OutOfCredits: Story = story({ subscription: exhausted })
```

### Interaction-only state

```typescript
export const MenuOpen: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open' }))
    await expect(canvas.getByRole('menu')).toBeVisible()
  }
}
```

### Variants or edge cases grid

```typescript
export const AllVariants: Story = {
  render: () => ({
    components: { MyComponent },
    template: `
      <div class="grid gap-4 sm:grid-cols-2">
        <MyComponent />
        <MyComponent disabled />
        <MyComponent loading />
        <MyComponent invalid />
      </div>
    `
  })
}
```

## Figma Mapping

- Extract the named states from the design first, then run each through "Controls Versus Scenarios".
- Named design states (`Disabled`, `Loading`, `Invalid`, `WithPlaceholder`) become stories; a size or color ramp becomes a control plus one `AllSizes` or `AllVariants` grid.
- Use pseudo-state parameters only if the addon is already configured in this repo.
- If a Figma state cannot be represented exactly, capture the closest prop-driven version and explain the gap in the story docs.

## Component-Specific Notes

- Widget components often need a minimal `SimplifiedWidget` object. Build it in `setup()` and use `computed()` when `args` change `widget.options`.
- Input and search components often need a width-constrained wrapper so they render at realistic sizes.
- Asset and platform cards often need background decorators such as `bg-base-background` and fixed-width containers.
- Desktop installer stories may need custom `backgrounds` parameters and may intentionally keep the older Storybook import style used by neighboring files.
- Use semantic tokens such as `bg-base-background` and `bg-node-component-surface` instead of `dark:` variants or hardcoded theme assumptions.

## Checklist

- [ ] Read the component source and any supporting types or composables
- [ ] Match the nearest local title pattern and story style
- [ ] Include a baseline story; name it `Default` only when that matches nearby conventions
- [ ] Every enum and boolean prop has a `meta.args` default; every enum prop has an `argTypes` control with `options`
- [ ] Every export is a scenario from the "Controls Versus Scenarios" table, not a single prop value
- [ ] Add `tags: ['autodocs']`
- [ ] Keep the story co-located with the component
- [ ] Run `pnpm storybook`
- [ ] Run `pnpm typecheck`
- [ ] Run `pnpm lint`

## Avoid

- Do not guess props, emits, slots, or exposed methods.
- Do not force one generic title convention across the repo.
- Do not mutate Storybook args directly for `v-model` components.
- Do not introduce `dark:` Tailwind variants in story wrappers.
- Do not create barrel files.
- Do not assume every story needs `layout: 'centered'` or a `Default` export; follow the nearest existing pattern.
