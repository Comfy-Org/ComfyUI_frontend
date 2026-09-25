import { describe, expect, it } from 'vitest'
import { workshopModels } from '../../../config/workshop-browse-content'
import { workshopContract } from '../../../config/workshop-contract-catalog'
import { prepareWorkshopRouterInput } from '../../../config/workshop-request'
import {
  resolveModelRouterRender,
  prepareModelRouterRender
} from '../../../config/router-render'
import { cinematicEnhancementModel } from './enhancement-model'
import type { RunOutput } from '../../../config/workshop-run'
import {
  ENHANCEMENT_ROUTER_ID,
  enhancementBrief,
  enhancementForm,
  enhancementContractForm,
  enhancementResult,
  applyEnhancement,
  isEnhancementModel
} from './enhancement'

const brief = enhancementBrief({
  scene: '  A boat.\nKEEP THIS COPY!  ',
  directions: 'Static camera.',
  mode: 'video'
})
const document = (
  patch: Record<string, unknown> = {},
  truncated = false
): RunOutput => ({
  kind: 'text',
  url: 'blob:test',
  fileName: 'result.json',
  truncated,
  text: JSON.stringify({
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: 'Gentle ripples catch the light.' }],
    usage: { input_tokens: 100, output_tokens: 20 },
    ...patch
  })
})

describe('Router prompt enhancement', () => {
  it('resolves the internal descriptor through the same Router render preparation as /models', async () => {
    const model = cinematicEnhancementModel()
    if (!model) throw new Error('Missing native descriptor')
    const form = enhancementForm(model, brief)
    const resolved = resolveModelRouterRender(model, {}, { form })
    expect(resolved.expectedKind).toBe('text')
    expect(resolved.routerId).toBe(ENHANCEMENT_ROUTER_ID)
    expect(model.href).toBe('')
    expect(model.examples).toEqual([])
    expect(isEnhancementModel(model)).toBe(true)
    const prepared = await prepareModelRouterRender(model, {}, { model, form })
    expect(prepared.body.messages).toEqual(
      JSON.parse(String(form.values.messages))
    )
  })
  it('uses the real bundled Haiku contract with user content and no catalog example input', async () => {
    const contract = workshopContract(ENHANCEMENT_ROUTER_ID)
    if (!contract) throw new Error('Missing bundled Haiku contract')
    const form = enhancementContractForm(contract, brief)
    const body = await prepareWorkshopRouterInput(
      contract,
      form.values,
      new AbortController().signal
    )
    expect(body.max_tokens).toBe(800)
    expect(body.messages).toEqual([
      {
        role: 'user',
        content: JSON.stringify({
          task: `Suggest compatible visual details in at most ${brief.maxAddition} characters.`,
          mode: 'video',
          scene: brief.original,
          existingDirections: brief.directions
        })
      }
    ])
    expect(JSON.stringify(body)).not.toContain('Reply with the single word')
    expect(body).not.toHaveProperty('stream')
  })
  it('does not invent a published Haiku descriptor when only the native contract exists', () => {
    expect(
      workshopModels.find((model) => model.routerId === ENHANCEMENT_ROUTER_ID)
    ).toBeUndefined()
    expect(isEnhancementModel(undefined)).toBe(false)
  })
  it('preserves original wording and whitespace verbatim, appending text blocks only', () => {
    const result = enhancementResult(
      [
        document({
          content: [
            { type: 'thinking', thinking: 'not output' },
            { type: 'text', text: 'First detail.' },
            { type: 'text', text: 'Second detail.' }
          ]
        })
      ],
      brief
    )
    expect(result.proposedPrompt).toBe(
      brief.original + '\n\nFirst detail.\nSecond detail.'
    )
    expect(result.inputTokens).toBe(100)
    expect(result.outputTokens).toBe(20)
  })
  it.for(['max_tokens', 'refusal', 'tool_use', null])(
    'rejects incomplete or refused stop reason %s',
    (stop_reason) => {
      expect(() =>
        enhancementResult([document({ stop_reason })], brief)
      ).toThrow()
    }
  )
  it('rejects malformed, truncated, empty and excessive output', () => {
    expect(() => enhancementResult([document({}, true)], brief)).toThrow(
      'incomplete'
    )
    expect(() => enhancementResult([document({ content: [] })], brief)).toThrow(
      'response'
    )
    expect(() =>
      enhancementResult(
        [document({ content: [{ type: 'refusal', text: 'No' }] })],
        brief
      )
    ).toThrow('refused')
    expect(() =>
      enhancementResult(
        [document({ content: [{ type: 'text', text: 'x'.repeat(2401) }] })],
        brief
      )
    ).toThrow('length')
    expect(() =>
      enhancementResult([{ ...document(), text: 'not JSON' }], brief)
    ).toThrow('response')
  })
  it('blocks applying a suggestion from another scene and rejects overlong inputs', () => {
    expect(() => applyEnhancement(brief, 'Changed scene', 'A detail.')).toThrow(
      'changed'
    )
    expect(() =>
      enhancementBrief({
        scene: 'x'.repeat(6001),
        directions: '',
        mode: 'image'
      })
    ).toThrow('input')
    expect(() =>
      enhancementBrief({
        scene: 'x'.repeat(700),
        directions: 'x'.repeat(40),
        mode: 'video',
        promptLimit: 800
      })
    ).toThrow('room')
    const small = enhancementBrief({
      scene: 'x'.repeat(600),
      directions: '',
      mode: 'video',
      promptLimit: 800
    })
    expect(small.maxAddition).toBe(196)
    expect(
      applyEnhancement(small, small.original, 'x'.repeat(196)).length
    ).toBe(798)
  })
})
