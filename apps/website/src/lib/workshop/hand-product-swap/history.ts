/** A value with the steps undo and redo walk through. */
export interface History<T> {
  readonly past: readonly T[]
  readonly present: T
  readonly future: readonly T[]
}

export function historyOf<T>(present: T): History<T> {
  return { past: [], present, future: [] }
}

/** Keeps the present as a step to undo back to, before a change. */
export function checkpoint<T>(history: History<T>): History<T> {
  return {
    past: [...history.past, history.present],
    present: history.present,
    future: []
  }
}

/** Swaps the present without a new step, for the moves of one drag. */
export function replace<T>(history: History<T>, present: T): History<T> {
  return { ...history, present }
}

/** A change the visitor can undo. */
export function commit<T>(history: History<T>, present: T): History<T> {
  return replace(checkpoint(history), present)
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1)
  if (previous === undefined) return history
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future]
  }
}

export function redo<T>(history: History<T>): History<T> {
  const [next, ...rest] = history.future
  if (next === undefined) return history
  return {
    past: [...history.past, history.present],
    present: next,
    future: rest
  }
}
