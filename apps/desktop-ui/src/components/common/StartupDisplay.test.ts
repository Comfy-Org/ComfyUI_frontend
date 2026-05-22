import { render, screen } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import StartupDisplay from '@/components/common/StartupDisplay.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { logoAlt: 'ComfyUI' } } }
})

const ProgressBarStub = {
  props: ['mode', 'value', 'showValue'],
  template:
    '<div data-testid="progress-bar" :data-mode="mode" :data-value="value" />'
}

function renderDisplay(
  props: {
    progressPercentage?: number
    title?: string
    statusText?: string
    hideProgress?: boolean
    fullScreen?: boolean
  } = {}
) {
  return render(StartupDisplay, {
    props,
    global: {
      plugins: [[PrimeVue, { unstyled: true }], i18n],
      stubs: { ProgressBar: ProgressBarStub }
    }
  })
}

describe('StartupDisplay', () => {
  describe('progressMode', () => {
    it('renders indeterminate mode when progressPercentage is undefined', () => {
      renderDisplay()
      expect(screen.getByTestId('progress-bar').dataset.mode).toBe(
        'indeterminate'
      )
    })

    it('renders determinate mode when progressPercentage is provided', () => {
      renderDisplay({ progressPercentage: 50 })
      expect(screen.getByTestId('progress-bar').dataset.mode).toBe(
        'determinate'
      )
    })

    it('passes progressPercentage as value to the progress bar', () => {
      renderDisplay({ progressPercentage: 75 })
      expect(screen.getByTestId('progress-bar').dataset.value).toBe('75')
    })
  })

  describe('hideProgress', () => {
    it('hides the progress bar when hideProgress is true', () => {
      renderDisplay({ hideProgress: true })
      expect(screen.queryByTestId('progress-bar')).toBeNull()
    })

    it('shows the progress bar by default', () => {
      renderDisplay()
      expect(screen.getByTestId('progress-bar')).toBeDefined()
    })
  })

  describe('title', () => {
    it('renders the title text when provided', () => {
      renderDisplay({ title: 'Loading...' })
      expect(screen.getByText('Loading...')).toBeDefined()
    })

    it('does not render h1 when title is not provided', () => {
      renderDisplay()
      expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    })
  })

  describe('statusText', () => {
    it('renders statusText with data-testid attribute', () => {
      renderDisplay({ statusText: 'Starting server' })
      expect(screen.getByTestId('startup-status-text').textContent).toContain(
        'Starting server'
      )
    })

    it('does not render statusText element when not provided', () => {
      renderDisplay()
      expect(screen.queryByTestId('startup-status-text')).toBeNull()
    })
  })
})
