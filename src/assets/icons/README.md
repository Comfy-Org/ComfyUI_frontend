# ComfyUI Custom Icons Guide

This guide explains how to add and use custom SVG icons in the ComfyUI frontend.

## Overview

ComfyUI uses a hybrid icon system that supports:
- **PrimeIcons** - Legacy icon library (CSS classes like `pi pi-plus`)
- **Iconify** - Modern icon system with 200,000+ icons
- **Custom Icons** - Your own SVG icons

Custom icons are powered by [unplugin-icons](https://github.com/unplugin/unplugin-icons) and integrate seamlessly with Vue's component system.

## Quick Start

### 1. Add Your SVG Icon

Place your SVG file in the `custom/` directory:
```
src/assets/icons/custom/
└── your-icon.svg
```

### 2. Use in Components

```vue
<template>
  <!-- Use as a Vue component -->
  <i-comfy:your-icon />
  
  <!-- In a PrimeVue button -->
  <Button>
    <template #icon>
      <i-comfy:your-icon />
    </template>
  </Button>
</template>
```

## SVG Requirements

### File Naming
- Use kebab-case: `workflow-icon.svg`, `node-tree.svg`
- Avoid special characters and spaces
- The filename becomes the icon name

### SVG Format
```xml
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="..." />
</svg>
```

**Important:**
- Use `viewBox` for proper scaling (24x24 is standard)
- Don't include `width` or `height` attributes
- Use `currentColor` for theme-aware icons
- Keep SVGs optimized and simple

### Color Theming

For icons that adapt to the current theme, use `currentColor`:

```xml
<!-- ✅ Good: Uses currentColor -->
<svg viewBox="0 0 24 24">
  <path stroke="currentColor" fill="none" d="..." />
</svg>

<!-- ❌ Bad: Hardcoded colors -->
<svg viewBox="0 0 24 24">
  <path stroke="white" fill="black" d="..." />
</svg>
```

## Usage Examples

### Basic Icon
```vue
<i-comfy:workflow />
```

### With Classes
```vue
<i-comfy:workflow class="text-2xl text-blue-500" />
```

### In Buttons
```vue
<Button severity="secondary" text>
  <template #icon>
    <i-comfy:workflow />
  </template>
</Button>
```

### Conditional Icons
```vue
<template #icon>
  <i-comfy:workflow v-if="isWorkflow" />
  <i-comfy:node v-else />
</template>
```

## Technical Details

### How It Works

1. **unplugin-icons** automatically discovers SVG files in `custom/`
2. During build, SVGs are converted to Vue components
3. Components are tree-shaken - only used icons are bundled
4. The `i-` prefix and `comfy:` namespace identify custom icons

### Configuration

The icon system is configured in `vite.config.mts`:

```typescript
Icons({
  compiler: 'vue3',
  customCollections: {
    'comfy': FileSystemIconLoader('src/assets/icons/custom'),
  }
})
```

### TypeScript Support

Icons are automatically typed. If TypeScript doesn't recognize a new icon:
1. Restart your dev server
2. Check that the SVG file is valid
3. Ensure the filename follows kebab-case convention

## Troubleshooting

### Icon Not Showing
1. **Check filename**: Must be kebab-case without special characters
2. **Restart dev server**: Required after adding new icons
3. **Verify SVG**: Ensure it's valid SVG syntax
4. **Check console**: Look for Vue component resolution errors

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

## Migration from PrimeIcons

When replacing a PrimeIcon with a custom icon:

```vue
<!-- Before: PrimeIcon -->
<Button icon="pi pi-box" />

<!-- After: Custom icon -->
<Button>
  <template #icon>
    <i-comfy:workflow />
  </template>
</Button>
```

## Adding Icon Collections

To add an entire icon set from npm:

1. Install the icon package
2. Configure in `vite.config.mts`
3. Use with the appropriate prefix

See the [unplugin-icons documentation](https://github.com/unplugin/unplugin-icons) for details.