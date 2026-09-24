import type { Page } from '@playwright/test'

import type { useAgentWorkflowTabBindingStore } from '@/workbench/extensions/agent/stores/agent/agentWorkflowTabBindingStore'

type AgentWorkflowTabBindingStore = ReturnType<
  typeof useAgentWorkflowTabBindingStore
>

type ScopeAction =
  | { kind: 'drop'; workflowId: string }
  | { kind: 'restore'; workflowId: string; tabPath: string }

/**
 * Runs one binding action against the real, mounted `agentWorkflowTabBinding`
 * Pinia store, the same store `AgentPanelRoot.vue`'s `getScope()` reads
 * through `boundOrOpenWorkflowFor`. Store instances cannot cross the
 * `page.evaluate` serialization boundary, so this is the single place that
 * reaches into the app's private Pinia map (`$pinia._s`); callers below
 * never touch it directly.
 */
function runScopeAction(
  page: Page,
  action: ScopeAction
): Promise<string | undefined> {
  return page.evaluate((action) => {
    const vueApp = document.getElementById('vue-app')
    if (vueApp === null) throw new Error('#vue-app is not mounted')
    // Vue attaches `__vue_app__` to the mount element at runtime; no public
    // type covers it, so this is the one unavoidable boundary cast.
    const pinia = (
      vueApp as unknown as {
        __vue_app__: {
          config: {
            globalProperties: { $pinia: { _s: Map<string, unknown> } }
          }
        }
      }
    ).__vue_app__.config.globalProperties.$pinia
    const store: unknown = pinia._s.get('agentWorkflowTabBinding')
    if (
      typeof store !== 'object' ||
      store === null ||
      !('tabPathFor' in store) ||
      !('bind' in store) ||
      !('unbindWorkflow' in store)
    )
      throw new Error('agentWorkflowTabBinding store is not mounted')
    const binding = store as AgentWorkflowTabBindingStore

    if (action.kind === 'drop') {
      const tabPath = binding.tabPathFor(action.workflowId)
      if (tabPath === undefined)
        throw new Error(`no bound tab path for workflow ${action.workflowId}`)
      binding.unbindWorkflow(action.workflowId)
      return tabPath
    }
    binding.bind(action.workflowId, action.tabPath)
    return undefined
  }, action)
}

/**
 * Drops the agent's workflow-tab binding so `getScope()` (AgentPanelRoot.vue)
 * resolves to null on the next batch, reproducing the same "can't resolve
 * which tab this edit is bound to" race the retry recovers from, without
 * touching the doc or sending another frame. Returns the bound tab path so
 * the caller can restore the exact same binding afterward.
 */
export async function dropWorkflowScope(
  page: Page,
  workflowId: string
): Promise<string> {
  const tabPath = await runScopeAction(page, { kind: 'drop', workflowId })
  if (tabPath === undefined)
    throw new Error(`no bound tab path for workflow ${workflowId}`)
  return tabPath
}

/** Restores a workflow-tab binding previously dropped by `dropWorkflowScope`. */
export async function restoreWorkflowScope(
  page: Page,
  workflowId: string,
  tabPath: string
): Promise<void> {
  await runScopeAction(page, { kind: 'restore', workflowId, tabPath })
}
