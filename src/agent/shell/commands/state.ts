import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'

import type { Command, CommandRegistry } from '../types'
import { emptyIter, stringIter } from '../types'

/**
 * Read-only state commands that mirror what the user sees in the UI.
 * Each command is backed by a Pinia store (not a raw API call), so the
 * numbers stay consistent with banners, error panels, and badges.
 */

const missingModels: Command = async () => {
  const store = useMissingModelStore()
  const candidates = store.missingModelCandidates ?? []
  if (candidates.length === 0) {
    return { stdout: stringIter('0 missing models\n'), exitCode: 0 }
  }
  const lines = candidates.map((m) => {
    const where = m.nodeId !== undefined ? `node #${m.nodeId}` : 'workflow'
    const dir = m.directory ? ` (${m.directory})` : ''
    const status =
      m.isMissing === true
        ? 'MISSING'
        : m.isMissing === false
          ? 'installed'
          : 'pending'
    return `${status}\t${m.nodeType}.${m.widgetName}\t${m.name}${dir}\t${where}`
  })
  return {
    stdout: stringIter(lines.join('\n') + '\n'),
    exitCode: 0
  }
}

const workflowErrors: Command = async () => {
  const errorStore = useExecutionErrorStore()
  const missingStore = useMissingModelStore()
  const lines: string[] = []
  if (missingStore.missingModelCount > 0) {
    lines.push(`missing models: ${missingStore.missingModelCount}`)
  }
  if (errorStore.hasAnyError) {
    lines.push(`errors detected (see UI error overlay for detail)`)
  }
  if (lines.length === 0) {
    return { stdout: stringIter('no errors\n'), exitCode: 0 }
  }
  return { stdout: stringIter(lines.join('\n') + '\n'), exitCode: 0 }
}

const activeWorkflow: Command = async () => {
  const store = useWorkflowStore()
  const wf = store.activeWorkflow
  if (!wf) {
    return { stdout: stringIter('no active workflow\n'), exitCode: 0 }
  }
  const lines = [
    `path: ${wf.path}`,
    `modified: ${wf.isModified ? 'yes' : 'no'}`,
    `persisted: ${wf.isPersisted ? 'yes' : 'no'}`
  ]
  return { stdout: stringIter(lines.join('\n') + '\n'), exitCode: 0 }
}

const help: Command = async () => {
  const lines = [
    'Available commands (this session):',
    '  coreutils: echo cat ls pwd wc head tail grep true false',
    '  comfy:     cmd <id>            invoke a registered UI command',
    '             cmd-list [regex]    discover command ids',
    '  state:     missing-models       list missing models (same as UI banner)',
    '             workflow-errors      summarize errors on the active workflow',
    '             active-workflow      show the active workflow path + flags',
    '             show-errors          open the right-side errors panel',
    '             show-missing-models  open the errors panel and focus missing models',
    '             help                 this message',
    'Mounts: /tmp (in-memory scratch), /workflows (saved workflows)'
  ]
  return { stdout: stringIter(lines.join('\n') + '\n'), exitCode: 0 }
}

const showErrorsPanel: Command = async () => {
  const panel = useRightSidePanelStore()
  panel.openPanel('errors')
  const errorStore = useExecutionErrorStore()
  errorStore.dismissErrorOverlay()
  return { stdout: stringIter('opened right-side errors panel\n'), exitCode: 0 }
}

const showMissingModels: Command = async () => {
  const missing = useMissingModelStore()
  if (missing.missingModelCount === 0) {
    return { stdout: emptyIter(), exitCode: 0, stderr: 'no missing models' }
  }
  const panel = useRightSidePanelStore()
  panel.openPanel('errors')
  const errorStore = useExecutionErrorStore()
  errorStore.dismissErrorOverlay()
  return {
    stdout: stringIter(
      `opened errors panel (${missing.missingModelCount} missing models)\n`
    ),
    exitCode: 0
  }
}

export function registerStateCommands(registry: CommandRegistry): void {
  registry.register('missing-models', missingModels)
  registry.register('workflow-errors', workflowErrors)
  registry.register('active-workflow', activeWorkflow)
  registry.register('show-errors', showErrorsPanel)
  registry.register('show-missing-models', showMissingModels)
  registry.register('help', help)
}
