import type { MaybeRefOrGetter } from 'vue'
import { computed, ref, toValue, watch } from 'vue'

export interface ActivityEvent {
  id: string
  date: Date
  userName: string
  eventType: string
  detail: string
  credits: number
  /** The partner node used, for 'Partner node usage' events. */
  partnerNode?: string
  /** True for credit inflows (auto-reload, top-up) vs. usage outflows. */
  credited?: boolean
}

export interface UserSummary {
  totalCredits: number
  lastActivity: Date
}

// Prototype mock: there is no usage-activity endpoint yet, so the event list is
// generated client-side and paginated in the browser.
const USERS = ['Yuta', 'Jane', 'Rob', 'Min', 'Alice', 'Priya', 'Diego']
const EVENT_TYPES = ['Cloud workflow', 'Partner node usage']
const DETAILS = ['1m 4s', '13m 4s', '59s', '1m 1s', '56s', '2m 12s', '48s']
const CREDITS = [514, 15, 512, 520, 513, 516, 88]
const PARTNER_NODES = [
  'Nano Banana Pro',
  'Kling Video',
  'Flux.1 Kontext [pro] Image',
  'OpenAI GPT Image',
  'Runway Gen-4 Image',
  'Luma Ray 2',
  'ByteDance Seedance 2.0',
  'Ideogram V4'
]

const HOUR_MS = 60 * 60 * 1000
const BASE = new Date('2026-02-25T18:30:00').getTime()

// Credit inflows (auto-reload / manual top-up) are workspace-level, not tied to a
// user — they read as '—' in the User column and carry no duration.
const INFLOWS: Omit<ActivityEvent, 'id'>[] = [
  {
    date: new Date(BASE - 20 * HOUR_MS),
    userName: '',
    eventType: 'Auto-reload',
    detail: '',
    credits: 5000,
    credited: true
  },
  {
    date: new Date(BASE - 96 * HOUR_MS),
    userName: '',
    eventType: 'Credit top-up',
    detail: '',
    credits: 20000,
    credited: true
  },
  {
    date: new Date(BASE - 190 * HOUR_MS),
    userName: '',
    eventType: 'Auto-reload',
    detail: '',
    credits: 5000,
    credited: true
  }
]

function mockActivity(): ActivityEvent[] {
  const usage = Array.from({ length: 44 }, (_, i) => {
    const eventType = EVENT_TYPES[i % EVENT_TYPES.length]
    return {
      id: `act-${i}`,
      date: new Date(BASE - i * 7 * HOUR_MS),
      userName: USERS[i % USERS.length],
      eventType,
      detail: DETAILS[i % DETAILS.length],
      credits: CREDITS[i % CREDITS.length],
      partnerNode:
        eventType === 'Partner node usage'
          ? PARTNER_NODES[i % PARTNER_NODES.length]
          : undefined
    }
  })
  const inflows = INFLOWS.map((event, i) => ({ ...event, id: `act-in-${i}` }))
  return [...usage, ...inflows]
}

export type ActivitySortField =
  | 'date'
  | 'user'
  | 'eventType'
  | 'detail'
  | 'credits'

export function useWorkspaceActivity(
  search: MaybeRefOrGetter<string>,
  pageSize: MaybeRefOrGetter<number>,
  selfName: MaybeRefOrGetter<string | null> = null
) {
  const all = mockActivity()
  const page = ref(1)
  const perPage = computed(() => Math.max(1, toValue(pageSize)))
  const sortField = ref<ActivitySortField>('date')
  const sortDirection = ref<'asc' | 'desc'>('desc')

  // Members only see their own usage. There's no per-user endpoint in this
  // prototype, so present the mock events as the member's own history.
  const base = computed<ActivityEvent[]>(() => {
    const self = toValue(selfName)
    if (!self) return all
    // Relabel usage to the member; credit inflows stay workspace-level ('—').
    return all.map((event) =>
      event.credited ? event : { ...event, userName: self }
    )
  })

  const filtered = computed(() => {
    const q = toValue(search).trim().toLowerCase()
    if (!q) return base.value
    return base.value.filter(
      (event) =>
        event.userName.toLowerCase().includes(q) ||
        event.eventType.toLowerCase().includes(q)
    )
  })

  const sorted = computed(() => {
    const dir = sortDirection.value === 'asc' ? 1 : -1
    return [...filtered.value].sort((a, b) => {
      if (sortField.value === 'credits') return dir * (a.credits - b.credits)
      if (sortField.value === 'user')
        return dir * a.userName.localeCompare(b.userName)
      if (sortField.value === 'eventType')
        return dir * a.eventType.localeCompare(b.eventType)
      if (sortField.value === 'detail')
        return dir * a.detail.localeCompare(b.detail)
      return dir * (a.date.getTime() - b.date.getTime())
    })
  })

  const total = computed(() => filtered.value.length)

  const pagedItems = computed(() => {
    const start = (page.value - 1) * perPage.value
    return sorted.value.slice(start, start + perPage.value)
  })

  function toggleSort(field: ActivitySortField) {
    if (sortField.value === field) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortField.value = field
      sortDirection.value = 'desc'
    }
  }

  watch([total, perPage], ([count]) => {
    const lastPage = Math.max(1, Math.ceil(count / perPage.value))
    if (page.value > lastPage) page.value = lastPage
  })

  // Per-user rollups behind the User hover card: lifetime credits and the most
  // recent event, aggregated across the whole (unpaged) list.
  const userSummaries = computed(() => {
    const map = new Map<string, UserSummary>()
    for (const event of base.value) {
      if (event.credited) continue
      const existing = map.get(event.userName)
      if (!existing) {
        map.set(event.userName, {
          totalCredits: event.credits,
          lastActivity: event.date
        })
      } else {
        existing.totalCredits += event.credits
        if (event.date > existing.lastActivity)
          existing.lastActivity = event.date
      }
    }
    return map
  })

  return {
    page,
    total,
    itemsPerPage: perPage,
    pagedItems,
    sortField,
    sortDirection,
    toggleSort,
    userSummaries
  }
}
