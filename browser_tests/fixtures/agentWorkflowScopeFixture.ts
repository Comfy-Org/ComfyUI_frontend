import type { Page } from '@playwright/test'

import type { useAgentWorkflowTabBindingStore } from '@/workbench/extensions/agent/stores/agent/agentWorkflowTabBindingStore'
import type { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

type AgentWorkflowTabBindingStore = ReturnType<
  typeof useAgentWorkflowTabBindingStore
>
type WorkflowStore = ReturnType<typeof useWorkflowStore>

/** What `dropWorkflowScope` needs to hand back so the drop can be undone. */
export interface DroppedScope {
  tabPath: string
  filename: string
}

type ScopeAction =
  | { kind: 'drop'; workflowId: string }
  | { kind: 'restore'; workflowId: string; tabPath: string; filename: string }

/**
 * Runs one binding action against the real, mounted `agentWorkflowTabBinding`
 * and `workflow` Pinia stores, the same stores `AgentPanelRoot.vue`'s
 * `getScope()` reads through `boundOrOpenWorkflowFor`. Store instances cannot
 * cross the `page.evaluate` serialization boundary, so this is the single
 * place that reaches into the app's private Pinia map (`$pinia._s`); callers
 * below never touch it directly.
 */
function runScopeAction(
  page: Page,
  action: ScopeAction
): Promise<DroppedScope | undefined> {
  return page.evaluate((action) => {
    function getPinia(): { _s: Map<string, unknown> } {
      const vueApp = document.getElementById('vue-app')
      if (vueApp === null) throw new Error('#vue-app is not mounted')
      // Vue attaches `__vue_app__` to the mount element at runtime; no public
      // type covers it, so this is the one unavoidable boundary cast.
      return (
        vueApp as unknown as {
          __vue_app__: {
            config: {
              globalProperties: { $pinia: { _s: Map<string, unknown> } }
            }
          }
        }
      ).__vue_app__.config.globalProperties.$pinia
    }

    function getBindingStore(pinia: {
      _s: Map<string, unknown>
    }): AgentWorkflowTabBindingStore {
      const store: unknown = pinia._s.get('agentWorkflowTabBinding')
      if (
        typeof store !== 'object' ||
        store === null ||
        !('tabPathFor' in store) ||
        !('bind' in store) ||
        !('unbindWorkflow' in store)
      )
        throw new Error('agentWorkflowTabBinding store is not mounted')
      return store as AgentWorkflowTabBindingStore
    }

    function getWorkflows(pinia: { _s: Map<string, unknown> }): WorkflowStore {
      const workflowStoreRaw: unknown = pinia._s.get('workflow')
      if (
        typeof workflowStoreRaw !== 'object' ||
        workflowStoreRaw === null ||
        !('getWorkflowByPath' in workflowStoreRaw)
      )
        throw new Error('workflow store is not mounted')
      return workflowStoreRaw as WorkflowStore
    }

    function dropScope(
      binding: AgentWorkflowTabBindingStore,
      workflows: WorkflowStore,
      workflowId: string
    ): DroppedScope {
      const tabPath = binding.tabPathFor(workflowId)
      if (tabPath === undefined)
        throw new Error(`no bound tab path for workflow ${workflowId}`)
      const tab = workflows.getWorkflowByPath(tabPath)
      if (!tab) throw new Error(`no open tab at ${tabPath} to drop scope from`)
      const filename = tab.filename
      binding.unbindWorkflow(workflowId)
      // Dropping the binding alone is not enough: `boundOrOpenWorkflowFor`
      // (useAgentWorkflowResolver's `resolveWorkflow`) falls back to
      // re-deriving the same scope by matching this still-open tab's name
      // against the cloud index, exactly as it does on a tab's first
      // activation. Renaming the tab breaks that name match too, so both
      // resolution paths are down while the tab (and its canvas) stays open
      // and observable -- the closed-tab race this reproduces, without
      // actually closing the tab.
      tab.filename = `${filename}\u0000scope-dropped`
      return { tabPath, filename }
    }

    function restoreScope(
      binding: AgentWorkflowTabBindingStore,
      workflows: WorkflowStore,
      restore: Extract<ScopeAction, { kind: 'restore' }>
    ): void {
      const tab = workflows.getWorkflowByPath(restore.tabPath)
      if (tab) tab.filename = restore.filename
      binding.bind(restore.workflowId, restore.tabPath)
    }

    const pinia = getPinia()
    const binding = getBindingStore(pinia)
    const workflows = getWorkflows(pinia)

    if (action.kind === 'drop')
      return dropScope(binding, workflows, action.workflowId)

    restoreScope(binding, workflows, action)
    return undefined
  }, action)
}

/**
 * Drops the agent's workflow-tab binding, and the tab's own cloud-name match,
 * so `getScope()` (AgentPanelRoot.vue) resolves to null on the next batch,
 * reproducing the same "can't resolve which tab this edit is bound to" race
 * the retry recovers from, without touching the doc or sending another
 * frame. Returns the tab path and original filename so the caller can
 * restore the exact same binding afterward.
 */
export async function dropWorkflowScope(
  page: Page,
  workflowId: string
): Promise<DroppedScope> {
  const dropped = await runScopeAction(page, { kind: 'drop', workflowId })
  if (dropped === undefined)
    throw new Error(`no bound tab path for workflow ${workflowId}`)
  return dropped
}

/** Restores a workflow-tab binding previously dropped by `dropWorkflowScope`. */
export async function restoreWorkflowScope(
  page: Page,
  workflowId: string,
  dropped: DroppedScope
): Promise<void> {
  await runScopeAction(page, { kind: 'restore', workflowId, ...dropped })
}
