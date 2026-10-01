import { writeFileSync } from 'node:fs'
import { z } from 'zod'

import {
  modelTrendQuery,
  modelTrendSnapshotSchema,
  trendModelVersions
} from '../src/components/models/explore/modelTrends'

const token = process.env.WEBSITE_POSTHOG_READ_TOKEN
if (!token) {
  if (process.env.REQUIRE_MODEL_TRENDS_REFRESH === '1')
    throw new Error(
      'Daily model trends refresh requires WEBSITE_POSTHOG_READ_TOKEN'
    )
  process.stdout.write('Model trends: using the dated committed snapshot.\n')
} else {
  const response = await fetch(
    'https://us.posthog.com/api/projects/204330/query/',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: { kind: 'HogQLQuery', query: modelTrendQuery },
        name: 'Website model version trends'
      }),
      signal: AbortSignal.timeout(60000)
    }
  )
  if (!response.ok)
    throw new Error(`Model trend query failed with HTTP ${response.status}`)
  const result = z
    .object({
      columns: z.array(z.string()),
      results: z.array(z.array(z.union([z.string(), z.number(), z.null()])))
    })
    .parse(await response.json())
  const expectedColumns = [
    'model',
    'users_current',
    'users_previous',
    'runs_current'
  ]
  if (result.columns.join(',') !== expectedColumns.join(','))
    throw new Error('Model trend query returned unexpected columns')
  const rows = result.results
    .map(([model, usersCurrent, usersPrevious, runsCurrent]) => ({
      model,
      usersCurrent,
      usersPrevious,
      runsCurrent
    }))
    .filter((row) =>
      trendModelVersions.some((version) => version.id === row.model)
    )
  const now = new Date()
  const snapshot = modelTrendSnapshotSchema.parse({
    asOf: `${now.toISOString().slice(0, 10)}T00:00:00Z`,
    source: 'comfy-cloud-partner-successes',
    rows
  })
  if (!snapshot.rows.length)
    throw new Error('Model trend query returned no recognized versions')
  writeFileSync(
    new URL('../src/data/model-trends.snapshot.json', import.meta.url),
    JSON.stringify(snapshot, null, 2) + '\n'
  )
  process.stdout.write('Refreshed model trends from production analytics.\n')
}
