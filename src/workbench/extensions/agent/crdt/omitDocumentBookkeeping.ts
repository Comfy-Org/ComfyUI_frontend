import {
  NODE_INCARNATION_KEY,
  OPAQUE_WIDGETS_KEY,
  WIDGET_FORM_KEY
} from '@comfyorg/comfy-multi-player'
import { omit } from 'es-toolkit/compat'

export function omitDocumentBookkeeping<T extends object>(record: T) {
  return omit(record, NODE_INCARNATION_KEY, OPAQUE_WIDGETS_KEY, WIDGET_FORM_KEY)
}
