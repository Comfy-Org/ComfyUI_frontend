import * as core from '@actions/core'
import { context, getOctokit } from '@actions/github'

type OctokitInstance = ReturnType<typeof getOctokit>

type ReleaseLabel = 'released:core' | 'released:cloud'

const LABEL_COLORS: Record<ReleaseLabel, string> = {
  'released:core': '0075ca',
  'released:cloud': 'e4e669'
}

function getLabelForBranch(branchName: string | null): ReleaseLabel | null {
  if (branchName?.startsWith('core/')) return 'released:core'
  if (branchName?.startsWith('cloud/')) return 'released:cloud'
  return null
}

function getLabelForTag(tag: string): ReleaseLabel | null {
  if (tag.startsWith('core/')) return 'released:core'
  if (tag.startsWith('cloud/')) return 'released:cloud'
  return null
}

function isHttpError(err: unknown): err is { status: number } {
  return typeof err === 'object' && err !== null && 'status' in err
}

async function ensureLabelExists(
  octokit: OctokitInstance,
  label: ReleaseLabel
): Promise<void> {
  try {
    await octokit.rest.issues.getLabel({
      owner: context.repo.owner,
      repo: context.repo.repo,
      name: label
    })
    core.info(`Label '${label}' already exists`)
  } catch (err: unknown) {
    if (isHttpError(err) && err.status === 404) {
      await octokit.rest.issues.createLabel({
        owner: context.repo.owner,
        repo: context.repo.repo,
        name: label,
        color: LABEL_COLORS[label]
      })
      core.info(`Created label '${label}'`)
    } else {
      throw err
    }
  }
}

async function findPreviousReleaseTag(
  octokit: OctokitInstance,
  branchPrefix: string,
  currentTag: string
): Promise<string | null> {
  const releases = await octokit.paginate(octokit.rest.repos.listReleases, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    per_page: 100
  })

  const samePrefix = releases.filter(
    (r) => r.tag_name !== currentTag && r.tag_name.startsWith(branchPrefix)
  )

  if (samePrefix.length === 0) return null

  const currentRelease = releases.find((r) => r.tag_name === currentTag)
  const currentDate = currentRelease?.published_at
    ? new Date(currentRelease.published_at)
    : new Date()

  const previous = samePrefix
    .filter((r) => r.published_at && new Date(r.published_at) < currentDate)
    .sort(
      (a, b) =>
        new Date(b.published_at ?? 0).getTime() -
        new Date(a.published_at ?? 0).getTime()
    )

  return previous[0]?.tag_name ?? null
}

async function getCommitsInRange(
  octokit: OctokitInstance,
  releaseTag: string,
  previousTag: string | null
): Promise<Array<{ sha: string }>> {
  if (previousTag) {
    const comparison = await octokit.rest.repos.compareCommitsWithBasehead({
      owner: context.repo.owner,
      repo: context.repo.repo,
      basehead: `${previousTag}...${releaseTag}`
    })
    const { commits } = comparison.data
    core.info(
      `Found ${commits.length} commits between ${previousTag} and ${releaseTag}`
    )
    return commits
  }

  const { data: tagCommit } = await octokit.rest.repos.getCommit({
    owner: context.repo.owner,
    repo: context.repo.repo,
    ref: releaseTag
  })
  core.info(
    `No previous release; processing single HEAD commit ${tagCommit.sha}`
  )
  return [tagCommit]
}

async function collectMergedPRNumbers(
  octokit: OctokitInstance,
  commits: Array<{ sha: string }>
): Promise<Set<number>> {
  const prNumbers = new Set<number>()
  for (const commit of commits) {
    const { data: prs } =
      await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
        owner: context.repo.owner,
        repo: context.repo.repo,
        commit_sha: commit.sha
      })
    for (const pr of prs) {
      if (pr.merged_at) prNumbers.add(pr.number)
    }
  }
  return prNumbers
}

async function labelPRs(
  octokit: OctokitInstance,
  prNumbers: Set<number>,
  label: ReleaseLabel
): Promise<{ labeled: string[]; skipped: string[] }> {
  const labeled: string[] = []
  const skipped: string[] = []

  for (const prNumber of prNumbers) {
    const { data: pr } = await octokit.rest.pulls.get({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: prNumber
    })

    if (pr.labels.some((l) => l.name === label)) {
      skipped.push(`#${prNumber}`)
      continue
    }

    await octokit.rest.issues.addLabels({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      labels: [label]
    })

    labeled.push(`#${prNumber} ${pr.title}`)
    core.info(`Labeled PR #${prNumber}: ${pr.title}`)
  }

  return { labeled, skipped }
}

async function writeSummary(
  releaseTag: string,
  label: ReleaseLabel,
  previousTag: string | null,
  labeled: string[],
  skipped: string[]
): Promise<void> {
  const summaryLines = [
    `## Release PR Label Tagger`,
    ``,
    `**Release tag:** \`${releaseTag}\``,
    `**Label applied:** \`${label}\``,
    `**Previous release:** ${previousTag ? `\`${previousTag}\`` : '_none_'}`,
    ``
  ]

  if (labeled.length > 0) {
    summaryLines.push(`### Labeled PRs (${labeled.length})`)
    summaryLines.push(...labeled.map((entry) => `- ${entry}`))
    summaryLines.push(``)
  }

  if (skipped.length > 0) {
    summaryLines.push(`### Skipped (already labeled): ${skipped.join(', ')}`)
    summaryLines.push(``)
  }

  if (labeled.length === 0 && skipped.length === 0) {
    summaryLines.push(`_No PRs found to label._`)
  }

  await core.summary.addRaw(summaryLines.join('\n')).write()
}

async function main(): Promise<void> {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('GITHUB_TOKEN is required')

  const octokit = getOctokit(token)
  const isManual = context.eventName === 'workflow_dispatch'

  const releaseTag: string = isManual
    ? (process.env.INPUT_RELEASE_TAG ?? context.payload.inputs?.release_tag)
    : context.payload.release?.tag_name

  if (!releaseTag) throw new Error('Could not determine release tag')

  const branch: string | null = isManual
    ? null
    : (context.payload.release?.target_commitish ?? null)

  core.info(`Processing release tag: ${releaseTag}`)
  core.info(
    `Target branch: ${branch ?? '(manual trigger, will be derived from tag)'}`
  )

  const label = getLabelForBranch(branch) ?? getLabelForTag(releaseTag)
  if (!label) {
    core.notice(
      `Skipping: branch '${branch}' / tag '${releaseTag}' does not match core/ or cloud/ pattern`
    )
    return
  }

  core.info(`Will apply label: ${label}`)

  const branchPrefix = label === 'released:core' ? 'core/' : 'cloud/'

  await ensureLabelExists(octokit, label)

  const previousTag = await findPreviousReleaseTag(
    octokit,
    branchPrefix,
    releaseTag
  )
  core.info(
    previousTag
      ? `Previous release tag: ${previousTag}`
      : 'No previous release found; will use all commits reachable from this tag'
  )

  const commits = await getCommitsInRange(octokit, releaseTag, previousTag)
  const prNumbers = await collectMergedPRNumbers(octokit, commits)
  core.info(`Found ${prNumbers.size} merged PRs associated with these commits`)

  const { labeled, skipped } = await labelPRs(octokit, prNumbers, label)

  await writeSummary(releaseTag, label, previousTag, labeled, skipped)
}

main().catch((err: unknown) => {
  core.setFailed(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
