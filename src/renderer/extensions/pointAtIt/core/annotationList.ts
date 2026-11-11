import type { AnnotationTarget } from './targetAddress'

/** One pinned comment. Its number is its place in the list. */
export interface Annotation {
  id: string
  targets: AnnotationTarget[]
  label: string
  comment: string
}

export type AnnotationEvent =
  | {
      type: 'saved'
      id: string
      targets: AnnotationTarget[]
      label: string
      comment: string
    }
  | { type: 'removed'; id: string }
  | { type: 'cleared' }

function save(
  list: readonly Annotation[],
  event: Extract<AnnotationEvent, { type: 'saved' }>
): readonly Annotation[] {
  const comment = event.comment.trim()
  if (!comment) return list
  const saved = {
    id: event.id,
    targets: event.targets,
    label: event.label,
    comment
  }
  return list.some((annotation) => annotation.id === event.id)
    ? list.map((annotation) =>
        annotation.id === event.id ? saved : annotation
      )
    : [...list, saved]
}

/** Pure transition for the list of pinned comments. */
export function reduceAnnotations(
  list: readonly Annotation[],
  event: AnnotationEvent
): readonly Annotation[] {
  if (event.type === 'saved') return save(list, event)
  if (event.type === 'cleared') return list.length === 0 ? list : []
  return list.some((annotation) => annotation.id === event.id)
    ? list.filter((annotation) => annotation.id !== event.id)
    : list
}
