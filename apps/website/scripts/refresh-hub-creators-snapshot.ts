import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  zHubProfile,
  zHubWorkflowListResponse
} from '@comfyorg/ingest-types/zod'
import type { z } from 'zod'

import { websiteRoot } from '@website/paths'
import type { HubCreatorsSnapshot } from '@/lib/hub/creators'
import { hubCreatorsSnapshotSchema } from '@/lib/hub/creators'
import { isDirectExecution } from './script-entry-point'

const API = 'https://cloud.comfy.org/api/hub'
const PAGE_SIZE = 100
const REQUEST_TIMEOUT_MS = 15_000
const snapshotPath = join(websiteRoot, 'src/data/hub-creators.snapshot.json')

type FetchJson = (url: string) => Promise<unknown>

type SnapshotWorkflow = HubCreatorsSnapshot['workflows'][number]

type ApiWorkflow = z.output<
  typeof zHubWorkflowListResponse
>['workflows'][number]

function displayNames(labels?: { display_name: string }[]) {
  return labels?.map(({ display_name }) => ({ display_name }))
}

function toSnapshotWorkflow(workflow: ApiWorkflow): SnapshotWorkflow {
  return {
    share_id: workflow.share_id,
    name: workflow.name,
    status: workflow.status,
    is_app: workflow.is_app,
    publish_time: workflow.publish_time ?? null,
    thumbnail_type: workflow.thumbnail_type,
    thumbnail_url: workflow.thumbnail_url,
    thumbnail_comparison_url: workflow.thumbnail_comparison_url,
    tags: displayNames(workflow.tags),
    models: displayNames(workflow.models),
    profile: { username: workflow.profile.username }
  }
}

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
    const page = zHubWorkflowListResponse.parse(
      await fetchJson(`${API}/workflows?${query}`)
    )
    workflows.push(...page.workflows.map(toSnapshotWorkflow))
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
  const usernameByKey = new Map<string, string>()
  for (const { profile } of workflows) {
    const key = profile.username.toLowerCase()
    if (!usernameByKey.has(key)) usernameByKey.set(key, profile.username)
  }
  const usernames = [...usernameByKey.values()].sort()
  const profiles = await Promise.all(
    usernames.map(async (username) =>
      zHubProfile.parse(
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
