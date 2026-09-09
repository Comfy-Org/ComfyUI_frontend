// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@testing-library/vue'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { WorkshopDetailModel } from '../../config/workshop-detail'
import WorkshopPlayground from './WorkshopPlayground.vue'

const model: WorkshopDetailModel = {
  id: 'bfl/flux-3',
  slug: 'bfl--flux-3',
  displayName: 'Flux 3',
  provider: 'bfl',
  modality: 'image',
  description: 'Generates an image.',
  tags: ['text-to-image'],
  fields: [
    {
      kind: 'text',
      name: 'prompt',
      label: 'Prompt',
      required: true,
      multiline: true,
      valueType: 'string'
    }
  ]
}

const jsonModel: WorkshopDetailModel = {
  ...model,
  fields: [
    {
      kind: 'text',
      name: 'inputs',
      label: 'Inputs',
      required: true,
      multiline: true,
      valueType: 'json',
      jsonSchema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', minLength: 1 },
            voice_id: { type: 'string', minLength: 1 }
          },
          required: ['text', 'voice_id'],
          additionalProperties: false
        },
        minItems: 1,
        maxItems: 10
      }
    }
  ]
}

describe('WorkshopPlayground', () => {
  it('updates every snippet from the current form values', async () => {
    const user = userEvent.setup()
    render(WorkshopPlayground, { props: { model } })

    await user.type(screen.getByRole('textbox', { name: /Prompt/ }), 'Red fox')
    await nextTick()
    expect(screen.getByText(/"prompt": "Red fox"/)).toBeTruthy()

    const typeScriptTab = screen.getByRole('tab', { name: 'TypeScript' })
    typeScriptTab.focus()
    await user.keyboard('{ArrowRight}')

    const pythonTab = screen.getByRole('tab', { name: 'Python' })
    expect(screen.getByRole('tab', { selected: true })).toBe(pythonTab)
    expect(screen.getByText(/comfy\.models\.run\("bfl\/flux-3"/)).toBeTruthy()
    expect(screen.getByText(/"prompt": "Red fox"/)).toBeTruthy()
  })

  it('replaces the placeholder key with a real one, per mount', async () => {
    // The placeholder is what the prerendered island contains. If it survived
    // into the browser, every reader would send the same Idempotency-Key and
    // the Router would treat one reader's run as a repeat of another's.
    const keyOf = (container: Element): string => {
      const match = /Idempotency-Key: ([^']+)'/.exec(container.textContent)
      expect(match).not.toBeNull()
      return match?.[1] ?? ''
    }

    // Only the active tab's panel is in the DOM, and the key lives in the raw
    // HTTP request. Driven by the keyboard because `TabsRoot` activates on
    // arrow navigation; a bare click does not move the selection here.
    const user = userEvent.setup()
    const showHttp = async (): Promise<void> => {
      screen.getByRole('tab', { name: 'TypeScript' }).focus()
      await user.keyboard('{ArrowRight}{ArrowRight}')
      await nextTick()
      expect(screen.getByRole('tab', { selected: true }).textContent).toContain(
        'HTTP'
      )
    }

    const first = render(WorkshopPlayground, { props: { model } })
    await showHttp()
    const firstKey = keyOf(first.container)

    expect(firstKey).not.toBe('REPLACE-WITH-A-UUID')
    expect(firstKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )

    first.unmount()
    const second = render(WorkshopPlayground, { props: { model } })
    await showHttp()

    expect(keyOf(second.container)).not.toBe(firstKey)
  })

  it('copies the selected snippet and confirms the action', async () => {
    const user = userEvent.setup()
    render(WorkshopPlayground, { props: { model } })

    // The prompt is required, and copying is blocked until it is filled.
    await user.type(screen.getByRole('textbox', { name: /Prompt/ }), 'Red fox')
    await nextTick()
    await user.click(screen.getByRole('button', { name: 'Copy code' }))

    // Asserted through the confirmation rather than by spying on
    // `navigator.clipboard.writeText`: this environment cannot grant the
    // clipboard-write permission, so the shared helper correctly takes its
    // legacy `execCommand` path and never touches that method. What gets
    // copied is the same `snippet` expression the panel renders, which the
    // live-snippet test above already pins.
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy()
  })

  it('will not copy a snippet whose required fields are still empty', async () => {
    // On first load most of the catalog is in this state: 253 of 268 models
    // are missing at least one required value, and 51 would emit `--data {}`.
    render(WorkshopPlayground, { props: { model } })

    expect(screen.getByRole('button', { name: 'Copy code' })).toHaveProperty(
      'disabled',
      true
    )
  })

  it('drops the copied confirmation when the language changes', async () => {
    const user = userEvent.setup()
    render(WorkshopPlayground, { props: { model } })

    await user.type(screen.getByRole('textbox', { name: /Prompt/ }), 'Red fox')
    await nextTick()
    await user.click(screen.getByRole('button', { name: 'Copy code' }))
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy()

    // Otherwise it still reads "Copied" over a snippet never copied.
    screen.getByRole('tab', { name: 'TypeScript' }).focus()
    await user.keyboard('{ArrowRight}')
    await nextTick()

    expect(screen.getByRole('button', { name: 'Copy code' })).toBeTruthy()
  })

  it('does not copy a snippet containing schema-invalid JSON', async () => {
    render(WorkshopPlayground, { props: { model: jsonModel } })
    const input = screen.getByRole('textbox', { name: /Inputs/ })
    const copy = screen.getByRole('button', { name: 'Copy code' })

    await fireEvent.update(input, '[]')
    await nextTick()
    expect(copy).toHaveProperty('disabled', true)

    await fireEvent.update(input, '[{"text":"Hello","voice_id":"Sarah"}]')
    await nextTick()
    expect(copy).toHaveProperty('disabled', false)
  })

  it('keeps the copy confirmation timed from the latest copy', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(WorkshopPlayground, { props: { model } })

    await user.type(screen.getByRole('textbox', { name: /Prompt/ }), 'Red fox')
    await nextTick()
    await user.click(screen.getByRole('button', { name: 'Copy code' }))
    await vi.advanceTimersByTimeAsync(1000)
    await user.click(screen.getByRole('button', { name: 'Copied' }))
    await vi.advanceTimersByTimeAsync(600)
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy()

    await vi.advanceTimersByTimeAsync(900)
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeTruthy()
  })
})
