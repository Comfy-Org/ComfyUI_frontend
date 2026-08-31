// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import BuildConfiguratorSplit01 from './BuildConfiguratorSplit01.vue'

const baseProps = {
  heading: 'One approved ComfyUI environment.',
  body: 'Define the build once, ship it everywhere.',
  features: ['Private custom nodes and models'],
  eyebrow: 'MANAGED BUILDS',
  panelTitle: 'Define your build',
  releasesLabel: 'COMFYUI RELEASE',
  releases: ['v0.3.41', 'v0.3.40'],
  environmentsLabel: 'PYTHON · PYTORCH · CUDA',
  environments: [
    { id: 'env-1', python: '3.12', torch: '2.6', cuda: '12.8' },
    { id: 'env-2', python: '3.11', torch: '2.5', cuda: '12.4' }
  ],
  nodesLabel: 'CUSTOM NODES',
  nodes: [
    { id: 'manager', label: 'ComfyUI-Manager', selected: true },
    { id: 'controlnet', label: 'ControlNet Aux' }
  ],
  modelsLabel: 'MODELS',
  models: [
    { id: 'flux', label: 'FLUX 3', selected: true },
    { id: 'wan', label: 'Wan 3.0' }
  ],
  cta: { label: 'START BUILDING', href: '/contact/' }
} as const

const summaryText = () =>
  screen.getByTestId('build-summary').textContent!.replace(/\s+/g, ' ').trim()

describe('BuildConfiguratorSplit01', () => {
  it('renders the copy column and a summary of the initial selection', () => {
    render(BuildConfiguratorSplit01, { props: baseProps })

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'One approved ComfyUI environment.'
      })
    ).toBeTruthy()
    expect(screen.getByText('Private custom nodes and models')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'START BUILDING' })).toBeTruthy()

    expect(summaryText()).toBe(
      'v0.3.41 · py3.12 · torch 2.6 1 nodes · 1 models · pinned'
    )
    expect(
      screen
        .getByRole('button', { name: 'v0.3.41' })
        .getAttribute('aria-pressed')
    ).toBe('true')
    expect(
      screen
        .getByRole('button', { name: 'ComfyUI-Manager' })
        .getAttribute('aria-pressed')
    ).toBe('true')
    expect(
      screen
        .getByRole('button', { name: 'ControlNet Aux' })
        .getAttribute('aria-pressed')
    ).toBe('false')
  })

  it('selects a single release and environment and re-derives the summary', async () => {
    render(BuildConfiguratorSplit01, { props: baseProps })

    await userEvent.click(screen.getByRole('button', { name: 'v0.3.40' }))
    await userEvent.click(
      screen.getByRole('button', { name: '3.11 · 2.5 · 12.4' })
    )

    expect(summaryText()).toContain('v0.3.40 · py3.11 · torch 2.5')
    expect(
      screen
        .getByRole('button', { name: 'v0.3.41' })
        .getAttribute('aria-pressed')
    ).toBe('false')
    expect(
      screen
        .getByRole('button', { name: 'v0.3.40' })
        .getAttribute('aria-pressed')
    ).toBe('true')
  })

  it('toggles node and model chips and updates the counts', async () => {
    render(BuildConfiguratorSplit01, { props: baseProps })

    await userEvent.click(
      screen.getByRole('button', { name: 'ControlNet Aux' })
    )
    await userEvent.click(screen.getByRole('button', { name: 'Wan 3.0' }))
    expect(summaryText()).toContain('2 nodes · 2 models')

    await userEvent.click(
      screen.getByRole('button', { name: 'ComfyUI-Manager' })
    )
    expect(summaryText()).toContain('1 nodes · 2 models')
  })
})
