import { render, screen } from '@testing-library/vue'
import { assert, expect, it } from 'vitest'
import { detailSchema } from '@/config/models-page-data'
import { catalogPresentation } from '@/lib/cms/catalog-presentation'
import LocalModelPage from './LocalModelPage.vue'

it('shows a local model and its authored prose without paid API or Run controls', () => {
  const model = detailSchema.parse(
    catalogPresentation({
      uid: '00000000-0000-4000-8000-000000000031',
      edit_version: '00000000-0000-4000-8000-000000000032',
      revision: 2,
      kind: 'MODEL',
      slug: '/hub/models/local',
      enabled: true,
      deleted: false,
      visibility: 'PUBLIC',
      data: {
        type: 'model',
        title: 'Local model',
        slug: 'local',
        description: 'A downloadable model',
        long_description: 'First paragraph.\n\nSecond paragraph.',
        faq: [
          { question: 'Does this run locally?', answer: 'Yes, in ComfyUI.' }
        ],
        website_media: { '$.static_thumb': '/catalog-media/still.webp' },
        website_media_types: { '$.static_thumb': 'image/webp' }
      }
    })
  )
  expect(model.type).toBe('MODEL')
  expect(model.routerId).toBeUndefined()
  assert(model.type === 'MODEL' && model.routerId === undefined)
  render(LocalModelPage, { props: { model } })
  expect(
    screen.getByRole('heading', { level: 1, name: 'Local model' })
  ).toBeVisible()
  expect(screen.getByText('First paragraph.')).toBeVisible()
  expect(screen.getByText('Second paragraph.')).toBeVisible()
  expect(screen.getByText('Does this run locally?')).toBeVisible()
  expect(screen.getByRole('img', { name: 'Local model' })).toHaveAttribute(
    'src',
    '/catalog-media/still.webp'
  )
  expect(screen.queryByRole('button', { name: /^Run/ })).not.toBeInTheDocument()
  expect(screen.queryByText(/Get API key/i)).not.toBeInTheDocument()
})
