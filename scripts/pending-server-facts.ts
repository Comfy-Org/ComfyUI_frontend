import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

import type { CheckMode } from './pendingServerFacts'
import {
  expiredTickets,
  extractTickets,
  fetchIssueStates,
  preflight
} from './pendingServerFacts'

const SOURCE_PATHSPECS = [
  ':(glob)src/**/*.ts',
  ':(glob)src/**/*.vue',
  ':(glob)apps/*/src/**/*.ts',
  ':(glob)apps/*/src/**/*.vue'
]
const TEST_FILE = /\.(test|spec)\.ts$|\/__tests__\//

function listSourceFiles(): string[] {
  return execFileSync('git', ['ls-files', '-z', '--', ...SOURCE_PATHSPECS], {
    encoding: 'utf8'
  })
    .split('\0')
    .filter((file) => file && !TEST_FILE.test(file))
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

const tickets = [...referencesByTicket.keys()].sort()
const mode: CheckMode = process.argv.includes('--offline')
  ? 'offline'
  : 'online'
const outcome = preflight({
  mode,
  tickets,
  nonLiteral,
  readCredentials: () => ({
    clientId: process.env.LINEAR_CLIENT_ID,
    clientSecret: process.env.LINEAR_CLIENT_SECRET
  })
})
if (outcome.kind === 'fail') fail(outcome.lines)
if (outcome.kind === 'pass') {
  process.stdout.write(`${outcome.message}\n`)
  process.exit(0)
}

const fetched = await fetchIssueStates({
  credentials: outcome.credentials,
  tickets,
  fetch
})
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
