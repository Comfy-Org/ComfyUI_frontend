import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'

import type { WorkshopModelDetail } from '../../config/models-catalogue'
import ModelRun from './ModelRun.vue'

const detail = (slug: string) => ({ slug }) as unknown as WorkshopModelDetail

const operation = (slug: string, task: string, price?: string) => ({
  slug,
  task,
  price,
  detail: detail(slug)
})

const mounts: string[] = []

// The real playground carries the whole Router session with it, and none of
// that is what this component decides.
const ModelDetailStub = defineComponent({
  props: { model: { type: Object, required: true } },
  setup: (props) => {
    mounts.push(props.model.slug)
  },
  template: '<p data-testid="detail">{{ model.slug }}</p>'
})

const mount = (operations: ReturnType<typeof operation>[]) =>
  render(ModelRun, {
    props: { operations },
    global: { stubs: { ModelDetail: ModelDetailStub } }
  })

const running = () => screen.getByTestId('detail').textContent

describe('ModelRun', () => {
  beforeEach(() => {
    mounts.length = 0
  })

  it('runs the only operation without asking which one', () => {
    mount([operation('flux--generate-images', 'Text to Image')])

    expect(screen.queryByTestId('model-operations')).toBeNull()
    expect(running()).toBe('flux--generate-images')
  })

  it('hands back the choice the catalogue collapsed', async () => {
    mount([
      operation('flux--generate-images', 'Text to Image', '10 credits'),
      operation('flux--edit-images', 'Image to Image', '14 credits')
    ])

    const choices = within(screen.getByTestId('model-operations'))
    expect(
      choices.getByRole('button', { name: /Text to Image/ })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(running()).toBe('flux--generate-images')

    await userEvent.click(
      choices.getByRole('button', { name: /Image to Image/ })
    )

    expect(running()).toBe('flux--edit-images')
    expect(
      choices.getByRole('button', { name: /Text to Image/ })
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('builds the playground again for the operation it switches to', async () => {
    mount([
      operation('flux--generate-images', 'Text to Image'),
      operation('flux--edit-images', 'Image to Image')
    ])

    await userEvent.click(
      screen.getByRole('button', { name: /Image to Image/ })
    )

    expect(mounts).toEqual(['flux--generate-images', 'flux--edit-images'])
  })
})
