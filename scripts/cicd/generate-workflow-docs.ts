#!/usr/bin/env tsx
/**
 * Generate workflow documentation from GitHub Actions workflow files
 *
 * This script:
 * 1. Scans all workflow YAML files in .github/workflows
 * 2. Extracts metadata (name, description, triggers, labels)
 * 3. Updates the workflows README.md with current information
 */
import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { parse } from 'yaml'

interface WorkflowMetadata {
  filename: string
  name: string
  description?: string
  prefix: string
  triggers: string[]
  labelTriggers: string[]
}

interface WorkflowsByPrefix {
  [prefix: string]: {
    description: string
    workflows: WorkflowMetadata[]
  }
}

const WORKFLOWS_DIR = join(process.cwd(), '.github/workflows')
const README_PATH = join(WORKFLOWS_DIR, 'README.md')

// Category descriptions for workflow prefixes
const PREFIX_DESCRIPTIONS: Record<string, string> = {
  'ci-': 'Testing, linting, validation',
  'release-': 'Version management, publishing',
  'pr-': 'PR automation (triggered by labels)',
  'api-': 'External API type generation',
  'i18n-': 'Internationalization updates',
  'publish-': 'Publishing and deployment',
  'version-': 'Version management'
}

/**
 * Add a label to the list if it's not already present
 */
function addUniqueLabel(labels: string[], label: string): void {
  if (!labels.includes(label)) {
    labels.push(label)
  }
}

/**
 * Extract label triggers from workflow content
 */
function extractLabelTriggers(content: string, workflowData: any): string[] {
  const labels: string[] = []

  // Check for label_trigger in anthropics/claude-code-action
  const labelTriggerMatch = content.match(/label_trigger:\s*["']([^"']+)["']/i)
  if (labelTriggerMatch) {
    labels.push(labelTriggerMatch[1])
  }

  // Check for github.event.label.name == 'label-name' pattern
  const labelNameMatches = content.matchAll(
    /github\.event\.label\.name\s*==\s*['"]([^'"]+)['"]/gi
  )
  for (const match of labelNameMatches) {
    addUniqueLabel(labels, match[1])
  }

  // Check for contains(github.event.pull_request.labels.*.name, 'label-name') pattern
  const containsLabelMatches = content.matchAll(
    /contains\(github\.event\.pull_request\.labels\.\*\.name,\s*['"]([^'"]+)['"]\)/gi
  )
  for (const match of containsLabelMatches) {
    addUniqueLabel(labels, match[1])
  }

  // Check for startsWith patterns with comment commands (e.g., /update-playwright)
  // These are included as they can trigger workflows through PR comments
  const labelCommentMatches = content.matchAll(
    /startsWith\(github\.event\.comment\.body,\s*['"]([^'"]+)['"]\)/gi
  )
  for (const match of labelCommentMatches) {
    const command = match[1]
    if (command) {
      addUniqueLabel(labels, command)
    }
  }

  return labels
}

/**
 * Extract trigger information from workflow
 */
function extractTriggers(workflowData: any): string[] {
  const triggers: string[] = []
  const on = workflowData.on

  if (!on) return triggers

  if (typeof on === 'string') {
    triggers.push(on)
  } else if (Array.isArray(on)) {
    triggers.push(...on)
  } else if (typeof on === 'object') {
    // Handle workflow_dispatch
    if (on.workflow_dispatch !== undefined) {
      triggers.push('workflow_dispatch (manual)')
    }

    // Handle pull_request with types
    if (on.pull_request) {
      if (typeof on.pull_request === 'object' && on.pull_request.types) {
        const types = Array.isArray(on.pull_request.types)
          ? on.pull_request.types.join(', ')
          : on.pull_request.types
        triggers.push(`pull_request (${types})`)
      } else {
        triggers.push('pull_request')
      }
    }

    // Handle pull_request_target
    if (on.pull_request_target) {
      if (
        typeof on.pull_request_target === 'object' &&
        on.pull_request_target.types
      ) {
        const types = Array.isArray(on.pull_request_target.types)
          ? on.pull_request_target.types.join(', ')
          : on.pull_request_target.types
        triggers.push(`pull_request_target (${types})`)
      } else {
        triggers.push('pull_request_target')
      }
    }

    // Handle push
    if (on.push) {
      triggers.push('push')
    }

    // Handle schedule
    if (on.schedule) {
      triggers.push('schedule')
    }

    // Handle issue_comment
    if (on.issue_comment) {
      if (typeof on.issue_comment === 'object' && on.issue_comment.types) {
        const types = Array.isArray(on.issue_comment.types)
          ? on.issue_comment.types.join(', ')
          : on.issue_comment.types
        triggers.push(`issue_comment (${types})`)
      } else {
        triggers.push('issue_comment')
      }
    }
  }

  return triggers
}

/**
 * Parse a single workflow file and extract metadata
 */
function parseWorkflowFile(filename: string): WorkflowMetadata | null {
  try {
    const filepath = join(WORKFLOWS_DIR, filename)
    const content = readFileSync(filepath, 'utf-8')
    const workflowData = parse(content)

    if (!workflowData || !workflowData.name) {
      console.warn(`Skipping ${filename}: no name field`)
      return null
    }

    // Determine prefix from filename
    const prefixMatch = filename.match(/^([a-z0-9]+)-/)
    const prefix = prefixMatch ? prefixMatch[1] + '-' : 'other-'

    const metadata: WorkflowMetadata = {
      filename,
      name: workflowData.name,
      description: workflowData.description,
      prefix,
      triggers: extractTriggers(workflowData),
      labelTriggers: extractLabelTriggers(content, workflowData)
    }

    return metadata
  } catch (error) {
    console.error(`Error parsing ${filename}:`, error)
    return null
  }
}

/**
 * Group workflows by prefix
 */
function groupWorkflowsByPrefix(
  workflows: WorkflowMetadata[]
): WorkflowsByPrefix {
  const grouped: WorkflowsByPrefix = {}

  for (const workflow of workflows) {
    if (!grouped[workflow.prefix]) {
      grouped[workflow.prefix] = {
        description: PREFIX_DESCRIPTIONS[workflow.prefix] || 'Other workflows',
        workflows: []
      }
    }
    grouped[workflow.prefix].workflows.push(workflow)
  }

  // Sort workflows within each group by filename
  for (const prefix in grouped) {
    grouped[prefix].workflows.sort((a, b) =>
      a.filename.localeCompare(b.filename)
    )
  }

  return grouped
}

/**
 * Generate markdown table for workflow categories
 */
function generateCategoryTable(grouped: WorkflowsByPrefix): string {
  const prefixOrder = [
    'ci-',
    'pr-',
    'release-',
    'api-',
    'i18n-',
    'publish-',
    'version-',
    'other-'
  ]

  let table =
    '| Prefix     | Purpose                             | Example                              |\n'
  table +=
    '| ---------- | ----------------------------------- | ------------------------------------ |\n'

  for (const prefix of prefixOrder) {
    if (grouped[prefix]) {
      const example = grouped[prefix].workflows[0]?.filename || ''
      const purpose = grouped[prefix].description
      table += `| \`${prefix}\` | ${purpose} | \`${example}\` |\n`
    }
  }

  return table
}

/**
 * Generate detailed workflow list with descriptions
 */
function generateWorkflowList(grouped: WorkflowsByPrefix): string {
  const prefixOrder = [
    'ci-',
    'pr-',
    'release-',
    'api-',
    'i18n-',
    'publish-',
    'version-',
    'other-'
  ]
  let markdown = ''

  for (const prefix of prefixOrder) {
    if (!grouped[prefix]) continue

    const category = grouped[prefix]
    const prefixName =
      prefix === 'other-'
        ? 'Other Workflows'
        : prefix.replace('-', '').toUpperCase()

    markdown += `\n### ${prefixName}\n\n`

    for (const workflow of category.workflows) {
      markdown += `#### [\`${workflow.filename}\`](./${workflow.filename})\n\n`
      markdown += `**Name:** ${workflow.name}\n\n`

      if (workflow.description) {
        markdown += `**Description:** ${workflow.description}\n\n`
      }

      if (workflow.triggers.length > 0) {
        markdown += `**Triggers:** ${workflow.triggers.join(', ')}\n\n`
      }

      if (workflow.labelTriggers.length > 0) {
        markdown += `**Label Triggers:** \`${workflow.labelTriggers.join('`, `')}\`\n\n`
      }
    }
  }

  return markdown
}

/**
 * Generate quick reference for label-triggered workflows
 */
function generateQuickReference(grouped: WorkflowsByPrefix): string {
  const allWorkflows = Object.values(grouped).flatMap((g) => g.workflows)
  const labelWorkflows = allWorkflows.filter((w) => w.labelTriggers.length > 0)

  if (labelWorkflows.length === 0) {
    return ''
  }

  // Group workflows by label to avoid duplicates
  const labelMap = new Map<string, string[]>()
  for (const workflow of labelWorkflows) {
    for (const label of workflow.labelTriggers) {
      // Filter out comment-based triggers (commands starting with /) from Quick Reference
      // These are still shown in detailed workflow sections with full context
      if (label.startsWith('/')) {
        continue
      }
      const description = workflow.description || workflow.name
      if (!labelMap.has(label)) {
        labelMap.set(label, [])
      }
      labelMap.get(label)!.push(description)
    }
  }

  let markdown = '## Quick Reference\n\n'
  markdown +=
    'For label-triggered workflows, add the corresponding label to a PR to trigger the workflow:\n'

  // Sort labels alphabetically for consistency
  const sortedLabels = Array.from(labelMap.keys()).sort()
  for (const label of sortedLabels) {
    const descriptions = labelMap.get(label)!
    // Use the first description, or note if multiple workflows share the same label
    const description =
      descriptions.length === 1
        ? descriptions[0]
        : `Triggers ${descriptions.length} workflows`
    markdown += `- \`${label}\` - ${description}\n`
  }

  markdown +=
    '\nFor manual workflows, use the "Run workflow" button in the Actions tab.\n'

  return markdown
}

/**
 * Generate the complete README content
 */
function generateReadme(grouped: WorkflowsByPrefix): string {
  const categoryTable = generateCategoryTable(grouped)
  const quickReference = generateQuickReference(grouped)
  const workflowList = generateWorkflowList(grouped)

  return `# GitHub Workflows

This directory contains GitHub Actions workflow files that automate various aspects of the ComfyUI frontend development and release process.

> **Note:** This documentation is auto-generated from workflow files. Do not edit manually.
> Run \`pnpm workflow:docs\` to regenerate.

## Naming Convention

Workflow files follow a consistent naming pattern: \`<prefix>-<descriptive-name>.yaml\`

### Category Prefixes

${categoryTable}

${quickReference}

## Workflow Details

${workflowList}

## Documentation

For more information about GitHub Actions, see:
- [Events that trigger workflows](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows)
- [Workflow syntax](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions)

## Maintaining Workflows

### Adding a New Workflow

1. Create a new workflow file following the naming convention
2. Include \`name\` and \`description\` fields at the top of the workflow
3. Run \`pnpm workflow:docs\` to update this README
4. Commit both the workflow file and updated README

### Best Practices

1. **Always include a description**: Add a \`description\` field after the \`name\` field
2. **Use consistent prefixes**: Follow the established prefix conventions
3. **Label-triggered workflows**: For PR automation, use the \`pr-\` prefix
4. **Document triggers**: Make trigger conditions clear in the workflow description
5. **Keep docs in sync**: Run \`pnpm workflow:docs\` after any workflow changes
`
}

/**
 * Main function
 */
function main() {
  // Read all workflow files
  const files = readdirSync(WORKFLOWS_DIR).filter(
    (f) => f.endsWith('.yaml') || f.endsWith('.yml')
  )
  const workflowFiles = files.filter((f) => f !== 'README.md')

  // Parse each workflow
  const workflows: WorkflowMetadata[] = []
  for (const filename of workflowFiles) {
    const metadata = parseWorkflowFile(filename)
    if (metadata) {
      workflows.push(metadata)
    }
  }

  // Group workflows by prefix
  const grouped = groupWorkflowsByPrefix(workflows)

  // Generate README
  const readme = generateReadme(grouped)
  writeFileSync(README_PATH, readme, 'utf-8')

  // Show label-triggered workflows for validation
  const labelWorkflows = workflows.filter((w) => w.labelTriggers.length > 0)
  if (labelWorkflows.length > 0 && process.env.VERBOSE) {
    for (const workflow of labelWorkflows) {
      console.warn(
        `Label-triggered: ${workflow.name}: ${workflow.labelTriggers.join(', ')}`
      )
    }
  }
}

main()
