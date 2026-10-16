import { z } from 'astro/zod'
import type { GetCccStagingData } from '@comfyorg/ingest-types'
import {
  zGetCccStagingQuery,
  zGetCccStagingResponse,
  zGetCccFinalReviewResponse
} from '@comfyorg/ingest-types/zod'
import type { Document } from './editor-document'
import { jsonObject } from './editor-document'
import { accountID } from './account-id'
import { changeID } from './change-id'

export const editorialStates = [
  'NEW',
  'APPROVED',
  'DEFERRED',
  'DELETED'
] as const
const decisions = ['NEW', 'APPROVED', 'DEFERRED'] as const
export type Decision = (typeof decisions)[number]
export const reviewTypes = [
  'model',
  'workflow',
  'app',
  'media',
  'template_set'
] as const
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const state = z.object({
  live_rev: integer.positive(),
  draft_rev: integer.positive(),
  draft_generation: integer,
  next_rev: integer.positive(),
  previous_live_rev: integer.positive().nullable()
})
const resource = z.object({
  uid: z.uuid(),
  revision_uid: z.uuid(),
  type: z.enum(reviewTypes),
  author_uid: accountID,
  document: jsonObject,
  is_deleted: z.boolean()
})
const item = z.object({
  content: resource,
  before: resource.optional(),
  status: z.enum(editorialStates),
  decision: z.enum(decisions),
  summary: z.string().max(2000),
  presentation: z
    .object({
      media_name: z.string().max(1000).optional(),
      uses: z
        .array(
          z.object({
            uid: z.uuid(),
            type: z.enum(reviewTypes).exclude(['media']),
            title: z.string().max(1000),
            slug: z.string().max(1000).optional(),
            origin: z.boolean(),
            is_deleted: z.boolean().optional()
          })
        )
        .max(5000)
        .optional(),
      preview: z
        .object({
          kind: z.enum(['image', 'video']),
          src: z
            .string()
            .refine(
              (value) =>
                value.trim() === value &&
                /^\/preview-media\/[1-9]\d*\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/.test(
                  value
                )
            )
        })
        .optional()
    })
    .optional()
})
export type ReviewFilter = NonNullable<GetCccStagingData['query']> & {
  change_id?: string
}
export function reviewFilterWith(query: {
  strict(): {
    safeParse(
      value: unknown
    ): { success: true; data: { author_uid?: string } } | { success: false }
  }
}) {
  return z.custom<ReviewFilter>((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return false
    if (!changeID.safeParse(Reflect.get(value, 'change_id')).success)
      return false
    const base = Object.fromEntries(
      Object.entries(value).filter(([key]) => key !== 'change_id')
    )
    const parsed = query.strict().safeParse(base)
    return (
      parsed.success &&
      accountID.optional().safeParse(parsed.data.author_uid).success
    )
  })
}
export const reviewFilter = reviewFilterWith(zGetCccStagingQuery)
const digest = z.string().regex(/^[a-f0-9]{64}$/)
// View models are narrowed from the deployed, generated open-JSON contract.
// Preserve authored literal keys rather than using the record parser's output.
const review = z.object({
  state,
  items: z.array(item).max(5000),
  filter: reviewFilter,
  unresolved_count: integer,
  selection_digest: digest
})
const finalReview = z.object({
  state,
  changes: z.array(item).max(5000),
  deferred: z.array(item).max(5000),
  selection_digest: digest,
  publish_enabled: z.boolean().optional().default(false)
})
export type FinalReview = z.infer<typeof finalReview>
export const publishBody = z
  .object({
    review: z
      .object({
        expected_live_rev: integer.positive(),
        expected_draft_rev: integer.positive(),
        expected_draft_generation: integer
      })
      .strict(),
    expected_selection_digest: digest
  })
  .strict()
const checkedUIDs = z
  .array(z.uuid())
  .min(1)
  .max(5000)
  .refine((values) => new Set(values).size === values.length)
export const checkedReviewBody = publishBody
  .omit({ expected_selection_digest: true })
  .extend({ selected_uids: checkedUIDs })
  .strict()
export const checkedPublishBody = publishBody
  .extend({ selected_uids: checkedUIDs })
  .strict()
export function checkedReviewPayload(snapshot: StagingReview, uids: string[]) {
  return {
    review: {
      expected_live_rev: snapshot.state.live_rev,
      expected_draft_rev: snapshot.state.draft_rev,
      expected_draft_generation: snapshot.state.draft_generation
    },
    selected_uids: uids
  }
}
export function publicationPayload(
  snapshot: FinalReview,
  selectedUIDs?: string[]
) {
  return {
    review: {
      expected_live_rev: snapshot.state.live_rev,
      expected_draft_rev: snapshot.state.draft_rev,
      expected_draft_generation: snapshot.state.draft_generation
    },
    expected_selection_digest: snapshot.selection_digest,
    ...(selectedUIDs ? { selected_uids: selectedUIDs } : {})
  }
}
export function publicationState(raw: unknown) {
  const parsed = state.safeParse(raw)
  return parsed.success ? parsed.data : undefined
}
export type StagingReview = z.infer<typeof review>
export type ReviewItem = z.infer<typeof item>
export function stagingSnapshot(raw: unknown) {
  if (!zGetCccStagingResponse.safeParse(raw).success) return undefined
  const parsed = review.safeParse(raw)
  return parsed.success ? parsed.data : undefined
}
export function finalSnapshot(raw: unknown) {
  if (!zGetCccFinalReviewResponse.safeParse(raw).success) return undefined
  const parsed = finalReview.safeParse(raw)
  return parsed.success ? parsed.data : undefined
}

export function filterFromQuery(query: URLSearchParams) {
  const permitted = new Set([
    'search',
    'author_uid',
    'change_id',
    'tags',
    'types',
    'statuses'
  ])
  if ([...query.keys()].some((key) => !permitted.has(key))) return undefined
  if (
    ['search', 'author_uid', 'change_id'].some(
      (key) => query.getAll(key).length > 1
    )
  )
    return undefined
  const raw = Object.fromEntries(
    [...permitted].flatMap((key) => {
      const values = query.getAll(key)
      return values.length
        ? [
            [
              key,
              ['search', 'author_uid', 'change_id'].includes(key)
                ? values[0]
                : values
            ]
          ]
        : []
    })
  )
  const result = reviewFilter.safeParse(raw)
  return result.success ? result.data : undefined
}
export function filterQuery(filter: ReviewFilter) {
  const query = new URLSearchParams()
  for (const key of ['search', 'author_uid', 'change_id'] as const) {
    const value = filter[key]
    if (value !== undefined) query.set(key, value)
  }
  for (const key of ['tags', 'types', 'statuses'] as const) {
    for (const entry of filter[key] ?? []) query.append(key, entry)
  }
  return query
}
export function unfiltered(filter: ReviewFilter) {
  return (
    !filter.search?.trim() &&
    !filter.author_uid &&
    !filter.change_id &&
    !filter.tags?.length &&
    !filter.types?.length &&
    !filter.statuses?.length
  )
}
export function stagePayload(
  snapshot: StagingReview,
  status: Decision,
  confirmAll: boolean,
  selectedUIDs?: string[]
) {
  return {
    review: {
      expected_live_rev: snapshot.state.live_rev,
      expected_draft_rev: snapshot.state.draft_rev,
      expected_draft_generation: snapshot.state.draft_generation
    },
    filter: snapshot.filter,
    expected_count: snapshot.items.length,
    expected_selection_digest: snapshot.selection_digest,
    confirm_all: confirmAll,
    status,
    ...(selectedUIDs ? { selected_uids: selectedUIDs } : {})
  }
}
export const stageBody = z
  .object({
    review: z
      .object({
        expected_live_rev: integer.positive(),
        expected_draft_rev: integer.positive(),
        expected_draft_generation: integer
      })
      .strict(),
    filter: reviewFilter,
    expected_count: integer.max(5000),
    expected_selection_digest: digest,
    confirm_all: z.boolean(),
    status: z.enum(decisions),
    selected_uids: z
      .array(z.uuid())
      .min(1)
      .max(5000)
      .refine((values) => new Set(values).size === values.length)
      .optional()
  })
  .strict()

export const discardBody = stageBody
  .omit({ status: true, confirm_all: true, selected_uids: true })
  .extend({
    expected_count: integer.positive().max(5000),
    confirm_discard: z.literal(true),
    targets: z
      .array(
        z
          .object({
            uid: z.uuid(),
            expected_revision_uid: z.uuid()
          })
          .strict()
      )
      .min(1)
      .max(100)
      .refine(
        (values) => new Set(values.map((v) => v.uid)).size === values.length
      )
  })
  .strict()

export function discardPayload(snapshot: StagingReview, uids: string[]) {
  const selected = new Set(uids)
  const { review, filter, expected_count, expected_selection_digest } =
    stagePayload(snapshot, 'NEW', false)
  return {
    review,
    filter,
    expected_count,
    expected_selection_digest,
    confirm_discard: true,
    targets: snapshot.items
      .filter((item) => selected.has(item.content.uid))
      .map((item) => ({
        uid: item.content.uid,
        expected_revision_uid: item.content.revision_uid
      }))
  }
}

export function itemTitle(entry: ReviewItem) {
  const { title, name } = entry.content.document
  return typeof title === 'string' && title
    ? title
    : typeof name === 'string' && name
      ? name
      : entry.content.uid
}

export interface FieldDifference {
  path: string
  before?: string
  after?: string
}
// Staff display only: arrays are compared at indexed paths, including removals.
// Bound output so a large workflow or deeply nested input does not freeze UI.
export function fieldDifferences(entry: ReviewItem): FieldDifference[] {
  const differences: FieldDifference[] = []
  function visit(
    before: Document[string] | undefined,
    after: Document[string] | undefined,
    path: string,
    depth: number
  ) {
    if (differences.length >= 100) return
    if (JSON.stringify(before) === JSON.stringify(after)) return
    if (
      depth < 12 &&
      before !== null &&
      after !== null &&
      typeof before === 'object' &&
      typeof after === 'object'
    ) {
      if (Array.isArray(before) && Array.isArray(after)) {
        for (let i = 0; i < Math.max(before.length, after.length); i++)
          visit(before[i], after[i], `${path}[${i}]`, depth + 1)
        return
      }
      if (!Array.isArray(before) && !Array.isArray(after)) {
        for (const key of new Set([
          ...Object.keys(before),
          ...Object.keys(after)
        ])) {
          const child = /^[A-Za-z_$][\w$]*$/.test(key)
            ? `${path}.${key}`
            : `${path}[${JSON.stringify(key)}]`
          visit(
            Object.hasOwn(before, key) ? before[key] : undefined,
            Object.hasOwn(after, key) ? after[key] : undefined,
            child,
            depth + 1
          )
        }
        return
      }
    }
    differences.push({
      path,
      before:
        before === undefined
          ? undefined
          : JSON.stringify(before).slice(0, 1500),
      after:
        after === undefined ? undefined : JSON.stringify(after).slice(0, 1500)
    })
  }
  visit(
    entry.before?.document ?? {},
    entry.content.is_deleted ? {} : entry.content.document,
    '$',
    0
  )
  return differences
}
