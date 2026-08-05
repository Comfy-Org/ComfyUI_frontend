import type { ActivityEvent } from '@/platform/workspace/composables/useWorkspaceActivity'

/**
 * Non-production sample ledger for Storybook and unit tests only — never
 * imported by shipping code. It stands in for the per-workspace usage API
 * (FE-1249) so the Activity table can be exercised with a populated,
 * multi-page, multi-user data set (usage outflows, partner-node rows, and
 * workspace-level credit inflows) while the live source is still empty.
 */
export const activityFixture: ActivityEvent[] = [
  {
    id: 'evt-01',
    date: new Date('2026-07-14T09:32:00Z'),
    userId: 'user-ada',
    userName: 'Ada Lovelace',
    eventType: 'Cloud workflow run',
    detail: '2 runs',
    credits: 1840
  },
  {
    id: 'evt-02',
    date: new Date('2026-07-14T08:10:00Z'),
    userId: 'user-grace',
    userName: 'Grace Hopper',
    eventType: 'Partner node usage',
    detail: '1 run',
    credits: 3200,
    partnerNode: 'Flux Pro 1.1 Ultra'
  },
  {
    id: 'evt-03',
    date: new Date('2026-07-13T22:47:00Z'),
    userId: 'user-ada',
    userName: 'Ada Lovelace',
    eventType: 'Partner node usage',
    detail: '4 runs',
    credits: 5120,
    partnerNode: 'Kling v2 Master'
  },
  {
    id: 'evt-04',
    date: new Date('2026-07-13T18:05:00Z'),
    userId: 'user-alan',
    userName: 'Alan Turing',
    eventType: 'Cloud workflow run',
    detail: '7 runs',
    credits: 6300
  },
  {
    id: 'evt-05',
    date: new Date('2026-07-13T12:00:00Z'),
    userId: null,
    userName: '',
    eventType: 'Auto-reload',
    detail: '—',
    credits: 20000,
    credited: true
  },
  {
    id: 'evt-06',
    date: new Date('2026-07-12T16:22:00Z'),
    userId: 'user-grace',
    userName: 'Grace Hopper',
    eventType: 'Cloud workflow run',
    detail: '3 runs',
    credits: 2700
  },
  {
    id: 'evt-07',
    date: new Date('2026-07-12T11:41:00Z'),
    userId: 'user-alan',
    userName: 'Alan Turing',
    eventType: 'Partner node usage',
    detail: '2 runs',
    credits: 4480,
    partnerNode: 'Gemini 2.5 Flash Image'
  },
  {
    id: 'evt-08',
    date: new Date('2026-07-11T20:15:00Z'),
    userId: 'user-ada',
    userName: 'Ada Lovelace',
    eventType: 'Cloud workflow run',
    detail: '5 runs',
    credits: 4100
  },
  {
    id: 'evt-09',
    date: new Date('2026-07-11T09:03:00Z'),
    userId: 'user-katherine',
    userName: 'Katherine Johnson',
    eventType: 'Cloud workflow run',
    detail: '1 run',
    credits: 760
  },
  {
    id: 'evt-10',
    date: new Date('2026-07-10T14:38:00Z'),
    userId: 'user-grace',
    userName: 'Grace Hopper',
    eventType: 'Partner node usage',
    detail: '6 runs',
    credits: 8900,
    partnerNode: 'Veo 3'
  },
  {
    id: 'evt-11',
    date: new Date('2026-07-10T07:26:00Z'),
    userId: 'user-alan',
    userName: 'Alan Turing',
    eventType: 'Cloud workflow run',
    detail: '2 runs',
    credits: 1560
  },
  {
    id: 'evt-12',
    date: new Date('2026-07-09T19:52:00Z'),
    userId: null,
    userName: '',
    eventType: 'Additional credits added',
    detail: '—',
    credits: 50000,
    credited: true
  },
  {
    id: 'evt-13',
    date: new Date('2026-07-09T13:14:00Z'),
    userId: 'user-katherine',
    userName: 'Katherine Johnson',
    eventType: 'Partner node usage',
    detail: '3 runs',
    credits: 3840,
    partnerNode: 'Recraft V3'
  },
  {
    id: 'evt-14',
    date: new Date('2026-07-08T10:48:00Z'),
    userId: 'user-ada',
    userName: 'Ada Lovelace',
    eventType: 'Cloud workflow run',
    detail: '4 runs',
    credits: 2950
  }
]
