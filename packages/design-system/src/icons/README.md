# ComfyUI Icons Guide

ComfyUI supports two types of icons: Lucide icons and custom icons. All icons are automatically imported - no manual imports needed!

## Quick Start - Code Examples

Lucide is the only third-party icon set. Don't add icons from other sets such as Heroicons, Tabler, or Carbon. PrimeIcons and Material Design Icons (`mdi`) are being phased out; don't add new uses, in first-party code or extensions. See [PrimeIcons (deprecated)](#primeicons-deprecated).

### 1. Lucide Icons

```vue
<template>
  <i class="icon-[lucide--download]" />
  <i class="icon-[lucide--settings]" />
  <i class="icon-[lucide--workflow] size-6" />

  <!-- With styling -->
  <i class="icon-[lucide--save] size-6 text-blue-500" />
</template>
```

[Browse Lucide icons →](https://lucide.dev/icons/)

### 2. Custom Icons

```vue
<template>
  <!-- Your custom SVG icons from packages/design-system/src/icons/ -->
  <i-comfy:workflow />
  <i-comfy:node-tree />
  <i-comfy:my-custom-icon class="size-5" />

  <!-- In a design-system Button -->
  <Button variant="secondary">
    <i-comfy:workflow />
  </Button>
</template>
```

## Icon Usage Patterns

### In Buttons

```vue
<template>
  <Button>
    <i class="icon-[lucide--save]" />
    Save File
  </Button>
</template>
```

### Conditional Icons

```vue
<template>
  <i class="icon-[lucide--eye]" v-if="isVisible" />
  <i class="icon-[lucide--eye-off]" v-else />

  <!-- Or with ternary -->
  <component :is="isLocked ? 'i-lucide:lock' : 'i-lucide:lock-open'" />
</template>
```

### With Tooltips

Put the icon in a `Button` and give the button the tooltip, so keyboard users
can reach it. See `packages/design-system/src/components/tooltip/README.md` for other triggers.

```vue
<template>
  <Button
    variant="muted-textonly"
    size="icon"
    :tooltip="$t('g.learnMore')"
    :aria-label="$t('g.learnMore')"
  >
    <i class="icon-[lucide--info]" />
  </Button>
</template>
```

## Finding Lucide Icons

1. Search [Lucide Icons](https://lucide.dev/icons/)
2. Copy the icon's name, such as `folder-open`
3. Use it as `icon-[lucide--folder-open]`

## Adding Custom Icons

### 1. Add Your SVG

Place your SVG file in `packages/design-system/src/icons/`:

```
packages/design-system/src/icons/
├── workflow-duplicate.svg
├── node-preview.svg
└── your-icon.svg
```

### 2. SVG Format Requirements

```xml
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <!-- Use currentColor for theme compatibility -->
  <path fill="currentColor" d="..." />
</svg>
```

**Important:**

- Use `viewBox` for proper scaling (24x24 is standard)
- Don't include `width` or `height` attributes
- Use `currentColor` for theme-aware icons
- Keep SVGs optimized and simple

### 3. Use Immediately

```vue
<template>
  <i-comfy:your-icon />
</template>
```

No imports needed - icons are auto-discovered!

## Render Mode: Mask vs Image

The default render mode is decided by the SVG's own colors:

- **Mask** — SVG with `currentColor`. The shape is displayed as a background
  mask, so it adapts to the theme via `text-*` classes.
- **Image** — the SVG uses concrete colors (e.g. `#d97757`). It is embedded
  as an image, preserving its own colors; `text-*` has no effect. Use this for
  brand logos that must keep their palette.

```
workflow.svg   fill="currentColor"  -> mask  (themeable)
claude.svg     fill="#d97757"       -> image (brand color preserved)
```

### Forcing a mode at usage time

```vue
<template>
  <i class="icon-[comfy--openai]" />
  <!-- default from SVG colors -->
  <i class="icon-img-[comfy--openai]" />
  <!-- force image, own colors -->
  <i class="icon-mask-[comfy--luma]" />
  <!-- force themeable mask -->
</template>
```

## Icon Guidelines

### Naming Conventions

- **Files**: `kebab-case.svg` (workflow-icon.svg)
- **Usage**: `<i-comfy:workflow-icon />`

### Size & Styling

`icon-[...]`, `icon-img-[...]`, and `icon-mask-[...]` default to `size-4` (16px). Font size has no effect on them, so don't size them with `text-*`. Override the size with `size-*` on the `<i>` itself:

```vue
<template>
  <i class="icon-[lucide--plus]" />
  <!-- 16px (default) -->
  <i class="icon-[lucide--plus] size-3" />
  <!-- 12px -->
  <i class="icon-[lucide--plus] size-6" />
  <!-- 24px -->

  <!-- Colors -->
  <i class="icon-[lucide--check] text-green-500" />
  <i class="icon-[lucide--x] text-red-500" />
</template>
```

### Theme Compatibility

Always use `currentColor` in SVGs for automatic theme adaptation:

```xml
<!-- ✅ Good: Adapts to light/dark theme -->
<svg viewBox="0 0 24 24">
  <path fill="currentColor" d="..." />
</svg>

<!-- ❌ Bad: Fixed colors -->
<svg viewBox="0 0 24 24">
  <path fill="#000000" d="..." />
</svg>
```

## Migration Guide

### From PrimeIcons to Iconify/Custom

```vue
<template>
  <!-- Before -->
  <Button size="icon">
    <i class="pi pi-download" />
  </Button>

  <!-- After -->
  <Button size="icon">
    <i class="icon-[lucide--download]" />
  </Button>
</template>
```

A `pi` glyph sized with a `text-*` class becomes an explicit `size-*` class. Pick the size by eye rather than converting the font size, because Lucide glyphs fill their viewBox differently from PrimeIcons:

```vue
<template>
  <!-- Before -->
  <i class="pi pi-folder text-lg" />

  <!-- After -->
  <i class="icon-[lucide--folder] size-5" />
</template>
```

Use `scale-*` only when a wrapper hardcodes the icon's size, such as `SidebarIcon`, which sets `size-5` on the `<i>` it renders from an icon class string.

### From Inline SVG to Custom Icon

```vue
<template>
  <!-- Before: Inline SVG -->
  <svg class="w-6 h-6" viewBox="0 0 24 24">
    <path d="..." />
  </svg>

  <!-- After: Save as custom/my-icon.svg and use -->
  <i-comfy:my-icon class="w-6 h-6" />
</template>
```

## PrimeIcons (deprecated)

`primeicons` is still imported in `src/main.ts` only so existing extensions that render `pi pi-*` classes keep working while it is phased out. Don't use PrimeIcons in new code, including extensions.

## Technical Details

### Auto-Import System

Icons are automatically imported using `unplugin-icons` - no manual imports needed! Just use the icon component directly.

### Configuration

The icon system has two layers:

1. **Tailwind CSS Plugin** (`@iconify/tailwind4`):
   - Configured via `@plugin` directive in `packages/design-system/src/css/theme.css`
   - Uses `from-folder(comfy, ...)` to load SVGs from `packages/design-system/src/icons/`
   - Auto-cleans and optimizes SVGs at build time

2. **Vite Runtime** (`vite.config.mts`):
   - Enables direct SVG import as Vue components
   - Supports dynamic icon loading

```css
/* CSS configuration for Tailwind icon classes */
@plugin "@iconify/tailwind4" {
  prefix: 'icon';
  scale: 1.2;
  icon-sets: from-folder(comfy, './packages/design-system/src/icons');
}
```

```typescript
// Vite configuration for component-based usage
Icons({
  compiler: 'vue3',
  customCollections: {
    comfy: FileSystemIconLoader('packages/design-system/src/icons')
  }
})
```

### TypeScript Support

Icons are fully typed. If TypeScript doesn't recognize a new custom icon:

1. Restart the dev server
2. Ensure the SVG file is valid
3. Check filename follows kebab-case

## Troubleshooting

### Icon Not Showing

1. **Check filename**: Must be kebab-case without special characters
2. **Restart dev server**: Required after adding new icons
3. **Verify SVG**: Ensure it's valid SVG syntax (build script validates automatically)
4. **Check console**: Look for Vue component resolution errors
5. **Build script errors**: Check console during build - malformed SVGs are logged but don't break builds

### Icon Wrong Color

- Replace hardcoded colors with `currentColor`
- Use `stroke="currentColor"` for outlines
- Use `fill="currentColor"` for filled shapes

### Icon Wrong Size

- Remove `width` and `height` from SVG
- Ensure `viewBox` is present
- Use CSS classes for sizing: `class="w-6 h-6"`

## Best Practices

1. **Optimize SVGs**: Use tools like [SVGO](https://jakearchibald.github.io/svgomg/) to minimize file size
2. **Consistent viewBox**: Stick to 24x24 or 16x16 for consistency
3. **Semantic names**: Use descriptive names like `workflow-duplicate` not `icon1`
4. **Theme support**: Always use `currentColor` for adaptable icons
5. **Test both themes**: Verify icons look good in light and dark modes

## Resources

- [Lucide Icons](https://lucide.dev/icons/)
- [unplugin-icons docs](https://github.com/unplugin/unplugin-icons)
