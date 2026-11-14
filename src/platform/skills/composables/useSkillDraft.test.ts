import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'

import { useSkillDraftStore } from '@/platform/skills/stores/skillDraftStore'

import { useSkillDraft } from './useSkillDraft'

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/scripts/api'))

function openAddForm() {
  const form = reactive({ name: '', description: '', body: '' })
  const scope = effectScope()
  const draft = scope.run(() => useSkillDraft({ pack: undefined, form }))
  return {
    form,
    settle: (submitted = { ...form }) => draft?.settle(submitted),
    close: () => scope.stop()
  }
}

describe('useSkillDraft', () => {
  it('does not bring back a draft that a save removed after the form was closed and reopened within the save delay', async () => {
    const first = openAddForm()
    first.form.body = 'a'
    await nextTick()
    first.close()

    const second = openAddForm()
    second.settle()
    second.close()
    await vi.advanceTimersByTimeAsync(1000)

    expect(useSkillDraftStore().newSkillDraft).toBeNull()
  })

  it.for(['name', 'description', 'body'] as const)(
    'keeps newer %s when a save of older text completes',
    async (field) => {
      const submitted = {
        name: 'portrait',
        description: 'Compose a portrait',
        body: 'Saved instructions'
      }
      const first = openAddForm()
      onTestFinished(first.close)
      Object.assign(first.form, submitted)
      await nextTick()
      first.close()
      const reopened = openAddForm()
      onTestFinished(reopened.close)
      reopened.form[field] = 'newer text'
      await vi.advanceTimersByTimeAsync(1000)

      first.settle(submitted)

      expect(useSkillDraftStore().newSkillDraft).toEqual({
        ...submitted,
        [field]: 'newer text'
      })
    }
  )

  it('writes the typed text when the page is being left before the save delay has passed', async () => {
    const form = openAddForm()
    onTestFinished(form.close)
    form.form.body = 'typed just now'
    await nextTick()

    window.dispatchEvent(new Event('pagehide'))

    expect(useSkillDraftStore().newSkillDraft?.body).toBe('typed just now')
  })
})
