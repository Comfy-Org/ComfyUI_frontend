import { render, screen } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

import StatusTag from '@/components/maintenance/StatusTag.vue'

const TagStub = defineComponent({
  name: 'Tag',
  props: {
    icon: String,
    severity: String,
    value: String
  },
  template: `<span data-testid="tag" :data-icon="icon" :data-severity="severity" :data-value="value">{{ value }}</span>`
})

function renderStatusTag(props: { error: boolean; refreshing?: boolean }) {
  return render(StatusTag, {
    props,
    global: {
      plugins: [[PrimeVue, { unstyled: true }]],
      stubs: { Tag: TagStub }
    }
  })
}

describe('StatusTag', () => {
  describe('refreshing state', () => {
    it('shows info severity when refreshing', () => {
      renderStatusTag({ error: false, refreshing: true })
      expect(screen.getByTestId('tag').dataset.severity).toBe('info')
    })

    it('shows refreshing translation key when refreshing', () => {
      renderStatusTag({ error: false, refreshing: true })
      expect(screen.getByTestId('tag').dataset.value).toBe(
        'maintenance.refreshing'
      )
    })

    it('shows question icon when refreshing', () => {
      renderStatusTag({ error: false, refreshing: true })
      expect(screen.getByTestId('tag').dataset.icon).toBeDefined()
    })
  })

  describe('error state', () => {
    it('shows danger severity when error is true', () => {
      renderStatusTag({ error: true })
      expect(screen.getByTestId('tag').dataset.severity).toBe('danger')
    })

    it('shows error translation key when error is true', () => {
      renderStatusTag({ error: true })
      expect(screen.getByTestId('tag').dataset.value).toBe('g.error')
    })
  })

  describe('OK state', () => {
    it('shows success severity when not refreshing and not error', () => {
      renderStatusTag({ error: false })
      expect(screen.getByTestId('tag').dataset.severity).toBe('success')
    })

    it('shows OK translation key when not refreshing and not error', () => {
      renderStatusTag({ error: false })
      expect(screen.getByTestId('tag').dataset.value).toBe('maintenance.OK')
    })
  })

  describe('precedence', () => {
    it('shows refreshing state when both refreshing and error are true', () => {
      renderStatusTag({ error: true, refreshing: true })
      expect(screen.getByTestId('tag').dataset.severity).toBe('info')
      expect(screen.getByTestId('tag').dataset.value).toBe(
        'maintenance.refreshing'
      )
    })
  })
})
