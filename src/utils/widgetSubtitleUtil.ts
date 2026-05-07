/**
 * Derives the short, right-aligned subtitle shown next to each input
 * widget in the App Mode floating panel ("text", "number", "size",
 * "seed", "list", "toggle"…).
 *
 * Two layers, in priority order:
 *
 *   1. Type label (metadata-driven, authoritative).
 *      Reads `spec.type` (the input spec returned by the backend
 *      node definition). Falls back to `widget.type` (the render
 *      type) when no spec is attached — happens during the
 *      pre-mount window and for legacy custom widgets that bypass
 *      input specs. Maps via TYPE_LABELS to a short word.
 *
 *   2. Name pattern overrides (UI affordance, optional).
 *      A widget name that matches an entry in NAME_PATTERNS gets
 *      that label *instead of* the type label. This layer exists
 *      because ComfyUI's input spec has no field for semantic
 *      concepts ("size", "seed") — those would otherwise all read
 *      as "number" and lose visual differentiation in the panel.
 *
 * The function is a pure UI affordance — never branch product logic
 * on its return value. If you need to know what kind of widget
 * something is, read `spec.type` directly.
 */
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

type WidgetSubtitleInput = Partial<
  Pick<SimplifiedWidget, 'name' | 'type' | 'spec'>
>

/**
 * Short, user-facing word for each canonical input-spec type.
 * Keys are uppercase-normalized so we can compare against either
 * `spec.type` (`'INT'`, `'STRING'`, …) or the render type
 * (`'number'`, `'text'`, …) without two tables.
 */
const TYPE_LABELS: Readonly<Record<string, string>> = {
  // Backend types (zod-validated input spec).
  STRING: 'text',
  INT: 'number',
  FLOAT: 'number',
  BOOLEAN: 'toggle',
  COMBO: 'list',
  TEXTAREA: 'text',
  MARKDOWN: 'text',
  COLOR: 'color',
  IMAGE: 'image',
  // Render types (the simplified widget's `type` field — usually
  // mirrors the backend type but lossier).
  NUMBER: 'number',
  TEXT: 'text',
  CUSTOMTEXT: 'text',
  TOGGLE: 'toggle',
  SLIDER: 'number',
  KNOB: 'number'
}

/**
 * Optional name-pattern overrides applied on top of the type label.
 *
 * **Bar for adding a row:** the concept must be both (a) widely
 * recognized in image-generation UIs and (b) impossible to read from
 * type metadata alone. The list is intentionally tiny — every
 * addition couples panel display to widget naming conventions, so
 * resist patterns that overlap or that exist only on a single node.
 *
 * Order matters: first match wins.
 */
const NAME_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  // Dimensional inputs (width, height, *_size, dimensions). Almost
  // always paired in the panel; "number / number" reads as a single
  // anonymous concept where "size / size" surfaces the relationship.
  [/(?:^|_)(?:width|height|size|dimensions?)(?:$|_)/i, 'size'],
  // Seed has its own semantic role (reproducibility) distinct from a
  // generic int input.
  [/(?:^|_)seed(?:$|_)/i, 'seed']
]

export function widgetSubtitle(widget: WidgetSubtitleInput): string {
  // Prefer the backend-authoritative spec type. Render type is the
  // fallback for the brief pre-mount window and legacy widgets.
  const rawType = widget.spec?.type ?? widget.type ?? ''
  const typeKey = String(rawType).toUpperCase()
  const typeLabel = TYPE_LABELS[typeKey] ?? typeKey.toLowerCase()

  const name = widget.name ?? ''
  for (const [pattern, label] of NAME_PATTERNS) {
    if (pattern.test(name)) return label
  }

  return typeLabel
}
