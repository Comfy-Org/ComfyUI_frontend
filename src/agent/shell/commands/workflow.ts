import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'
import { ensureWorkflowSuffix, getWorkflowSuffix } from '@/utils/formatUtil'
import { getAllNonIoNodesInSubgraph } from '@/utils/graphTraversalUtil'

import type { Command, CommandRegistry } from '../types'
import { emptyIter, stringIter } from '../types'

function stripQuotes(s: string): string {
  return s.trim().replace(/^['"`]|['"`]$/g, '')
}

/**
 * save-as <name>
 *
 * Non-interactive "Save Workflow As". The core Comfy.SaveWorkflowAs command
 * opens a modal prompt for the filename, which blocks the agent's
 * tool-call flow. This wrapper calls workflowService.saveWorkflowAs with
 * a pre-supplied filename so the LLM can save in one step.
 */
const saveAs: Command = async (ctx) => {
  const name = stripQuotes(ctx.argv.slice(1).join(' '))
  if (!name) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'usage: save-as <filename>'
    }
  }
  const workflow = useWorkflowStore().activeWorkflow as ComfyWorkflow | null
  if (!workflow) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: 'save-as: no active workflow'
    }
  }
  try {
    const ok = await useWorkflowService().saveWorkflowAs(workflow, {
      filename: name
    })
    if (!ok) {
      return {
        stdout: emptyIter(),
        exitCode: 1,
        stderr: 'save-as: cancelled or failed'
      }
    }
    return { stdout: stringIter(`saved as ${name}\n`), exitCode: 0 }
  } catch (err) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: err instanceof Error ? err.message : String(err)
    }
  }
}

/**
 * new-workflow [name]
 *
 * Create a new blank workflow. If a name is given, immediately persist it
 * via save-as so the file is visible in /workflows without a modal.
 */
const newWorkflow: Command = async (ctx) => {
  const name = stripQuotes(ctx.argv.slice(1).join(' '))
  try {
    await useCommandStore().execute('Comfy.NewBlankWorkflow')
    if (!name) {
      return { stdout: stringIter('new blank workflow\n'), exitCode: 0 }
    }
    const workflow = useWorkflowStore().activeWorkflow as ComfyWorkflow | null
    if (!workflow) {
      return {
        stdout: emptyIter(),
        exitCode: 1,
        stderr: 'new-workflow: no active workflow after create'
      }
    }
    const ok = await useWorkflowService().saveWorkflowAs(workflow, {
      filename: name
    })
    if (!ok) {
      return {
        stdout: emptyIter(),
        exitCode: 1,
        stderr: 'new-workflow: save-as cancelled or failed'
      }
    }
    return {
      stdout: stringIter(`new workflow saved as ${name}\n`),
      exitCode: 0
    }
  } catch (err) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: err instanceof Error ? err.message : String(err)
    }
  }
}

/**
 * rename-workflow <newname>
 *
 * Non-interactive rename of the active persisted workflow. Bypasses the
 * modal prompt opened by Comfy.RenameWorkflow.
 */
const renameWorkflow: Command = async (ctx) => {
  const newName = stripQuotes(ctx.argv.slice(1).join(' '))
  if (!newName) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'usage: rename-workflow <newname>'
    }
  }
  const workflow = useWorkflowStore().activeWorkflow as ComfyWorkflow | null
  if (!workflow) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: 'rename-workflow: no active workflow'
    }
  }
  if (!workflow.isPersisted) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: 'rename-workflow: workflow is not persisted — use save-as instead'
    }
  }
  if (newName === workflow.filename) {
    return {
      stdout: stringIter(`rename-workflow: unchanged (${newName})\n`),
      exitCode: 0
    }
  }
  try {
    const suffix = getWorkflowSuffix(workflow.suffix)
    const newPath =
      workflow.directory + '/' + ensureWorkflowSuffix(newName, suffix)
    await useWorkflowService().renameWorkflow(workflow, newPath)
    return {
      stdout: stringIter(`renamed to ${newPath}\n`),
      exitCode: 0
    }
  } catch (err) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: err instanceof Error ? err.message : String(err)
    }
  }
}

/**
 * set-subgraph-desc <description...>
 *
 * Set the BlueprintDescription on the currently-open subgraph.
 * Bypasses the modal prompt opened by Comfy.Subgraph.SetDescription.
 */
const setSubgraphDesc: Command = async (ctx) => {
  const description = ctx.argv.slice(1).join(' ').trim()
  if (!description) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'usage: set-subgraph-desc <description...>'
    }
  }
  const canvas = useCanvasStore().canvas
  const subgraph = canvas?.subgraph
  if (!subgraph) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: 'set-subgraph-desc: no active subgraph'
    }
  }
  try {
    const extra = (subgraph.extra ??= {}) as Record<string, unknown>
    extra.BlueprintDescription = description.trim() || undefined
    useWorkflowStore().activeWorkflow?.changeTracker?.checkState()
    return {
      stdout: stringIter(`subgraph description set\n`),
      exitCode: 0
    }
  } catch (err) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: err instanceof Error ? err.message : String(err)
    }
  }
}

/**
 * set-subgraph-aliases <alias1> [alias2 ...]
 *
 * Set the BlueprintSearchAliases on the currently-open subgraph.
 * Bypasses the modal prompt opened by Comfy.Subgraph.SetSearchAliases.
 */
const setSubgraphAliases: Command = async (ctx) => {
  const raw = ctx.argv.slice(1)
  if (raw.length === 0) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'usage: set-subgraph-aliases <alias1> [alias2 ...]'
    }
  }
  const aliases = raw
    .flatMap((s) => s.split(','))
    .map((s) => s.trim())
    .filter(Boolean)
  const canvas = useCanvasStore().canvas
  const subgraph = canvas?.subgraph
  if (!subgraph) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: 'set-subgraph-aliases: no active subgraph'
    }
  }
  try {
    const extra = (subgraph.extra ??= {}) as Record<string, unknown>
    extra.BlueprintSearchAliases = aliases.length > 0 ? aliases : undefined
    useWorkflowStore().activeWorkflow?.changeTracker?.checkState()
    return {
      stdout: stringIter(`subgraph aliases: ${aliases.join(', ')}\n`),
      exitCode: 0
    }
  } catch (err) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: err instanceof Error ? err.message : String(err)
    }
  }
}

/**
 * clear-workflow --force
 *
 * Clear the active workflow without the native confirm() dialog.
 * The --force flag is mandatory to prevent accidental destruction.
 */
const clearWorkflow: Command = async (ctx) => {
  const force = ctx.argv.slice(1).includes('--force')
  if (!force) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'usage: clear-workflow --force (required to confirm destruction)'
    }
  }
  try {
    app.clean()
    if (app.canvas.subgraph) {
      const subgraph = app.canvas.subgraph
      const nonIoNodes = getAllNonIoNodesInSubgraph(subgraph)
      nonIoNodes.forEach((node) => subgraph.remove(node))
    }
    api.dispatchCustomEvent('graphCleared')
    return { stdout: stringIter('workflow cleared\n'), exitCode: 0 }
  } catch (err) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: err instanceof Error ? err.message : String(err)
    }
  }
}

export function registerWorkflowCommands(registry: CommandRegistry): void {
  registry.register('save-as', saveAs)
  registry.register('new-workflow', newWorkflow)
  registry.register('rename-workflow', renameWorkflow)
  registry.register('set-subgraph-desc', setSubgraphDesc)
  registry.register('set-subgraph-aliases', setSubgraphAliases)
  registry.register('clear-workflow', clearWorkflow)
}
