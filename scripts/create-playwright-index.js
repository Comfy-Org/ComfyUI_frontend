#!/usr/bin/env node
/**
 * Creates an index page for Playwright test reports with test statistics
 * Reads JSON reports from each browser and creates a landing page with cards
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const reportsDir = path.join(__dirname, '..', '.pages', 'playwright-reports')

function getTestStats(reportPath) {
  try {
    const reportJsonPath = path.join(reportPath, 'report.json')
    if (!fs.existsSync(reportJsonPath)) {
      console.warn(`No report.json found at ${reportJsonPath}`)
      return null
    }

    const reportData = JSON.parse(fs.readFileSync(reportJsonPath, 'utf-8'))

    let passed = 0
    let failed = 0
    let skipped = 0
    let flaky = 0

    // Parse Playwright JSON report format
    if (reportData.suites) {
      const countResults = (suites) => {
        for (const suite of suites) {
          if (suite.specs) {
            for (const spec of suite.specs) {
              if (!spec.tests || spec.tests.length === 0) continue

              const test = spec.tests[0]
              const results = test.results || []

              // Check if test is flaky (has both pass and fail results)
              const hasPass = results.some((r) => r.status === 'passed')
              const hasFail = results.some((r) => r.status === 'failed')

              if (hasPass && hasFail) {
                flaky++
              } else if (results.some((r) => r.status === 'passed')) {
                passed++
              } else if (results.some((r) => r.status === 'failed')) {
                failed++
              } else if (results.some((r) => r.status === 'skipped')) {
                skipped++
              }
            }
          }
          if (suite.suites) {
            countResults(suite.suites)
          }
        }
      }

      countResults(reportData.suites)
    }

    return { passed, failed, skipped, flaky }
  } catch (error) {
    console.error(`Error reading report at ${reportPath}:`, error.message)
    return null
  }
}

function generateIndexHtml(browsers) {
  const cards = browsers
    .map((browser) => {
      const { name, stats } = browser
      if (!stats) return ''

      const total = stats.passed + stats.failed + stats.skipped + stats.flaky
      const passRate = total > 0 ? ((stats.passed / total) * 100).toFixed(1) : 0

      return `
      <a href="./${name}/index.html" class="card">
        <div class="card-header">
          <h2>${name}</h2>
          <span class="pass-rate ${stats.failed > 0 ? 'has-failures' : ''}">${passRate}%</span>
        </div>
        <div class="stats">
          <div class="stat passed">
            <span class="label">Passed</span>
            <span class="value">${stats.passed}</span>
          </div>
          <div class="stat failed">
            <span class="label">Failed</span>
            <span class="value">${stats.failed}</span>
          </div>
          <div class="stat skipped">
            <span class="label">Skipped</span>
            <span class="value">${stats.skipped}</span>
          </div>
          <div class="stat flaky">
            <span class="label">Flaky</span>
            <span class="value">${stats.flaky}</span>
          </div>
        </div>
      </a>
    `
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Playwright E2E Test Reports</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 2rem;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    h1 {
      color: white;
      text-align: center;
      margin-bottom: 3rem;
      font-size: 2.5rem;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
    }

    .card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      transition: transform 0.2s, box-shadow 0.2s;
      text-decoration: none;
      color: inherit;
      display: block;
    }

    .card:hover {
      transform: translateY(-5px);
      box-shadow: 0 15px 40px rgba(0, 0, 0, 0.3);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid #f0f0f0;
    }

    .card h2 {
      color: #333;
      font-size: 1.5rem;
      text-transform: capitalize;
    }

    .pass-rate {
      background: #10b981;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-weight: bold;
      font-size: 1.1rem;
    }

    .pass-rate.has-failures {
      background: #ef4444;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }

    .stat {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .stat .label {
      font-size: 0.875rem;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .stat .value {
      font-size: 1.75rem;
      font-weight: bold;
    }

    .stat.passed .value {
      color: #10b981;
    }

    .stat.failed .value {
      color: #ef4444;
    }

    .stat.skipped .value {
      color: #f59e0b;
    }

    .stat.flaky .value {
      color: #8b5cf6;
    }

    @media (max-width: 768px) {
      h1 {
        font-size: 2rem;
      }

      .cards-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎭 Playwright E2E Test Reports</h1>
    <div class="cards-grid">
      ${cards}
    </div>
  </div>
</body>
</html>`
}

function main() {
  if (!fs.existsSync(reportsDir)) {
    console.log(
      'No playwright reports directory found, skipping index creation'
    )
    return
  }

  const browsers = []
  const browserDirs = fs.readdirSync(reportsDir, { withFileTypes: true })

  for (const dirent of browserDirs) {
    if (dirent.isDirectory()) {
      const browserName = dirent.name
      const browserPath = path.join(reportsDir, browserName)
      const stats = getTestStats(browserPath)

      if (stats) {
        browsers.push({ name: browserName, stats })
        console.log(`✓ Found report for ${browserName}:`, stats)
      }
    }
  }

  if (browsers.length === 0) {
    console.warn('No valid browser reports found')
    return
  }

  const html = generateIndexHtml(browsers)
  const indexPath = path.join(reportsDir, 'index.html')

  fs.writeFileSync(indexPath, html, 'utf-8')
  console.log(`✓ Created index page at ${indexPath}`)
}

main()
