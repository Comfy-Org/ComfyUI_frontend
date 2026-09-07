import { useDialogStore } from '@/stores/dialogStore'

import TypeformDialogContent from './TypeformDialogContent.vue'

export interface TypeformDialogOptions {
  typeformId: string
  title: string
  /** Comma-separated `key=value` tags passed to Typeform via `data-tf-hidden`. */
  hiddenFields?: string
  key?: string
}

export function openTypeformDialog({
  typeformId,
  title,
  hiddenFields,
  key
}: TypeformDialogOptions) {
  useDialogStore().showDialog({
    key: key ?? `typeform-${typeformId}`,
    title,
    component: TypeformDialogContent,
    props: { typeformId, hiddenFields },
    dialogComponentProps: {
      renderer: 'reka',
      size: 'lg'
    }
  })
}
