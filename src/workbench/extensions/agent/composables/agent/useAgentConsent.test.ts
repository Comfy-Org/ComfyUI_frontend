import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDialogStore } from '@/stores/dialogStore'

import { useAgentConsent } from './useAgentConsent'

describe('useAgentConsent', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
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
})
