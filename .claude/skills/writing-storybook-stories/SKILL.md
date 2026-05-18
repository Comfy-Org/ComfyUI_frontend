---
name: writing-storybook-stories
description: 'Write or update Storybook stories for Vue components in ComfyUI_frontend. Use when adding, modifying, reviewing, or debugging `.stories.ts` files, Storybook docs, component demos, or visual catalog entries in `src/` or `apps/desktop-ui/`.'
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
6. Add each variation on separate stories, except hover state. this should be automatically applied by the implementation and not require a separate story.
7. Run Storybook and validation checks before handing off.

## Match Local Conventions

- Copy the closest neighboring story instead of forcing one universal template.
- Most repo stories use `@storybook/vue3-vite`. Some stories under `apps/desktop-ui` still use `@storybook/vue3`; keep the local convention for that area.
- Add `tags: ['autodocs']` unless the surrounding stories in that area intentionally omit it.
- Use `ComponentPropsAndSlots<typeof Component>` when it helps with prop and slot typing.
- Keep `render` functions stateful when needed. Use `ref()`, `computed()`, and `toRefs(args)` instead of mutating Storybook args directly.
- Use `args.default` or other slot-shaped args when the component content is provided through slots.
- Use `ComponentExposed` only when a component's exposed API breaks the normal Storybook typing.
- Add decorators for realistic width or background context when the component needs it.

## Title Patterns

Do not invent titles from scratch when a close sibling story already exists. Match the nearest domain pattern.

| Component area                                          | Typical title pattern                |
| ------------------------------------------------------- | ------------------------------------ |
| `src/components/ui/button/Button.vue`                   | `Components/Button/Button`           |
| `src/components/ui/input/Input.vue`                     | `Components/Input`                   |
| `src/components/ui/search-input/SearchInput.vue`        | `Components/Input/SearchInput`       |
| `src/components/common/SearchBox.vue`                   | `Components/Input/SearchBox`         |
| `src/renderer/extensions/vueNodes/widgets/components/*` | `Widgets/<WidgetName>`               |
| `src/platform/assets/components/*`                      | `Platform/Assets/<ComponentName>`    |
| `apps/desktop-ui/src/components/*`                      | `Desktop/Components/<ComponentName>` |
| `apps/desktop-ui/src/views/*`                           | `Desktop/Views/<ViewName>`           |

If multiple patterns seem plausible, follow the closest sibling story in the same folder tree.

## Common Story Shapes

### Stateful input or `v-model`

```typescript
export const Default: Story = {
  render: (args) => ({
    components: { MyComponent },
    setup() {
      const { disabled, size } = toRefs(args)
      const value = ref('Hello world')
      return { value, disabled, size }
    },
    template:
      '<MyComponent v-model="value" :disabled="disabled" :size="size" />'
  })
}
```

### Slot-driven content

```typescript
const meta: Meta<ComponentPropsAndSlots<typeof Button>> = {
  argTypes: {
    default: { control: 'text' }
  },
  args: {
    default: 'Button'
  }
}

export const SingleButton: Story = {
  render: (args) => ({
    components: { Button },
    setup() {
      return { args }
    },
    template: '<Button v-bind="args">{{ args.default }}</Button>'
  })
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

- Extract the named states from the design first.
- Prefer explicit prop-driven stories such as `Disabled`, `Loading`, `Invalid`, `WithPlaceholder`, `AllSizes`, or `EdgeCases`.
- Add an aggregate story such as `AllVariants`, `AllSizes`, or `EdgeCases` when side-by-side comparison is useful.
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
- [ ] Add focused stories for meaningful states
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
