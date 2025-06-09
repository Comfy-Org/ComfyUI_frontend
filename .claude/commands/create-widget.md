# Create a Vue Widget for ComfyUI

Your task is to create a new Vue widget for ComfyUI based on the widget specification: $ARGUMENTS

## Instructions

Follow the comprehensive guide in `vue-widget-conversion/vue-widget-guide.md` to create the widget. This guide contains step-by-step instructions, examples from actual PRs, and best practices.

### Key Steps to Follow:

1. **Understand the Widget Type**
   - Analyze what type of widget is needed: $ARGUMENTS
   - Identify the data type (string, number, array, object, etc.)
   - Determine if it needs special behaviors (execution state awareness, dynamic management, etc.)

2. **Component Creation**
   - Create Vue component in `src/components/graph/widgets/`
   - REQUIRED: Use PrimeVue components (reference `vue-widget-conversion/primevue-components.md`)
   - Use Composition API with `<script setup>`
   - Implement proper v-model binding with `defineModel`

3. **Composable Pattern**
   - Always create widget constructor composable in `src/composables/widgets/`
   - Only create node-level composable in `src/composables/node/` if the widget needs dynamic management
   - Follow the dual composable pattern explained in the guide

4. **Registration**
   - Register in `src/scripts/widgets.ts`
   - Use appropriate widget type name

5. **Testing**
   - Create unit tests for composables
   - Test with actual nodes that use the widget

### Important Requirements:

- **Always use PrimeVue components** - Check `vue-widget-conversion/primevue-components.md` for available components
- Use TypeScript with proper types
- Follow Vue 3 Composition API patterns
- Use Tailwind CSS for styling (no custom CSS unless absolutely necessary)
- Implement proper error handling and validation
- Consider performance (use v-show vs v-if appropriately)

### Before Starting:

1. First read through the entire guide at `vue-widget-conversion/vue-widget-guide.md`
2. Check existing widget implementations for similar patterns
3. Identify which PrimeVue component(s) best fit the widget requirements

### Widget Specification to Implement:
$ARGUMENTS

Begin by analyzing the widget requirements and proposing an implementation plan based on the guide.