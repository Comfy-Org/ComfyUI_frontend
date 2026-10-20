import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

import { websiteRoot } from '@website/paths'
import type { HubCreatorsSnapshot } from '@/lib/hub/creators'
import {
  hubCreatorProfileSchema,
  hubCreatorWorkflowSchema,
  hubCreatorsSnapshotSchema
} from '@/lib/hub/creators'
import { isDirectExecution } from './script-entry-point'

const API = 'https://cloud.comfy.org/api/hub'
const PAGE_SIZE = 100
const REQUEST_TIMEOUT_MS = 15_000
const snapshotPath = join(websiteRoot, 'src/data/hub-creators.snapshot.json')

type FetchJson = (url: string) => Promise<unknown>

const workflowPageSchema = z.object({
  workflows: z.array(hubCreatorWorkflowSchema),
  next_cursor: z.string().optional()
})

export async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  return response.json()
}

async function fetchWorkflows(fetchJson: FetchJson) {
  const workflows: HubCreatorsSnapshot['workflows'] = []
  const seenCursors = new Set<string>()
  let cursor: string | undefined
  do {
    const query = new URLSearchParams({ limit: String(PAGE_SIZE) })
    if (cursor) query.set('cursor', cursor)
    const page = workflowPageSchema.parse(
      await fetchJson(`${API}/workflows?${query}`)
    )
    workflows.push(...page.workflows)
    cursor = page.workflows.length > 0 ? page.next_cursor : undefined
    if (cursor && seenCursors.has(cursor))
      throw new Error(`The Hub API returned cursor ${cursor} twice`)
    if (cursor) seenCursors.add(cursor)
  } while (cursor)
  return workflows
}

function assertComplete(
  { profiles, workflows }: HubCreatorsSnapshot,
  current?: HubCreatorsSnapshot
) {
  if (profiles.length === 0 || workflows.length === 0)
    throw new Error(
      `The Hub API returned no workflows or no profiles (${workflows.length} workflows, ${profiles.length} profiles); keeping the current snapshot`
    )
  const currentCount = current?.workflows.length ?? 0
  if (workflows.length < currentCount / 2)
    throw new Error(
      `The Hub API returned ${workflows.length} workflows, under half of the ${currentCount} in the current snapshot; keeping the current snapshot`
    )
}

export async function fetchSnapshot(
  fetchJson: FetchJson,
  current?: HubCreatorsSnapshot
): Promise<HubCreatorsSnapshot> {
  const workflows = await fetchWorkflows(fetchJson)
  const usernames = [
    ...new Set(workflows.map(({ profile }) => profile.username))
  ].sort()
  const profiles = await Promise.all(
    usernames.map(async (username) =>
      hubCreatorProfileSchema.parse(
        await fetchJson(`${API}/profiles/${encodeURIComponent(username)}`)
      )
    )
  )
  const snapshot = hubCreatorsSnapshotSchema.parse({
    fetched_at: new Date().toISOString(),
    profiles,
    workflows
  })
  assertComplete(snapshot, current)
  return snapshot
}

async function main() {
  const current = hubCreatorsSnapshotSchema.parse(
    JSON.parse(readFileSync(snapshotPath, 'utf8'))
  )
  const snapshot = await fetchSnapshot(getJson, current)
  writeFileSync(`${snapshotPath}.tmp`, JSON.stringify(snapshot, null, 2) + '\n')
  renameSync(`${snapshotPath}.tmp`, snapshotPath)
  process.stdout.write(
    `Wrote ${snapshot.profiles.length} creators and ${snapshot.workflows.length} workflows to ${snapshotPath}\n`
  )
}

if (isDirectExecution(process.argv[1], import.meta.filename)) await main()
