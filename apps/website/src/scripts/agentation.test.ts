import { describe, expect, it, vi } from 'vitest'

import type { Root } from 'react-dom/client'

import { Agentation } from 'agentation'
import { createRoot } from 'react-dom/client'

import { mountAgentation } from './agentation'

const render = vi.fn<Root['render']>()

vi.mock(import('agentation'), () => ({
  Agentation: () => null
}))

vi.mock(import('react-dom/client'), () => ({
  createRoot: vi.fn<typeof createRoot>(() => ({ render, unmount: vi.fn() }))
}))

describe('mountAgentation', () => {
  it('appends a host to the body and renders Agentation into it', () => {
    mountAgentation()

    const host = vi.mocked(createRoot).mock.lastCall?.[0]
    expect(host?.parentElement).toBe(document.body)
    expect(document.body.lastElementChild).toBe(host)
    expect(render).toHaveBeenCalledWith(
      expect.objectContaining({
        type: Agentation,
        props: { endpoint: 'http://localhost:4747', appName: 'comfy.org' }
      })
    )
  })

  it('re-appends the host after Astro swaps the body', () => {
    mountAgentation()
    const host = vi.mocked(createRoot).mock.lastCall?.[0]

    document.body.replaceChildren(document.createElement('main'))
    document.dispatchEvent(new Event('astro:after-swap'))

    expect(host?.parentElement).toBe(document.body)
    expect(document.body.lastElementChild).toBe(host)
  })
})
