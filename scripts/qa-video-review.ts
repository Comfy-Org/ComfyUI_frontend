#!/usr/bin/env tsx
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { GoogleGenerativeAI } from '@google/generative-ai'
import { globSync } from 'glob'

interface CliOptions {
  artifactsDir: string
  videoFile: string
  beforeVideo: string
  outputDir: string
  model: string
  requestTimeoutMs: number
  dryRun: boolean
  prContext: string
  targetUrl: string
  passLabel: string
}

interface VideoCandidate {
  platformName: string
  videoPath: string
  mtimeMs: number
}

const DEFAULT_OPTIONS: CliOptions = {
  artifactsDir: './tmp/qa-artifacts',
  videoFile: '',
  beforeVideo: '',
  outputDir: './tmp',
  model: 'gemini-3-flash-preview',
  requestTimeoutMs: 300_000,
  dryRun: false,
  prContext: '',
  targetUrl: '',
  passLabel: ''
}

const USAGE = `Usage:
  pnpm exec tsx scripts/qa-video-review.ts [options]

Options:
  --artifacts-dir <path>        Artifacts root directory
                                 (default: ./tmp/qa-artifacts)
  --video-file <name-or-path>   Video file to analyze (required)
                                 (supports basename or relative/absolute path)
  --before-video <path>         Before video (main branch) for comparison
                                 When provided, sends both videos to Gemini
                                 for comparative before/after analysis
  --output-dir <path>           Output directory for markdown reports
                                 (default: ./tmp)
  --model <name>                Gemini model
                                 (default: gemini-3-flash-preview)
  --request-timeout-ms <n>      Request timeout in milliseconds
                                 (default: 300000)
  --pr-context <file>           File with PR context (title, body, diff)
                                 for PR-aware review
  --target-url <url>            Issue or PR URL to include in the report
  --pass-label <label>          Label for multi-pass reports (e.g. pass1)
                                 Output becomes {platform}-{label}-qa-video-report.md
  --dry-run                     Discover videos and output targets only
  --help                        Show this help text

Environment:
  GEMINI_API_KEY                Required unless --dry-run
`

function parsePositiveInteger(rawValue: string, flagName: string): number {
  const parsedValue = Number.parseInt(rawValue, 10)
  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`Invalid value for ${flagName}: "${rawValue}"`)
  }
  return parsedValue
}

function parseCliOptions(args: string[]): CliOptions {
  const options: CliOptions = { ...DEFAULT_OPTIONS }

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    const nextValue = args[index + 1]
    const requireValue = (flagName: string): string => {
      if (!nextValue || nextValue.startsWith('--')) {
        throw new Error(`Missing value for ${flagName}`)
      }
      index += 1
      return nextValue
    }

    if (argument === '--help') {
      process.stdout.write(USAGE)
      process.exit(0)
    }

    if (argument === '--artifacts-dir') {
      options.artifactsDir = requireValue(argument)
      continue
    }

    if (argument === '--video-file') {
      options.videoFile = requireValue(argument)
      continue
    }

    if (argument === '--output-dir') {
      options.outputDir = requireValue(argument)
      continue
    }

    if (argument === '--model') {
      options.model = requireValue(argument)
      continue
    }

    if (argument === '--request-timeout-ms') {
      options.requestTimeoutMs = parsePositiveInteger(
        requireValue(argument),
        argument
      )
      continue
    }

    if (argument === '--before-video') {
      options.beforeVideo = requireValue(argument)
      continue
    }

    if (argument === '--pr-context') {
      options.prContext = requireValue(argument)
      continue
    }

    if (argument === '--target-url') {
      options.targetUrl = requireValue(argument)
      continue
    }

    if (argument === '--pass-label') {
      options.passLabel = requireValue(argument)
      continue
    }

    if (argument === '--dry-run') {
      options.dryRun = true
      continue
    }

    throw new Error(`Unknown argument: ${argument}`)
  }

  return options
}

function normalizePlatformName(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug.length > 0 ? slug : 'unknown-platform'
}

export function extractPlatformFromArtifactDirName(dirName: string): string {
  const matchedValue = dirName.match(/^qa-report-(.+?)(?:-\d+)?$/i)?.[1]
  return normalizePlatformName(matchedValue ?? dirName)
}

function extractPlatformFromVideoPath(videoPath: string): string {
  const artifactDirName = basename(dirname(videoPath))
  return extractPlatformFromArtifactDirName(artifactDirName)
}

export function pickLatestVideosByPlatform(
  candidates: VideoCandidate[]
): VideoCandidate[] {
  const latestByPlatform = new Map<string, VideoCandidate>()

  for (const candidate of candidates) {
    const current = latestByPlatform.get(candidate.platformName)
    if (!current || candidate.mtimeMs > current.mtimeMs) {
      latestByPlatform.set(candidate.platformName, candidate)
    }
  }

  return [...latestByPlatform.values()].sort((a, b) =>
    a.platformName.localeCompare(b.platformName)
  )
}

function toProjectRelativePath(targetPath: string): string {
  const relativePath = relative(process.cwd(), targetPath)
  if (relativePath.startsWith('.')) {
    return relativePath
  }
  return `./${relativePath}`
}

function errorToString(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function normalizePathForMatch(value: string): string {
  return value.replaceAll('\\', '/').replace(/^\.\/+/, '')
}

export function selectVideoCandidateByFile(
  candidates: VideoCandidate[],
  options: { artifactsDir: string; videoFile: string }
): VideoCandidate {
  const requestedValue = options.videoFile.trim()
  if (requestedValue.length === 0) {
    throw new Error('--video-file is required')
  }

  const artifactsRoot = resolve(options.artifactsDir)
  const requestedAbsolutePath = resolve(requestedValue)
  const requestedPathKey = normalizePathForMatch(requestedValue)

  const matches = candidates.filter((candidate) => {
    const candidateAbsolutePath = resolve(candidate.videoPath)
    if (candidateAbsolutePath === requestedAbsolutePath) {
      return true
    }

    const candidateBaseName = basename(candidate.videoPath)
    if (candidateBaseName === requestedValue) {
      return true
    }

    const relativeToCwd = normalizePathForMatch(
      relative(process.cwd(), candidateAbsolutePath)
    )
    if (relativeToCwd === requestedPathKey) {
      return true
    }

    const relativeToArtifacts = normalizePathForMatch(
      relative(artifactsRoot, candidateAbsolutePath)
    )
    return relativeToArtifacts === requestedPathKey
  })

  if (matches.length === 1) {
    return matches[0]
  }

  if (matches.length === 0) {
    const availableVideos = candidates.map((candidate) =>
      toProjectRelativePath(candidate.videoPath)
    )
    throw new Error(
      [
        `No video matched --video-file "${options.videoFile}".`,
        'Available videos:',
        ...availableVideos.map((videoPath) => `- ${videoPath}`)
      ].join('\n')
    )
  }

  throw new Error(
    [
      `--video-file "${options.videoFile}" matched ${matches.length} videos.`,
      'Please pass a more specific path.',
      ...matches.map((match) => `- ${toProjectRelativePath(match.videoPath)}`)
    ].join('\n')
  )
}

async function collectVideoCandidates(
  artifactsDir: string
): Promise<VideoCandidate[]> {
  const absoluteArtifactsDir = resolve(artifactsDir)
  const videoPaths = globSync('**/qa-session{,-[0-9]}.mp4', {
    cwd: absoluteArtifactsDir,
    absolute: true,
    nodir: true
  }).sort()

  const candidates = await Promise.all(
    videoPaths.map(async (videoPath) => {
      const videoStat = await stat(videoPath)
      return {
        platformName: extractPlatformFromVideoPath(videoPath),
        videoPath,
        mtimeMs: videoStat.mtimeMs
      }
    })
  )

  return candidates
}

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  const mimeMap: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.m4v': 'video/mp4'
  }
  return mimeMap[ext] || 'video/mp4'
}

function buildReviewPrompt(options: {
  platformName: string
  videoPath: string
  prContext: string
  isComparative: boolean
}): string {
  const { platformName, videoPath, prContext, isComparative } = options

  if (isComparative) {
    return buildComparativePrompt(platformName, videoPath, prContext)
  }

  return buildSingleVideoPrompt(platformName, videoPath, prContext)
}

function buildComparativePrompt(
  platformName: string,
  videoPath: string,
  prContext: string
): string {
  const lines = [
    'You are a senior QA engineer performing a BEFORE/AFTER comparison review.',
    '',
    'You are given TWO videos:',
    '- **Video 1 (BEFORE)**: The main branch BEFORE the PR. This shows the OLD behavior.',
    '- **Video 2 (AFTER)**: The PR branch AFTER the changes. This shows the NEW behavior.',
    '',
    'Both videos show the same test steps executed on different code versions.',
    ''
  ]

  if (prContext) {
    lines.push('## PR Context', prContext, '')
  }

  lines.push(
    '## Your Task',
    `Platform: "${platformName}". After video: ${toProjectRelativePath(videoPath)}.`,
    '',
    '1. **BEFORE video**: Does it demonstrate the old behavior or bug that the PR aims to fix?',
    '   Describe what you observe — this establishes the baseline.',
    '2. **AFTER video**: Does it prove the PR fix works? Is the intended new behavior visible?',
    '3. **Comparison**: What specifically changed between before and after?',
    '4. **Regressions**: Did the PR introduce any new problems visible in the AFTER video',
    '   that were NOT present in the BEFORE video?',
    '',
    'Note: Brief black frames during page transitions are NORMAL.',
    'Report only concrete, visible differences. Avoid speculation.',
    '',
    'Return markdown with these sections exactly:',
    '## Summary',
    '(What the PR changes, whether BEFORE confirms the old behavior, whether AFTER proves the fix)',
    '',
    '## Behavior Changes',
    'Summarize ALL behavioral differences as a markdown TABLE:',
    '| Behavior | Before (main) | After (PR) | Verdict |',
    '',
    '- **Behavior**: short name for the behavior (e.g. "Save shortcut label", "Menu hover style")',
    '- **Before (main)**: how it works/looks in the BEFORE video',
    '- **After (PR)**: how it works/looks in the AFTER video',
    '- **Verdict**: `Fixed`, `Improved`, `Changed`, `Regression`, or `No Change`',
    '',
    'One row per distinct behavior. Include both changed AND unchanged key behaviors',
    'that were tested, so reviewers can confirm nothing was missed.',
    '',
    '## Timeline Comparison',
    'Present a chronological frame-by-frame comparison as a markdown TABLE:',
    '| Time | Type | Severity | Before (main) | After (PR) |',
    '',
    '- **Time**: timestamp or range from the videos (e.g. `0:05-0:08`)',
    '- **Type**: category such as `Visual`, `Behavior`, `Layout`, `Text`, `Animation`, `Menu`, `State`',
    '- **Severity**: `None` (neutral change), `Fixed` (bug resolved), `Regression`, `Minor`, `Major`',
    '- **Before (main)**: what is observed in the BEFORE video at that time',
    '- **After (PR)**: what is observed in the AFTER video at that time',
    '',
    'Include one row per distinct observable difference. If behavior is identical at a timestamp,',
    'omit that row. Focus on meaningful differences, not narrating every frame.',
    '',
    '## Confirmed Issues',
    'For each issue, use this exact format:',
    '',
    '### [Short issue title]',
    '`SEVERITY` `TIMESTAMP` `Confidence: LEVEL`',
    '',
    '[Description — specify whether it appears in BEFORE, AFTER, or both]',
    '',
    '**Evidence:** [What you observed at the given timestamp in which video]',
    '',
    '**Suggested Fix:** [Actionable recommendation]',
    '',
    '---',
    '',
    '## Possible Issues (Needs Human Verification)',
    '## Overall Risk',
    '(Assess whether the PR achieves its goal based on the before/after comparison)'
  )

  return lines.filter(Boolean).join('\n')
}

function buildSingleVideoPrompt(
  platformName: string,
  videoPath: string,
  prContext: string
): string {
  const lines = [
    'You are a senior QA engineer reviewing a UI test session recording.',
    ''
  ]

  const isIssueContext =
    prContext &&
    /^### Issue #|^Title:.*\bbug\b|^This video attempts to reproduce/im.test(
      prContext
    )

  if (prContext) {
    if (isIssueContext) {
      lines.push(
        '## Issue Context',
        'This video attempts to reproduce a reported bug on the main branch.',
        'Your review MUST evaluate whether the reported bug is visible and reproducible.',
        '',
        prContext,
        '',
        '## Review Instructions',
        '1. Does the video demonstrate the reported bug occurring?',
        '2. Is the bug clearly visible and reproducible from the steps shown?',
        '3. Are there any other issues visible during the reproduction attempt?',
        '',
        '## CRITICAL: Honesty Requirements',
        '- If the video only shows login, idle canvas, or trivial menu interactions WITHOUT actually performing the reproduction steps, say "INCONCLUSIVE — reproduction steps were not performed".',
        '- Do NOT claim a bug is "confirmed" unless you can clearly see the bug behavior described in the issue.',
        '- Do NOT hallucinate findings. If the video does not show meaningful interaction, say so clearly.',
        '- Rate confidence as "Low" if the video does not actually demonstrate the bug scenario.',
        ''
      )
    } else {
      lines.push(
        '## PR Context',
        'The video is a QA session testing a specific pull request.',
        'Your review MUST evaluate whether the PR achieves its stated purpose.',
        '',
        prContext,
        '',
        '## Review Instructions',
        "1. Does the video demonstrate the PR's intended behavior working correctly?",
        '2. Are there regressions or side effects caused by the PR changes?',
        '3. Does the observed behavior match what the PR claims to implement/fix?',
        ''
      )
    }
  }

  lines.push(
    `Review this QA session video for platform "${platformName}".`,
    `Source video: ${toProjectRelativePath(videoPath)}.`,
    'The video shows the full test session — analyze it chronologically.',
    'Focus on UI regressions, broken states, visual glitches, unreadable text, missing labels/i18n, and clear workflow failures.',
    'Note: Brief black frames during page transitions are NORMAL and should NOT be reported as issues.',
    'Report only concrete, visible problems and avoid speculation.',
    'If confidence is low, mark it explicitly.',
    '',
    'Return markdown with these sections exactly:',
    '## Summary',
    isIssueContext
      ? '(Explain what bug was reported and whether the video confirms it is reproducible)'
      : prContext
        ? '(Explain what the PR intended and whether the video confirms it works)'
        : '',
    '## Confirmed Issues',
    'For each confirmed issue, use this exact format (one block per issue):',
    '',
    '### [Short issue title]',
    '`HIGH` `01:03` `Confidence: High`',
    '',
    '[Description of the issue — what went wrong and what was expected]',
    '',
    '**Evidence:** [What you observed in the video at the given timestamp]',
    '',
    '**Suggested Fix:** [Actionable recommendation]',
    '',
    '---',
    '',
    'The first line after the heading MUST be exactly three backtick-wrapped labels:',
    '`SEVERITY` `TIMESTAMP` `Confidence: LEVEL`',
    'Do NOT use a table for issues — use the block format above.',
    '## Possible Issues (Needs Human Verification)',
    '## Overall Risk'
  )

  return lines.filter(Boolean).join('\n')
}

const MAX_VIDEO_BYTES = 100 * 1024 * 1024

async function readVideoFile(videoPath: string): Promise<Buffer> {
  const fileStat = await stat(videoPath)
  if (fileStat.size > MAX_VIDEO_BYTES) {
    throw new Error(
      `Video ${basename(videoPath)} is ${formatBytes(fileStat.size)}, exceeds ${formatBytes(MAX_VIDEO_BYTES)} limit`
    )
  }
  return readFile(videoPath)
}

async function requestGeminiReview(options: {
  apiKey: string
  model: string
  platformName: string
  videoPath: string
  beforeVideoPath: string
  timeoutMs: number
  prContext: string
}): Promise<string> {
  const genAI = new GoogleGenerativeAI(options.apiKey)
  const model = genAI.getGenerativeModel({ model: options.model })

  const isComparative = options.beforeVideoPath.length > 0
  const prompt = buildReviewPrompt({
    platformName: options.platformName,
    videoPath: options.videoPath,
    prContext: options.prContext,
    isComparative
  })

  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [{ text: prompt }]

  if (isComparative) {
    const beforeBuffer = await readVideoFile(options.beforeVideoPath)
    parts.push(
      { text: 'Video 1 — BEFORE (main branch):' },
      {
        inlineData: {
          mimeType: getMimeType(options.beforeVideoPath),
          data: beforeBuffer.toString('base64')
        }
      }
    )
  }

  const afterBuffer = await readVideoFile(options.videoPath)
  if (isComparative) {
    parts.push({ text: 'Video 2 — AFTER (PR branch):' })
  }
  parts.push({
    inlineData: {
      mimeType: getMimeType(options.videoPath),
      data: afterBuffer.toString('base64')
    }
  })

  const result = await model.generateContent(parts, {
    timeout: options.timeoutMs
  })
  const response = result.response
  const text = response.text()

  if (!text || text.trim().length === 0) {
    throw new Error('Gemini API returned no output text')
  }

  return text.trim()
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function buildReportMarkdown(input: {
  platformName: string
  model: string
  videoPath: string
  videoSizeBytes: number
  beforeVideoPath?: string
  beforeVideoSizeBytes?: number
  reviewText: string
  targetUrl?: string
}): string {
  const headerLines = [
    `# ${input.platformName} QA Video Report`,
    '',
    `- Generated at: ${new Date().toISOString()}`,
    `- Model: \`${input.model}\``
  ]

  if (input.targetUrl) {
    headerLines.push(`- Target: ${input.targetUrl}`)
  }

  if (input.beforeVideoPath) {
    headerLines.push(
      `- Before video: \`${toProjectRelativePath(input.beforeVideoPath)}\` (${formatBytes(input.beforeVideoSizeBytes ?? 0)})`,
      `- After video: \`${toProjectRelativePath(input.videoPath)}\` (${formatBytes(input.videoSizeBytes)})`,
      '- Mode: **Comparative (before/after)**'
    )
  } else {
    headerLines.push(
      `- Source video: \`${toProjectRelativePath(input.videoPath)}\``,
      `- Video size: ${formatBytes(input.videoSizeBytes)}`
    )
  }

  headerLines.push('', '## AI Review', '')
  return `${headerLines.join('\n')}${input.reviewText.trim()}\n`
}

async function reviewVideo(
  video: VideoCandidate,
  options: CliOptions,
  apiKey: string
): Promise<void> {
  let prContext = ''
  if (options.prContext) {
    try {
      prContext = await readFile(options.prContext, 'utf-8')
      process.stdout.write(
        `[${video.platformName}] Loaded PR context from ${options.prContext}\n`
      )
    } catch {
      process.stdout.write(
        `[${video.platformName}] Warning: Could not read PR context file ${options.prContext}\n`
      )
    }
  }

  const beforeVideoPath = options.beforeVideo
    ? resolve(options.beforeVideo)
    : ''

  if (beforeVideoPath) {
    const beforeStat = await stat(beforeVideoPath)
    process.stdout.write(
      `[${video.platformName}] Before video: ${toProjectRelativePath(beforeVideoPath)} (${formatBytes(beforeStat.size)})\n`
    )
  }

  process.stdout.write(
    `[${video.platformName}] Sending ${beforeVideoPath ? '2 videos (comparative)' : 'video'} to ${options.model}\n`
  )

  const reviewText = await requestGeminiReview({
    apiKey,
    model: options.model,
    platformName: video.platformName,
    videoPath: video.videoPath,
    beforeVideoPath,
    timeoutMs: options.requestTimeoutMs,
    prContext
  })

  const videoStat = await stat(video.videoPath)
  const passSegment = options.passLabel ? `-${options.passLabel}` : ''
  const outputPath = resolve(
    options.outputDir,
    `${video.platformName}${passSegment}-qa-video-report.md`
  )

  const reportInput: Parameters<typeof buildReportMarkdown>[0] = {
    platformName: video.platformName,
    model: options.model,
    videoPath: video.videoPath,
    videoSizeBytes: videoStat.size,
    reviewText,
    targetUrl: options.targetUrl || undefined
  }

  if (beforeVideoPath) {
    const beforeStat = await stat(beforeVideoPath)
    reportInput.beforeVideoPath = beforeVideoPath
    reportInput.beforeVideoSizeBytes = beforeStat.size
  }

  const reportMarkdown = buildReportMarkdown(reportInput)

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, reportMarkdown, 'utf-8')

  process.stdout.write(
    `[${video.platformName}] Wrote ${toProjectRelativePath(outputPath)}\n`
  )
}

function isExecutedAsScript(metaUrl: string): boolean {
  const modulePath = fileURLToPath(metaUrl)
  const scriptPath = process.argv[1] ? resolve(process.argv[1]) : ''
  return modulePath === scriptPath
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2))
  const candidates = await collectVideoCandidates(options.artifactsDir)

  if (candidates.length === 0) {
    process.stdout.write(
      `No qa-session.mp4 files found under ${toProjectRelativePath(resolve(options.artifactsDir))}\n`
    )
    return
  }

  const selectedVideo = selectVideoCandidateByFile(candidates, {
    artifactsDir: options.artifactsDir,
    videoFile: options.videoFile
  })

  process.stdout.write(
    `Selected ${selectedVideo.platformName}: ${toProjectRelativePath(selectedVideo.videoPath)}\n`
  )

  if (options.dryRun) {
    process.stdout.write('\nDry run mode enabled, no API calls were made.\n')
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required unless --dry-run is set')
  }

  await reviewVideo(selectedVideo, options, apiKey)
}

if (isExecutedAsScript(import.meta.url)) {
  void main().catch((error: unknown) => {
    const message = errorToString(error)
    process.stderr.write(`qa-video-review failed: ${message}\n`)
    process.exit(1)
  })
}
