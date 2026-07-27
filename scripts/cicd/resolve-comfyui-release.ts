#!/usr/bin/env tsx
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

interface ReleaseInfo {
  current_version: string
  target_minor: number
  target_version: string
  target_branch: string
  needs_release: boolean
  latest_patch_tag: string | null
  branch_head_sha: string | null
  tag_commit_sha: string | null
  diff_url: string
  release_pr_url: string | null
}

/**
 * Execute a command and return stdout
 */
function exec(command: string, cwd?: string): string {
  try {
    return execSync(command, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const cwdInfo = cwd ? ` in directory: ${cwd}` : ''
    console.error(
      `Command failed: ${command}${cwdInfo}\nError: ${errorMessage}`
    )
    return ''
  }
}

/**
 * Parse version from requirements.txt
 * Handles formats: comfyui-frontend-package==1.2.3, comfyui-frontend-package>=1.2.3, etc.
 */
function parseRequirementsVersion(requirementsPath: string): string | null {
  if (!fs.existsSync(requirementsPath)) {
    console.error(`Requirements file not found: ${requirementsPath}`)
    return null
  }

  const content = fs.readFileSync(requirementsPath, 'utf-8')
  const match = content.match(
    /comfyui-frontend-package\s*(?:==|>=|<=|~=|>|<)\s*([0-9]+\.[0-9]+\.[0-9]+)/
  )

  if (!match) {
    console.error(
      'Could not find comfyui-frontend-package version in requirements.txt'
    )
    return null
  }

  return match[1]
}

/**
 * Validate semantic version string
 */
function isValidSemver(version: string): boolean {
  if (!version || typeof version !== 'string') {
    return false
  }

  const parts = version.split('.')
  if (parts.length !== 3) {
    return false
  }

  return parts.every((part) => {
    const num = Number(part)
    return Number.isFinite(num) && num >= 0 && String(num) === part
  })
}

/**
 * Parse a target branch override of the form `core/<major>.<minor>`.
 * Returns the parsed major/minor and normalized branch, or null if malformed.
 */
function parseTargetBranchOverride(
  branch: string
): { major: number; minor: number; branch: string } | null {
  const match = branch.match(/^core\/(\d+)\.(\d+)$/)
  if (!match) {
    return null
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    branch
  }
}

/**
 * Compute the next release version for a target major.minor line.
 *
 * With no prior tag, the line starts at `.0`. With a prior tag, the patch is
 * bumped when there are pending commits, otherwise the tagged version stands.
 * Returns null if the tag is not valid semver.
 */
function computeTargetVersion(
  targetMajor: number,
  targetMinor: number,
  latestPatchTag: string | null,
  hasPendingCommits: boolean
): string | null {
  if (!latestPatchTag) {
    return `${targetMajor}.${targetMinor}.0`
  }

  const tagVersion = latestPatchTag.replace('v', '')
  if (!isValidSemver(tagVersion)) {
    return null
  }

  const existingPatch = Number(tagVersion.split('.')[2])
  return hasPendingCommits
    ? `${targetMajor}.${targetMinor}.${existingPatch + 1}`
    : tagVersion
}

/**
 * Check whether a branch exists on origin in the given repo.
 */
function branchExists(branch: string, repoPath: string): boolean {
  return Boolean(exec(`git rev-parse --verify origin/${branch}`, repoPath))
}

/**
 * Get the latest patch tag for a given major.minor version
 */
function getLatestPatchTag(
  repoPath: string,
  major: number,
  minor: number
): string | null {
  // Fetch all tags
  exec('git fetch --tags', repoPath)

  // Use git's native version sorting to get the latest tag
  const latestTag = exec(
    `git tag -l 'v${major}.${minor}.*' --sort=-version:refname | head -n 1`,
    repoPath
  )

  if (!latestTag) {
    return null
  }

  // Validate the tag is a valid semver (vX.Y.Z format)
  const validTagRegex = /^v\d+\.\d+\.\d+$/
  if (!validTagRegex.test(latestTag)) {
    console.error(
      `Latest tag for version ${major}.${minor} is not valid semver: ${latestTag}`
    )
    return null
  }

  return latestTag
}

/**
 * Resolve the ComfyUI release information
 */
function resolveRelease(
  comfyuiRepoPath: string,
  frontendRepoPath: string
): ReleaseInfo | null {
  // Parse current version from ComfyUI requirements.txt
  const requirementsPath = path.join(comfyuiRepoPath, 'requirements.txt')
  const currentVersion = parseRequirementsVersion(requirementsPath)

  if (!currentVersion) {
    return null
  }

  // Validate version format
  if (!isValidSemver(currentVersion)) {
    console.error(
      `Invalid semantic version format: ${currentVersion}. Expected format: X.Y.Z`
    )
    return null
  }

  const [currentMajor, currentMinor] = currentVersion.split('.').map(Number)

  // Fetch all branches
  exec('git fetch origin', frontendRepoPath)

  // Target major defaults to the current pin's major, but a TARGET_BRANCH
  // override (below) can retarget both major and minor.
  let targetMajor = currentMajor
  let targetMinor: number
  let targetBranch: string

  const targetBranchOverride = process.env.TARGET_BRANCH?.trim()

  if (targetBranchOverride) {
    // Manual override takes precedence over RELEASE_TYPE / pin-derived selection.
    const parsed = parseTargetBranchOverride(targetBranchOverride)
    if (!parsed) {
      console.error(
        `Invalid TARGET_BRANCH: "${targetBranchOverride}". Expected format: core/<major>.<minor> (e.g. core/1.47 or core/2.0)`
      )
      return null
    }

    targetMajor = parsed.major
    targetMinor = parsed.minor
    targetBranch = parsed.branch

    if (!branchExists(targetBranch, frontendRepoPath)) {
      console.error(
        `Manual override branch ${targetBranch} does not exist in frontend repo`
      )
      return null
    }

    console.error(
      `Manual override: targeting ${targetBranch} (ignoring release_type)`
    )
  } else {
    // Determine target branch based on release type:
    //   'patch' → target current minor (hotfix for production version)
    //   'minor' → try next minor, fall back to current minor (bi-weekly cadence)
    const releaseTypeInput =
      process.env.RELEASE_TYPE?.trim().toLowerCase() || 'minor'
    if (releaseTypeInput !== 'minor' && releaseTypeInput !== 'patch') {
      console.error(
        `Invalid RELEASE_TYPE: "${releaseTypeInput}". Expected "minor" or "patch"`
      )
      return null
    }
    const releaseType: 'minor' | 'patch' = releaseTypeInput

    if (releaseType === 'patch') {
      targetMinor = currentMinor
      targetBranch = `core/${targetMajor}.${targetMinor}`

      if (!branchExists(targetBranch, frontendRepoPath)) {
        console.error(
          `Patch release requested but branch ${targetBranch} does not exist`
        )
        return null
      }

      console.error(
        `Patch release: targeting current production branch ${targetBranch}`
      )
    } else {
      // Try next minor first, fall back to current minor if not available
      targetMinor = currentMinor + 1
      targetBranch = `core/${targetMajor}.${targetMinor}`

      if (!branchExists(targetBranch, frontendRepoPath)) {
        // Fall back to current minor for minor release
        targetMinor = currentMinor
        targetBranch = `core/${targetMajor}.${targetMinor}`

        if (!branchExists(targetBranch, frontendRepoPath)) {
          console.error(
            `Neither core/${targetMajor}.${currentMinor + 1} nor core/${targetMajor}.${currentMinor} branches exist in frontend repo`
          )
          return null
        }

        console.error(
          `Next minor branch core/${targetMajor}.${currentMinor + 1} not found, falling back to core/${targetMajor}.${currentMinor} for minor release`
        )
      }
    }
  }

  // Get latest patch tag for target major.minor
  const latestPatchTag = getLatestPatchTag(
    frontendRepoPath,
    targetMajor,
    targetMinor
  )

  let needsRelease: boolean
  let branchHeadSha: string | null
  let tagCommitSha: string | null = null
  let targetVersion: string

  if (latestPatchTag) {
    // Get commit SHA for the tag
    tagCommitSha = exec(`git rev-list -n 1 ${latestPatchTag}`, frontendRepoPath)

    // Get commit SHA for branch head
    branchHeadSha = exec(
      `git rev-parse origin/${targetBranch}`,
      frontendRepoPath
    )

    // Check if there are commits between tag and branch head
    const commitsBetween = exec(
      `git rev-list ${latestPatchTag}..origin/${targetBranch} --count`,
      frontendRepoPath
    )

    const commitCount = parseInt(commitsBetween, 10)
    needsRelease = !isNaN(commitCount) && commitCount > 0

    const nextVersion = computeTargetVersion(
      targetMajor,
      targetMinor,
      latestPatchTag,
      needsRelease
    )
    if (!nextVersion) {
      console.error(
        `Invalid tag version format: ${latestPatchTag}. Expected format: vX.Y.Z`
      )
      return null
    }
    targetVersion = nextVersion
  } else {
    // No tags exist for this major.minor version, need to create the .0 patch
    needsRelease = true
    targetVersion = `${targetMajor}.${targetMinor}.0`
    branchHeadSha = exec(
      `git rev-parse origin/${targetBranch}`,
      frontendRepoPath
    )
  }

  const diffUrl = `https://github.com/Comfy-Org/ComfyUI_frontend/compare/v${currentVersion}...v${targetVersion}`

  return {
    current_version: currentVersion,
    target_minor: targetMinor,
    target_version: targetVersion,
    target_branch: targetBranch,
    needs_release: needsRelease,
    latest_patch_tag: latestPatchTag,
    branch_head_sha: branchHeadSha,
    tag_commit_sha: tagCommitSha,
    diff_url: diffUrl,
    release_pr_url: null // Will be populated by workflow if release is triggered
  }
}

/**
 * Main execution: parse args, resolve, and print the JSON result.
 */
function main(): void {
  const comfyuiRepoPath = process.argv[2]
  const frontendRepoPath = process.argv[3] || process.cwd()

  if (!comfyuiRepoPath) {
    console.error(
      'Usage: resolve-comfyui-release.ts <comfyui-repo-path> [frontend-repo-path]'
    )
    process.exit(1)
  }

  const releaseInfo = resolveRelease(comfyuiRepoPath, frontendRepoPath)

  if (!releaseInfo) {
    console.error('Failed to resolve release information')
    process.exit(1)
  }

  // Output as JSON for GitHub Actions
  // oxlint-disable-next-line no-console -- stdout is captured by the workflow
  console.log(JSON.stringify(releaseInfo, null, 2))
}

// Only run when invoked directly, not when imported by tests.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export {
  computeTargetVersion,
  isValidSemver,
  parseRequirementsVersion,
  parseTargetBranchOverride,
  resolveRelease
}
