import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDialogStore } from '@/stores/dialogStore'

import TypeformDialogContent from './TypeformDialogContent.vue'
import { openTypeformDialog } from './openTypeformDialog'

describe('openTypeformDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('opens the form embed in a Reka dialog with the given id and hidden fields', () => {
    const showDialog = vi.spyOn(useDialogStore(), 'showDialog')

    openTypeformDialog({
      typeformId: 'abc123',
      title: 'A Form',
      hiddenFields: 'foo=bar'
    })

    expect(showDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'typeform-abc123',
        title: 'A Form',
        component: TypeformDialogContent,
        props: { typeformId: 'abc123', hiddenFields: 'foo=bar' },
        dialogComponentProps: expect.objectContaining({ renderer: 'reka' })
      })
    )
  })

  it('honors an explicit dialog key', () => {
    const showDialog = vi.spyOn(useDialogStore(), 'showDialog')

    openTypeformDialog({ typeformId: 'abc123', title: 'A Form', key: 'custom' })

    expect(showDialog).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'custom' })
    )
  })
})
