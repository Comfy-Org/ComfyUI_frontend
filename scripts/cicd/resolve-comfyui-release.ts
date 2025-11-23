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
 * Get the latest patch tag for a given minor version
 */
function getLatestPatchTag(repoPath: string, minor: number): string | null {
  // Fetch all tags
  exec('git fetch --tags', repoPath)

  // List all tags matching v1.{minor}.*
  const tags = exec(`git tag -l 'v1.${minor}.*'`, repoPath)
    .split('\n')
    .filter((tag) => tag.trim() !== '')

  if (tags.length === 0) {
    return null
  }

  // Sort tags by version (semantic sort)
  const sortedTags = tags.sort((a, b) => {
    const aParts = a.replace('v', '').split('.').map(Number)
    const bParts = b.replace('v', '').split('.').map(Number)

    for (let i = 0; i < 3; i++) {
      if (aParts[i] !== bParts[i]) {
        return aParts[i] - bParts[i]
      }
    }
    return 0
  })

  return sortedTags[sortedTags.length - 1]
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

  const [major, currentMinor, patch] = currentVersion.split('.').map(Number)

  // Calculate target minor version (next minor)
  const targetMinor = currentMinor + 1
  const targetBranch = `core/1.${targetMinor}`

  // Check if target branch exists in frontend repo
  exec('git fetch origin', frontendRepoPath)
  const branchExists = exec(
    `git rev-parse --verify origin/${targetBranch}`,
    frontendRepoPath
  )

  if (!branchExists) {
    console.error(
      `Target branch ${targetBranch} does not exist in frontend repo`
    )
    return null
  }

  // Get latest patch tag for target minor
  const latestPatchTag = getLatestPatchTag(frontendRepoPath, targetMinor)

  let needsRelease = false
  let branchHeadSha: string | null = null
  let tagCommitSha: string | null = null
  let targetVersion = currentVersion

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

    needsRelease = parseInt(commitsBetween) > 0

    // Parse existing patch number and increment if needed
    const tagVersion = latestPatchTag.replace('v', '')
    const [, , existingPatch] = tagVersion.split('.').map(Number)

    if (needsRelease) {
      targetVersion = `1.${targetMinor}.${existingPatch + 1}`
    } else {
      targetVersion = tagVersion
    }
  } else {
    // No tags exist for this minor version, need to create v1.{targetMinor}.0
    needsRelease = true
    targetVersion = `1.${targetMinor}.0`
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

// Main execution
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
// eslint-disable-next-line no-console
console.log(JSON.stringify(releaseInfo, null, 2))

export { resolveRelease }
