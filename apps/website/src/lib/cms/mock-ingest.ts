import { randomUUID } from 'node:crypto'

export interface SeedEntry {
  uid: string
  kind: 'MODEL' | 'WORKFLOW' | 'APP'
  slug: string
  enabled: boolean
  visibility: 'PUBLIC' | 'STAFF'
  data: Record<string, unknown> & {
    name: string
    slug: string
    capabilities?: string[]
  }
}

interface CatalogRecord extends SeedEntry {
  revision: number
  edit_version: string
  deleted: boolean
  visible_from?: string
}

interface PublicationEvent {
  id: string
  action: 'PUBLISH' | 'REVERT' | 'APPROVE' | 'REJECT'
  target_id: string
  previous_id?: string
  actor_uid: string
  created_at: string
}

export const MOCK_CREDENTIAL = 'local-design-review'

export type MockReply = [status: number, body?: unknown]

/**
 * An in-memory stand-in for the ingest service's site API, seeded with the
 * Hub's public records plus a few sample draft changes and submissions. The
 * local design server and the demo deployment both answer through it.
 */
export function createMockIngest(seed: SeedEntry[]) {
  const iso = (value: string | number) => new Date(value).toISOString()

  let liveRevision = 3
  let generation = 1
  const edited = (record: CatalogRecord, changes: Partial<CatalogRecord>) => ({
    ...record,
    ...changes,
    revision: liveRevision + 1,
    edit_version: randomUUID()
  })

  let live: CatalogRecord[] = seed.map((entry) => ({
    ...entry,
    revision: 1,
    edit_version: randomUUID(),
    deleted: false
  }))
  const draft: CatalogRecord[] = [
    edited(live[0], {
      data: {
        ...live[0].data,
        name: `${live[0].data.name} (Pro)`,
        capabilities: [...(live[0].data.capabilities ?? []), 'upscale']
      }
    }),
    edited(live[1], { enabled: false }),
    edited(live[2], { visible_from: iso('2026-10-20T16:00:00Z') }),
    ...live.slice(3),
    edited(live[3], {
      uid: randomUUID(),
      slug: '/hub/models/new-demo-model',
      data: { ...live[3].data, name: 'New Demo Model', slug: 'new-demo-model' }
    })
  ]

  let history: PublicationEvent[] = [
    {
      id: '3',
      action: 'PUBLISH',
      target_id: '3',
      previous_id: '2',
      actor_uid: 'staff-alex',
      created_at: iso('2026-10-06T18:12:00Z')
    },
    {
      id: 'approval-1',
      action: 'APPROVE',
      target_id: 'shr_7Kq2',
      actor_uid: 'staff-sam',
      created_at: iso('2026-10-05T14:40:00Z')
    },
    {
      id: '2',
      action: 'PUBLISH',
      target_id: '2',
      previous_id: '1',
      actor_uid: 'staff-alex',
      created_at: iso('2026-10-02T09:03:00Z')
    }
  ]
  let submissions = [
    {
      uid: randomUUID(),
      share_id: 'shr_9Xa1',
      version_id: 'v3',
      title: 'Cinematic portrait relight',
      owner_uid: 'user_42',
      description:
        'Relights portraits with a three-point setup using Flux Kontext and an upscaler pass.',
      listed: true,
      submitted_at: iso('2026-10-07T11:20:00Z')
    },
    {
      uid: randomUUID(),
      share_id: 'shr_2Lm8',
      version_id: 'v1',
      title: 'Product shot on white',
      owner_uid: 'user_77',
      description:
        'Background removal and studio lighting for e-commerce product photos.',
      listed: false,
      submitted_at: iso('2026-10-08T08:05:00Z')
    }
  ]

  const projection = (revision: number, items: CatalogRecord[]) => ({
    revision_id: revision,
    generation,
    items
  })
  const isScheduledBy = (item: CatalogRecord, at: number) =>
    !item.visible_from || Date.parse(item.visible_from) <= at
  const visible = (items: CatalogRecord[], now: string | null = null) => {
    const at = now ? Date.parse(now) : Date.now()
    return items.filter(
      (item) => item.enabled && !item.deleted && isScheduledBy(item, at)
    )
  }
  const record = (event: Omit<PublicationEvent, 'actor_uid' | 'created_at'>) =>
    (history = [
      { ...event, actor_uid: 'local-designer', created_at: iso(Date.now()) },
      ...history
    ])

  type Reply = MockReply
  const reads: Partial<Record<string, (url: URL) => Reply>> = {
    review: () => [
      200,
      {
        draft: projection(liveRevision + 1, draft),
        live: projection(liveRevision, live),
        previous_live_id: liveRevision - 1,
        can_edit: true,
        can_apply: true,
        history
      }
    ],
    catalog: (url) => {
      const isDraft = url.searchParams.get('view') === 'DRAFT'
      return [
        200,
        projection(
          isDraft ? liveRevision + 1 : liveRevision,
          visible(isDraft ? draft : live, url.searchParams.get('now'))
        )
      ]
    },
    submissions: () => [200, submissions]
  }
  const writes: Partial<
    Record<string, (body: Record<string, unknown>) => Reply>
  > = {
    publish: () => {
      record({
        id: String(liveRevision + 1),
        action: 'PUBLISH',
        target_id: String(liveRevision + 1),
        previous_id: String(liveRevision)
      })
      live = draft
      liveRevision += 1
      generation += 1
      return [204]
    },
    revert: (body) => {
      record({
        id: randomUUID(),
        action: 'REVERT',
        target_id: String(body.live_id)
      })
      return [204]
    }
  }
  const reviewSubmission = (shareId: string, status: unknown): Reply => {
    submissions = submissions.filter(
      (submission) => submission.share_id !== shareId
    )
    record({
      id: randomUUID(),
      action: status === 'approved' ? 'APPROVE' : 'REJECT',
      target_id: shareId
    })
    return [204]
  }

  const notFound = (): Reply => [404]
  const read = (path: string, url: URL) => (reads[path] ?? notFound)(url)
  const parseBody = (raw: string) => JSON.parse(raw || '{}')
  const write = (path: string, raw: string) => {
    const body = parseBody(raw)
    const shareId = path.match(/^submissions\/([^/]+)\/review$/)?.[1]
    if (shareId) return reviewSubmission(shareId, body.status)
    return (writes[path] ?? notFound)(body)
  }
  return (
    method: string | undefined,
    url: URL,
    authorization: string | null | undefined,
    raw: string
  ): Reply => {
    if (url.pathname === '/api/v1/catalog/items')
      return [200, projection(liveRevision, visible(live))]
    if (authorization !== `Bearer ${MOCK_CREDENTIAL}`) return [401]
    const path = url.pathname.replace(/^\/admin\/api\/site\//, '')
    return method === 'POST' ? write(path, raw) : read(path, url)
  }
}
