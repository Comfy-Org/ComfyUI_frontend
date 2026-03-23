#!/usr/bin/env tsx
/**
 * QA PR Analysis Script
 *
 * Deeply analyzes a PR using Gemini Pro to generate targeted QA guides
 * for before/after recording sessions. Fetches PR thread, extracts media,
 * and produces structured test plans.
 *
 * Usage:
 *   pnpm exec tsx scripts/qa-analyze-pr.ts \
 *     --pr-number 10270 \
 *     --repo owner/repo \
 *     --output-dir qa-guides/ \
 *     [--model gemini-2.5-pro]
 *
 * Env: GEMINI_API_KEY (required)
 */

import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { GoogleGenerativeAI } from '@google/generative-ai'

// ── Types ──

interface QaGuideStep {
  action: string
  description: string
  expected_before?: string
  expected_after?: string
}

interface QaGuide {
  summary: string
  test_focus: string
  prerequisites: string[]
  steps: QaGuideStep[]
  visual_checks: string[]
}

interface PrThread {
  title: string
  body: string
  labels: string[]
  issueComments: string[]
  reviewComments: string[]
  reviews: string[]
  diff: string
}

type TargetType = 'pr' | 'issue'

interface Options {
  prNumber: string
  repo: string
  outputDir: string
  model: string
  apiKey: string
  mediaBudgetBytes: number
  maxVideoBytes: number
  type: TargetType
}

// ── CLI parsing ──

function parseArgs(): Options {
  const args = process.argv.slice(2)
  const opts: Partial<Options> = {
    model: 'gemini-2.5-pro',
    apiKey: process.env.GEMINI_API_KEY || '',
    mediaBudgetBytes: 20 * 1024 * 1024,
    maxVideoBytes: 10 * 1024 * 1024,
    type: 'pr'
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--pr-number':
        opts.prNumber = args[++i]
        break
      case '--repo':
        opts.repo = args[++i]
        break
      case '--output-dir':
        opts.outputDir = args[++i]
        break
      case '--model':
        opts.model = args[++i]
        break
      case '--type':
        opts.type = args[++i] as TargetType
        break
      case '--help':
        console.warn(
          'Usage: qa-analyze-pr.ts --pr-number <num> --repo <owner/repo> --output-dir <path> [--model <model>] [--type pr|issue]'
        )
        process.exit(0)
    }
  }

  if (!opts.prNumber || !opts.repo || !opts.outputDir) {
    console.error(
      'Required: --pr-number <num> --repo <owner/repo> --output-dir <path>'
    )
    process.exit(1)
  }

  if (!opts.apiKey) {
    console.error('GEMINI_API_KEY environment variable is required')
    process.exit(1)
  }

  return opts as Options
}

// ── PR thread fetching ──

function ghExec(cmd: string): string {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      timeout: 30_000,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim()
  } catch (err) {
    console.warn(`gh command failed: ${cmd}`)
    console.warn((err as Error).message)
    return ''
  }
}

function fetchPrThread(prNumber: string, repo: string): PrThread {
  console.warn('Fetching PR thread...')

  const prView = ghExec(
    `gh pr view ${prNumber} --repo ${repo} --json title,body,labels`
  )
  const prData = prView
    ? JSON.parse(prView)
    : { title: '', body: '', labels: [] }

  const issueCommentsRaw = ghExec(
    `gh api repos/${repo}/issues/${prNumber}/comments --paginate`
  )
  const issueComments: string[] = issueCommentsRaw
    ? JSON.parse(issueCommentsRaw).map((c: { body: string }) => c.body)
    : []

  const reviewCommentsRaw = ghExec(
    `gh api repos/${repo}/pulls/${prNumber}/comments --paginate`
  )
  const reviewComments: string[] = reviewCommentsRaw
    ? JSON.parse(reviewCommentsRaw).map((c: { body: string }) => c.body)
    : []

  const reviewsRaw = ghExec(
    `gh api repos/${repo}/pulls/${prNumber}/reviews --paginate`
  )
  const reviews: string[] = reviewsRaw
    ? JSON.parse(reviewsRaw)
        .filter((r: { body: string }) => r.body)
        .map((r: { body: string }) => r.body)
    : []

  const diff = ghExec(`gh pr diff ${prNumber} --repo ${repo}`)

  console.warn(
    `PR #${prNumber}: "${prData.title}" | ` +
      `${issueComments.length} issue comments, ` +
      `${reviewComments.length} review comments, ` +
      `${reviews.length} reviews, ` +
      `diff: ${diff.length} chars`
  )

  return {
    title: prData.title || '',
    body: prData.body || '',
    labels: (prData.labels || []).map((l: { name: string }) => l.name),
    issueComments,
    reviewComments,
    reviews,
    diff
  }
}

interface IssueThread {
  title: string
  body: string
  labels: string[]
  comments: string[]
}

function fetchIssueThread(issueNumber: string, repo: string): IssueThread {
  console.warn('Fetching issue thread...')

  const issueView = ghExec(
    `gh issue view ${issueNumber} --repo ${repo} --json title,body,labels`
  )
  const issueData = issueView
    ? JSON.parse(issueView)
    : { title: '', body: '', labels: [] }

  const commentsRaw = ghExec(
    `gh api repos/${repo}/issues/${issueNumber}/comments --paginate`
  )
  const comments: string[] = commentsRaw
    ? JSON.parse(commentsRaw).map((c: { body: string }) => c.body)
    : []

  console.warn(
    `Issue #${issueNumber}: "${issueData.title}" | ` +
      `${comments.length} comments`
  )

  return {
    title: issueData.title || '',
    body: issueData.body || '',
    labels: (issueData.labels || []).map((l: { name: string }) => l.name),
    comments
  }
}

// ── Media extraction ──

const MEDIA_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|mp4|webm|mov)$/i

const MEDIA_URL_PATTERNS = [
  // Markdown images: ![alt](url)
  /!\[[^\]]*\]\(([^)]+)\)/g,
  // GitHub user-attachments
  /https:\/\/github\.com\/user-attachments\/assets\/[a-f0-9-]+/g,
  // Private user images
  /https:\/\/private-user-images\.githubusercontent\.com\/[^\s)"]+/g,
  // Raw URLs with media extensions (standalone or in text)
  /(?<!="|=')https?:\/\/[^\s)<>"]+\.(?:png|jpg|jpeg|gif|webp|mp4|webm|mov)(?:\?[^\s)<>"]*)?/gi
]

export function extractMediaUrls(text: string): string[] {
  if (!text) return []

  const urls = new Set<string>()

  for (const pattern of MEDIA_URL_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      // For markdown images, the URL is in capture group 1
      const url = match[1] || match[0]
      // Clean trailing markdown/html artifacts
      const cleaned = url.replace(/[)>"'\s]+$/, '')
      if (cleaned.startsWith('http')) {
        urls.add(cleaned)
      }
    }
  }

  return [...urls]
}

// ── Media downloading ──

const ALLOWED_MEDIA_DOMAINS = [
  'github.com',
  'raw.githubusercontent.com',
  'user-images.githubusercontent.com',
  'private-user-images.githubusercontent.com',
  'objects.githubusercontent.com',
  'github.githubassets.com'
]

function isAllowedMediaDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname
    return ALLOWED_MEDIA_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    )
  } catch {
    return false
  }
}

async function downloadMedia(
  urls: string[],
  outputDir: string,
  budgetBytes: number,
  maxVideoBytes: number
): Promise<Array<{ path: string; mimeType: string }>> {
  const downloaded: Array<{ path: string; mimeType: string }> = []
  let totalBytes = 0

  const mediaDir = resolve(outputDir, 'media')
  mkdirSync(mediaDir, { recursive: true })

  for (const url of urls) {
    if (totalBytes >= budgetBytes) {
      console.warn(
        `Media budget exhausted (${totalBytes} bytes), skipping rest`
      )
      break
    }

    if (!isAllowedMediaDomain(url)) {
      console.warn(`Skipping non-GitHub URL: ${url.slice(0, 80)}`)
      continue
    }

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
        headers: { Accept: 'image/*,video/*' },
        redirect: 'follow'
      })

      if (!response.ok) {
        console.warn(`Failed to download ${url}: ${response.status}`)
        continue
      }

      const contentLength = response.headers.get('content-length')
      if (contentLength) {
        const declaredSize = Number.parseInt(contentLength, 10)
        if (declaredSize > budgetBytes - totalBytes) {
          console.warn(
            `Content-Length ${declaredSize} would exceed budget, skipping ${url}`
          )
          continue
        }
      }

      const contentType = response.headers.get('content-type') || ''
      const buffer = Buffer.from(await response.arrayBuffer())

      // Skip oversized videos
      const isVideo =
        contentType.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(url)
      if (isVideo && buffer.length > maxVideoBytes) {
        console.warn(
          `Skipping large video ${url} (${(buffer.length / 1024 / 1024).toFixed(1)}MB > ${(maxVideoBytes / 1024 / 1024).toFixed(0)}MB cap)`
        )
        continue
      }

      if (totalBytes + buffer.length > budgetBytes) {
        console.warn(`Would exceed budget, skipping ${url}`)
        continue
      }

      const ext = guessExtension(url, contentType)
      const filename = `media-${downloaded.length}${ext}`
      const filepath = resolve(mediaDir, filename)
      writeFileSync(filepath, buffer)
      totalBytes += buffer.length

      const mimeType = contentType.split(';')[0].trim() || guessMimeType(ext)

      downloaded.push({ path: filepath, mimeType })
      console.warn(
        `Downloaded: ${url.slice(0, 80)}... (${(buffer.length / 1024).toFixed(0)}KB)`
      )
    } catch (err) {
      console.warn(`Failed to download ${url}: ${(err as Error).message}`)
    }
  }

  console.warn(
    `Downloaded ${downloaded.length}/${urls.length} media files ` +
      `(${(totalBytes / 1024 / 1024).toFixed(1)}MB)`
  )
  return downloaded
}

function guessExtension(url: string, contentType: string): string {
  const urlMatch = url.match(MEDIA_EXTENSIONS)
  if (urlMatch) return urlMatch[0].toLowerCase()

  const typeMap: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/webm': '.webm'
  }
  return typeMap[contentType.split(';')[0]] || '.bin'
}

function guessMimeType(ext: string): string {
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime'
  }
  return map[ext] || 'application/octet-stream'
}

// ── Gemini analysis ──

function buildIssueAnalysisPrompt(issue: IssueThread): string {
  const allText = [
    `# Issue: ${issue.title}`,
    '',
    '## Description',
    issue.body,
    '',
    issue.comments.length > 0
      ? `## Comments\n${issue.comments.join('\n\n---\n\n')}`
      : ''
  ]
    .filter(Boolean)
    .join('\n')

  return `You are a senior QA engineer analyzing a bug report for ComfyUI frontend (a Vue 3 + TypeScript web application for AI image generation workflows).

Your task: Generate a single targeted QA reproduction guide to verify this bug on the current main branch.

${allText}

## Available test actions
Each step must use one of these actions:
- "openMenu" — clicks the Comfy hamburger menu (top-left C logo)
- "hoverMenuItem" — hovers a top-level menu item to open submenu (label required)
- "clickMenuItem" — clicks an item in the visible submenu (label required)
- "fillDialog" — fills dialog input and presses Enter (text required)
- "pressKey" — presses a keyboard key (key required)
- "click" — clicks an element by visible text (text required)
- "wait" — waits briefly (ms required, max 3000)
- "screenshot" — takes a screenshot (name required)

## Output format
Return a JSON object with exactly one key: "reproduce", containing:
{
  "summary": "One sentence: what bug this issue reports",
  "test_focus": "Specific behavior to reproduce",
  "prerequisites": ["e.g. Load default workflow"],
  "steps": [
    {
      "action": "openMenu",
      "description": "Open the main menu to trigger the reported bug",
      "expected_before": "What should happen if the bug is present"
    }
  ],
  "visual_checks": ["Specific visual evidence of the bug to look for"]
}

## Rules
- REPRODUCE guide: 3-6 steps, under 30 seconds. Follow the issue's reproduction steps closely.
- Focus on triggering and demonstrating the SPECIFIC bug reported.
- Use information from the issue description and comments to understand the bug.
- Include at least one screenshot step to capture the bug state.
- Do NOT include login steps.
- Menu pattern: openMenu -> hoverMenuItem -> clickMenuItem or screenshot.
- Output ONLY valid JSON, no markdown fences or explanation.`
}

function buildAnalysisPrompt(thread: PrThread): string {
  const allText = [
    `# PR: ${thread.title}`,
    '',
    '## Description',
    thread.body,
    '',
    thread.issueComments.length > 0
      ? `## Issue Comments\n${thread.issueComments.join('\n\n---\n\n')}`
      : '',
    thread.reviewComments.length > 0
      ? `## Review Comments\n${thread.reviewComments.join('\n\n---\n\n')}`
      : '',
    thread.reviews.length > 0
      ? `## Reviews\n${thread.reviews.join('\n\n---\n\n')}`
      : '',
    '',
    '## Diff (truncated)',
    '```',
    thread.diff.slice(0, 8000),
    '```'
  ]
    .filter(Boolean)
    .join('\n')

  return `You are a senior QA engineer analyzing a pull request for ComfyUI frontend (a Vue 3 + TypeScript web application for AI image generation workflows).

Your task: Generate TWO targeted QA test guides — one for BEFORE the PR (main branch) and one for AFTER (PR branch).

${allText}

## Available test actions
Each step must use one of these actions:
- "openMenu" — clicks the Comfy hamburger menu (top-left C logo)
- "hoverMenuItem" — hovers a top-level menu item to open submenu (label required)
- "clickMenuItem" — clicks an item in the visible submenu (label required)
- "fillDialog" — fills dialog input and presses Enter (text required)
- "pressKey" — presses a keyboard key (key required)
- "click" — clicks an element by visible text (text required)
- "wait" — waits briefly (ms required, max 3000)
- "screenshot" — takes a screenshot (name required)

## Output format
Return a JSON object with exactly two keys: "before" and "after", each containing:
{
  "summary": "One sentence: what this PR changes",
  "test_focus": "Specific behaviors to verify in this recording",
  "prerequisites": ["e.g. Load default workflow"],
  "steps": [
    {
      "action": "openMenu",
      "description": "Open the main menu to check file options",
      "expected_before": "Old behavior description (before key only)",
      "expected_after": "New behavior description (after key only)"
    }
  ],
  "visual_checks": ["Specific visual elements to look for"]
}

## Rules
- BEFORE guide: 2-4 steps, under 15 seconds. Show OLD/missing behavior.
- AFTER guide: 3-6 steps, under 30 seconds. Prove the fix/feature works.
- Focus on the SPECIFIC behavior changed by this PR, not generic testing.
- Use information from PR description, screenshots, and comments to understand intended behavior.
- Include at least one screenshot step in each guide.
- Do NOT include login steps.
- Menu pattern: openMenu -> hoverMenuItem -> clickMenuItem or screenshot.
- Output ONLY valid JSON, no markdown fences or explanation.`
}

async function analyzeWithGemini(
  thread: PrThread,
  media: Array<{ path: string; mimeType: string }>,
  model: string,
  apiKey: string
): Promise<{ before: QaGuide; after: QaGuide }> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const geminiModel = genAI.getGenerativeModel({ model })

  const prompt = buildAnalysisPrompt(thread)

  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [{ text: prompt }]

  // Add media as inline data
  for (const item of media) {
    try {
      const buffer = readFileSync(item.path)
      parts.push({
        inlineData: {
          mimeType: item.mimeType,
          data: buffer.toString('base64')
        }
      })
    } catch (err) {
      console.warn(
        `Failed to read media ${item.path}: ${(err as Error).message}`
      )
    }
  }

  console.warn(
    `Sending to ${model}: ${prompt.length} chars text, ${media.length} media files`
  )

  const result = await geminiModel.generateContent({
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json'
    }
  })

  let text = result.response.text()
  // Strip markdown fences if present
  text = text
    .replace(/^```(?:json)?\n?/gm, '')
    .replace(/```$/gm, '')
    .trim()

  console.warn('Gemini response received')
  console.warn('Raw response (first 500 chars):', text.slice(0, 500))
  const parsed = JSON.parse(text)

  // Handle different response shapes from Gemini
  let before: QaGuide
  let after: QaGuide

  if (Array.isArray(parsed) && parsed.length >= 2) {
    // Array format: [before, after]
    before = parsed[0]
    after = parsed[1]
  } else if (parsed.before && parsed.after) {
    // Object format: { before, after }
    before = parsed.before
    after = parsed.after
  } else {
    // Try nested wrapper keys
    const inner = parsed.qa_guide ?? parsed.guides ?? parsed
    if (inner.before && inner.after) {
      before = inner.before
      after = inner.after
    } else {
      console.warn(
        'Full response:',
        JSON.stringify(parsed, null, 2).slice(0, 2000)
      )
      throw new Error(
        `Unexpected response shape. Got keys: ${Object.keys(parsed).join(', ')}`
      )
    }
  }

  return { before, after }
}

async function analyzeIssueWithGemini(
  issue: IssueThread,
  media: Array<{ path: string; mimeType: string }>,
  model: string,
  apiKey: string
): Promise<QaGuide> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const geminiModel = genAI.getGenerativeModel({ model })

  const prompt = buildIssueAnalysisPrompt(issue)

  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [{ text: prompt }]

  for (const item of media) {
    try {
      const buffer = readFileSync(item.path)
      parts.push({
        inlineData: {
          mimeType: item.mimeType,
          data: buffer.toString('base64')
        }
      })
    } catch (err) {
      console.warn(
        `Failed to read media ${item.path}: ${(err as Error).message}`
      )
    }
  }

  console.warn(
    `Sending to ${model}: ${prompt.length} chars text, ${media.length} media files`
  )

  const result = await geminiModel.generateContent({
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json'
    }
  })

  let text = result.response.text()
  text = text
    .replace(/^```(?:json)?\n?/gm, '')
    .replace(/```$/gm, '')
    .trim()

  console.warn('Gemini response received')
  console.warn('Raw response (first 500 chars):', text.slice(0, 500))
  const parsed = JSON.parse(text)

  const guide: QaGuide =
    parsed.reproduce ?? parsed.qa_guide?.reproduce ?? parsed
  return guide
}

// ── Main ──

async function main() {
  const opts = parseArgs()
  mkdirSync(opts.outputDir, { recursive: true })

  if (opts.type === 'issue') {
    await analyzeIssue(opts)
  } else {
    await analyzePr(opts)
  }
}

async function analyzeIssue(opts: Options) {
  const issue = fetchIssueThread(opts.prNumber, opts.repo)

  const allText = [issue.body, ...issue.comments].join('\n')
  const mediaUrls = extractMediaUrls(allText)
  console.warn(`Found ${mediaUrls.length} media URLs`)

  const media = await downloadMedia(
    mediaUrls,
    opts.outputDir,
    opts.mediaBudgetBytes,
    opts.maxVideoBytes
  )

  const guide = await analyzeIssueWithGemini(
    issue,
    media,
    opts.model,
    opts.apiKey
  )

  const beforePath = resolve(opts.outputDir, 'qa-guide-before.json')
  writeFileSync(beforePath, JSON.stringify(guide, null, 2))

  console.warn(`Wrote QA guide:`)
  console.warn(`  Reproduce: ${beforePath}`)
}

async function analyzePr(opts: Options) {
  const thread = fetchPrThread(opts.prNumber, opts.repo)

  const allText = [
    thread.body,
    ...thread.issueComments,
    ...thread.reviewComments,
    ...thread.reviews
  ].join('\n')
  const mediaUrls = extractMediaUrls(allText)
  console.warn(`Found ${mediaUrls.length} media URLs`)

  const media = await downloadMedia(
    mediaUrls,
    opts.outputDir,
    opts.mediaBudgetBytes,
    opts.maxVideoBytes
  )

  const guides = await analyzeWithGemini(thread, media, opts.model, opts.apiKey)

  const beforePath = resolve(opts.outputDir, 'qa-guide-before.json')
  const afterPath = resolve(opts.outputDir, 'qa-guide-after.json')
  writeFileSync(beforePath, JSON.stringify(guides.before, null, 2))
  writeFileSync(afterPath, JSON.stringify(guides.after, null, 2))

  console.warn(`Wrote QA guides:`)
  console.warn(`  Before: ${beforePath}`)
  console.warn(`  After:  ${afterPath}`)
}

import { fileURLToPath } from 'node:url'

function isExecutedAsScript(metaUrl: string): boolean {
  const modulePath = fileURLToPath(metaUrl)
  const scriptPath = process.argv[1] ? resolve(process.argv[1]) : ''
  return modulePath === scriptPath
}

if (isExecutedAsScript(import.meta.url)) {
  main().catch((err) => {
    console.error('PR analysis failed:', err)
    process.exit(1)
  })
}
