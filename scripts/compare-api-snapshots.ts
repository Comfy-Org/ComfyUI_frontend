#!/usr/bin/env node

/**
 * Compares two API snapshots and generates a human-readable changelog
 * documenting additions, removals, and modifications to the public API.
 */

import * as fs from 'fs'

const args = process.argv.slice(2)
if (args.length < 4) {
  console.error(
    'Usage: compare-api-snapshots.js <previous.json> <current.json> <previous-version> <current-version> [repo-owner] [repo-name] [git-ref]'
  )
  process.exit(1)
}

const [
  previousPath,
  currentPath,
  previousVersion,
  currentVersion,
  repoOwner = 'Comfy-Org',
  repoName = 'ComfyUI_frontend',
  gitRef = 'main'
] = args

if (!fs.existsSync(previousPath)) {
  console.error(`Previous snapshot not found: ${previousPath}`)
  process.exit(1)
}

if (!fs.existsSync(currentPath)) {
  console.error(`Current snapshot not found: ${currentPath}`)
  process.exit(1)
}

const previousApi = JSON.parse(fs.readFileSync(previousPath, 'utf-8'))
const currentApi = JSON.parse(fs.readFileSync(currentPath, 'utf-8'))

/**
 * Generate GitHub permalink to source code
 * Prefers source file location over dist .d.ts location
 */
function generateGitHubLink(name, item) {
  // If we have source file information, use that
  if (item?.sourceFile && item?.sourceLine) {
    return `[\`${name}\`](https://github.com/${repoOwner}/${repoName}/blob/${gitRef}/${item.sourceFile}#L${item.sourceLine})`
  }

  // Fallback to .d.ts location if available
  if (item?.line) {
    return `[\`${name}\`](https://github.com/${repoOwner}/${repoName}/blob/${gitRef}/dist/index.d.ts#L${item.line})`
  }

  // No location info available
  return `\`${name}\``
}

/**
 * Compare two API snapshots and generate changelog
 */
function compareApis(previous, current) {
  const changes = {
    breaking: [],
    additions: [],
    modifications: [],
    deprecations: []
  }

  const categories = [
    'types',
    'interfaces',
    'enums',
    'functions',
    'classes',
    'constants'
  ]

  for (const category of categories) {
    const prevItems = previous[category] || {}
    const currItems = current[category] || {}

    // Find additions
    for (const name in currItems) {
      if (!prevItems[name]) {
        changes.additions.push({
          category,
          name,
          item: currItems[name]
        })
      }
    }

    // Find removals and modifications
    for (const name in prevItems) {
      if (!currItems[name]) {
        changes.breaking.push({
          category,
          name,
          type: 'removed',
          item: prevItems[name]
        })
      } else {
        // Check for modifications
        const diff = compareItems(prevItems[name], currItems[name], category)
        if (diff.length > 0) {
          changes.modifications.push({
            category,
            name,
            changes: diff
          })
        }
      }
    }
  }

  return changes
}

/**
 * Compare two items and return differences
 */
function compareItems(prev, curr, category) {
  const differences = []

  if (category === 'interfaces' || category === 'classes') {
    // Compare members
    const prevMembers = new Map(prev.members?.map((m) => [m.name, m]) || [])
    const currMembers = new Map(curr.members?.map((m) => [m.name, m]) || [])

    // Find added members
    for (const [name, member] of currMembers) {
      if (!prevMembers.has(name)) {
        differences.push({
          type: 'member_added',
          name,
          member
        })
      }
    }

    // Find removed members
    for (const [name, member] of prevMembers) {
      if (!currMembers.has(name)) {
        differences.push({
          type: 'member_removed',
          name,
          member
        })
      } else {
        // Check if member type changed
        const prevMember = prevMembers.get(name)
        const currMember = currMembers.get(name)

        if (prevMember.type !== currMember.type) {
          differences.push({
            type: 'member_type_changed',
            name,
            from: prevMember.type,
            to: currMember.type
          })
        }

        if (prevMember.optional !== currMember.optional) {
          differences.push({
            type: 'member_optionality_changed',
            name,
            from: prevMember.optional ? 'optional' : 'required',
            to: currMember.optional ? 'optional' : 'required'
          })
        }
      }
    }

    // Compare methods (for classes and interfaces)
    if (category === 'classes') {
      const prevMethods = new Map(prev.methods?.map((m) => [m.name, m]) || [])
      const currMethods = new Map(curr.methods?.map((m) => [m.name, m]) || [])

      for (const [name, method] of currMethods) {
        if (!prevMethods.has(name)) {
          differences.push({
            type: 'method_added',
            name,
            method
          })
        }
      }

      for (const [name, method] of prevMethods) {
        if (!currMethods.has(name)) {
          differences.push({
            type: 'method_removed',
            name,
            method
          })
        } else {
          const prevMethod = prevMethods.get(name)
          const currMethod = currMethods.get(name)

          if (prevMethod.returnType !== currMethod.returnType) {
            differences.push({
              type: 'method_return_type_changed',
              name,
              from: prevMethod.returnType,
              to: currMethod.returnType
            })
          }

          // Compare parameters
          if (
            JSON.stringify(prevMethod.parameters) !==
            JSON.stringify(currMethod.parameters)
          ) {
            differences.push({
              type: 'method_signature_changed',
              name,
              from: prevMethod.parameters,
              to: currMethod.parameters
            })
          }
        }
      }
    }
  } else if (category === 'functions') {
    // Compare function signatures
    if (prev.returnType !== curr.returnType) {
      differences.push({
        type: 'return_type_changed',
        from: prev.returnType,
        to: curr.returnType
      })
    }

    if (JSON.stringify(prev.parameters) !== JSON.stringify(curr.parameters)) {
      differences.push({
        type: 'parameters_changed',
        from: prev.parameters,
        to: curr.parameters
      })
    }
  } else if (category === 'enums') {
    // Compare enum members
    const prevMembers = new Set(prev.members?.map((m) => m.name) || [])
    const currMembers = new Set(curr.members?.map((m) => m.name) || [])

    for (const member of currMembers) {
      if (!prevMembers.has(member)) {
        differences.push({
          type: 'enum_member_added',
          name: member
        })
      }
    }

    for (const member of prevMembers) {
      if (!currMembers.has(member)) {
        differences.push({
          type: 'enum_member_removed',
          name: member
        })
      }
    }
  }

  return differences
}

/**
 * Format changelog as markdown
 */
function formatChangelog(changes, prevVersion, currVersion) {
  const lines = []

  lines.push(`## v${currVersion} (${new Date().toISOString().split('T')[0]})`)
  lines.push('')
  lines.push(
    `Comparing v${prevVersion} → v${currVersion}. This changelog documents changes to the public API surface that third-party extensions and custom nodes depend on.`
  )
  lines.push('')

  // Breaking changes
  if (changes.breaking.length > 0) {
    lines.push('### ⚠️ Breaking Changes')
    lines.push('')

    const grouped = groupByCategory(changes.breaking)
    for (const [category, items] of Object.entries(grouped)) {
      lines.push(`**${categoryToTitle(category)}**`)
      lines.push('')
      for (const item of items) {
        const displayName = generateGitHubLink(item.name, item.item)
        lines.push(`- **Removed**: ${displayName}`)
      }
      lines.push('')
    }
  }

  // Additions - commented out as per feedback
  // if (changes.additions.length > 0) {
  //   lines.push('### ✨ Additions')
  //   lines.push('')
  //
  //   const grouped = groupByCategory(changes.additions)
  //   for (const [category, items] of Object.entries(grouped)) {
  //     lines.push(`**${categoryToTitle(category)}**`)
  //     lines.push('')
  //     for (const item of items) {
  //       lines.push(`- \`${item.name}\``)
  //       if (item.item.members && item.item.members.length > 0) {
  //         const publicMembers = item.item.members.filter(
  //           (m) => !m.visibility || m.visibility === 'public'
  //         )
  //         if (publicMembers.length > 0 && publicMembers.length <= 5) {
  //           lines.push(
  //             `  - Members: ${publicMembers.map((m) => `\`${m.name}\``).join(', ')}`
  //           )
  //         }
  //       }
  //     }
  //     lines.push('')
  //   }
  // }

  // Modifications
  if (changes.modifications.length > 0) {
    lines.push('### 🔄 Modifications')
    lines.push('')

    const hasBreakingMods = changes.modifications.some((mod) =>
      mod.changes.some((c) => isBreakingChange(c))
    )

    if (hasBreakingMods) {
      lines.push('> **Note**: Some modifications may be breaking changes.')
      lines.push('')
    }

    const grouped = groupByCategory(changes.modifications)
    for (const [category, items] of Object.entries(grouped)) {
      lines.push(`**${categoryToTitle(category)}**`)
      lines.push('')
      for (const item of items) {
        // Get the current item to access source location
        const currItem =
          currentApi[item.category] && currentApi[item.category][item.name]
        const displayName = generateGitHubLink(item.name, currItem)
        lines.push(`- ${displayName}`)
        for (const change of item.changes) {
          const formatted = formatChange(change)
          if (formatted) {
            lines.push(`  ${formatted}`)
          }
        }
      }
      lines.push('')
    }
  }

  if (changes.breaking.length === 0 && changes.modifications.length === 0) {
    lines.push('_No API changes detected._')
    lines.push('')
  }

  lines.push('---')
  lines.push('')

  return lines.join('\n')
}

function groupByCategory(items) {
  const grouped = {}
  for (const item of items) {
    if (!grouped[item.category]) {
      grouped[item.category] = []
    }
    grouped[item.category].push(item)
  }
  return grouped
}

function categoryToTitle(category) {
  const titles = {
    types: 'Type Aliases',
    interfaces: 'Interfaces',
    enums: 'Enums',
    functions: 'Functions',
    classes: 'Classes',
    constants: 'Constants'
  }
  return titles[category] || category
}

function isBreakingChange(change) {
  const breakingTypes = [
    'member_removed',
    'method_removed',
    'member_type_changed',
    'method_return_type_changed',
    'method_signature_changed',
    'return_type_changed',
    'parameters_changed',
    'enum_member_removed'
  ]
  return breakingTypes.includes(change.type)
}

function formatChange(change) {
  switch (change.type) {
    case 'member_added':
      return `- ✨ Added member: \`${change.name}\``
    case 'member_removed':
      return `- ⚠️ **Breaking**: Removed member: \`${change.name}\``
    case 'member_type_changed':
      return `- ⚠️ **Breaking**: Member \`${change.name}\` type changed: \`${change.from}\` → \`${change.to}\``
    case 'member_optionality_changed':
      return `- ${change.to === 'required' ? '⚠️ **Breaking**' : '✨'}: Member \`${change.name}\` is now ${change.to}`
    case 'method_added':
      return `- ✨ Added method: \`${change.name}()\``
    case 'method_removed':
      return `- ⚠️ **Breaking**: Removed method: \`${change.name}()\``
    case 'method_return_type_changed':
      return `- ⚠️ **Breaking**: Method \`${change.name}()\` return type changed: \`${change.from}\` → \`${change.to}\``
    case 'method_signature_changed':
      return `- ⚠️ **Breaking**: Method \`${change.name}()\` signature changed`
    case 'return_type_changed':
      return `- ⚠️ **Breaking**: Return type changed: \`${change.from}\` → \`${change.to}\``
    case 'parameters_changed':
      return `- ⚠️ **Breaking**: Function parameters changed`
    case 'enum_member_added':
      return `- ✨ Added enum value: \`${change.name}\``
    case 'enum_member_removed':
      return `- ⚠️ **Breaking**: Removed enum value: \`${change.name}\``
    default:
      return null
  }
}

// Main execution
const changes = compareApis(previousApi, currentApi)
const changelog = formatChangelog(changes, previousVersion, currentVersion)

// eslint-disable-next-line no-console
console.log(changelog)
