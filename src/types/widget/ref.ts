/**
 * WidgetRef: identity + kind for referencing widgets without full data.
 *
 * @module widget/ref
 */

import type { WidgetIdentity } from './identity'
import type { WidgetKind } from './model'

export interface WidgetRef extends WidgetIdentity {
  kind: WidgetKind
}
