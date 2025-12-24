/**
 * CI Script: Verify OSS Build Compliance
 *
 * This script verifies that the OSS build (DISTRIBUTION=localhost) does not contain:
 * 1. Proprietary licensed files (e.g., ABCROM font)
 * 2. Telemetry code (e.g., mixpanel library references)
 *
 * Usage: node scripts/verify-oss-build.js
 *
 * Exit codes:
 * - 0: All checks passed
 * - 1: Violations found
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const DIST_DIR = join(__dirname, '..', 'dist')
const COLORS = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
}

// Patterns to check for violations
const VIOLATION_PATTERNS = {
  // Proprietary font checks
  font: {
    patterns: [/ABCROM/gi, /ABCROMExtended/gi, /ABC\s*ROM/gi],
    description: 'ABCROM proprietary font references'
  },
  // Telemetry checks - more specific patterns to avoid false positives
  telemetry: {
    patterns: [
      /mixpanel\.init/gi,
      /mixpanel\.identify/gi,
      /MixpanelTelemetryProvider/gi,
      /mp\.comfy\.org/gi,
      /mixpanel-browser/gi,
      // Only check for our specific tracking methods with context
      /useTelemetry\(\).*?trackWorkflow/gs,
      /useTelemetry\(\).*?trackEvent/gs,
      // Check for Mixpanel tracking in a more specific way
      /mixpanel\.track\s*\(/gi
    ],
    description: 'Mixpanel telemetry code'
  }
}

// File extensions to check
const JS_EXTENSIONS = ['.js', '.mjs', '.cjs']
const FONT_EXTENSIONS = ['.woff', '.woff2', '.ttf', '.otf']

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dir, extensions = null) {
  const files = []

  try {
    const items = readdirSync(dir)

    for (const item of items) {
      const fullPath = join(dir, item)
      const stat = statSync(fullPath)

      if (stat.isDirectory()) {
        files.push(...getAllFiles(fullPath, extensions))
      } else if (stat.isFile()) {
        if (!extensions || extensions.includes(extname(fullPath))) {
          files.push(fullPath)
        }
      }
    }
  } catch (err) {
    console.error(
      `${COLORS.red}Error reading directory ${dir}: ${err.message}${COLORS.reset}`
    )
  }

  return files
}

/**
 * Check if file content contains violation patterns
 */
function checkFileForViolations(filePath, violationConfig) {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const violations = []

    for (const pattern of violationConfig.patterns) {
      const matches = content.match(pattern)
      if (matches && matches.length > 0) {
        violations.push({
          pattern: pattern.toString(),
          matches: matches.length,
          sample: matches[0]
        })
      }
    }

    return violations
  } catch (err) {
    // Binary files or read errors - skip
    return []
  }
}

/**
 * Check for proprietary font files
 */
function checkForFontFiles() {
  console.log(
    `\n${COLORS.blue}Checking for proprietary font files...${COLORS.reset}`
  )

  const fontFiles = getAllFiles(DIST_DIR, FONT_EXTENSIONS)
  const violations = []

  for (const fontFile of fontFiles) {
    const fileName = fontFile.toLowerCase()
    if (fileName.includes('abcrom')) {
      violations.push(fontFile)
    }
  }

  if (violations.length > 0) {
    console.log(
      `${COLORS.red}✗ Found ${violations.length} proprietary font file(s):${COLORS.reset}`
    )
    violations.forEach((file) => {
      console.log(`  ${COLORS.red}- ${file}${COLORS.reset}`)
    })
    return false
  } else {
    console.log(
      `${COLORS.green}✓ No proprietary font files found${COLORS.reset}`
    )
    return true
  }
}

/**
 * Check JavaScript files for code violations
 */
function checkJavaScriptFiles() {
  console.log(
    `\n${COLORS.blue}Checking JavaScript files for code violations...${COLORS.reset}`
  )

  const jsFiles = getAllFiles(DIST_DIR, JS_EXTENSIONS)
  const allViolations = {}

  for (const [violationType, config] of Object.entries(VIOLATION_PATTERNS)) {
    allViolations[violationType] = []

    for (const jsFile of jsFiles) {
      const violations = checkFileForViolations(jsFile, config)
      if (violations.length > 0) {
        allViolations[violationType].push({
          file: jsFile,
          violations
        })
      }
    }
  }

  let hasViolations = false

  for (const [violationType, config] of Object.entries(VIOLATION_PATTERNS)) {
    const violations = allViolations[violationType]

    if (violations.length > 0) {
      hasViolations = true
      console.log(
        `\n${COLORS.red}✗ Found ${config.description} in ${violations.length} file(s):${COLORS.reset}`
      )

      violations.forEach(({ file, violations: fileViolations }) => {
        console.log(`\n  ${COLORS.yellow}${file}${COLORS.reset}`)
        fileViolations.forEach(({ pattern, matches, sample }) => {
          console.log(`    ${COLORS.red}Pattern: ${pattern}${COLORS.reset}`)
          console.log(`    ${COLORS.red}Matches: ${matches}${COLORS.reset}`)
          console.log(`    ${COLORS.red}Sample: "${sample}"${COLORS.reset}`)
        })
      })
    } else {
      console.log(
        `${COLORS.green}✓ No ${config.description} found${COLORS.reset}`
      )
    }
  }

  return !hasViolations
}

/**
 * Main verification function
 */
function main() {
  console.log(
    `${COLORS.blue}========================================${COLORS.reset}`
  )
  console.log(`${COLORS.blue}OSS Build Verification${COLORS.reset}`)
  console.log(
    `${COLORS.blue}========================================${COLORS.reset}`
  )
  console.log(`${COLORS.blue}Checking: ${DIST_DIR}${COLORS.reset}`)

  // Check if dist directory exists
  try {
    statSync(DIST_DIR)
  } catch (err) {
    console.error(
      `\n${COLORS.red}Error: dist/ directory not found. Please run 'pnpm build' first.${COLORS.reset}`
    )
    process.exit(1)
  }

  // Run checks
  const fontCheckPassed = checkForFontFiles()
  const codeCheckPassed = checkJavaScriptFiles()

  // Summary
  console.log(
    `\n${COLORS.blue}========================================${COLORS.reset}`
  )
  console.log(`${COLORS.blue}Verification Summary${COLORS.reset}`)
  console.log(
    `${COLORS.blue}========================================${COLORS.reset}`
  )

  if (fontCheckPassed && codeCheckPassed) {
    console.log(
      `${COLORS.green}✓ All checks passed! OSS build is compliant.${COLORS.reset}\n`
    )
    process.exit(0)
  } else {
    console.log(
      `${COLORS.red}✗ Verification failed! Please fix the violations above.${COLORS.reset}\n`
    )
    process.exit(1)
  }
}

main()
