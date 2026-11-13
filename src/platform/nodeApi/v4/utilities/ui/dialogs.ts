import ExtensionSlot from '@/components/common/ExtensionSlot.vue'
import type { DialogHandle } from '@/platform/nodeApi/v4/types'
import {
  isCallback,
  isName,
  isText,
  packObject
} from '@/platform/nodeApi/v4/utilities/packArguments'
import { useDialogStore } from '@/stores/dialogStore'

import { mountedContent } from './mountedContent'

export function showDialog(definition: unknown): DialogHandle {
  const member = 'ui.showDialog'
  const fields = packObject(member, 'a dialog', definition)
  const key = fields.required('key', isName, 'a non-empty string')
  const title = fields.optional('title', isText, 'a string')
  const content = mountedContent(
    member,
    fields.required('render', isCallback, 'a function'),
    fields.optional('destroy', isCallback, 'a function')
  )
  const store = useDialogStore()
  const dialog = store.showExtensionDialog({
    key,
    title,
    component: ExtensionSlot,
    props: { extension: { id: key, type: 'custom', ...content } }
  })
  return Object.freeze({
    close() {
      if (dialog && store.dialogStack.includes(dialog)) {
        store.closeDialog({ key: dialog.key })
      }
    }
  })
}
