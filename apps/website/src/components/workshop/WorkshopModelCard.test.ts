// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '../../config/models-catalogue'
import WorkshopModelCard from './WorkshopModelCard.vue'

const base: WorkshopModel = {
  slug: 'flux',
  name: 'Flux',
  workflowCount: 2,
  href: '/models/flux/',
  routerId: 'bfl/flux',
  capabilities: [],
  runs: 12_000,
  provider: 'Black Forest Labs',
  modality: 'image',
  task: 'image-to-image'
}

describe('WorkshopModelCard', () => {
  it('links the name, provider badge and task to the model page', () => {
    render(WorkshopModelCard, { props: { model: base } })
    const link = screen.getByTestId('workshop-model-card')
    expect(link.getAttribute('href')).toBe('/models/flux/')
    expect(screen.getByText('Flux')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Black Forest Labs' })).toBeTruthy()
    expect(screen.getByTestId('model-card-name').textContent).toBe('Flux')
    expect(screen.getByTestId('model-card-task').textContent).toBe(
      'Image to Image'
    )
    expect(screen.queryByText(/credits|\$/)).toBeNull()
    expect(screen.queryByTestId('model-incomplete-badge')).toBeNull()
    expect(screen.getByTestId('model-media-placeholder')).toBeTruthy()
    expect(screen.queryByRole('img', { name: 'Flux' })).toBeNull()
    expect(screen.queryByLabelText('Flux')).toBeNull()
  })

  it.for([
    { locale: 'en', label: 'Incomplete', action: 'View details' },
    { locale: 'zh-CN', label: '尚未完善', action: '查看详情' }
  ] as const)(
    'labels incomplete models in $locale without disabling the page link',
    ({ locale, label, action }) => {
      render(WorkshopModelCard, {
        props: {
          model: { ...base, incompleteReason: 'missing-input-schema' },
          locale
        }
      })
      expect(screen.getByText(label)).toBeTruthy()
      expect(
        screen
          .getByRole('link', { name: new RegExp(label) })
          .getAttribute('href')
      ).toBe(base.href)
      expect(screen.getByText(action)).toBeTruthy()
      expect(screen.queryByText('Try now')).toBeNull()
    }
  )

  it('falls back to the provider initial and the modality when nothing matches', () => {
    render(WorkshopModelCard, {
      props: {
        model: { ...base, name: 'Mystery', provider: 'Nobody', task: undefined }
      }
    })
    expect(screen.getByText('N')).toBeTruthy()
    expect(screen.getByTestId('model-card-task').textContent).toBe('Image')
  })

  it('renders moving thumbnails as video instead of an image', () => {
    render(WorkshopModelCard, {
      props: {
        model: {
          ...base,
          thumbnailUrl: 'https://assets.example/preview.mp4',
          thumbnail: {
            url: 'https://assets.example/preview.mp4',
            kind: 'video'
          }
        }
      }
    })

    expect(screen.getByLabelText('Flux').getAttribute('src')).toBe(
      'https://assets.example/preview.mp4'
    )
    expect(screen.queryByRole('img', { name: 'Flux' })).toBeNull()
  })

  it.for(['image', 'video'] as const)(
    'labels a shared %s thumbnail without replacing its name or destination',
    (kind) => {
      render(WorkshopModelCard, {
        props: {
          model: {
            ...base,
            name: 'Flux Turbo',
            thumbnail: { kind, url: 'https://assets.example/shared' },
            thumbnailLabel: 'Turbo'
          }
        }
      })
      expect(screen.getByTestId('model-thumbnail-label').textContent).toBe(
        'Turbo'
      )
      expect(screen.getByTestId('model-card-name').textContent).toBe(
        'Flux Turbo'
      )
      expect(
        screen.getByRole('link', { name: /Flux Turbo/ }).getAttribute('href')
      ).toBe(base.href)
    }
  )

  it.for([false, true])(
    'keeps incomplete status alongside the ribbon (hub: %s)',
    (providerBadge) => {
      render(WorkshopModelCard, {
        props: {
          providerBadge,
          model: {
            ...base,
            incompleteReason: 'missing-input-schema',
            thumbnail: { kind: 'image', url: 'https://assets.example/shared' },
            thumbnailLabel: 'Pro'
          }
        }
      })
      expect(screen.getByText('Incomplete')).toBeTruthy()
      expect(screen.getByTestId('model-thumbnail-label').textContent).toBe(
        'Pro'
      )
      expect(screen.getByText('View details')).toBeTruthy()
    }
  )

  it.for([
    { ...base, thumbnailLabel: 'Turbo' },
    {
      ...base,
      thumbnail: {
        kind: 'image',
        url: 'https://assets.example/unique'
      } as const
    }
  ])('leaves fallback and unlabelled artwork unmarked', (card) => {
    render(WorkshopModelCard, { props: { model: card } })
    expect(screen.queryByTestId('model-thumbnail-label')).toBeNull()
  })
})
