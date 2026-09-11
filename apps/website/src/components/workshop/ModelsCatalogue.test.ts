// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'
import ModelsCatalogue from './ModelsCatalogue.vue'

afterEach(() => {
  localStorage.clear()
  history.replaceState(null, '', '/')
})

describe('ModelsCatalogue', () => {
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
