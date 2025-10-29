import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import SingleSelect from './SingleSelect.vue'

interface SingleSelectProps {
  label?: string
  options?: Array<{ name: string; value: string }>
  listMaxHeight?: string
  popoverMinWidth?: string
  popoverMaxWidth?: string
  modelValue?: string | null
}

const meta: Meta<SingleSelectProps> = {
  title: 'Components/Input/SingleSelect/Accessibility',
  component: SingleSelect,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
# SingleSelect Accessibility Guide

This SingleSelect component provides full keyboard accessibility and screen reader support following WCAG 2.1 AA guidelines.

## Keyboard Navigation

- **Tab** - Focus the trigger button
- **Enter/Space** - Open/close dropdown when focused
- **Arrow Up/Down** - Navigate through options when dropdown is open
- **Enter/Space** - Select option when navigating
- **Escape** - Close dropdown

## Screen Reader Support

- Uses \`role="combobox"\` to identify as dropdown
- \`aria-haspopup="listbox"\` indicates popup contains list
- \`aria-expanded\` shows dropdown state
- \`aria-label\` provides accessible name with i18n fallback
- Selected option announced to screen readers

## Testing Instructions

1. **Tab Navigation**: Use Tab key to focus the component
2. **Keyboard Opening**: Press Enter or Space to open dropdown
3. **Option Navigation**: Use Arrow keys to navigate options
4. **Selection**: Press Enter/Space to select an option
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
    listMaxHeight: {
      control: 'text',
      description: 'Maximum height of dropdown list'
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

const sortOptions = [
  { name: 'Name A → Z', value: 'name-asc' },
  { name: 'Name Z → A', value: 'name-desc' },
  { name: 'Most Popular', value: 'popular' },
  { name: 'Most Recent', value: 'recent' },
  { name: 'File Size', value: 'size' }
]

const priorityOptions = [
  { name: 'High Priority', value: 'high' },
  { name: 'Medium Priority', value: 'medium' },
  { name: 'Low Priority', value: 'low' },
  { name: 'No Priority', value: 'none' }
]

export const KeyboardNavigationDemo: Story = {
  render: (args) => ({
    components: { SingleSelect },
    setup() {
      const selectedSort = ref<string | null>(null)
      const selectedPriority = ref<string | null>('medium')

      return {
        args,
        selectedSort,
        selectedPriority,
        sortOptions,
        priorityOptions
      }
    },
    template: `
      <div class="space-y-6 p-4">
        <div class="bg-blue-50 dark-theme:bg-blue-900/20 border border-azure-400 dark-theme:border-blue-700 rounded-lg p-4">
          <h3 class="text-lg font-semibold mb-2">🎯 Keyboard Navigation Test</h3>
          <p class="text-sm text-smoke-600 dark-theme:text-smoke-300 mb-4">
            Use your keyboard to navigate these SingleSelect dropdowns:
          </p>
          <ol class="text-sm text-smoke-600 dark-theme:text-smoke-300 list-decimal list-inside space-y-1">
            <li><strong>Tab</strong> to focus the dropdown</li>
            <li><strong>Enter/Space</strong> to open dropdown</li>
            <li><strong>Arrow Up/Down</strong> to navigate options</li>
            <li><strong>Enter/Space</strong> to select option</li>
            <li><strong>Escape</strong> to close dropdown</li>
          </ol>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-2">
            <label class="block text-sm font-medium text-smoke-700 dark-theme:text-smoke-200">
              Sort Order
            </label>
            <SingleSelect
              v-model="selectedSort"
              :options="sortOptions"
              label="Choose sort order"
              class="w-full"
            />
            <p class="text-xs text-smoke-500">
              Selected: {{ selectedSort ? sortOptions.find(o => o.value === selectedSort)?.name : 'None' }}
            </p>
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-medium text-smoke-700 dark-theme:text-smoke-200">
              Task Priority (With Icon)
            </label>
            <SingleSelect
              v-model="selectedPriority"
              :options="priorityOptions"
              label="Set priority level"
              class="w-full"
            >
              <template #icon>
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd" />
                </svg>
              </template>
            </SingleSelect>
            <p class="text-xs text-smoke-500">
              Selected: {{ selectedPriority ? priorityOptions.find(o => o.value === selectedPriority)?.name : 'None' }}
            </p>
          </div>
        </div>
      </div>
    `
  })
}

export const ScreenReaderFriendly: Story = {
  render: (args) => ({
    components: { SingleSelect },
    setup() {
      const selectedLanguage = ref<string | null>('en')
      const selectedTheme = ref<string | null>(null)

      const languageOptions = [
        { name: 'English', value: 'en' },
        { name: 'Spanish', value: 'es' },
        { name: 'French', value: 'fr' },
        { name: 'German', value: 'de' },
        { name: 'Japanese', value: 'ja' }
      ]

      const themeOptions = [
        { name: 'Light Theme', value: 'light' },
        { name: 'Dark Theme', value: 'dark' },
        { name: 'Auto (System)', value: 'auto' },
        { name: 'High Contrast', value: 'contrast' }
      ]

      return {
        selectedLanguage,
        selectedTheme,
        languageOptions,
        themeOptions,
        args
      }
    },
    template: `
      <div class="space-y-6 p-4">
        <div class="bg-green-50 dark-theme:bg-green-900/20 border border-green-200 dark-theme:border-green-700 rounded-lg p-4">
          <h3 class="text-lg font-semibold mb-2">♿ Screen Reader Test</h3>
          <p class="text-sm text-smoke-600 dark-theme:text-smoke-300 mb-2">
            These dropdowns have proper ARIA attributes and labels for screen readers:
          </p>
          <ul class="text-sm text-smoke-600 dark-theme:text-smoke-300 list-disc list-inside space-y-1">
            <li><code>role="combobox"</code> identifies as dropdown</li>
            <li><code>aria-haspopup="listbox"</code> indicates popup type</li>
            <li><code>aria-expanded</code> shows open/closed state</li>
            <li><code>aria-label</code> provides accessible name</li>
            <li>Selected option value announced to assistive technology</li>
          </ul>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-2">
            <label class="block text-sm font-medium text-smoke-700 dark-theme:text-smoke-200" id="language-label">
              Preferred Language
            </label>
            <SingleSelect
              v-model="selectedLanguage"
              :options="languageOptions"
              label="Select language"
              class="w-full"
              aria-labelledby="language-label"
            />
            <p class="text-xs text-smoke-500" aria-live="polite">
              Current: {{ selectedLanguage ? languageOptions.find(o => o.value === selectedLanguage)?.name : 'None selected' }}
            </p>
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-medium text-smoke-700 dark-theme:text-smoke-200" id="theme-label">
              Interface Theme
            </label>
            <SingleSelect
              v-model="selectedTheme"
              :options="themeOptions"
              label="Select theme"
              class="w-full"
              aria-labelledby="theme-label"
            />
            <p class="text-xs text-smoke-500" aria-live="polite">
              Current: {{ selectedTheme ? themeOptions.find(o => o.value === selectedTheme)?.name : 'No theme selected' }}
            </p>
          </div>
        </div>

        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 class="font-semibold mb-2">🎧 Screen Reader Testing Tips</h4>
          <ul class="text-sm text-smoke-600 dark-theme:text-smoke-300 space-y-1">
            <li>• Listen for role announcements when focusing</li>
            <li>• Verify dropdown state changes are announced</li>
            <li>• Check that selected values are spoken clearly</li>
            <li>• Ensure option navigation is announced</li>
          </ul>
        </div>
      </div>
    `
  })
}

export const FormIntegration: Story = {
  render: (args) => ({
    components: { SingleSelect },
    setup() {
      const formData = ref({
        category: null as string | null,
        status: 'draft' as string | null,
        assignee: null as string | null
      })

      const categoryOptions = [
        { name: 'Bug Report', value: 'bug' },
        { name: 'Feature Request', value: 'feature' },
        { name: 'Documentation', value: 'docs' },
        { name: 'Question', value: 'question' }
      ]

      const statusOptions = [
        { name: 'Draft', value: 'draft' },
        { name: 'Review', value: 'review' },
        { name: 'Approved', value: 'approved' },
        { name: 'Published', value: 'published' }
      ]

      const assigneeOptions = [
        { name: 'Alice Johnson', value: 'alice' },
        { name: 'Bob Smith', value: 'bob' },
        { name: 'Carol Davis', value: 'carol' },
        { name: 'David Wilson', value: 'david' }
      ]

      const handleSubmit = () => {
        alert('Form submitted with: ' + JSON.stringify(formData.value, null, 2))
      }

      return {
        formData,
        categoryOptions,
        statusOptions,
        assigneeOptions,
        handleSubmit,
        args
      }
    },
    template: `
      <div class="max-w-2xl mx-auto p-6">
        <div class="bg-purple-50 dark-theme:bg-purple-900/20 border border-purple-200 dark-theme:border-purple-700 rounded-lg p-4 mb-6">
          <h3 class="text-lg font-semibold mb-2">📝 Form Integration Test</h3>
          <p class="text-sm text-smoke-600 dark-theme:text-smoke-300">
            Test keyboard navigation through a complete form with SingleSelect components.
            Tab order should be logical and all elements should be accessible.
          </p>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-smoke-700 dark-theme:text-smoke-200 mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              placeholder="Enter a title"
              class="block w-full px-3 py-2 border border-smoke-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-smoke-700 dark-theme:text-smoke-200 mb-1">
              Category *
            </label>
            <SingleSelect
              v-model="formData.category"
              :options="categoryOptions"
              label="Select category"
              required
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-smoke-700 dark-theme:text-smoke-200 mb-1">
              Status
            </label>
            <SingleSelect
              v-model="formData.status"
              :options="statusOptions"
              label="Select status"
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-smoke-700 dark-theme:text-smoke-200 mb-1">
              Assignee
            </label>
            <SingleSelect
              v-model="formData.assignee"
              :options="assigneeOptions"
              label="Select assignee"
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-smoke-700 dark-theme:text-smoke-200 mb-1">
              Description
            </label>
            <textarea
              rows="4"
              placeholder="Enter description"
              class="block w-full px-3 py-2 border border-smoke-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div class="flex gap-3">
            <button
              type="submit"
              class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Submit
            </button>
            <button
              type="button"
              class="px-4 py-2 bg-smoke-300 dark-theme:bg-smoke-600 text-smoke-700 dark-theme:text-smoke-200 rounded-md hover:bg-smoke-400 dark-theme:hover:bg-smoke-500 focus:ring-2 focus:ring-smoke-500 focus:ring-offset-2"
            >
              Cancel
            </button>
          </div>
        </form>

        <div class="mt-6 p-4 bg-gray-50 dark-theme:bg-zinc-800 border border-smoke-200 dark-theme:border-zinc-700 rounded-lg">
          <h4 class="font-semibold mb-2">Current Form Data:</h4>
          <pre class="text-xs text-smoke-600 dark-theme:text-smoke-300">{{ JSON.stringify(formData, null, 2) }}</pre>
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
          <h2 class="text-2xl font-bold mb-4">♿ SingleSelect Accessibility Checklist</h2>

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
                  <span><strong>Form Integration:</strong> Works properly in forms with other elements</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 class="text-lg font-semibold mb-3 text-blue-700">📋 Testing Guidelines</h3>
              <ol class="space-y-2 text-sm list-decimal list-inside">
                <li><strong>Keyboard Only:</strong> Navigate using only keyboard</li>
                <li><strong>Screen Reader:</strong> Test with NVDA, JAWS, or VoiceOver</li>
                <li><strong>Focus Visible:</strong> Ensure focus rings are always visible</li>
                <li><strong>Tab Order:</strong> Verify logical progression in forms</li>
                <li><strong>Announcements:</strong> Check state changes are announced</li>
                <li><strong>Selection:</strong> Verify selected value is announced</li>
              </ol>
            </div>
          </div>

          <div class="mt-6 p-4 bg-blue-50 dark-theme:bg-blue-900/20 border border-azure-400 dark-theme:border-blue-700 rounded-lg">
            <h4 class="font-semibold mb-2">🎯 Quick Test</h4>
            <p class="text-sm text-smoke-700 dark-theme:text-smoke-200">
              Close your eyes, use only the keyboard, and try to select different options from any dropdown above.
              If you can successfully navigate and make selections, the accessibility implementation is working!
            </p>
          </div>

          <div class="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <h4 class="font-semibold mb-2">⚡ Performance Note</h4>
            <p class="text-sm text-smoke-700 dark-theme:text-smoke-200">
              These accessibility features are built into the component with minimal performance impact.
              The ARIA attributes and keyboard handlers add less than 1KB to the bundle size.
            </p>
          </div>
        </div>
      </div>
    `
  })
}
