import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { z } from 'zod'

import type { IssueNode, IssueState } from './pendingServerFacts'
import {
  ISSUE_STATES_QUERY,
  expiredTickets,
  extractTickets,
  indexIssueStates
} from './pendingServerFacts'

const SOURCE_PATHSPECS = [
  ':(glob)src/**/*.ts',
  ':(glob)src/**/*.vue',
  ':(glob)apps/*/src/**/*.ts',
  ':(glob)apps/*/src/**/*.vue'
]
const TEST_FILE = /\.(test|spec)\.ts$|\/__tests__\//

const issuesResponseSchema = z.object({
  data: z.object({
    issues: z.object({
      nodes: z.array(
        z.object({
          identifier: z.string(),
          state: z.object({ type: z.string(), name: z.string() })
        })
      )
    })
  })
})

type IssueStatesFetch =
  | { ok: true; states: Record<string, IssueState | null> }
  | { ok: false; reason: string }

function listSourceFiles(): string[] {
  return execFileSync('git', ['ls-files', '-z', '--', ...SOURCE_PATHSPECS], {
    encoding: 'utf8'
  })
    .split('\0')
    .filter((file) => file && !TEST_FILE.test(file))
}

async function fetchIssueStates(
  apiKey: string,
  tickets: string[]
): Promise<IssueStatesFetch> {
  const numbers = tickets.map((ticket) => Number(ticket.slice('BE-'.length)))
  let response: Response
  try {
    response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: ISSUE_STATES_QUERY,
        variables: { numbers }
      })
    })
  } catch (cause) {
    return { ok: false, reason: `Linear request failed: ${String(cause)}` }
  }
  const body: unknown = await response.json().catch(() => undefined)
  const parsed = issuesResponseSchema.safeParse(body)
  if (!response.ok || !parsed.success) {
    return {
      ok: false,
      reason: `Linear responded ${response.status}: ${JSON.stringify(body)}`
    }
  }
  const nodes: IssueNode[] = parsed.data.data.issues.nodes
  return { ok: true, states: indexIssueStates(tickets, nodes) }
}

function fail(lines: string[]): never {
  process.stderr.write(`${lines.join('\n')}\n`)
  process.exit(1)
}

const referencesByTicket = new Map<string, string[]>()
const nonLiteral: string[] = []
for (const file of listSourceFiles()) {
  for (const { line, ticket } of extractTickets(readFileSync(file, 'utf8'))) {
    const location = `${file}:${line}`
    if (ticket === null) nonLiteral.push(location)
    else
      referencesByTicket.set(ticket, [
        ...(referencesByTicket.get(ticket) ?? []),
        location
      ])
  }
}

if (nonLiteral.length) {
  fail([
    "pendingServerFact needs a 'BE-<number>' string literal as its first argument so its expiry can be checked:",
    ...nonLiteral.map((location) => `  ${location}`)
  ])
}

const tickets = [...referencesByTicket.keys()].sort()
if (!tickets.length) {
  process.stdout.write('No pendingServerFact call sites. Nothing to check.\n')
  process.exit(0)
}

const apiKey = process.env.LINEAR_API_KEY
if (!apiKey) {
  fail([
    `Found ${tickets.length} pendingServerFact ticket(s) (${tickets.join(', ')}) but LINEAR_API_KEY is not set.`,
    'Set the LINEAR_API_KEY secret so their expiry can be checked.'
  ])
}

const fetched = await fetchIssueStates(apiKey, tickets)
if (!fetched.ok) fail([fetched.reason])

const { closed, unknown } = expiredTickets(fetched.states)
const locationsOf = (ticket: string) =>
  (referencesByTicket.get(ticket) ?? []).map((location) => `    ${location}`)

if (closed.length || unknown.length) {
  fail([
    ...closed.flatMap(({ ticket, state }) => [
      `${ticket} is ${state}; its pendingServerFact bridge has expired:`,
      ...locationsOf(ticket)
    ]),
    ...unknown.flatMap((ticket) => [
      `${ticket} does not exist in Linear's BE team:`,
      ...locationsOf(ticket)
    ]),
    '',
    'Render the field the backend now ships and delete the pendingServerFact wrapper.',
    'For an unknown ticket, fix the identifier. See ADR-API-SERVER-FACTS-0042.'
  ])
}

process.stdout.write(
  `All ${tickets.length} pendingServerFact ticket(s) are still open.\n`
)
