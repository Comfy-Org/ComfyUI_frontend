import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import {
  ROUTER_CATALOG_MODEL_COUNT,
  ROUTER_COMFY_ONLY_PREVIEW,
  ROUTER_PROVIDER_COVERAGE
} from '../../config/router-providers'
import RouterProviderCoverageSection from './RouterProviderCoverageSection.vue'

const remaining =
  ROUTER_CATALOG_MODEL_COUNT - ROUTER_PROVIDER_COVERAGE.length - 1

function servedBy(name: string): boolean[] {
  return within(screen.getByRole('row', { name: new RegExp(name) }))
    .getAllByRole('cell')
    .map((cell) => within(cell).queryByText('Served') !== null)
}

describe('RouterProviderCoverageSection', () => {
  it('says every model runs on Comfy, starting with the busiest', () => {
    render(RouterProviderCoverageSection, { props: { locale: 'en' } })

    expect(
      screen.getByRole('heading', {
        name: 'Same models. More places to run them.'
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Every model runs on Comfy by default/)
    ).toBeInTheDocument()
    expect(screen.getByText('model_provider').tagName).toBe('CODE')
    expect(
      screen.getByText(/We're starting with the highest-traffic models/)
    ).toBeInTheDocument()
  })

  it('heads each serving provider column with its logo', () => {
    render(RouterProviderCoverageSection, { props: { locale: 'en' } })

    const headers = screen.getAllByRole('columnheader')
    expect(headers[0]).toHaveTextContent('MODEL')
    expect(
      headers
        .slice(1)
        .map((header) => within(header).getByRole('img').getAttribute('alt'))
    ).toEqual(['Comfy', 'fal', 'Higgsfield', 'Runware', 'WaveSpeed'])
  })

  it('lists each routable model, then previews the Comfy-only catalog', () => {
    render(RouterProviderCoverageSection, { props: { locale: 'en' } })

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    expect(ROUTER_PROVIDER_COVERAGE).toHaveLength(8)
    expect(rows).toHaveLength(
      1 + ROUTER_PROVIDER_COVERAGE.length + ROUTER_COMFY_ONLY_PREVIEW.length
    )
    expect(
      screen.getByRole('link', { name: 'Nano Banana Pro' })
    ).toHaveAttribute(
      'href',
      'https://docs.comfy.org/development/comfy-router/models/google/nano-banana-pro/code'
    )
    expect(screen.getByRole('link', { name: 'MiniMax H3' })).toBeTruthy()
    expect(
      screen.queryByRole('link', { name: 'GPT Image 2.5 Flare' })
    ).toBeNull()
    expect(screen.queryByText('FLUX 2 Pro')).toBeNull()
    expect(rows.at(-1)).toHaveClass('opacity-10')
  })

  it('marks Comfy on every row and each other provider where it serves', () => {
    render(RouterProviderCoverageSection, { props: { locale: 'en' } })

    expect(servedBy('Nano Banana Pro')).toEqual([true, true, false, true, true])
    expect(servedBy('Kling V3')).toEqual([true, false, true, false, false])
    expect(servedBy('Seedance 2.0')).toEqual([true, true, false, false, false])
    expect(servedBy('MiniMax H3')).toEqual([true, false, false, false, false])
  })

  it('sends the rest of the catalog to the models page', () => {
    render(RouterProviderCoverageSection, { props: { locale: 'en' } })

    expect(screen.getByText(`+${remaining} more models`)).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: `Browse all ${ROUTER_CATALOG_MODEL_COUNT} models`
      })
    ).toHaveAttribute('href', '/models')
  })

  it('translates the chrome and keeps model names as they are', () => {
    render(RouterProviderCoverageSection, { props: { locale: 'zh-CN' } })

    expect(
      screen.getByRole('heading', { name: '同样的模型，更多运行选择。' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: '模型' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Nano Banana Pro' })
    ).toBeInTheDocument()
    expect(screen.getByText(`另有 ${remaining} 个模型`)).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: new RegExp(String(ROUTER_CATALOG_MODEL_COUNT))
      })
    ).toHaveAttribute('href', '/models')
  })
})
