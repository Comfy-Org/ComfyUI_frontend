import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import type {
  FieldErrors,
  FieldSchema,
  FormValues
} from '../../config/workshop-playground'
import { defaultValues, schemaForModel } from '../../config/workshop-playground'
import { getAuthoredRouterWorkshopModelDetail as getRouterWorkshopModelDetail } from '../../config/workshop-router-content'
import PlaygroundForm from './PlaygroundForm.vue'

const PAGE = 'kling--omni-pro-image-to-video--animate-images'

function mountPage(errors: FieldErrors = {}) {
  const model = getRouterWorkshopModelDetail(PAGE)
  if (!model) throw new Error(`Missing ${PAGE}`)
  const schema = schemaForModel(model)
  const values = ref<FormValues>(defaultValues(schema, model.defaults))
  render(
    defineComponent({
      setup: () => () =>
        h(PlaygroundForm, {
          schema,
          errors,
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

function slot(
  name: string,
  label: string,
  hint?: string,
  advanced?: boolean
): FieldSchema {
  return {
    kind: 'text',
    name,
    label,
    required: false,
    multiline: false,
    ...(hint ? { hint } : {}),
    ...(advanced === undefined ? {} : { advanced }),
    presentation: {
      label,
      help: hint ?? '',
      hidden: false,
      advanced: advanced ?? false,
      control: 'text-box',
      urlUpload: 'image'
    }
  }
}

function renderSchema(schema: FieldSchema[], errors: FieldErrors = {}) {
  render(
    defineComponent({
      setup: () => () =>
        h(PlaygroundForm, {
          schema,
          errors,
          modelValue: {},
          'onUpdate:modelValue': () => {}
        })
    })
  )
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

// Grouping only requires the slots to be the same kind of upload, not to carry
// the same limits, so a complaint about one of them has to be worded from that
// slot rather than from the one that happens to lead the group.
describe('a complaint about a later slot', () => {
  it('is worded from the slot it came from', () => {
    renderSchema(
      [
        slot('image_url', 'Image', 'The first one has to be square.'),
        slot('image_url_2', 'Image 2', 'The second one has to be wide.')
      ],
      { image_url_2: 'incompatible' }
    )

    expect(screen.getByTestId('error-image_url')).toHaveTextContent(
      'The second one has to be wide.'
    )
  })
})

// Which section each slot lands in is the contract's call, and a run is not
// obliged to keep its slots together. Wherever a follower lands it has to
// leave the form, or it renders twice — once inside the group, once on its own.
describe('a run whose slots are filed apart', () => {
  it.for([
    { where: 'the follower is filed under Advanced', advanced: [false, true] },
    { where: 'the whole run is filed under Advanced', advanced: [true, true] }
  ])('still asks once when $where', ({ advanced }) => {
    renderSchema([
      slot('image_url', 'Image', undefined, advanced[0]),
      slot('image_url_2', 'Image 2', undefined, advanced[1])
    ])

    expect(screen.getByTestId('field-group-image_url')).toBeTruthy()
    expect(screen.queryByTestId('field-group-image_url_2')).toBeNull()
    expect(screen.getByTestId('field-image_url-count')).toHaveTextContent(
      '0 / 2'
    )
  })
})

// `errors` comes from the page's last validation, so it still describes the
// slots as they were. The control owns all of them, so a complaint about one
// it has since emptied has to go with it.
describe('a complaint about a slot the control has changed', () => {
  it('goes once the slots are chosen again', async () => {
    const user = userEvent.setup()
    mountPage({ reference_image_url_2: 'tooLarge' })

    expect(screen.getByTestId('error-reference_image_url')).toBeTruthy()

    await user.upload(
      screen.getByLabelText('Reference image', { selector: 'input' }),
      [image('first.png')]
    )

    expect(screen.queryByTestId('error-reference_image_url')).toBeNull()
  })
})
