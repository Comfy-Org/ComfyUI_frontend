import { once } from 'es-toolkit'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import {
  callListener,
  reportListenerFailure
} from '@/platform/nodeApi/shared/listeners'
import type {
  NodeDef,
  NodeDefBuilder,
  Unsubscribe
} from '@/platform/nodeApi/v4/types'
import type { SelectorCandidate, TypeSelection } from './defSelector'
import { HOOK_NAMES, createNodeDefBuilder } from './nodeHooks'
import type { HookCallbackLists, HookCallbacks, HookName } from './nodeHooks'

/** A node type that extensions apply to: one the host registered, or one a pack defined. */
export interface NodeType {
  readonly type: string
  readonly category: string
  /** The class the type's nodes are made from. */
  readonly nodeClass: typeof LGraphNode
  /** A new copy of the type's definition. */
  def(): NodeDef
}

/** What the extensions need from whoever delivers their hooks. */
export interface HookInstaller {
  /** Records a class registered for a type, so its nodes count as the type's. */
  registered(nodeType: NodeType): void
  /** Makes sure the type's nodes, those that exist and those to come, call back for each of `hooks`. */
  install(nodeType: NodeType, hooks: readonly HookName[]): void
  /** The number of applied extensions with a callback for some hook changed. */
  demandChanged(): void
}

interface Extension {
  readonly selects: TypeSelection
  readonly apply: (builder: NodeDefBuilder) => void
  readonly appliedTo: Set<string>
  readonly sequence: number
}

interface Application {
  readonly extension: Extension
  readonly callbacks: HookCallbackLists
}

export interface Extensions {
  extend(
    selects: TypeSelection,
    apply: (builder: NodeDefBuilder) => void
  ): Unsubscribe
  /** Adds the hooks a defined type declares, before any extension's, to that registration of it only. */
  extendOwnType(
    nodeType: NodeType,
    apply: (builder: NodeDefBuilder) => void
  ): Unsubscribe
  /** Records a type, replacing an earlier registration of it, and applies every extension that selects it. */
  typeRegistered(nodeType: NodeType): void
  /** Forgets a type and its hooks, if it is still registered as `nodeType`. */
  typeUnregistered(nodeType: NodeType): void
  nodeType(type: string): NodeType | undefined
  /** Every type, in the order it first registered. */
  nodeTypes(): readonly NodeType[]
  /** The callbacks for `hook` on `type`, in the order they were added. */
  callbacksFor<K extends HookName>(
    type: string,
    hook: K
  ): readonly HookCallbacks[K][]
  /** How many applied extensions have a callback for `hook`. */
  demand(hook: HookName): number
}

export function createExtensions(installer: HookInstaller): Extensions {
  const extensions = new Set<Extension>()
  const nodeTypes = new Map<string, NodeType>()
  const applications = new Map<string, Application[]>()
  const demand = new Map<HookName, number>()

  function countDemand(callbacks: HookCallbackLists, change: 1 | -1): void {
    for (const hook of HOOK_NAMES) {
      if (callbacks[hook].length)
        demand.set(hook, (demand.get(hook) ?? 0) + change)
    }
  }

  function removeApplications(
    type: string,
    remove: (application: Application) => boolean
  ): void {
    const list = applications.get(type) ?? []
    for (const application of list.filter(remove)) {
      application.extension.appliedTo.delete(type)
      countDemand(application.callbacks, -1)
    }
    const kept = list.filter((application) => !remove(application))
    if (kept.length) applications.set(type, kept)
    else applications.delete(type)
  }

  function applyIfSelected(
    extension: Extension,
    nodeType: NodeType,
    candidate: SelectorCandidate
  ): void {
    if (!extensions.has(extension) || !extension.selects(candidate)) return
    const applied = callListener('extend', () => {
      const opened = createNodeDefBuilder(candidate.def())
      try {
        reportRejection('extend', extension.apply(opened.builder))
      } finally {
        opened.close()
      }
      return opened.callbacks
    })
    const hooks = HOOK_NAMES.filter((hook) => applied?.[hook].length)
    if (!applied || hooks.length === 0 || !extensions.has(extension)) return
    applications.set(
      nodeType.type,
      [
        ...(applications.get(nodeType.type) ?? []),
        { extension, callbacks: applied }
      ].sort(
        (first, second) => first.extension.sequence - second.extension.sequence
      )
    )
    extension.appliedTo.add(nodeType.type)
    countDemand(applied, 1)
    installer.install(nodeType, hooks)
  }

  function addExtension(extension: Extension): Unsubscribe {
    extensions.add(extension)
    for (const nodeType of Array.from(nodeTypes.values())) {
      applyIfSelected(extension, nodeType, candidateFor(nodeType))
    }
    installer.demandChanged()
    return once(() => {
      extensions.delete(extension)
      for (const type of Array.from(extension.appliedTo)) {
        removeApplications(
          type,
          (application) => application.extension === extension
        )
      }
      installer.demandChanged()
    })
  }

  let sequence = 0

  return {
    extend: (selects, apply) =>
      addExtension({
        selects,
        apply,
        appliedTo: new Set(),
        sequence: ++sequence
      }),

    extendOwnType: (nodeType, apply) =>
      addExtension({
        selects: (candidate) => nodeTypes.get(candidate.type) === nodeType,
        apply,
        appliedTo: new Set(),
        sequence: 0
      }),

    typeRegistered(nodeType) {
      removeApplications(nodeType.type, () => true)
      nodeTypes.set(nodeType.type, nodeType)
      installer.registered(nodeType)
      const candidate = candidateFor(nodeType)
      for (const extension of Array.from(extensions)) {
        applyIfSelected(extension, nodeType, candidate)
      }
      installer.demandChanged()
    },

    typeUnregistered(nodeType) {
      if (nodeTypes.get(nodeType.type) !== nodeType) return
      nodeTypes.delete(nodeType.type)
      removeApplications(nodeType.type, () => true)
      installer.demandChanged()
    },

    nodeType: (type) => nodeTypes.get(type),
    nodeTypes: () => Array.from(nodeTypes.values()),
    callbacksFor(type, hook) {
      return (applications.get(type) ?? []).flatMap(
        ({ callbacks }) => callbacks[hook]
      )
    },
    demand: (hook) => demand.get(hook) ?? 0
  }
}

function candidateFor(nodeType: NodeType): SelectorCandidate {
  return {
    type: nodeType.type,
    category: nodeType.category,
    def: once(() => nodeType.def())
  }
}

function reportRejection(event: string, returned: unknown): void {
  if (returned instanceof Promise) {
    returned.catch((error: unknown) => reportListenerFailure(event, error))
  }
}
