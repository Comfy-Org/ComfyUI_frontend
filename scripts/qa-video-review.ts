#!/usr/bin/env tsx
import { spawn } from 'node:child_process'
import {
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile
} from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { globSync } from 'glob'

interface CliOptions {
  artifactsDir: string
  videoFile: string
  outputDir: string
  model: string
  minIntervalSeconds: number
  maxFrames: number
  requestTimeoutMs: number
  dryRun: boolean
  keepFrames: boolean
}

interface VideoCandidate {
  platformName: string
  videoPath: string
  mtimeMs: number
}

interface ExtractedFrame {
  index: number
  timestampSeconds: number
  filePath: string
  dataUrl: string
}

type ResponseInputContent =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string }

interface ResponseInputMessage {
  role: 'system' | 'user'
  content: ResponseInputContent[]
}

interface ResponsesCreatePayload {
  model: string
  input: ResponseInputMessage[]
  max_output_tokens: number
}

interface OpenAIReviewRequest {
  apiKey: string
  baseUrl: string
  model: string
  platformName: string
  videoPath: string
  frames: ExtractedFrame[]
  samplingIntervalSeconds: number
  timeoutMs: number
}

const DEFAULT_OPTIONS: CliOptions = {
  artifactsDir: './tmp/qa-artifacts',
  videoFile: '',
  outputDir: './tmp',
  model: 'gpt-4o',
  minIntervalSeconds: 5,
  maxFrames: 36,
  requestTimeoutMs: 300_000,
  dryRun: false,
  keepFrames: false
}

const USAGE = `Usage:
  pnpm exec tsx scripts/qa-video-review.ts [options]

Options:
  --artifacts-dir <path>        Artifacts root directory
                                 (default: ./tmp/qa-artifacts)
  --video-file <name-or-path>   Video file to analyze (required)
                                 (supports basename or relative/absolute path)
  --output-dir <path>           Output directory for markdown reports
                                 (default: ./tmp)
  --model <name>                OpenAI model
                                 (default: gpt-4o)
  --min-interval-seconds <n>    Minimum frame sampling interval in seconds
                                 (default: 5)
  --max-frames <n>              Max frames analyzed per video
                                 (default: 36)
  --request-timeout-ms <n>      Request timeout in milliseconds
                                 (default: 300000)
  --dry-run                     Discover videos and output targets only
  --keep-frames                 Keep extracted frames in ./tmp for inspection
  --help                        Show this help text

Environment:
  OPENAI_API_KEY                Required unless --dry-run
  OPENAI_BASE_URL               Optional override for API base URL
`

function parsePositiveNumber(rawValue: string, flagName: string): number {
  const parsedValue = Number(rawValue)
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error(`Invalid value for ${flagName}: "${rawValue}"`)
  }
  return parsedValue
}

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

    if (argument === '--min-interval-seconds') {
      options.minIntervalSeconds = parsePositiveNumber(
        requireValue(argument),
        argument
      )
      continue
    }

    if (argument === '--max-frames') {
      options.maxFrames = parsePositiveInteger(requireValue(argument), argument)
      continue
    }

    if (argument === '--request-timeout-ms') {
      options.requestTimeoutMs = parsePositiveInteger(
        requireValue(argument),
        argument
      )
      continue
    }

    if (argument === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (argument === '--keep-frames') {
      options.keepFrames = true
      continue
    }

    throw new Error(`Unknown argument: ${argument}`)
  }

  return options
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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

async function runCommand(command: string, args: string[]): Promise<string> {
  return await new Promise<string>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString()
    })

    child.on('error', (error) => {
      rejectPromise(error)
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise(stdout)
        return
      }

      const details = stderr.trim() || stdout.trim() || 'unknown failure'
      rejectPromise(
        new Error(
          `${command} ${args.join(' ')} failed with code ${String(code)}: ${details}`
        )
      )
    })
  })
}

async function ensureBinariesAvailable(): Promise<void> {
  await runCommand('ffmpeg', ['-version'])
  await runCommand('ffprobe', ['-version'])
}

async function getVideoDurationSeconds(
  videoPath: string
): Promise<number | null> {
  try {
    const stdout = await runCommand('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      videoPath
    ])
    const durationSeconds = Number.parseFloat(stdout.trim())
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      return null
    }
    return durationSeconds
  } catch {
    return null
  }
}

function computeSamplingIntervalSeconds(
  durationSeconds: number | null,
  minIntervalSeconds: number,
  maxFrames: number
): number {
  if (durationSeconds === null) {
    return minIntervalSeconds
  }

  const fullCoverageInterval = durationSeconds / maxFrames
  return Math.max(minIntervalSeconds, fullCoverageInterval)
}

async function collectVideoCandidates(
  artifactsDir: string
): Promise<VideoCandidate[]> {
  const absoluteArtifactsDir = resolve(artifactsDir)
  const videoPaths = globSync('**/qa-session.mp4', {
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

async function extractFramesFromVideo(
  videoPath: string,
  stagingDir: string,
  minIntervalSeconds: number,
  maxFrames: number
): Promise<{ frames: ExtractedFrame[]; samplingIntervalSeconds: number }> {
  const durationSeconds = await getVideoDurationSeconds(videoPath)
  const samplingIntervalSeconds = computeSamplingIntervalSeconds(
    durationSeconds,
    minIntervalSeconds,
    maxFrames
  )
  const outputPattern = join(stagingDir, 'frame-%03d.jpg')

  await runCommand('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    videoPath,
    '-vf',
    `fps=1/${samplingIntervalSeconds},scale=1024:-2:force_original_aspect_ratio=decrease`,
    '-frames:v',
    String(maxFrames),
    outputPattern
  ])

  const frameNames = (await readdir(stagingDir))
    .filter((name) => name.startsWith('frame-') && name.endsWith('.jpg'))
    .sort()

  if (frameNames.length === 0) {
    throw new Error(`No frames were extracted from ${videoPath}`)
  }

  const frames = await Promise.all(
    frameNames.map(async (frameName, index) => {
      const framePath = join(stagingDir, frameName)
      const buffer = await readFile(framePath)
      return {
        index: index + 1,
        timestampSeconds: Number((index * samplingIntervalSeconds).toFixed(2)),
        filePath: framePath,
        dataUrl: `data:image/jpeg;base64,${buffer.toString('base64')}`
      }
    })
  )

  return { frames, samplingIntervalSeconds }
}

function buildReviewMessages(
  request: OpenAIReviewRequest
): ResponseInputMessage[] {
  const systemPrompt = [
    'You are a senior QA engineer reviewing a UI test session.',
    'Report only concrete, visible problems and avoid speculation.',
    'If confidence is low, mark it explicitly.'
  ].join(' ')

  const introPrompt = [
    `Review sampled frames from a QA session for platform "${request.platformName}".`,
    `Source video: ${toProjectRelativePath(request.videoPath)}.`,
    `Frames are presented in chronological order at ~${request.samplingIntervalSeconds.toFixed(2)}s intervals.`,
    'Focus on UI regressions, broken states, visual glitches, unreadable text, missing labels/i18n, and clear workflow failures.',
    'Return markdown with these sections exactly:',
    '## Summary',
    '## Confirmed Issues',
    '## Possible Issues (Needs Human Verification)',
    '## Overall Risk',
    'Under Confirmed Issues include a markdown table with columns:',
    'Severity | Timestamp (s) | Issue | Evidence | Confidence | Suggested Fix'
  ].join('\n')

  const userContent: ResponseInputContent[] = [
    { type: 'input_text', text: introPrompt }
  ]

  for (const frame of request.frames) {
    userContent.push({
      type: 'input_text',
      text: `Frame ${frame.index} at approximately ${frame.timestampSeconds}s`
    })
    userContent.push({
      type: 'input_image',
      image_url: frame.dataUrl
    })
  }

  return [
    {
      role: 'system',
      content: [{ type: 'input_text', text: systemPrompt }]
    },
    {
      role: 'user',
      content: userContent
    }
  ]
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

function extractApiErrorMessage(responseBody: unknown): string {
  if (!isRecord(responseBody)) {
    return 'Unknown API error'
  }

  const errorValue = responseBody.error
  if (!isRecord(errorValue)) {
    return 'Unknown API error'
  }

  const messageValue = errorValue.message
  if (typeof messageValue !== 'string' || messageValue.length === 0) {
    return 'Unknown API error'
  }

  return messageValue
}

export function extractOutputText(responseBody: unknown): string | null {
  if (!isRecord(responseBody)) {
    return null
  }

  const topLevelOutputText = responseBody.output_text
  if (
    typeof topLevelOutputText === 'string' &&
    topLevelOutputText.trim().length > 0
  ) {
    return topLevelOutputText.trim()
  }

  const outputValue = responseBody.output
  if (!Array.isArray(outputValue)) {
    return null
  }

  const collectedParts: string[] = []
  for (const outputItem of outputValue) {
    if (!isRecord(outputItem)) {
      continue
    }

    const contentValue = outputItem.content
    if (!Array.isArray(contentValue)) {
      continue
    }

    for (const contentItem of contentValue) {
      if (!isRecord(contentItem)) {
        continue
      }

      if (contentItem.type !== 'output_text') {
        continue
      }

      const textValue = contentItem.text
      if (typeof textValue === 'string' && textValue.trim().length > 0) {
        collectedParts.push(textValue.trim())
      }
    }
  }

  if (collectedParts.length === 0) {
    return null
  }

  return collectedParts.join('\n\n')
}

async function requestOpenAIReview(
  request: OpenAIReviewRequest
): Promise<string> {
  const payload: ResponsesCreatePayload = {
    model: request.model,
    input: buildReviewMessages(request),
    max_output_tokens: 3_000
  }

  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), request.timeoutMs)

  try {
    const response = await fetch(
      `${normalizeBaseUrl(request.baseUrl)}/responses`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${request.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      }
    )

    const rawResponse = await response.text()
    let responseBody: unknown
    try {
      responseBody = JSON.parse(rawResponse)
    } catch {
      throw new Error(
        `OpenAI API returned a non-JSON response: ${rawResponse.slice(0, 400)}`
      )
    }

    if (!response.ok) {
      throw new Error(
        `OpenAI API request failed (${response.status}): ${extractApiErrorMessage(responseBody)}`
      )
    }

    const reviewText = extractOutputText(responseBody)
    if (!reviewText) {
      throw new Error('OpenAI API returned no output text')
    }

    return reviewText
  } finally {
    clearTimeout(timeoutHandle)
  }
}

function buildReportMarkdown(input: {
  platformName: string
  model: string
  videoPath: string
  frames: ExtractedFrame[]
  samplingIntervalSeconds: number
  reviewText: string
}): string {
  const header = [
    `# ${input.platformName} QA Video Report`,
    '',
    `- Generated at: ${new Date().toISOString()}`,
    `- Model: \`${input.model}\``,
    `- Source video: \`${toProjectRelativePath(input.videoPath)}\``,
    `- Frames analyzed: ${input.frames.length}`,
    `- Sampling interval: ${input.samplingIntervalSeconds.toFixed(2)}s`,
    '',
    '## AI Review',
    ''
  ].join('\n')

  return `${header}${input.reviewText.trim()}\n`
}

async function reviewVideo(
  video: VideoCandidate,
  options: CliOptions,
  apiKey: string,
  baseUrl: string
): Promise<void> {
  const stagingRoot = resolve('./tmp')
  await mkdir(stagingRoot, { recursive: true })
  const stagingDir = await mkdtemp(join(stagingRoot, 'qa-video-review-'))

  try {
    process.stdout.write(
      `[${video.platformName}] Extracting frames from ${toProjectRelativePath(video.videoPath)}\n`
    )

    const { frames, samplingIntervalSeconds } = await extractFramesFromVideo(
      video.videoPath,
      stagingDir,
      options.minIntervalSeconds,
      options.maxFrames
    )

    process.stdout.write(
      `[${video.platformName}] Sending ${frames.length} frame(s) to ${options.model}\n`
    )

    const reviewText = await requestOpenAIReview({
      apiKey,
      baseUrl,
      model: options.model,
      platformName: video.platformName,
      videoPath: video.videoPath,
      frames,
      samplingIntervalSeconds,
      timeoutMs: options.requestTimeoutMs
    })

    const outputPath = resolve(
      options.outputDir,
      `${video.platformName}-qa-video-report.md`
    )
    const reportMarkdown = buildReportMarkdown({
      platformName: video.platformName,
      model: options.model,
      videoPath: video.videoPath,
      frames,
      samplingIntervalSeconds,
      reviewText
    })

    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, reportMarkdown, 'utf-8')

    process.stdout.write(
      `[${video.platformName}] Wrote ${toProjectRelativePath(outputPath)}\n`
    )

    if (options.keepFrames) {
      const stagedFrames = (await readdir(stagingDir)).filter((name) =>
        name.endsWith('.jpg')
      ).length
      process.stdout.write(
        `[${video.platformName}] Kept ${stagedFrames} frame(s) in ${toProjectRelativePath(stagingDir)}\n`
      )
      return
    }
  } finally {
    if (!options.keepFrames) {
      await rm(stagingDir, { recursive: true, force: true })
    }
  }
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

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required unless --dry-run is set')
  }

  await ensureBinariesAvailable()

  const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
  await reviewVideo(selectedVideo, options, apiKey, baseUrl)
}

if (isExecutedAsScript(import.meta.url)) {
  void main().catch((error: unknown) => {
    const message = errorToString(error)
    process.stderr.write(`qa-video-review failed: ${message}\n`)
    process.exit(1)
  })
}
