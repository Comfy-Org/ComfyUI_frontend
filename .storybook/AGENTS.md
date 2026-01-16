# Storybook Guidelines

## Story Structure

Place `*.stories.ts` alongside components. See `docs/guidance/storybook.md` for patterns.

## Mock Data

Use realistic ComfyUI schemas (node definitions, components).

## Available Context

Stories have access to:
- All ComfyUI stores
- PrimeVue with ComfyUI theming
- i18n system
- CSS variables and styling

## Troubleshooting

1. **Import Errors**: Verify `@/` alias works
2. **Missing Styles**: Check CSS imports in `preview.ts`
3. **Store Errors**: Check store initialization in setup
