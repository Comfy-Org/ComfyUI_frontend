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
// that is what this component decides. It does place the operation choice,
// which the playground takes as a slot under its own tabs.
const ModelDetailStub = defineComponent({
  props: { model: { type: Object, required: true } },
  setup: (props) => {
    mounts.push(props.model.slug)
  },
  template:
    '<p data-testid="detail">{{ model.slug }}</p><slot name="operations" />'
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

  // The switch rebuilds the playground the choice sits inside, so every read
  // here is of the row as it stands now rather than of the one that was there.
  const choice = (name: RegExp) =>
    within(screen.getByTestId('model-operations')).getByRole('button', { name })

  it('hands back the choice the catalogue collapsed', async () => {
    mount([
      operation('flux--generate-images', 'Text to Image', '10 credits'),
      operation('flux--edit-images', 'Image to Image', '14 credits')
    ])

    expect(choice(/Text to Image/)).toHaveAttribute('aria-pressed', 'true')
    expect(running()).toBe('flux--generate-images')

    await userEvent.click(choice(/Image to Image/))

    expect(running()).toBe('flux--edit-images')
    expect(choice(/Text to Image/)).toHaveAttribute('aria-pressed', 'false')
    expect(choice(/Image to Image/)).toHaveAttribute('aria-pressed', 'true')
  })

  // Switching destroys the button that was pressed, so without putting it back
  // a keyboard would be left on the document body.
  it('keeps the keyboard on the operation it switched to', async () => {
    mount([
      operation('flux--generate-images', 'Text to Image'),
      operation('flux--edit-images', 'Image to Image')
    ])

    await userEvent.click(choice(/Image to Image/))

    expect(choice(/Image to Image/)).toHaveFocus()
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
