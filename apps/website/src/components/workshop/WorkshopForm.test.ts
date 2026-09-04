// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type {
  WorkshopDetailModel,
  WorkshopFormValues
} from '../../config/workshop-detail'
import WorkshopForm from './WorkshopForm.vue'

const model = {
  id: 'bfl/flux-3',
  slug: 'bfl-flux-3',
  displayName: 'Flux 3',
  provider: 'Black Forest Labs',
  modality: 'image',
  description: 'Text to image.',
  tags: ['image'],
  fields: [
    {
      kind: 'text',
      name: 'prompt',
      label: 'Prompt',
      required: true,
      multiline: true,
      valueType: 'string'
    },
    {
      kind: 'select',
      name: 'aspect_ratio',
      label: 'Aspect ratio',
      required: false,
      options: ['1:1', '16:9'],
      defaultValue: '1:1'
    }
  ]
} satisfies WorkshopDetailModel

/**
 * Asserting on what the component emits, rather than on an injected update
 * handler, is what a caller actually observes — and it keeps the fixture and
 * the props in their real types with no casts.
 */
function renderForm() {
  return render(WorkshopForm, { props: { model } })
}

function lastEmittedValues(
  utils: ReturnType<typeof renderForm>
): WorkshopFormValues | undefined {
  const emitted = utils.emitted('update:modelValue') as
    | [WorkshopFormValues][]
    | undefined
  return emitted?.at(-1)?.[0]
}

function utilsSelectValue(): string {
  return (screen.getByLabelText(/aspect ratio/i) as HTMLSelectElement).value
}

describe('WorkshopForm', () => {
  it('renders one control per field in the model', () => {
    renderForm()

    expect(screen.getByLabelText(/prompt/i)).toBeTruthy()
    expect(screen.getByLabelText(/aspect ratio/i)).toBeTruthy()
  })

  it('seeds the schema defaults and reports them', async () => {
    // The page renders this before the visitor has touched anything, so the
    // form has to become the model's defaults rather than stay empty and send
    // a request with no aspect ratio.
    const utils = renderForm()

    await waitFor(() =>
      expect(lastEmittedValues(utils)).toMatchObject({ aspect_ratio: '1:1' })
    )
    expect(utilsSelectValue()).toBe('1:1')
  })

  it('keeps an edit instead of re-seeding over it', async () => {
    const utils = renderForm()
    await userEvent.setup().type(screen.getByLabelText(/prompt/i), 'a cat')

    // The seed must not come back and overwrite what was typed.
    expect(lastEmittedValues(utils)).toMatchObject({
      prompt: 'a cat',
      aspect_ratio: '1:1'
    })
  })

  it('leaves running to the run panel rather than offering its own control', () => {
    renderForm()

    // The form is inputs only. It used to carry a permanently disabled "Run
    // model" button; now that running actually works, a second dead control
    // beside the live one would be worse than no control at all.
    expect(screen.queryAllByRole('button')).toEqual([])
  })
})
