/**
 * Classifies widget-array mutation sites.
 *
 * `widgets.splice` accounts for the overwhelming majority of escalated sites,
 * and it means four different things. Reading the indices distinguishes them,
 * which turns a vague "figure it out" into a specific instruction — the single
 * biggest lever on how reliably the agent tier converts this cohort.
 *
 * Classification is not the same as conversion. Most of these still need a
 * human or an agent, because the replacement shapes differ (`add()` takes a
 * definition, `push` took a constructed widget). The value is precision, not
 * automation.
 */

export type WidgetMutationKind =
  /** `splice(i,1)` then `splice(i,0,w)` — forces re-read, array unchanged. */
  | 'invalidate'
  /** Same, and the line before assigns `.options` — the kjnodes shape. */
  | 'invalidate-options'
  /** `splice` moving a widget to a different index. */
  | 'move'
  /** Whole-array assignment. */
  | 'reorder'
  /** `length = n`. */
  | 'truncate'
  /** `push` / `unshift`. */
  | 'append'
  /** `splice` removing without reinserting. */
  | 'remove'
  | 'unknown'

export interface WidgetMutation {
  readonly kind: WidgetMutationKind
  readonly line: number
  readonly text: string
  /** What to do about it, specific to the kind. */
  readonly instruction: string
}

const SPLICE =
  /\.widgets\s*\.splice\s*\(\s*([^,)]+?)\s*,\s*([^,)]+?)\s*(?:,\s*(.+?))?\s*\)/
const ASSIGN = /\.widgets\s*=\s*\[/
const LENGTH = /\.widgets\s*\.length\s*=\s*([^;]+)/
const APPEND = /\.widgets\s*\.(?:push|unshift)\s*\(/
const OPTIONS_ASSIGN = /\.options\s*=[^=]/

const INSTRUCTIONS: Record<WidgetMutationKind, string> = {
  'invalidate-options': `Remove-and-reinsert at the same index, immediately after an \`options\` assignment. This is cache invalidation, not a reorder. Replace the whole sequence with \`node.widgets.get(name).setOptions(newOptions)\`, which invalidates properly and preserves accessor descriptors.`,
  invalidate: `Remove-and-reinsert at the same index — the array is unchanged, so this forces a re-read rather than reordering. Find what it was invalidating and use the API that owns it (usually \`setOptions\`); if nothing obvious, escalate to a human.`,
  move: `A widget moves to a different index. Use \`node.widgets.move(name, index)\`.`,
  reorder: `Whole-array assignment. Use \`node.widgets.reorder(names)\` — it splices in place, so the renderer keeps tracking, and throws on a partial list rather than dropping widgets.`,
  truncate: `Truncation. Assigning \`length\` skips each widget's teardown, which is why the surrounding code usually calls \`onRemove()\` by hand. Use \`node.widgets.remove(name)\` per widget — it runs teardown — and delete the manual loop.`,
  append: `Appending a constructed widget. \`node.widgets.add(def)\` takes a definition rather than a widget instance, so this needs the definition, not a mechanical swap.`,
  remove: `Removal by index. Use \`node.widgets.remove(name)\`; prefer the name over the index, which shifts.`,
  unknown: `Could not classify. Read the indices and surrounding statements before converting.`
}

/** Normalises an index expression enough to compare two splice calls. */
const normalise = (expr: string) => expr.replace(/\s+/g, '')

export function classifyWidgetMutation(
  lines: readonly (string | null)[],
  index: number
): WidgetMutation | undefined {
  const line = lines[index]
  if (line === null || line === undefined) return undefined

  const at = (kind: WidgetMutationKind): WidgetMutation => ({
    kind,
    line: index + 1,
    text: line.trim(),
    instruction: INSTRUCTIONS[kind]
  })

  if (LENGTH.test(line)) return at('truncate')
  if (ASSIGN.test(line)) return at('reorder')
  if (APPEND.test(line)) return at('append')

  const splice = SPLICE.exec(line)
  if (!splice) return undefined

  const [, start, deleteCount, inserted] = splice

  // Reinsertion in the same statement: splice(i, 1, w) at the same index.
  if (inserted && normalise(deleteCount) === '1') return at('invalidate')

  // Paired statements: splice(i,1) followed closely by splice(i,0,w).
  for (
    let ahead = index + 1;
    ahead <= index + 3 && ahead < lines.length;
    ahead++
  ) {
    const next = lines[ahead]
    if (next === null || next === undefined) continue
    const pair = SPLICE.exec(next)
    if (!pair) continue
    const sameIndex = normalise(pair[1]) === normalise(start)
    const reinserts = normalise(pair[2]) === '0' && !!pair[3]
    if (sameIndex && reinserts) {
      const previous = lines[index - 1]
      return at(
        previous && OPTIONS_ASSIGN.test(previous)
          ? 'invalidate-options'
          : 'invalidate'
      )
    }
    if (reinserts) return at('move')
  }

  if (normalise(deleteCount) !== '0') return at('remove')
  return at('unknown')
}
