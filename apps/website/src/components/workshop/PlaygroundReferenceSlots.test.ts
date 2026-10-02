import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import type { FormValues } from '../../config/workshop-playground'
import { defaultValues, schemaForModel } from '../../config/workshop-playground'
import { getAuthoredRouterWorkshopModelDetail as getRouterWorkshopModelDetail } from '../../config/workshop-router-content'
import PlaygroundForm from './PlaygroundForm.vue'

const PAGE = 'kling--omni-pro-image-to-video--animate-images'

function mountPage() {
  const model = getRouterWorkshopModelDetail(PAGE)
  if (!model) throw new Error(`Missing ${PAGE}`)
  const schema = schemaForModel(model)
  const values = ref<FormValues>(defaultValues(schema, model.defaults))
  render(
    defineComponent({
      setup: () => () =>
        h(PlaygroundForm, {
          schema,
          errors: {},
          modelValue: values.value,
          'onUpdate:modelValue': (next: FormValues) => {
            values.value = next
          }
        })
    })
  )
  return values
}

function image(name: string) {
  return new File([new Uint8Array(2048)], name, { type: 'image/png' })
}

describe('numbered reference slots', () => {
  it('asks for the reference images once, not once per slot', () => {
    mountPage()

    expect(screen.getByTestId('field-group-reference_image_url')).toBeTruthy()
    expect(screen.queryByTestId('field-group-reference_image_url_2')).toBeNull()
    expect(screen.queryByTestId('field-group-reference_image_url_7')).toBeNull()
    // The slots the model takes are what the one control is worth, so the
    // count has to say how many there are rather than leave it to be guessed.
    // The page's own example fills the first one.
    expect(
      screen.getByTestId('field-reference_image_url-count')
    ).toHaveTextContent('1 / 7')
  })

  it('fills the slots in order from the one control', async () => {
    const user = userEvent.setup()
    const values = mountPage()
    const first = image('first.png')
    const second = image('second.png')

    await user.upload(
      screen.getByLabelText('Reference image', { selector: 'input' }),
      [first, second]
    )

    // The example keeps the slot it came in, and the two chosen images take
    // the next ones in the order they were given.
    expect(typeof values.value.reference_image_url).toBe('string')
    expect(values.value).toMatchObject({
      reference_image_url_2: { file: first },
      reference_image_url_3: { file: second }
    })
    expect(values.value.reference_image_url_4).toBeUndefined()
    expect(
      screen.getByTestId('field-reference_image_url-count')
    ).toHaveTextContent('3 / 7')
  })

  it('closes the gap when a chosen image is removed', async () => {
    const user = userEvent.setup()
    const values = mountPage()
    const first = image('first.png')
    const second = image('second.png')

    await user.upload(
      screen.getByLabelText('Reference image', { selector: 'input' }),
      [first, second]
    )
    await user.click(screen.getByRole('button', { name: 'Remove first.png' }))

    // What is left moves up rather than leaving a hole: the model reads the
    // slots in order, and an empty one would end the list early.
    expect(values.value).toMatchObject({
      reference_image_url_2: { file: second }
    })
    expect(values.value.reference_image_url_3).toBeUndefined()
    expect(
      screen.getByTestId('field-reference_image_url-count')
    ).toHaveTextContent('2 / 7')
  })
})
