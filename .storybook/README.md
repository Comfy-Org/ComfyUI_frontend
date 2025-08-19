# Storybook Configuration for ComfyUI Frontend

## What is Storybook?

Storybook is a frontend workshop for building UI components and pages in isolation. It allows developers to:

- Build components independently from the main application
- Test components with different props and states
- Document component APIs and usage patterns
- Share components across teams and projects
- Catch visual regressions through visual testing

## Storybook vs Other Testing Tools

| Tool | Purpose | Use Case |
|------|---------|----------|
| **Storybook** | Component isolation & documentation | Developing, testing, and showcasing individual UI components |
| **Playwright** | End-to-end testing | Full user workflow testing across multiple pages |
| **Vitest** | Unit testing | Testing business logic, utilities, and component behavior |
| **Vue Testing Library** | Component testing | Testing component interactions and DOM output |

### When to Use Storybook

**✅ Use Storybook for:**
- Developing new UI components in isolation
- Creating component documentation and examples
- Testing different component states and props
- Sharing components with designers and stakeholders
- Visual regression testing
- Building a component library or design system

**❌ Don't use Storybook for:**
- Testing complex user workflows (use Playwright)
- Testing business logic (use Vitest)
- Integration testing between components (use Vue Testing Library)

## How to Use Storybook

### Development Commands

```bash
# Start Storybook development server
npm run storybook

# Build static Storybook for deployment
npm run build-storybook
```

### Creating Stories

Stories are located alongside components in `src/` directories with the pattern `*.stories.ts`:

```typescript
// MyComponent.stories.ts
import type { Meta, StoryObj } from '@storybook/vue3'
import MyComponent from './MyComponent.vue'

const meta: Meta<typeof MyComponent> = {
  title: 'Components/MyComponent',
  component: MyComponent,
  parameters: {
    layout: 'centered'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: 'Hello World'
  }
}

export const WithVariant: Story = {
  args: {
    title: 'Variant Example',
    variant: 'secondary'
  }
}
```

### Available Features

- **Vue 3 Support**: Full Vue 3 composition API and reactivity
- **PrimeVue Integration**: All PrimeVue components and theming
- **ComfyUI Theming**: Custom ComfyUI theme preset applied
- **Pinia Stores**: Access to application stores for components that need state
- **TypeScript**: Full TypeScript support with proper type checking
- **CSS/SCSS**: Component styling support
- **Auto-documentation**: Automatic prop tables and component documentation
- **Chromatic Integration**: Automated visual regression testing for component stories

## Development Tips

### Best Practices

1. **Keep Stories Simple**: Each story should demonstrate one specific use case
2. **Use Realistic Data**: Use data that resembles real application usage
3. **Document Edge Cases**: Create stories for loading states, errors, and edge cases
4. **Group Related Stories**: Use consistent naming and grouping for related components

### Component Testing Strategy

```typescript
// Example: Testing different component states
export const Loading: Story = {
  args: {
    isLoading: true
  }
}

export const Error: Story = {
  args: {
    error: 'Failed to load data'
  }
}

export const WithLongText: Story = {
  args: {
    description: 'Very long description that might cause layout issues...'
  }
}
```

### Debugging Tips

- Use browser DevTools to inspect component behavior
- Check the Storybook console for Vue warnings or errors
- Use the Controls addon to dynamically change props
- Leverage the Actions addon to test event handling

## Configuration Files

- **`main.ts`**: Core Storybook configuration and Vite integration
- **`preview.ts`**: Global decorators, parameters, and Vue app setup
- **`manager.ts`**: Storybook UI customization (if needed)

## Chromatic Visual Testing

This project uses [Chromatic](https://chromatic.com) for automated visual regression testing of Storybook components.

### How It Works

- **Automated Testing**: Every push to `main` and `sno-storybook` branches triggers Chromatic builds
- **Pull Request Reviews**: PRs against `main` branch include visual diffs for component changes
- **Baseline Management**: Changes on `main` branch are automatically accepted as new baselines
- **Cross-browser Testing**: Tests across multiple browsers and viewports

### Viewing Results

1. Check the GitHub Actions tab for Chromatic workflow status
2. Click on the Chromatic build link in PR comments to review visual changes
3. Accept or reject visual changes directly in the Chromatic UI

### Best Practices for Visual Testing

- **Consistent Stories**: Ensure stories render consistently across different environments
- **Meaningful Names**: Use descriptive story names that clearly indicate the component state
- **Edge Cases**: Include stories for loading, error, and empty states
- **Realistic Data**: Use data that closely resembles production usage

## Integration with ComfyUI

This Storybook setup includes:

- ComfyUI-specific theming and styling
- Pre-configured Pinia stores for state management
- Internationalization (i18n) support
- PrimeVue component library integration
- Proper alias resolution for `@/` imports

For component-specific examples, see the NodePreview stories in `src/components/node/`.