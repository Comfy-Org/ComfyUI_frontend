import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

import type { Command, CommandRegistry } from '../types'
import { emptyIter, stringIter } from '../types'

interface TemplateInfoSlim {
  name?: string
  title?: string
  localizedTitle?: string
  description?: string
  sourceModule?: string
}

interface TemplateModuleSlim {
  moduleName: string
  templates: TemplateInfoSlim[]
}

async function fetchTemplateJson(
  id: string,
  sourceModule: string
): Promise<unknown> {
  if (sourceModule === 'default') {
    return fetch(api.fileURL(`/templates/${id}.json`)).then((r) => r.json())
  }
  return fetch(
    api.apiURL(`/workflow_templates/${sourceModule}/${id}.json`)
  ).then((r) => r.json())
}

/**
 * templates [filter]
 *
 * List available workflow templates. Output columns: moduleName/id — title.
 * Optional regex/substring filter (case-insensitive) matches title, id, or
 * description. Use before `load-template` to find a starting workflow.
 */
const templatesList: Command = async (ctx) => {
  const filter = ctx.argv.slice(1).join(' ').trim()
  let regex: RegExp | null = null
  if (filter) {
    try {
      regex = new RegExp(filter, 'i')
    } catch {
      const escaped = filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      regex = new RegExp(escaped, 'i')
    }
  }

  const store = useWorkflowTemplatesStore()
  try {
    if (!store.isLoaded) await store.loadWorkflowTemplates()
  } catch (err) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr:
        'templates: failed to load index — ' +
        (err instanceof Error ? err.message : String(err))
    }
  }

  const groups = store.groupedTemplates as Array<{
    label: string
    modules: TemplateModuleSlim[]
  }>
  const lines: string[] = []
  let total = 0
  for (const group of groups) {
    for (const mod of group.modules) {
      for (const tpl of mod.templates) {
        const id = tpl.name ?? ''
        const title = tpl.localizedTitle ?? tpl.title ?? id
        const desc = (tpl.description ?? '').replace(/\s+/g, ' ').slice(0, 80)
        if (
          regex &&
          !regex.test(id) &&
          !regex.test(title) &&
          !regex.test(desc)
        ) {
          continue
        }
        lines.push(`${mod.moduleName}/${id} — ${title}`)
        total++
      }
    }
  }
  if (total === 0) {
    return {
      stdout: stringIter(
        filter
          ? `(no templates match "${filter}")\n`
          : '(no templates loaded)\n'
      ),
      exitCode: 0
    }
  }
  lines.push('', `${total} template(s). Use: load-template <moduleName> <id>`)
  return { stdout: stringIter(lines.join('\n') + '\n'), exitCode: 0 }
}

/**
 * load-template <moduleName> <id>
 *
 * Load a workflow template by module + id (as shown by `templates`).
 * Replaces the active workflow. Use when the user asks for something
 * starting from a standard pipeline instead of building from scratch.
 */
const loadTemplate: Command = async (ctx) => {
  const [, moduleName, id] = ctx.argv
  if (!moduleName || !id) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'usage: load-template <moduleName> <id>  (run `templates` first)'
    }
  }
  const store = useWorkflowTemplatesStore()
  try {
    if (!store.isLoaded) await store.loadWorkflowTemplates()
  } catch {
    /* keep going with whatever sourceModule was passed */
  }

  // Resolve the real sourceModule: when listings show moduleName='all',
  // the template carries its own sourceModule. Also handles the common
  // case of a template id that only lives under one known sourceModule.
  let resolvedSource = moduleName
  const groups = store.groupedTemplates as Array<{
    modules: TemplateModuleSlim[]
  }>
  outer: for (const g of groups) {
    for (const mod of g.modules) {
      if (mod.moduleName !== moduleName && moduleName !== 'all') continue
      for (const tpl of mod.templates) {
        if (tpl.name === id) {
          resolvedSource = tpl.sourceModule ?? mod.moduleName
          break outer
        }
      }
    }
  }

  try {
    const json = (await fetchTemplateJson(id, resolvedSource)) as Parameters<
      typeof app.loadGraphData
    >[0]
    await app.loadGraphData(json, true, true, id, {
      openSource: 'template'
    })
    return {
      stdout: stringIter(
        `loaded template ${resolvedSource}/${id}` +
          (resolvedSource !== moduleName
            ? ` (resolved from ${moduleName})`
            : '') +
          '\n'
      ),
      exitCode: 0
    }
  } catch (err) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr:
        `load-template: failed to load ${resolvedSource}/${id} — ` +
        (err instanceof Error ? err.message : String(err))
    }
  }
}

export function registerTemplateCommands(registry: CommandRegistry): void {
  registry.register('templates', templatesList)
  registry.register('load-template', loadTemplate)
}
