import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { h, ref } from 'vue'

import EditorTextArea from './EditorTextArea.vue'
import EditorTray from './EditorTray.vue'

function renderTray(fieldLabel?: boolean) {
  const text = ref('')
  render(EditorTray, {
    props: { title: 'Animation', closeLabel: 'Close', fieldLabel },
    slots: {
      default: () =>
        h(EditorTextArea, {
          label: 'Animation',
          modelValue: text.value,
          'onUpdate:modelValue': (next: string) => (text.value = next)
        })
    }
  })
}

describe('EditorTray', () => {
  it.for([
    { fieldLabel: undefined, hidden: false },
    { fieldLabel: false, hidden: true }
  ])(
    'keeps the field label for screen readers only when asked (fieldLabel: $fieldLabel)',
    ({ fieldLabel, hidden }) => {
      renderTray(fieldLabel)

      expect(
        screen.getByRole('textbox', { name: 'Animation' })
      ).toBeInTheDocument()
      expect(
        screen
          .getByRole('dialog', { name: 'Animation' })
          .classList.contains('**:data-field-label:sr-only')
      ).toBe(hidden)
    }
  )
})
