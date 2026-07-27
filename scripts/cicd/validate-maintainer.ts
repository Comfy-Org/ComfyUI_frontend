import { appendFileSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

type Assignee = {
  login?: string | null
  type?: string | null
}

type EventPayload = {
  issue?: { assignees?: Assignee[] | null }
  pull_request?: { assignees?: Assignee[] | null }
}

type GitHubUser = {
  login?: string | null
  suspended_at?: string | null
  type?: string | null
}

type OrgMembership = {
  state?: string | null
}

export type MembershipRecord = {
  membership: OrgMembership | null
  teamMembership: OrgMembership | null
  user: GitHubUser | null
}

export type MembershipLookup = (login: string) => Promise<MembershipRecord>

export type MaintainerValidation = {
  errors: string[]
  valid: boolean
}

export type PullRequestAssigneePayload = {
  assignees?: Assignee[] | null
  number?: number | null
}

const BOT_LOGIN = /(?:\[bot\]|[-_]bot)$/i
const COMFY_ORG = 'Comfy-Org'
const HUMAN_TEAM = 'comfy_frontend_devs'

function isHumanAccount(assignee: Assignee): assignee is Assignee & {
  login: string
} {
  const login = assignee.login?.trim() ?? ''
  return (
    Boolean(login) &&
    assignee.type?.toLowerCase() === 'user' &&
    !BOT_LOGIN.test(login)
  )
}

function isActiveOrgHuman(record: MembershipRecord, login: string): boolean {
  const userLogin = record.user?.login?.trim() ?? ''
  return (
    userLogin.toLowerCase() === login.toLowerCase() &&
    record.user?.type?.toLowerCase() === 'user' &&
    !record.user.suspended_at &&
    record.membership?.state?.toLowerCase() === 'active' &&
    record.teamMembership?.state?.toLowerCase() === 'active'
  )
}

export async function validateMaintainerAssignees(
  assignees: Assignee[],
  membershipFor: MembershipLookup
): Promise<MaintainerValidation> {
  for (const assignee of assignees) {
    if (!isHumanAccount(assignee)) continue
    if (isActiveOrgHuman(await membershipFor(assignee.login), assignee.login)) {
      return { errors: [], valid: true }
    }
  }

  return {
    errors: [
      'Assign at least one active human member of the Comfy-Org/comfy_frontend_devs team.'
    ],
    valid: false
  }
}

export async function validatePullRequestMaintainers(
  pullRequests: PullRequestAssigneePayload[],
  membershipFor: MembershipLookup
): Promise<MaintainerValidation> {
  if (pullRequests.length === 0) {
    return {
      errors: ['No pull request metadata was available for owner validation.'],
      valid: false
    }
  }

  const errors: string[] = []
  for (const pullRequest of pullRequests) {
    const result = await validateMaintainerAssignees(
      pullRequest.assignees ?? [],
      membershipFor
    )
    if (!result.valid) {
      const prefix = pullRequest.number ? `PR #${pullRequest.number}: ` : ''
      errors.push(...result.errors.map((error) => `${prefix}${error}`))
    }
  }

  return { errors, valid: errors.length === 0 }
}

export function createGitHubMembershipLookup(token: string): MembershipLookup {
  return async (login): Promise<MembershipRecord> => {
    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2026-03-10'
    }
    const userResponse = await fetch(
      `https://api.github.com/users/${encodeURIComponent(login)}`,
      { headers }
    )
    if (userResponse.status === 404) {
      return { membership: null, teamMembership: null, user: null }
    }
    if (!userResponse.ok) {
      throw new Error(
        `GitHub user lookup failed for ${login}: ${userResponse.status}`
      )
    }

    const membershipResponse = await fetch(
      `https://api.github.com/orgs/${COMFY_ORG}/memberships/${encodeURIComponent(login)}`,
      { headers }
    )
    if (membershipResponse.status === 404) {
      return {
        membership: null,
        teamMembership: null,
        user: (await userResponse.json()) as GitHubUser
      }
    }
    if (!membershipResponse.ok) {
      throw new Error(
        `GitHub organization membership lookup failed for ${login}: ${membershipResponse.status}`
      )
    }

    const teamResponse = await fetch(
      `https://api.github.com/orgs/${COMFY_ORG}/teams/${HUMAN_TEAM}/memberships/${encodeURIComponent(login)}`,
      { headers }
    )
    if (teamResponse.status === 404) {
      return {
        membership: (await membershipResponse.json()) as OrgMembership,
        teamMembership: null,
        user: (await userResponse.json()) as GitHubUser
      }
    }
    if (!teamResponse.ok) {
      throw new Error(
        `GitHub human-team membership lookup failed for ${login}: ${teamResponse.status}`
      )
    }

    return {
      membership: (await membershipResponse.json()) as OrgMembership,
      teamMembership: (await teamResponse.json()) as OrgMembership,
      user: (await userResponse.json()) as GitHubUser
    }
  }
}

function writeOutput(valid: boolean): void {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `valid=${valid}\n`)
  }
}

async function runCli(): Promise<void> {
  const [eventPath] = process.argv.slice(2)
  if (!eventPath) {
    throw new Error('Usage: validate-maintainer.ts <event.json>')
  }

  const token = process.env.COMFY_ORG_MEMBERS_READ_TOKEN?.trim()
  if (!token) {
    throw new Error('COMFY_ORG_MEMBERS_READ_TOKEN is required.')
  }

  const payload = JSON.parse(readFileSync(eventPath, 'utf8')) as EventPayload
  const assignees =
    payload.pull_request?.assignees ?? payload.issue?.assignees ?? []
  const result = await validateMaintainerAssignees(
    assignees,
    createGitHubMembershipLookup(token)
  )

  writeOutput(result.valid)
  if (result.valid) {
    process.stdout.write('Human Comfy maintainer assignment satisfied.\n')
    return
  }

  result.errors.forEach((error) => console.error(`::error::${error}`))
  process.exitCode = 1
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runCli().catch((error: unknown) => {
    writeOutput(false)
    const message = error instanceof Error ? error.message : String(error)
    console.error(`::error::${message}`)
    process.exitCode = 1
  })
}
