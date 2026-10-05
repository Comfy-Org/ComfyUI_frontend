# UI Component Guidelines

## Adding New Components

```bash
pnpm dlx shadcn-vue@latest add <component-name> --yes
```

After adding, create `ComponentName.stories.ts` with Default, Disabled, and variant stories.

## Reka UI Wrapper Components

- Use reactive props destructuring with rest: `const { class: className, ...restProps } = defineProps<Props>()`
- Use `useForwardProps(restProps)` for prop forwarding, or `computed()` if adding defaults
- Import siblings directly (`./Component.vue`), not from barrel (`'.'`)
- Use `cn()` for class merging with `className`
- Use Iconify icons: `<i class="icon-[lucide--check]" />`
- Use core semantic tokens such as `bg-secondary-background`, `text-muted-foreground`, and `border-border-default`
- Generic UI primitives must not create or consume feature-, screen-, or component-specific color tokens
- Before adding a token, search `packages/design-system/src/css/style.css` for an existing semantic role
- Add a token only for a reusable role that the core theme cannot express. Do not add a token family for each component
- Tailwind 4 CSS variables use parentheses: `h-(--my-var)` not `h-[--my-var]`
