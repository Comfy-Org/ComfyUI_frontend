import * as fs from 'node:fs'
import * as path from 'node:path'
import * as https from 'node:https'
import * as http from 'node:http'
import * as cheerio from 'cheerio'

interface PageAnalysis {
  url: string
  title: string
  metaDescription: string
  metaKeywords: string[]
  headings: { level: string; text: string }[]
  keywords: { phrase: string; count: number }[]
  error?: string
}

const DEFAULT_URLS = [
  'https://openart.ai/workflows',
  'https://openart.ai/workflows/all',
  'https://civitai.com/models?types=Workflows',
  'https://civitai.com/search/models?sortBy=models_v9&query=comfyui%20workflow',
  'https://comfyworkflows.com/',
  'https://www.runcomfy.com/comfyui-workflows'
]

import { fileURLToPath } from 'node:url'

const SITE_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DOCS_DIR = path.join(SITE_DIR, 'docs')

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'as',
  'is',
  'was',
  'are',
  'were',
  'been',
  'be',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'must',
  'shall',
  'can',
  'need',
  'this',
  'that',
  'these',
  'those',
  'it',
  'its',
  'you',
  'your',
  'we',
  'our',
  'they',
  'their',
  'what',
  'which',
  'who',
  'whom',
  'how',
  'when',
  'where',
  'why',
  'all',
  'each',
  'every',
  'both',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'not',
  'only',
  'same',
  'so',
  'than',
  'too',
  'very',
  'just',
  'also',
  'now',
  'here',
  'there',
  'about',
  'into',
  'over',
  'after',
  'before',
  'between',
  'under',
  'again',
  'further',
  'then',
  'once',
  'any',
  'if',
  'out',
  'up',
  'down',
  'px',
  'rem',
  'em',
  'rgba',
  'rgb',
  'var',
  'none',
  'flex',
  'grid',
  'block',
  'inline',
  'url',
  'http',
  'https',
  'www',
  'com',
  'true',
  'false',
  'null',
  'undefined',
  'function',
  'return',
  'const',
  'let',
  'new',
  'class'
])

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const protocol = parsedUrl.protocol === 'https:' ? https : http

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOResearchBot/1.0)',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    }

    const req = protocol.get(options, (res) => {
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        const location = res.headers.location
        const redirectUrl = location.startsWith('http')
          ? location
          : new URL(location, url).href
        fetchPage(redirectUrl).then(resolve).catch(reject)
        return
      }

      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }

      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => resolve(data))
      res.on('error', reject)
    })

    req.on('error', reject)
    req.setTimeout(15000, () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })
  })
}

function extractKeywords(text: string): Map<string, number> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))

  const counts = new Map<string, number>()
  for (const word of words) {
    counts.set(word, (counts.get(word) || 0) + 1)
  }

  const bigrams: string[] = []
  for (let i = 0; i < words.length - 1; i++) {
    if (!STOP_WORDS.has(words[i]) && !STOP_WORDS.has(words[i + 1])) {
      bigrams.push(`${words[i]} ${words[i + 1]}`)
    }
  }
  for (const bigram of bigrams) {
    counts.set(bigram, (counts.get(bigram) || 0) + 1)
  }

  return counts
}

function analyzePage(url: string, html: string): PageAnalysis {
  const $ = cheerio.load(html)

  $('script, style, noscript, svg, path, link, meta').remove()

  const title = $('title').text().trim()
  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() || ''
  const metaKeywordsRaw =
    $('meta[name="keywords"]').attr('content')?.trim() || ''
  const metaKeywords = metaKeywordsRaw
    ? metaKeywordsRaw
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
    : []

  const headings: { level: string; text: string }[] = []
  $('h1, h2, h3').each((_, el) => {
    const text = $(el).text().trim()
    if (text && text.length < 200) {
      headings.push({ level: el.tagName.toLowerCase(), text })
    }
  })

  const visibleText: string[] = []
  $('h1, h2, h3, h4, p, li, a, span, div, td, th, label, button').each(
    (_, el) => {
      const text = $(el).clone().children().remove().end().text().trim()
      if (text && text.length > 2 && text.length < 200) {
        visibleText.push(text)
      }
    }
  )

  const bodyText = visibleText.join(' ')
  const allKeywords = extractKeywords(bodyText)

  const sortedKeywords = Array.from(allKeywords.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([phrase, count]) => ({ phrase, count }))

  return {
    url,
    title,
    metaDescription,
    metaKeywords,
    headings: headings.slice(0, 20),
    keywords: sortedKeywords
  }
}

async function analyzeCompetitors(urls: string[]): Promise<PageAnalysis[]> {
  const results: PageAnalysis[] = []

  for (const url of urls) {
    console.log(`Fetching: ${url}`)
    try {
      const html = await fetchPage(url)
      const analysis = analyzePage(url, html)
      results.push(analysis)
      console.log(
        `  ✓ Found ${analysis.keywords.length} keywords, ${analysis.headings.length} headings`
      )
    } catch (error) {
      console.log(
        `  ✗ Error: ${error instanceof Error ? error.message : String(error)}`
      )
      results.push({
        url,
        title: '',
        metaDescription: '',
        metaKeywords: [],
        headings: [],
        keywords: [],
        error: error instanceof Error ? error.message : String(error)
      })
    }

    await delay(1000)
  }

  return results
}

function aggregateKeywords(
  analyses: PageAnalysis[]
): { phrase: string; totalCount: number; sites: number }[] {
  const aggregate = new Map<string, { count: number; sites: Set<string> }>()

  for (const analysis of analyses) {
    if (analysis.error) continue
    for (const kw of analysis.keywords) {
      const existing = aggregate.get(kw.phrase) || {
        count: 0,
        sites: new Set<string>()
      }
      existing.count += kw.count
      existing.sites.add(new URL(analysis.url).hostname)
      aggregate.set(kw.phrase, existing)
    }
  }

  return Array.from(aggregate.entries())
    .map(([phrase, data]) => ({
      phrase,
      totalCount: data.count,
      sites: data.sites.size
    }))
    .filter((k) => k.sites >= 2)
    .sort((a, b) => b.sites - a.sites || b.totalCount - a.totalCount)
    .slice(0, 100)
}

function generateReport(analyses: PageAnalysis[]): string {
  const topKeywords = aggregateKeywords(analyses)
  const successfulAnalyses = analyses.filter((a) => !a.error)

  let report = `# Competitor SEO Analysis Report

Generated: ${new Date().toISOString().split('T')[0]}

## Summary

- **Pages Analyzed:** ${successfulAnalyses.length}/${analyses.length}
- **Total Keywords Found:** ${topKeywords.length} (appearing on 2+ sites)

---

## Top Keywords Across Competitors

Keywords appearing on multiple competitor sites:

| Keyword/Phrase | Sites | Total Count |
|---------------|-------|-------------|
`

  for (const kw of topKeywords.slice(0, 30)) {
    report += `| ${kw.phrase} | ${kw.sites} | ${kw.totalCount} |\n`
  }

  report += `
---

## Individual Page Analysis

`

  for (const analysis of analyses) {
    const hostname = new URL(analysis.url).hostname
    report += `### ${hostname}\n\n`
    report += `**URL:** ${analysis.url}\n\n`

    if (analysis.error) {
      report += `**Error:** ${analysis.error}\n\n`
      continue
    }

    report += `**Title:** ${analysis.title || '(none)'}\n\n`
    report += `**Meta Description:** ${analysis.metaDescription || '(none)'}\n\n`

    if (analysis.metaKeywords.length > 0) {
      report += `**Meta Keywords:** ${analysis.metaKeywords.join(', ')}\n\n`
    }

    if (analysis.headings.length > 0) {
      report += `**Key Headings:**\n`
      for (const h of analysis.headings.slice(0, 10)) {
        report += `- [${h.level}] ${h.text}\n`
      }
      report += '\n'
    }

    if (analysis.keywords.length > 0) {
      report += `**Top Keywords:**\n`
      for (const kw of analysis.keywords.slice(0, 15)) {
        report += `- "${kw.phrase}" (${kw.count}x)\n`
      }
      report += '\n'
    }

    report += '---\n\n'
  }

  report += `## Recommendations for Our Site

Based on competitor analysis:

### High-Priority Keywords to Target
`

  const priorityKeywords = topKeywords.filter((k) => k.sites >= 2).slice(0, 10)
  for (const kw of priorityKeywords) {
    report += `- **${kw.phrase}** - appears on ${kw.sites} competitor sites\n`
  }

  report += `
### Content Patterns Observed
- Workflow galleries with filtering/search
- Category-based organization (by media type, model, use case)
- User-generated content with ratings/downloads
- Tutorial and documentation sections

### SEO Improvements to Consider
1. Include high-frequency keywords in page titles and H1s
2. Add comprehensive meta descriptions with key terms
3. Create category landing pages for major workflow types
4. Add structured data for workflow listings
5. Build internal linking between related templates
`

  return report
}

async function main() {
  const args = process.argv.slice(2)
  const urls = args.length > 0 ? args : DEFAULT_URLS

  console.log('Competitor Keyword Analysis')
  console.log('===========================\n')
  console.log(`Analyzing ${urls.length} URLs...\n`)

  const analyses = await analyzeCompetitors(urls)
  const report = generateReport(analyses)

  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true })
  }

  const outputPath = path.join(DOCS_DIR, 'competitor-analysis.md')
  fs.writeFileSync(outputPath, report)

  console.log(`\n✓ Report saved to: ${outputPath}`)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
