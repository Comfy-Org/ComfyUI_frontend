import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/vue'
import { defineComponent, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { reportError } from '@/platform/telemetry/reportError'

import {
  listSkillPacks,
  publishSkillPack,
  SkillPacksApiError
} from '../api/skillsApi'
import { useSkillPacksStore } from '../stores/skillPacksStore'
import type { SkillPack } from '../types'
import { useSkillPackForm } from './useSkillPackForm'

vi.mock(import('../api/skillsApi'), { spy: true })

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    en: {
      g: { unknownError: 'unknown-error' },
      skillPacks: {
        errors: {
          nameRequired: 'name-required',
          nameTooLong: 'name-too-long',
          nameCharset: 'name-charset',
          nameReserved: 'name-reserved',
          nameAlreadyExists: 'name-already-exists',
          descriptionRequired: 'description-required',
          descriptionSingleLine: 'description-single-line',
          descriptionTooLong: 'description-too-long',
          bodyRequired: 'body-required'
        }
      }
    }
  }
})

function makePack(overrides: Partial<SkillPack> = {}): SkillPack {
  return {
    id: 'pack-1',
    name: 'my-pack',
    description: 'load me when upscaling',
    body: 'always upscale with 4x-UltraSharp',
    body_hash: 'abc',
    created_at: '2026-08-22T00:00:00Z',
    updated_at: '2026-08-22T00:00:00Z',
    ...overrides
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/**
 * `useSkillPackForm` reads i18n and the store, so it has to run inside a
 * component. The harness exposes the composable's return value directly.
 */
function mountForm(pack?: SkillPack) {
  const visible = ref(true)
  const onSaved = vi.fn()
  let api!: ReturnType<typeof useSkillPackForm>
  render(
    defineComponent({
      setup() {
        api = useSkillPackForm({ pack: () => pack, visible, onSaved })
        return () => null
      }
    }),
    { global: { plugins: [i18n] } }
  )
  return { ...api, onSaved, visible }
}

describe('useSkillPackForm', () => {
  it('seeds the editor from the pack it was given, with no second fetch', () => {
    const pack = makePack()
    const { form } = mountForm(pack)

    expect(form.name).toBe(pack.name)
    expect(form.description).toBe(pack.description)
    expect(form.body).toBe(pack.body)
    expect(listSkillPacks).not.toHaveBeenCalled()
  })

  it.for([
    ['..', 'name-charset'],
    ['bad name', 'name-charset'],
    ['a'.repeat(65), 'name-too-long'],
    ['building', 'name-reserved']
  ])('rejects the name %s before sending a request', async ([name, error]) => {
    const { form, errors, handleSubmit } = mountForm()
    form.name = name
    form.description = 'load me'
    form.body = 'do the thing'

    await handleSubmit()

    expect(errors.name).toBe(error)
    expect(publishSkillPack).not.toHaveBeenCalled()
  })

  it('rejects a multi-line trigger description before sending a request', async () => {
    const { form, errors, handleSubmit } = mountForm()
    form.name = 'my-pack'
    form.description = 'line one\nline two'
    form.body = 'do the thing'

    await handleSubmit()

    expect(errors.description).toBe('description-single-line')
    expect(publishSkillPack).not.toHaveBeenCalled()
  })

  it('rejects Unicode line separators in the trigger description', async () => {
    const { form, errors, handleSubmit } = mountForm()
    form.name = 'my-pack'
    form.description = 'line one\u2028line two'
    form.body = 'do the thing'

    await handleSubmit()

    expect(errors.description).toBe('description-single-line')
    expect(publishSkillPack).not.toHaveBeenCalled()
  })

  it('does not silently replace an existing pack from create mode', async () => {
    const store = useSkillPacksStore()
    store.packs = [makePack()]
    const { form, errors, handleSubmit } = mountForm()
    form.name = 'my-pack'
    form.description = 'replacement trigger'
    form.body = 'replacement body'

    await handleSubmit()

    expect(errors.name).toBe('name-already-exists')
    expect(publishSkillPack).not.toHaveBeenCalled()
  })

  it('counts the description in code points, not UTF-16 units', async () => {
    const saved = makePack({ description: '😀'.repeat(700) })
    vi.mocked(publishSkillPack).mockResolvedValue(saved)
    const { form, errors, fieldError, onSaved, handleSubmit } = mountForm()
    form.name = 'my-pack'
    // 700 astral code points is 1400 UTF-16 units but under the 1024 cap.
    form.description = '😀'.repeat(700)
    form.body = 'do the thing'

    await handleSubmit()

    expect(errors.description).toBe('')
    expect(publishSkillPack).toHaveBeenCalledOnce()
    expect(fieldError.value).toBeNull()
    expect(onSaved).toHaveBeenCalledOnce()
    expect(useSkillPacksStore().packs).toEqual([saved])
  })

  it('lets the server enforce deployment-configured pack budgets', async () => {
    const store = useSkillPacksStore()
    store.packs = Array.from({ length: 5 }, (_, index) =>
      makePack({ id: `pack-${index}`, name: `pack-${index}` })
    )
    const saved = makePack({ id: 'pack-6', name: 'a-sixth-pack' })
    vi.mocked(publishSkillPack).mockResolvedValue(saved)
    const { form, budgetError, handleSubmit } = mountForm()
    form.name = 'a-sixth-pack'
    form.description = 'load me'
    form.body = 'a'.repeat(10 * 1024 + 1)

    await handleSubmit()

    expect(budgetError.value).toBeNull()
    expect(publishSkillPack).toHaveBeenCalledWith({
      name: 'a-sixth-pack',
      description: 'load me',
      body: 'a'.repeat(10 * 1024 + 1)
    })
  })

  it('surfaces a 409 as the limit state, carrying the server message verbatim', async () => {
    vi.mocked(publishSkillPack).mockRejectedValue(
      new SkillPacksApiError('total size 25601 exceeds 25600 by 1', 409)
    )
    const { form, fieldError, budgetError, handleSubmit } = mountForm()
    form.name = 'my-pack'
    form.description = 'load me'
    form.body = 'do the thing'

    await handleSubmit()

    expect(budgetError.value).toBe('total size 25601 exceeds 25600 by 1')
    expect(fieldError.value).toBeNull()
  })

  it('surfaces a 400 as an editable field error, distinct from the limit state', async () => {
    vi.mocked(publishSkillPack).mockRejectedValue(
      new SkillPacksApiError('always:true is not accepted for user packs', 400)
    )
    const { form, fieldError, budgetError, handleSubmit } = mountForm()
    form.name = 'my-pack'
    form.description = 'load me'
    form.body = 'do the thing'

    await handleSubmit()

    expect(fieldError.value).toBe('always:true is not accepted for user packs')
    expect(budgetError.value).toBeNull()
  })

  it('treats a 404 as the gate closing and hides the surface', async () => {
    vi.mocked(publishSkillPack).mockRejectedValue(
      new SkillPacksApiError('not found', 404)
    )
    const store = useSkillPacksStore()
    const { form, visible, handleSubmit } = mountForm()
    form.name = 'my-pack'
    form.description = 'load me'
    form.body = 'do the thing'

    await handleSubmit()
    await nextTick()

    expect(store.routesAvailable).toBe(false)
    expect(visible.value).toBe(false)
  })

  it('reports an unexpected publish failure and shows a fallback', async () => {
    const failure = new TypeError('network unavailable')
    vi.mocked(publishSkillPack).mockRejectedValue(failure)
    const { form, fieldError, handleSubmit } = mountForm()
    form.name = 'my-pack'
    form.description = 'load me'
    form.body = 'do the thing'

    await handleSubmit()

    expect(reportError).toHaveBeenCalledWith(failure, {
      errorType: 'error_publishing_agent_skill_pack',
      surface: 'agent'
    })
    expect(fieldError.value).toBe('unknown-error')
  })

  it('publishes the trimmed name and stores the returned pack', async () => {
    const saved = makePack({ name: 'my-pack' })
    vi.mocked(publishSkillPack).mockResolvedValue(saved)
    const store = useSkillPacksStore()
    const { form, onSaved, handleSubmit } = mountForm()
    form.name = '  my-pack  '
    form.description = 'load me'
    form.body = 'do the thing'

    await handleSubmit()

    expect(publishSkillPack).toHaveBeenCalledWith({
      name: 'my-pack',
      description: 'load me',
      body: 'do the thing'
    })
    expect(store.packs).toEqual([saved])
    expect(onSaved).toHaveBeenCalledOnce()
  })

  it('submits once when publish is repeated while pending', async () => {
    const pending = deferred<SkillPack>()
    vi.mocked(publishSkillPack).mockReturnValue(pending.promise)
    const { form, handleSubmit, onSaved } = mountForm()
    Object.assign(form, {
      name: 'my-pack',
      description: 'load me',
      body: 'do it'
    })

    const first = handleSubmit()
    const repeated = handleSubmit()
    pending.resolve(makePack())
    await Promise.all([first, repeated])

    expect(publishSkillPack).toHaveBeenCalledOnce()
    expect(onSaved).toHaveBeenCalledOnce()
  })

  it('waits for an earlier save before submitting a reopened form', async () => {
    const pending = deferred<SkillPack>()
    vi.mocked(publishSkillPack)
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(makePack({ name: 'new-pack', body: 'new draft' }))
    const { form, handleSubmit, visible } = mountForm()
    Object.assign(form, {
      name: 'my-pack',
      description: 'load me',
      body: 'do it'
    })
    const first = handleSubmit()
    visible.value = false
    visible.value = true
    Object.assign(form, {
      name: 'new-pack',
      description: 'load me',
      body: 'new draft'
    })

    await handleSubmit()
    expect(publishSkillPack).toHaveBeenCalledOnce()
    pending.resolve(makePack())
    await first
    expect(visible.value).toBe(true)
    expect(form.body).toBe('new draft')

    await handleSubmit()
    expect(publishSkillPack).toHaveBeenLastCalledWith({
      name: 'new-pack',
      description: 'load me',
      body: 'new draft'
    })
    expect(visible.value).toBe(false)
  })

  it('retains failed input and allows a successful retry', async () => {
    const saved = makePack({ body: 'keep this draft' })
    vi.mocked(publishSkillPack)
      .mockRejectedValueOnce(new SkillPacksApiError('correct the request', 400))
      .mockResolvedValueOnce(saved)
    const { form, handleSubmit, fieldError, visible } = mountForm()
    Object.assign(form, {
      name: 'my-pack',
      description: 'load me',
      body: 'keep this draft'
    })

    await handleSubmit()
    expect(form).toEqual({
      name: 'my-pack',
      description: 'load me',
      body: 'keep this draft'
    })
    expect(visible.value).toBe(true)
    expect(fieldError.value).toBe('correct the request')

    await handleSubmit()
    expect(fieldError.value).toBeNull()
    expect(visible.value).toBe(false)
    expect(useSkillPacksStore().packs).toEqual([saved])
  })

  it('preserves a reopened draft when an earlier save completes', async () => {
    const pending = deferred<SkillPack>()
    vi.mocked(publishSkillPack).mockReturnValue(pending.promise)
    const { form, handleSubmit, visible, onSaved } = mountForm()
    Object.assign(form, {
      name: 'my-pack',
      description: 'load me',
      body: 'do it'
    })
    const submit = handleSubmit()

    visible.value = false
    await nextTick()
    visible.value = true
    await nextTick()
    form.body = 'new unsaved draft'
    pending.resolve(makePack())
    await submit

    expect(visible.value).toBe(true)
    expect(form.body).toBe('new unsaved draft')
    expect(onSaved).not.toHaveBeenCalled()
    expect(useSkillPacksStore().packs).toEqual([makePack()])
  })

  it('does not attach an earlier save error to a reopened draft', async () => {
    const pending = deferred<SkillPack>()
    vi.mocked(publishSkillPack).mockReturnValue(pending.promise)
    const { form, handleSubmit, visible, fieldError, loading } = mountForm()
    Object.assign(form, {
      name: 'my-pack',
      description: 'load me',
      body: 'do it'
    })
    const submit = handleSubmit()

    visible.value = false
    await nextTick()
    visible.value = true
    await nextTick()
    form.body = 'new unsaved draft'
    pending.reject(new SkillPacksApiError('earlier request failed', 400))
    await submit

    expect(fieldError.value).toBeNull()
    expect(form.body).toBe('new unsaved draft')
    expect(loading.value).toBe(false)
  })
})
