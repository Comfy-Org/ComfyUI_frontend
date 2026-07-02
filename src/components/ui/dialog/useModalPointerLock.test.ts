import { render } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import {
  SelectContent,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectViewport
} from 'reka-ui'
import { defineComponent, h, nextTick, ref } from 'vue'

import Dialog from './Dialog.vue'
import DialogContent from './DialogContent.vue'
import DialogPortal from './DialogPortal.vue'

async function flush() {
  await nextTick()
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

function mountDialogWithSelect(modal: boolean) {
  const dialogOpen = ref(true)
  const selectOpen = ref(false)

  const Parent = defineComponent({
    setup() {
      return () =>
        h(
          Dialog,
          {
            modal,
            open: dialogOpen.value,
            'onUpdate:open': (value: boolean) => (dialogOpen.value = value)
          },
          () =>
            h(DialogPortal, null, () =>
              h(DialogContent, null, () =>
                h(
                  SelectRoot,
                  {
                    open: selectOpen.value,
                    'onUpdate:open': (value: boolean) =>
                      (selectOpen.value = value)
                  },
                  () => [
                    h(SelectTrigger, null, () => 'trigger'),
                    h(SelectPortal, null, () =>
                      h(SelectContent, { position: 'popper' }, () =>
                        h(SelectViewport, null, () => 'items')
                      )
                    )
                  ]
                )
              )
            )
        )
    }
  })

  return { ...render(Parent), dialogOpen, selectOpen }
}

describe('modal dialog pointer lock', () => {
  it('keeps body inert after a nested combobox popover opens and closes', async () => {
    const { selectOpen } = mountDialogWithSelect(true)
    await flush()
    expect(document.body.style.pointerEvents).toBe('none')

    selectOpen.value = true
    await flush()
    expect(document.body.style.pointerEvents).toBe('none')

    // Reka restores body pointer events when the popover layer unmounts; the
    // lock must re-assert it so the canvas behind the dialog stays inert.
    selectOpen.value = false
    await flush()
    expect(document.body.style.pointerEvents).toBe('none')
  })

  it('restores body pointer events once the dialog closes', async () => {
    const { dialogOpen } = mountDialogWithSelect(true)
    await flush()
    expect(document.body.style.pointerEvents).toBe('none')

    dialogOpen.value = false
    await flush()
    expect(document.body.style.pointerEvents).toBe('')
  })

  it('does not lock body for a non-modal dialog', async () => {
    mountDialogWithSelect(false)
    await flush()
    expect(document.body.style.pointerEvents).toBe('')
  })

  it('holds the body lock until every open modal dialog closes', async () => {
    const first = mountDialogWithSelect(true)
    const second = mountDialogWithSelect(true)
    await flush()
    expect(document.body.style.pointerEvents).toBe('none')

    // With one modal still open the shared lock must keep the body inert.
    first.dialogOpen.value = false
    await flush()
    expect(document.body.style.pointerEvents).toBe('none')

    // Once the last modal closes the lock releases and stops forcing inert.
    second.dialogOpen.value = false
    await flush()
    expect(document.body.style.pointerEvents).not.toBe('none')
  })
})
