---
globs:
  - '**/*.vue'
  - '**/*.css'
---

# Tailwind Conventions

## Class Merging

Always use `cn()` for conditional classes:

```vue
<div :class="cn('text-node-component-header-icon', hasError && 'text-danger')" />
```

Never use `:class="[]"` array syntax.

## Theme & Dark Mode

Never use the `dark:` variant. Use semantic tokens from `style.css`:

```vue
<!-- ❌ Wrong -->
<div class="bg-white dark:bg-gray-900" />

<!-- ✅ Correct -->
<div class="bg-node-component-surface" />
```

## Sizing

Use Tailwind fraction utilities, not arbitrary percentages:

```vue
<!-- ❌ Wrong -->
<div class="w-[80%] h-[50%]" />

<!-- ✅ Correct -->
<div class="w-4/5 h-1/2" />
```

## Specificity

Never use `!important` or the `!` prefix. If existing `!important` rules interfere, fix those instead.
