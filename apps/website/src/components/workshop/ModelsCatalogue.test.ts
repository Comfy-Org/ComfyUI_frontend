// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { captureWorkshopEvent } from '../../scripts/posthog'
import ModelsCatalogue from './ModelsCatalogue.vue'

const enabled = ref(false)
vi.mock(import('../../scripts/posthog'), () => ({
  useWorkshopEnabled: () => enabled,
  captureWorkshopEvent: vi.fn()
}))

beforeEach(() => {
  enabled.value = false
})

afterEach(() => {
  localStorage.clear()
  history.replaceState(null, '', '/')
})

describe('ModelsCatalogue', () => {
  it('records a visit once after access is enabled, without counting the hidden catalogue', async () => {
    render(ModelsCatalogue, { props: { models: [] } })
    await nextTick()
    expect(captureWorkshopEvent).not.toHaveBeenCalled()
    enabled.value = true
    await nextTick()
    enabled.value = false
    await nextTick()
    enabled.value = true
    await nextTick()
    expect(captureWorkshopEvent).toHaveBeenCalledExactlyOnceWith({
      name: 'catalogue_viewed',
      properties: { model_count: 0 }
    })
  })
  it.for(['?v=v2', '?version=v2', ''])(
    'ignores prototype overrides (%s) and renders the approved catalog',
    (query) => {
      history.replaceState(null, '', `/models/${query}`)
      localStorage.setItem('comfy-workshop-version', 'v2')
      render(ModelsCatalogue, { props: { models: [] } })
      expect(screen.getByTestId('workshop-hero')).toBeTruthy()
      expect(screen.queryByTestId('workshop-hub')).toBeNull()
      expect(screen.getByTestId('workshop-sections')).toBeTruthy()
    }
  )
})
