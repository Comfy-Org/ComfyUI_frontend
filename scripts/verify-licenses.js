/**
 * CI Script: Verify License Compliance
 *
 * This script verifies that all production dependencies use open-source compatible licenses.
 * It checks against a list of approved licenses and flags any non-compliant dependencies.
 *
 * Usage: node scripts/verify-licenses.js
 *
 * Exit codes:
 * - 0: All licenses are compliant
 * - 1: Non-compliant licenses found
 */

import { execSync } from 'child_process'

const COLORS = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
}

// Approved open-source licenses
// Based on OSI-approved licenses and common permissive licenses
const APPROVED_LICENSES = new Set([
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'CC0-1.0',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'Unlicense',
  'WTFPL',
  '0BSD',
  'BlueOak-1.0.0',
  'Python-2.0',
  'Zlib',
  // GPL is acceptable for libraries as long as we're GPL-3.0-only
  'GPL-2.0',
  'GPL-3.0',
  'GPL-3.0-only',
  'LGPL-2.1',
  'LGPL-3.0',
  'MPL-2.0',
  // Public domain
  'Public Domain',
  'Unlicensed'
])

// Known problematic licenses
const PROBLEMATIC_LICENSES = new Set([
  'UNLICENSED',
  'CUSTOM',
  'SEE LICENSE IN LICENSE',
  'PROPRIETARY'
])

/**
 * Parse pnpm licenses output
 */
function getLicenses() {
  console.log(
    `${COLORS.blue}Fetching production dependency licenses...${COLORS.reset}`
  )

  try {
    const output = execSync('pnpm licenses list --json --prod', {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    })

    const licenses = JSON.parse(output)
    return licenses
  } catch (err) {
    console.error(
      `${COLORS.red}Error fetching licenses: ${err.message}${COLORS.reset}`
    )
    process.exit(1)
  }
}

/**
 * Normalize license names for comparison
 */
function normalizeLicense(license) {
  if (!license) return 'UNKNOWN'

  // Handle common variations
  const normalized = license.trim().replace(/\s+/g, '-').toUpperCase()

  // Handle "OR" clauses - take the first license
  if (normalized.includes(' OR ')) {
    return normalized.split(' OR ')[0].trim()
  }

  // Handle "AND" clauses - if any license is approved, consider it approved
  if (normalized.includes(' AND ')) {
    const licenses = normalized.split(' AND ')
    for (const lic of licenses) {
      const trimmed = lic.trim()
      if (APPROVED_LICENSES.has(trimmed)) {
        return trimmed
      }
    }
  }

  return normalized
}

/**
 * Check if a license is approved
 */
function isLicenseApproved(license) {
  const normalized = normalizeLicense(license)

  // Check exact match
  if (APPROVED_LICENSES.has(normalized)) {
    return true
  }

  // Check if any approved license is a substring (handles variations)
  for (const approved of APPROVED_LICENSES) {
    if (normalized.includes(approved.toUpperCase())) {
      return true
    }
  }

  return false
}

/**
 * Main verification function
 */
function main() {
  console.log(
    `${COLORS.blue}========================================${COLORS.reset}`
  )
  console.log(`${COLORS.blue}License Compliance Verification${COLORS.reset}`)
  console.log(
    `${COLORS.blue}========================================${COLORS.reset}\n`
  )

  const licenses = getLicenses()

  const violations = []
  const warnings = []
  let totalPackages = 0

  // Check each license group
  for (const [license, packages] of Object.entries(licenses)) {
    for (const pkg of packages) {
      totalPackages++

      const isApproved = isLicenseApproved(license)
      const isProblematic = PROBLEMATIC_LICENSES.has(normalizeLicense(license))

      if (isProblematic || !isApproved) {
        violations.push({
          package: pkg.name,
          version: pkg.versions[0],
          license: license,
          isProblematic
        })
      } else if (license === 'UNKNOWN' || !license) {
        warnings.push({
          package: pkg.name,
          version: pkg.versions[0],
          license: 'UNKNOWN'
        })
      }
    }
  }

  // Report warnings
  if (warnings.length > 0) {
    console.log(
      `${COLORS.yellow}⚠ Packages with unknown licenses (${warnings.length}):${COLORS.reset}`
    )
    warnings.forEach(({ package: name, version }) => {
      console.log(`  ${COLORS.yellow}- ${name}@${version}${COLORS.reset}`)
    })
    console.log()
  }

  // Report violations
  if (violations.length > 0) {
    console.log(
      `${COLORS.red}✗ Found ${violations.length} package(s) with non-compliant licenses:${COLORS.reset}\n`
    )

    violations.forEach(({ package: name, version, license, isProblematic }) => {
      console.log(`  ${COLORS.red}Package: ${name}@${version}${COLORS.reset}`)
      console.log(`  ${COLORS.red}License: ${license}${COLORS.reset}`)
      if (isProblematic) {
        console.log(
          `  ${COLORS.red}⚠ This license is known to be problematic${COLORS.reset}`
        )
      }
      console.log()
    })

    console.log(
      `${COLORS.blue}========================================${COLORS.reset}`
    )
    console.log(`${COLORS.red}✗ License verification failed!${COLORS.reset}`)
    console.log(
      `${COLORS.red}Please review and update dependencies with non-compliant licenses.${COLORS.reset}\n`
    )
    process.exit(1)
  }

  // Success
  console.log(
    `${COLORS.blue}========================================${COLORS.reset}`
  )
  console.log(
    `${COLORS.green}✓ All ${totalPackages} production dependencies use approved licenses!${COLORS.reset}\n`
  )
  process.exit(0)
}

main()
