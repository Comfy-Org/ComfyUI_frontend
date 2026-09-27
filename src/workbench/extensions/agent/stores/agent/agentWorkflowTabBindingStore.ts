import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { toRaw, watch } from 'vue'

import { areWorkflowIdsEquivalent } from '@/platform/workflow/core/utils/workflowId'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { clearLegacyAgentStorage } from '@/platform/workflow/persistence/base/storageIO'
import {
  getWorkspaceId,
  StorageKeys
} from '@/platform/workflow/persistence/base/storageKeys'

const BINDING_TTL_MS = 30 * 24 * 60 * 60 * 1000

interface PersistedBinding {
  tabPath: string
  graphId: string | null
  confirmedAt: number
}

type PersistedBindings = Record<string, PersistedBinding>

interface OpenTab {
  tab: ComfyWorkflow
  path: string
}

function isPersistedBinding(value: unknown): value is PersistedBinding {
  if (typeof value !== 'object' || value === null) return false
  const { tabPath, graphId, confirmedAt } = value as Record<string, unknown>
  return (
    typeof tabPath === 'string' &&
    (graphId === null || typeof graphId === 'string') &&
    typeof confirmedAt === 'number'
  )
}

function liveBindings(
  bindings: Record<string, unknown>,
  now: number
): PersistedBindings {
  return Object.fromEntries(
    Object.entries(bindings).filter(
      (entry): entry is [string, PersistedBinding] =>
        isPersistedBinding(entry[1]) &&
        entry[1].confirmedAt + BINDING_TTL_MS >= now
    )
  )
}

function graphIdOf(tab: ComfyWorkflow): string | undefined {
  const activeId = tab.activeState?.id
  if (activeId !== undefined) return activeId
  if (typeof tab.originalContent !== 'string') return undefined
  try {
    const parsed: unknown = JSON.parse(tab.originalContent)
    return typeof parsed === 'object' &&
      parsed !== null &&
      'id' in parsed &&
      typeof parsed.id === 'string'
      ? parsed.id
      : undefined
  } catch {
    return undefined
  }
}

export const useAgentWorkflowTabBindingStore = defineStore(
  'agentWorkflowTabBinding',
  () => {
    clearLegacyAgentStorage()
    const tabByWorkflow = useLocalStorage<PersistedBindings>(
      StorageKeys.agentWorkflowTabBindings(getWorkspaceId()),
      {}
    )
    tabByWorkflow.value = liveBindings(tabByWorkflow.value, Date.now())

    const workflows = useWorkflowStore()
    const boundInstances = new Map<string, ComfyWorkflow>()
    const refusedInstances = new Map<string, ComfyWorkflow>()

    function recordFor(workflowId: string): PersistedBinding | undefined {
      return Object.hasOwn(tabByWorkflow.value, workflowId)
        ? tabByWorkflow.value[workflowId]
        : undefined
    }

    function recordIdFor(tabPath: string): string | undefined {
      for (const [workflowId, record] of Object.entries(tabByWorkflow.value)) {
        if (record.tabPath === tabPath) return workflowId
      }
      return undefined
    }

    function isVerifiedOwner(workflowId: string, tab: ComfyWorkflow): boolean {
      return boundInstances.get(workflowId) === toRaw(tab)
    }

    // The document id is the proof. A saved workflow may still claim a record
    // that predates ids, and a tab refused as a draft does not become the owner
    // by being saved in place at the record's path.
    function claimable(
      workflowId: string,
      record: PersistedBinding,
      tab: ComfyWorkflow
    ): boolean {
      if (refusedInstances.get(workflowId) === toRaw(tab)) return false
      const graphId = graphIdOf(tab)
      if (record.graphId === null || graphId === undefined)
        return !tab.isTemporary
      return areWorkflowIdsEquivalent(graphId, record.graphId, tab.legacyId)
    }

    function blockedByOccupant(
      workflowId: string,
      record: PersistedBinding
    ): boolean {
      const occupant = workflows.openWorkflows.find(
        (tab) => tab.path === record.tabPath
      )
      return (
        occupant !== undefined &&
        !isVerifiedOwner(workflowId, occupant) &&
        !claimable(workflowId, record, occupant)
      )
    }

    function unbind(tabPath: string): void {
      for (const [workflowId, record] of Object.entries(tabByWorkflow.value)) {
        if (record.tabPath === tabPath) {
          delete tabByWorkflow.value[workflowId]
          boundInstances.delete(workflowId)
          refusedInstances.delete(workflowId)
        }
      }
    }

    /**
     * Drops one workflow's record wherever it sits. Path-keyed `unbind` would
     * take whichever workflow occupies the path now, which is the wrong one
     * once the tab has been rebound.
     */
    function unbindWorkflow(workflowId: string): void {
      if (!Object.hasOwn(tabByWorkflow.value, workflowId)) return
      delete tabByWorkflow.value[workflowId]
      boundInstances.delete(workflowId)
      refusedInstances.delete(workflowId)
    }

    function releaseClosedTab({ tab, path }: OpenTab): void {
      const workflowId = recordIdFor(path)
      if (workflowId === undefined) return
      if (refusedInstances.get(workflowId) === toRaw(tab))
        refusedInstances.delete(workflowId)
      if (isVerifiedOwner(workflowId, tab)) unbind(path)
    }

    function adoptOpenTab({ tab, path }: OpenTab): void {
      const workflowId = recordIdFor(path)
      if (workflowId === undefined || boundInstances.has(workflowId)) return
      const record = tabByWorkflow.value[workflowId]
      if (!claimable(workflowId, record, tab)) {
        refusedInstances.set(workflowId, toRaw(tab))
        return
      }
      boundInstances.set(workflowId, toRaw(tab))
      tabByWorkflow.value[workflowId] = { ...record, confirmedAt: Date.now() }
    }

    watch(
      (): OpenTab[] =>
        workflows.openWorkflows.map((tab) => ({ tab, path: tab.path })),
      (open, previous = []) => {
        previous
          .filter(({ tab }) => !open.some((entry) => entry.tab === tab))
          .forEach(releaseClosedTab)
        open.forEach(adoptOpenTab)
      },
      { immediate: true }
    )

    function matchesWorkflow(
      workflowId: string,
      workflow: ComfyWorkflow
    ): boolean {
      return !workflow.isTemporary || isVerifiedOwner(workflowId, workflow)
    }

    function bind(workflowId: string, tabPath: string): void {
      unbind(tabPath)
      refusedInstances.delete(workflowId)
      const workflow = workflows.getWorkflowByPath(tabPath)
      if (workflow) boundInstances.set(workflowId, toRaw(workflow))
      else boundInstances.delete(workflowId)
      tabByWorkflow.value = {
        ...tabByWorkflow.value,
        [workflowId]: {
          tabPath,
          graphId: workflow ? (graphIdOf(workflow) ?? null) : null,
          confirmedAt: Date.now()
        }
      }
    }

    function tabPathFor(workflowId: string): string | undefined {
      const record = recordFor(workflowId)
      return record !== undefined && !blockedByOccupant(workflowId, record)
        ? record.tabPath
        : undefined
    }

    function workflowIdFor(tabPath: string): string | undefined {
      const workflowId = recordIdFor(tabPath)
      return workflowId !== undefined &&
        !blockedByOccupant(workflowId, tabByWorkflow.value[workflowId])
        ? workflowId
        : undefined
    }

    return {
      bind,
      unbind,
      unbindWorkflow,
      matchesWorkflow,
      tabPathFor,
      workflowIdFor
    }
  }
)
