/* ------------------------------------------------------------------ *
 * agentCore — pure, host-independent kernels of the agent panel       *
 * ------------------------------------------------------------------ *
 * The agent panel writes to the user's LIVE canvas, so a handful of decisions are
 * trust-critical: which incoming value a widget actually accepts, whether a
 * mutating call really changed anything (so its undo snapshot is kept vs dropped),
 * how the snapshot stack is bounded without burying the pre-agent state, and which
 * bundled template a fuzzy query resolves to. Those decisions live here as PURE
 * functions — no host `app`, no Vue stores, no DOM — so they can be unit-tested
 * headless and consumed by the services/stores layer without a running host. */

/* ----------------------------- widget coercion ----------------------------- */

/* Coerce an incoming value to a widget's EXISTING value type so the agent can pass
   a string/number/bool interchangeably without corrupting it, then validate it
   against the widget's declared options. A value that can't be coerced is REJECTED
   (throws) rather than silently stored — otherwise the bad value only blows up
   later at submit/render, untraceable to the tool that set it. A combo's allowed
   `values` are enforced (throw on an invalid choice); a numeric min/max is CLAMPED
   (and the clamped number is returned, so the caller sees what was actually set).
   `ctx` only supplies the widget name + node id used in error messages. */
export function coerceWidgetValue(
  prev: unknown,
  value: unknown,
  opts: { values?: unknown[]; min?: number; max?: number } | null | undefined,
  ctx: { widgetName: string; nodeId: number | string }
): unknown {
  let next: unknown = value
  if (typeof prev === 'number') {
    // Number('') === 0 would slip an empty/whitespace string past the finite check as a silent 0.
    const raw = typeof value === 'number' ? value : String(value).trim()
    const n = raw === '' ? NaN : Number(raw)
    if (!Number.isFinite(n))
      throw new Error(
        `Widget "${ctx.widgetName}" on node ${ctx.nodeId} expects a number; got ${JSON.stringify(value)}`
      )
    next = n
  } else if (typeof prev === 'string') {
    next = typeof value === 'string' ? value : String(value)
  } else if (typeof prev === 'boolean') {
    if (typeof value === 'boolean') next = value
    else {
      const s = String(value).trim().toLowerCase()
      if (s === 'true' || s === '1') next = true
      else if (s === 'false' || s === '0') next = false
      else
        throw new Error(
          `Widget "${ctx.widgetName}" on node ${ctx.nodeId} expects a boolean; got ${JSON.stringify(value)}`
        )
    }
  }
  const o: { values?: unknown[]; min?: number; max?: number } = opts ?? {}
  if (Array.isArray(o.values) && !o.values.includes(next)) {
    throw new Error(
      `Widget "${ctx.widgetName}" only accepts: ${o.values.join(', ')}`
    )
  }
  if (typeof next === 'number') {
    let clamped = next
    if (typeof o.min === 'number' && clamped < o.min) clamped = o.min
    if (typeof o.max === 'number' && clamped > o.max) clamped = o.max
    next = clamped
  }
  return next
}

/* ----------------------------- snapshot stack ------------------------------ */

/* Did a mutating bridge call actually change the graph? The mutating bridge fns
   report success with a truthy field:
     addNode          -> { added, id }
     setWidgetValue   -> { id, widget, value }
     openTemplate     -> { opened }              (no-op: { opened: null, message })
     loadWorkflow     -> { opened, nodeCount }
     newWorkflow      -> { opened }
   openTemplate is the one that RETURNS a no-op (`opened: null`) instead of throwing,
   which is exactly the phantom-snapshot leak this closes (BE-1439, defect #4).
   Conservative: an unrecognized / non-object result is treated as LANDED so we never
   over-discard a snapshot that actually guards a real change (losing a valid undo is
   worse than keeping one redundant snapshot). */
export function mutationLanded(tool: string, result: unknown): boolean {
  if (!result || typeof result !== 'object') return true
  const r = result as Record<string, unknown>
  switch (tool) {
    case 'addNode':
      return !!r.added
    case 'setWidgetValue':
      return r.id != null
    case 'openTemplate':
    case 'loadWorkflow':
    case 'newWorkflow':
      return !!r.opened
    // applyGraphMutation (BE-1784): only the ACTIVE-tab path is a destructive in-place
    // write that needs the snapshot/revert guard. A NEW-tab mutation is additive (a
    // fresh tab, existing tabs untouched), so discard its snapshot. `landed` (not
    // loaded/ops) is the keep signal: a destructive load or op that altered the graph
    // and then threw still set it, so the snapshot survives to revert the damage.
    case 'applyGraphMutation':
      return r.target === 'active' && !!r.landed
    default:
      return true
  }
}

/* Bound the snapshot stack to `cap` entries by evicting the SECOND-oldest (index 1),
   never index 0: the very first snapshot is the true pre-agent state, so "undo
   everything the agent did" must always remain reachable even if a noisy/compromised
   agent emits >cap mutations to try to bury it. The origin snapshot is pinned;
   everything after it rolls (BE-1439). Mutates `stack` in place (it IS the live
   stack); a no-op until the cap is exceeded. */
export function enforceSnapshotCap<T>(stack: T[], cap: number): void {
  if (stack.length > cap) stack.splice(1, 1)
}

/* Remove a SPECIFIC snapshot by id — used to undo a speculative capture when the
   mutation it guarded failed or no-op'd, so a later revert can't "undo" a change
   that never landed (and so failing/no-op calls can't pad the stack and evict real
   snapshots at the cap). We remove by id rather than popping the top because the
   message handler is async + re-entrant: under concurrent tool dispatch the snapshot
   to drop is not necessarily on top (a later call may have pushed after us). A null
   id (capture was skipped) and an already-evicted id are both safe no-ops. Returns
   whether a snapshot was actually removed, so the caller can fire its UI refresh only
   on a real change (BE-1439, defect #2). */
export function removeSnapshotById<T extends { id: number }>(
  stack: T[],
  id: number | null
): boolean {
  if (id == null) return false
  const i = stack.findIndex((s) => s.id === id)
  if (i === -1) return false
  stack.splice(i, 1)
  return true
}

/* Is any mutating bridge call GENUINELY still live? A call started within `ttlMs` of
   `now` blocks revert (so a late-resolving mutation can't re-apply on top of a
   just-reverted graph). A call that blew past the TTL is treated as hung, NOT live,
   so it can't permanently brick revert for the rest of the session — it still
   unregisters cleanly when/if it eventually settles (BE-1439, defect #1). `inFlight`
   yields each registered call's start time (ms). */
export function isMutationLive(
  inFlight: Iterable<number>,
  now: number,
  ttlMs: number
): boolean {
  const cutoff = now - ttlMs
  for (const startedAt of inFlight) if (startedAt > cutoff) return true
  return false
}

/* ----------------------------- template match ------------------------------ */

export type TemplateRef = { id: string; module: string; title: string }

/* Normalize a template title/id/query to a lowercase, separator-flattened form so a
   fuzzy match ignores case and `_`/`-` styling differences. */
export function normalizeTemplateText(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
}

/* Pick the bundled template that best matches a free-text query (e.g. "open a flux
   template"). Stop-words are stripped from the query; each template scores +1 per
   query word found in its normalized "title id" haystack, +3 when the whole query
   appears contiguously (so an exact phrase wins over scattered word hits). Returns:
   - the FIRST template when the query is empty/all stop-words (generic "open a
     template" → a starter), or
   - the best-scoring template, or
   - null when nothing scored (no word matched) → the caller surfaces a no-match
     message rather than silently opening an unrelated template.
   `all` is assumed non-empty (the caller throws "no templates available" first). */
export function matchTemplate(
  all: TemplateRef[],
  query: string | undefined
): TemplateRef | null {
  const q = normalizeTemplateText(query || '')
    .replace(/\b(open|load|the|a|an|template|workflow|please)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!q) return all.length ? all[0] : null
  const words = q.split(' ').filter(Boolean)
  let best = 0
  let pick: TemplateRef | null = null
  for (const t of all) {
    const hay = normalizeTemplateText(`${t.title} ${t.id}`)
    let score = words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0)
    if (hay.includes(q)) score += 3 // contiguous match wins
    if (score > best) {
      best = score
      pick = t
    }
  }
  return best === 0 ? null : pick
}
