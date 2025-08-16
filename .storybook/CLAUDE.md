# Storybook Development Guidelines for Claude

## Quick Commands

- `npm run storybook`: Start Storybook development server
- `npm run build-storybook`: Build static Storybook
- `npm run test:component`: Run component tests (includes Storybook components)

## Development Workflow for Storybook

1. **Creating New Stories**:
   - Place `*.stories.ts` files alongside components
   - Follow the naming pattern: `ComponentName.stories.ts`
   - Use realistic mock data that matches ComfyUI schemas

2. **Testing Stories**:
   - Verify stories render correctly in Storybook UI
   - Test different component states and edge cases
   - Ensure proper theming and styling

3. **Code Quality**:
   - Run `npm run typecheck` to verify TypeScript
   - Run `npm run lint` to check for linting issues
   - Follow existing story patterns and conventions

## Story Creation Guidelines

### Basic Story Structure

```typescript
import type { Meta, StoryObj } from '@storybook/vue3'
import ComponentName from './ComponentName.vue'

const meta: Meta<typeof ComponentName> = {
  title: 'Category/ComponentName',
  component: ComponentName,
  parameters: {
    layout: 'centered' // or 'fullscreen', 'padded'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    // Component props
  }
}
```

### Mock Data Patterns

For ComfyUI components, use realistic mock data:

```typescript
// Node definition mock
const mockNodeDef = {
  input: {
    required: {
      prompt: ["STRING", { multiline: true }]
    }
  },
  output: ["CONDITIONING"],
  output_is_list: [false],
  category: "conditioning"
}

// Component instance mock
const mockComponent = {
  id: "1",
  type: "CLIPTextEncode",
  // ... other properties
}
```

### Common Story Variants

Always include these story variants when applicable:

- **Default**: Basic component with minimal props
- **WithData**: Component with realistic data
- **Loading**: Component in loading state
- **Error**: Component with error state
- **LongContent**: Component with edge case content
- **Empty**: Component with no data

### Storybook-Specific Code Patterns

#### Store Access
```typescript
// In stories, access stores through the setup function
export const WithStore: Story = {
  render: () => ({
    setup() {
      const store = useMyStore()
      return { store }
    },
    template: '<MyComponent :data="store.data" />'
  })
}
```

#### Event Testing
```typescript
export const WithEvents: Story = {
  args: {
    onUpdate: fn() // Use Storybook's fn() for action logging
  }
}
```

## Configuration Notes

### Vue App Setup
The Storybook preview is configured with:
- Pinia stores initialized
- PrimeVue with ComfyUI theme
- i18n internationalization
- All necessary CSS imports

### Build Configuration
- Vite integration with proper alias resolution
- Manual chunking for better performance
- TypeScript support with strict checking
- CSS processing for Vue components

## Troubleshooting

### Common Issues

1. **Import Errors**: Verify `@/` alias is working correctly
2. **Missing Styles**: Ensure CSS imports are in `preview.ts`
3. **Store Errors**: Check store initialization in setup
4. **Type Errors**: Use proper TypeScript types for story args

### Debug Commands

```bash
# Check TypeScript issues
npm run typecheck

# Lint Storybook files
npm run lint .storybook/

# Build to check for production issues
npm run build-storybook
```

## File Organization

```
.storybook/
├── main.ts          # Core configuration
├── preview.ts       # Global setup and decorators
├── README.md        # User documentation
└── CLAUDE.md        # This file - Claude guidelines

src/
├── components/
│   └── MyComponent/
│       ├── MyComponent.vue
│       └── MyComponent.stories.ts
```

## Integration with ComfyUI

### Available Context

Stories have access to:
- All ComfyUI stores (widgetStore, colorPaletteStore, etc.)
- PrimeVue components with ComfyUI theming
- Internationalization system
- ComfyUI CSS variables and styling

### Testing Components

When testing ComfyUI-specific components:
1. Use realistic node definitions and data structures
2. Test with different node types (sampling, conditioning, etc.)
3. Verify proper CSS theming and dark/light modes
4. Check component behavior with various input combinations

### Performance Considerations

- Use manual chunking for large dependencies
- Minimize bundle size by avoiding unnecessary imports
- Leverage Storybook's lazy loading capabilities
- Profile build times and optimize as needed

## Best Practices

1. **Keep Stories Focused**: Each story should demonstrate one specific use case
2. **Use Descriptive Names**: Story names should clearly indicate what they show
3. **Document Complex Props**: Use JSDoc comments for complex prop types
4. **Test Edge Cases**: Create stories for unusual but valid use cases
5. **Maintain Consistency**: Follow established patterns in existing stories