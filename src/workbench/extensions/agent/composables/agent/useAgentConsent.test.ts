import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDialogStore } from '@/stores/dialogStore'

import { useAgentConsent } from './useAgentConsent'

function setSearch(search: string): void {
  window.history.replaceState({}, '', `${window.location.pathname}${search}`)
}

describe('useAgentConsent', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    setSearch('')
    useAgentConsent().accepted.value = false
  })

  it('asks before letting the caller through the first time', () => {
    const dialogStore = useDialogStore()
    const showDialog = vi.spyOn(dialogStore, 'showDialog')
    const onAccept = vi.fn()

    useAgentConsent().withConsent(onAccept)

    expect(onAccept).not.toHaveBeenCalled()
    expect(showDialog).toHaveBeenCalledOnce()
  })

  it('runs the caller and remembers the answer once accepted', () => {
    const dialogStore = useDialogStore()
    const showDialog = vi.spyOn(dialogStore, 'showDialog')
    const onAccept = vi.fn()

    const consent = useAgentConsent()
    consent.withConsent(onAccept)

    const props = showDialog.mock.calls[0][0].props as {
      onAccept: () => void
    }
    props.onAccept()

    expect(onAccept).toHaveBeenCalledOnce()
    expect(consent.accepted.value).toBe(true)
  })

  it('does not ask again once consent is on record', () => {
    const dialogStore = useDialogStore()
    const showDialog = vi.spyOn(dialogStore, 'showDialog')
    const consent = useAgentConsent()
    consent.accepted.value = true

    const onAccept = vi.fn()
    consent.withConsent(onAccept)

    expect(onAccept).toHaveBeenCalledOnce()
    expect(showDialog).not.toHaveBeenCalled()
  })

  it('leaves consent unrecorded when the reader rejects', () => {
    const dialogStore = useDialogStore()
    const showDialog = vi.spyOn(dialogStore, 'showDialog')
    const onAccept = vi.fn()

    const consent = useAgentConsent()
    consent.withConsent(onAccept)

    const props = showDialog.mock.calls[0][0].props as { onReject: () => void }
    props.onReject()

    expect(onAccept).not.toHaveBeenCalled()
    expect(consent.accepted.value).toBe(false)
  })

  describe('with ?agentConsent=always', () => {
    beforeEach(() => setSearch('?agentConsent=always'))

    it('asks again even when consent is already on record', () => {
      const dialogStore = useDialogStore()
      const showDialog = vi.spyOn(dialogStore, 'showDialog')
      const consent = useAgentConsent()
      consent.accepted.value = true

      consent.withConsent(vi.fn())

      expect(showDialog).toHaveBeenCalledOnce()
    })

    it('lets the caller through without recording the answer', () => {
      const dialogStore = useDialogStore()
      const showDialog = vi.spyOn(dialogStore, 'showDialog')
      const onAccept = vi.fn()
      const consent = useAgentConsent()

      consent.withConsent(onAccept)
      const props = showDialog.mock.calls[0][0].props as {
        onAccept: () => void
      }
      props.onAccept()

      expect(onAccept).toHaveBeenCalledOnce()
      expect(consent.accepted.value).toBe(false)
    })
  })
})
