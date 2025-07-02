#!/usr/bin/env tsx
import { execSync } from 'child_process'
import * as fs from 'fs'
import { globSync } from 'glob'

interface LocaleData {
  [key: string]: any
}

// Configuration
const SOURCE_PATTERNS = ['src/**/*.{js,ts,vue}', '!src/locales/**/*']
const IGNORE_PATTERNS = [
  // Keys that might be dynamically constructed
  /^commands\./, // Command definitions are loaded dynamically
  /^settings\..*\.options\./, // Setting options are rendered dynamically
  /^nodeDefs\./, // Node definitions are loaded from backend
  /^templateWorkflows\./, // Template workflows are loaded dynamically
  /^dataTypes\./, // Data types might be referenced dynamically
  /^contextMenu\./, // Context menu items might be dynamic
  /^color\./ // Color names might be used dynamically
]

// Get list of staged locale files
function getStagedLocaleFiles(): string[] {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=AM', {
      encoding: 'utf-8'
    })
    return output
      .split('\n')
      .filter(
        (file) => file.startsWith('src/locales/') && file.endsWith('.json')
      )
  } catch {
    return []
  }
}

// Extract all keys from a nested object
function extractKeys(obj: any, prefix = ''): string[] {
  const keys: string[] = []

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...extractKeys(value, fullKey))
    } else {
      keys.push(fullKey)
    }
  }

  return keys
}

// Get new keys added in staged files
function getNewKeysFromStagedFiles(stagedFiles: string[]): Set<string> {
  const newKeys = new Set<string>()

  for (const file of stagedFiles) {
    try {
      // Get the staged content
      const stagedContent = execSync(`git show :${file}`, { encoding: 'utf-8' })
      const stagedData: LocaleData = JSON.parse(stagedContent)
      const stagedKeys = new Set(extractKeys(stagedData))

      // Get the current HEAD content (if file exists)
      let headKeys = new Set<string>()
      try {
        const headContent = execSync(`git show HEAD:${file}`, {
          encoding: 'utf-8'
        })
        const headData: LocaleData = JSON.parse(headContent)
        headKeys = new Set(extractKeys(headData))
      } catch {
        // File is new, all keys are new
      }

      // Find keys that are in staged but not in HEAD
      stagedKeys.forEach((key) => {
        if (!headKeys.has(key)) {
          newKeys.add(key)
        }
      })
    } catch (error) {
      console.error(`Error processing ${file}:`, error)
    }
  }

  return newKeys
}

// Check if a key should be ignored
function shouldIgnoreKey(key: string): boolean {
  return IGNORE_PATTERNS.some((pattern) => pattern.test(key))
}

// Search for key usage in source files
function isKeyUsed(key: string, sourceFiles: string[]): boolean {
  // Common patterns for i18n key usage
  const patterns = [
    // Direct usage: $t('key'), t('key'), i18n.t('key')
    new RegExp(`[t$]\\s*\\(\\s*['"\`]${key}['"\`]`, 'g'),
    // With namespace: $t('g.key'), t('namespace.key')
    new RegExp(
      `[t$]\\s*\\(\\s*['"\`][^'"]+\\.${key.split('.').pop()}['"\`]`,
      'g'
    ),
    // Dynamic keys might reference parts of the key
    new RegExp(`['"\`]${key}['"\`]`, 'g')
  ]

  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, 'utf-8')

    for (const pattern of patterns) {
      if (pattern.test(content)) {
        return true
      }
    }
  }

  return false
}

// Main function
async function checkNewUnusedKeys() {
  const stagedLocaleFiles = getStagedLocaleFiles()

  if (stagedLocaleFiles.length === 0) {
    // No locale files staged, nothing to check
    process.exit(0)
  }

  // Get all new keys from staged files
  const newKeys = getNewKeysFromStagedFiles(stagedLocaleFiles)

  if (newKeys.size === 0) {
    // Silent success - no output needed
    process.exit(0)
  }

  // Get all source files
  const sourceFiles = globSync(SOURCE_PATTERNS)

  // Check each new key
  const unusedNewKeys: string[] = []

  newKeys.forEach((key) => {
    if (!shouldIgnoreKey(key) && !isKeyUsed(key, sourceFiles)) {
      unusedNewKeys.push(key)
    }
  })

  // Report results
  if (unusedNewKeys.length > 0) {
    console.log('\n❌ Found unused NEW i18n keys:\n')

    for (const key of unusedNewKeys.sort()) {
      console.log(`  - ${key}`)
    }

    console.log(`\n✨ Total unused new keys: ${unusedNewKeys.length}`)
    console.log(
      '\nThese keys were added but are not used anywhere in the codebase.'
    )
    console.log('Please either use them or remove them before committing.')

    process.exit(1)
  } else {
    // Silent success - no output needed
  }
}

// Run the check
checkNewUnusedKeys().catch((err) => {
  console.error('Error checking unused keys:', err)
  process.exit(1)
})
