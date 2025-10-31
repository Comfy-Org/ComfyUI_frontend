import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { MultiSelectProps } from 'primevue/multiselect'
import { ref } from 'vue'

import MultiSelect from './MultiSelect.vue'
import type { SelectOption } from './types'

// Combine our component props with PrimeVue MultiSelect props
interface ExtendedProps extends Partial<MultiSelectProps> {
  // Our custom props
  label?: string
  showSearchBox?: boolean
  showSelectedCount?: boolean
  showClearButton?: boolean
  searchPlaceholder?: string
  listMaxHeight?: string
  popoverMinWidth?: string
  popoverMaxWidth?: string
  // Override modelValue type to match our Option type
  modelValue?: SelectOption[]
}

const meta: Meta<ExtendedProps> = {
  title: 'Components/Input/MultiSelect/Accessibility',
  component: MultiSelect,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
# MultiSelect Accessibility Guide

This MultiSelect component provides full keyboard accessibility and screen reader support following WCAG 2.1 AA guidelines.

## Keyboard Navigation

- **Tab** - Focus the trigger button
- **Enter/Space** - Open/close dropdown when focused
- **Arrow Up/Down** - Navigate through options when dropdown is open
- **Enter/Space** - Select/deselect options when navigating
- **Escape** - Close dropdown

## Screen Reader Support

- Uses \`role="combobox"\` to identify as dropdown
- \`aria-haspopup="listbox"\` indicates popup contains list
- \`aria-expanded\` shows dropdown state
- \`aria-label\` provides accessible name with i18n fallback
- Selected count announced to screen readers

## Testing Instructions

1. **Tab Navigation**: Use Tab key to focus the component
2. **Keyboard Opening**: Press Enter or Space to open dropdown
3. **Option Navigation**: Use Arrow keys to navigate options
4. **Selection**: Press Enter/Space to select options
5. **Closing**: Press Escape to close dropdown
6. **Screen Reader**: Test with screen reader software

Try these stories with keyboard-only navigation!
        `
      }
    }
  },
  argTypes: {
    label: {
      control: 'text',
      description: 'Label for the trigger button'
    },
    showSearchBox: {
      control: 'boolean',
      description: 'Show search box in dropdown header'
    },
    showSelectedCount: {
      control: 'boolean',
      description: 'Show selected count in dropdown header'
    },
    showClearButton: {
      control: 'boolean',
      description: 'Show clear all button in dropdown header'
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

const frameworkOptions = [
  { name: 'React', value: 'react' },
  { name: 'Vue', value: 'vue' },
  { name: 'Angular', value: 'angular' },
  { name: 'Svelte', value: 'svelte' },
  { name: 'TypeScript', value: 'typescript' },
  { name: 'JavaScript', value: 'javascript' }
]

export const KeyboardNavigationDemo: Story = {
  render: (args) => ({
    components: { MultiSelect },
    setup() {
      const selectedFrameworks = ref<SelectOption[]>([])
      const searchQuery = ref('')

      return {
        args: {
          ...args,
          options: frameworkOptions,
          modelValue: selectedFrameworks,
          'onUpdate:modelValue': (value: SelectOption[]) => {
            selectedFrameworks.value = value
          },
          'onUpdate:searchQuery': (value: string) => {
            searchQuery.value = value
          }
        },
        selectedFrameworks,
        searchQuery
      }
    },
    template: `
      <div class="space-y-4 p-4">
        <div class="bg-blue-50 dark-theme:bg-blue-900/20 border border-azure-400 dark-theme:border-blue-700 rounded-lg p-4">
          <h3 class="text-lg font-semibold mb-2">🎯 Keyboard Navigation Test</h3>
          <p class="text-sm text-smoke-600 dark-theme:text-smoke-300 mb-4">
            Use your keyboard to navigate this MultiSelect:
          </p>
          <ol class="text-sm text-smoke-600 list-decimal list-inside space-y-1">
            <li><strong>Tab</strong> to focus the dropdown</li>
            <li><strong>Enter/Space</strong> to open dropdown</li>
            <li><strong>Arrow Up/Down</strong> to navigate options</li>
            <li><strong>Enter/Space</strong> to select options</li>
            <li><strong>Escape</strong> to close dropdown</li>
          </ol>
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-smoke-700">
            Select Frameworks (Keyboard Navigation Test)
          </label>
          <MultiSelect v-bind="args" class="w-80" />
          <p class="text-xs text-smoke-500">
            Selected: {{ selectedFrameworks.map(f => f.name).join(', ') || 'None' }}
          </p>
        </div>
      </div>
    `
  }),
  args: {
    label: 'Choose Frameworks',
    showSearchBox: true,
    showSelectedCount: true,
    showClearButton: true
  }
}

export const ScreenReaderFriendly: Story = {
  render: (args) => ({
    components: { MultiSelect },
    setup() {
      const selectedColors = ref<SelectOption[]>([])
      const selectedSizes = ref<SelectOption[]>([])

      const colorOptions = [
        { name: 'Red', value: 'red' },
        { name: 'Blue', value: 'blue' },
        { name: 'Green', value: 'green' },
        { name: 'Yellow', value: 'yellow' }
      ]

      const sizeOptions = [
        { name: 'Small', value: 'sm' },
        { name: 'Medium', value: 'md' },
        { name: 'Large', value: 'lg' },
        { name: 'Extra Large', value: 'xl' }
      ]

      return {
        selectedColors,
        selectedSizes,
        colorOptions,
        sizeOptions,
        args
      }
    },
    template: `
      <div class="space-y-6 p-4">
        <div class="bg-green-50 dark-theme:bg-green-900/20 border border-green-200 dark-theme:border-green-700 rounded-lg p-4">
          <h3 class="text-lg font-semibold mb-2">♿ Screen Reader Test</h3>
          <p class="text-sm text-smoke-600 mb-2">
            These dropdowns have proper ARIA attributes and labels for screen readers:
          </p>
          <ul class="text-sm text-smoke-600 list-disc list-inside space-y-1">
            <li><code>role="combobox"</code> identifies as dropdown</li>
            <li><code>aria-haspopup="listbox"</code> indicates popup type</li>
            <li><code>aria-expanded</code> shows open/closed state</li>
            <li><code>aria-label</code> provides accessible name</li>
            <li>Selection count announced to assistive technology</li>
          </ul>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-2">
            <label class="block text-sm font-medium text-smoke-700">
              Color Preferences
            </label>
            <MultiSelect
              v-model="selectedColors"
              :options="colorOptions"
              label="Select colors"
              :show-selected-count="true"
              :show-clear-button="true"
              class="w-full"
            />
            <p class="text-xs text-smoke-500" aria-live="polite">
              {{ selectedColors.length }} color(s) selected
            </p>
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-medium text-smoke-700">
              Size Preferences
            </label>
            <MultiSelect
              v-model="selectedSizes"
              :options="sizeOptions"
              label="Select sizes"
              :show-selected-count="true"
              :show-search-box="true"
              class="w-full"
            />
            <p class="text-xs text-smoke-500" aria-live="polite">
              {{ selectedSizes.length }} size(s) selected
            </p>
          </div>
        </div>
      </div>
    `
  })
}

export const FocusManagement: Story = {
  render: (args) => ({
    components: { MultiSelect },
    setup() {
      const selectedItems = ref<SelectOption[]>([])
      const focusTestOptions = [
        { name: 'Option A', value: 'a' },
        { name: 'Option B', value: 'b' },
        { name: 'Option C', value: 'c' }
      ]

      return {
        selectedItems,
        focusTestOptions,
        args
      }
    },
    template: `
      <div class="space-y-4 p-4">
        <div class="bg-purple-50 dark-theme:bg-purple-900/20 border border-purple-200 dark-theme:border-purple-700 rounded-lg p-4">
          <h3 class="text-lg font-semibold mb-2">🎯 Focus Management Test</h3>
          <p class="text-sm text-smoke-600 dark-theme:text-smoke-300 mb-4">
            Test focus behavior with multiple form elements:
          </p>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-smoke-700 mb-1">
              Before MultiSelect
            </label>
            <input
              type="text"
              placeholder="Previous field"
              class="block w-64 px-3 py-2 border border-smoke-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-smoke-700 mb-1">
              MultiSelect (Test Focus Ring)
            </label>
            <MultiSelect
              v-model="selectedItems"
              :options="focusTestOptions"
              label="Focus test dropdown"
              :show-selected-count="true"
              class="w-64"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-smoke-700 mb-1">
              After MultiSelect
            </label>
            <input
              type="text"
              placeholder="Next field"
              class="block w-64 px-3 py-2 border border-smoke-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Submit Button
          </button>
        </div>

        <div class="text-sm text-smoke-600 mt-4">
          <strong>Test:</strong> Tab through all elements and verify focus rings are visible and logical.
        </div>
      </div>
    `
  })
}

export const AccessibilityChecklist: Story = {
  render: () => ({
    template: `
      <div class="max-w-4xl mx-auto p-6 space-y-6">
        <div class="bg-gray-50 dark-theme:bg-zinc-800 border border-smoke-200 dark-theme:border-zinc-700 rounded-lg p-6">
          <h2 class="text-2xl font-bold mb-4">♿ MultiSelect Accessibility Checklist</h2>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 class="text-lg font-semibold mb-3 text-green-700">✅ Implemented Features</h3>
              <ul class="space-y-2 text-sm">
                <li class="flex items-start">
                  <span class="text-green-500 mr-2">✓</span>
                  <span><strong>Keyboard Navigation:</strong> Tab, Enter, Space, Arrow keys, Escape</span>
                </li>
                <li class="flex items-start">
                  <span class="text-green-500 mr-2">✓</span>
                  <span><strong>ARIA Attributes:</strong> role, aria-haspopup, aria-expanded, aria-label</span>
                </li>
                <li class="flex items-start">
                  <span class="text-green-500 mr-2">✓</span>
                  <span><strong>Focus Management:</strong> Visible focus rings and logical tab order</span>
                </li>
                <li class="flex items-start">
                  <span class="text-green-500 mr-2">✓</span>
                  <span><strong>Internationalization:</strong> Translatable aria-label fallbacks</span>
                </li>
                <li class="flex items-start">
                  <span class="text-green-500 mr-2">✓</span>
                  <span><strong>Screen Reader Support:</strong> Proper announcements and state</span>
                </li>
                <li class="flex items-start">
                  <span class="text-green-500 mr-2">✓</span>
                  <span><strong>Color Contrast:</strong> Meets WCAG AA requirements</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 class="text-lg font-semibold mb-3 text-blue-700">📋 Testing Guidelines</h3>
              <ol class="space-y-2 text-sm list-decimal list-inside">
                <li><strong>Keyboard Only:</strong> Navigate using only keyboard</li>
                <li><strong>Screen Reader:</strong> Test with NVDA, JAWS, or VoiceOver</li>
                <li><strong>Focus Visible:</strong> Ensure focus rings are always visible</li>
                <li><strong>Tab Order:</strong> Verify logical progression</li>
                <li><strong>Announcements:</strong> Check state changes are announced</li>
                <li><strong>Escape Behavior:</strong> Escape always closes dropdown</li>
              </ol>
            </div>
          </div>

          <div class="mt-6 p-4 bg-blue-50 dark-theme:bg-blue-900/20 border border-azure-400 dark-theme:border-blue-700 rounded-lg">
            <h4 class="font-semibold mb-2">🎯 Quick Test</h4>
            <p class="text-sm text-smoke-700 dark-theme:text-smoke-300">
              Close your eyes, use only the keyboard, and try to select multiple options from any dropdown above.
              If you can successfully navigate and make selections, the accessibility implementation is working!
            </p>
          </div>
        </div>
      </div>
    `
  })
}
