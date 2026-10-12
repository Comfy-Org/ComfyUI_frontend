import {
  NODE_INCARNATION_KEY,
  OPAQUE_WIDGETS_KEY,
  WIDGET_FORM_KEY
} from '@comfyorg/comfy-multi-player'
import { omit } from 'es-toolkit'

export function omitDocumentBookkeeping(record: Record<string, unknown>) {
  return omit(record, [
    NODE_INCARNATION_KEY,
    OPAQUE_WIDGETS_KEY,
    WIDGET_FORM_KEY
  ])
}
