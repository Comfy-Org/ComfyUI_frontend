import { merge } from 'es-toolkit'

import { PREFIX, SEPARATOR } from '@/constants/groupNodeConstants'
import type {
  GroupNodeWorkflowData,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useToastStore } from '@/platform/updates/common/toastStore'

import { type ComfyApp, app } from '../../scripts/app'
import { $el } from '../../scripts/ui'
import { ComfyDialog } from '../../scripts/ui/dialog'
import { DraggableList } from '../../scripts/ui/draggableList'
import { GroupNodeConfig, GroupNodeHandler } from './groupNode'
import './groupNodeManage.css'

/** Group node types have nodeData of type GroupNodeWorkflowData */
interface GroupNodeType {
  nodeData: GroupNodeWorkflowData
}

type GroupNodeConstructor = typeof LGraphNode & GroupNodeType

function hasNodeData(
  nodeType: typeof LGraphNode | undefined
): nodeType is GroupNodeConstructor {
  return nodeType != null && 'nodeData' in nodeType
}

const ORDER: unique symbol = Symbol('ORDER')

interface NodeModification {
  name?: string
  visible?: boolean
}

interface OrderModification {
  order: number
}

type NodeModifications = Record<string, NodeModification> & {
  [ORDER]?: OrderModification
}

type DragEndEvent = CustomEvent<{
  element: Element
  oldPosition: number
  newPosition: number
}>

export class ManageGroupDialog extends ComfyDialog<HTMLDialogElement> {
  tabs!: Record<
    'Inputs' | 'Outputs' | 'Widgets',
    { tab: HTMLAnchorElement; page: HTMLElement }
  >
  selectedNodeIndex: number | null | undefined
  selectedTab: keyof ManageGroupDialog['tabs'] = 'Inputs'
  selectedGroup: string | undefined
  modifications: Record<string, { nodes?: Record<string, NodeModifications> }> =
    {}
  nodeItems: HTMLLIElement[] = []
  app: ComfyApp
  groupNodeType!: GroupNodeConstructor
  groupNodeDef: unknown
  groupData: ReturnType<typeof GroupNodeHandler.getGroupData> | null = null

  innerNodesList!: HTMLUListElement
  widgetsPage!: HTMLElement
  inputsPage!: HTMLElement
  outputsPage!: HTMLElement
  draggable: DraggableList | null = null

  get selectedNodeInnerIndex(): number {
    if (this.selectedNodeIndex == null) return 0
    const item = this.nodeItems[this.selectedNodeIndex]
    return +(item?.dataset?.nodeindex ?? 0)
  }

  constructor(app: ComfyApp) {
    super()
    this.app = app
    this.element = $el('dialog.comfy-group-manage', {
      parent: document.body
    }) as HTMLDialogElement
  }

  changeTab(tab: keyof ManageGroupDialog['tabs']) {
    this.tabs[this.selectedTab].tab.classList.remove('active')
    this.tabs[this.selectedTab].page.classList.remove('active')
    this.tabs[tab].tab.classList.add('active')
    this.tabs[tab].page.classList.add('active')
    this.selectedTab = tab
  }

  changeNode(index: number, force?: boolean) {
    if (!force && this.selectedNodeIndex === index) return

    if (this.selectedNodeIndex != null) {
      this.nodeItems[this.selectedNodeIndex].classList.remove('selected')
    }
    this.nodeItems[index].classList.add('selected')
    this.selectedNodeIndex = index

    if (!this.buildInputsPage() && this.selectedTab === 'Inputs') {
      this.changeTab('Widgets')
    }
    if (!this.buildWidgetsPage() && this.selectedTab === 'Widgets') {
      this.changeTab('Outputs')
    }
    if (!this.buildOutputsPage() && this.selectedTab === 'Outputs') {
      this.changeTab('Inputs')
    }

    this.changeTab(this.selectedTab)
  }

  getGroupData() {
    const nodeType =
      LiteGraph.registered_node_types[
        `${PREFIX}${SEPARATOR}` + this.selectedGroup
      ]
    if (!hasNodeData(nodeType)) {
      throw new Error(`Group node type not found: ${this.selectedGroup}`)
    }
    this.groupNodeType = nodeType
    this.groupNodeDef = this.groupNodeType.nodeData
    this.groupData = GroupNodeHandler.getGroupData(this.groupNodeType)
  }

  changeGroup(group: string, reset = true) {
    this.selectedGroup = group
    this.getGroupData()

    const nodes = this.groupData?.nodeData.nodes ?? []
    this.nodeItems = nodes.map((n, i) =>
      $el(
        'li.draggable-item',
        {
          dataset: {
            nodeindex: String(n.index ?? i)
          },
          onclick: () => {
            this.changeNode(i)
          }
        },
        [
          $el('span.drag-handle'),
          $el(
            'div',
            {
              textContent: n.title ?? n.type
            },
            n.title
              ? $el('span', {
                  textContent: n.type
                })
              : []
          )
        ]
      )
    ) as HTMLLIElement[]

    this.innerNodesList.replaceChildren(...this.nodeItems)

    if (reset) {
      this.selectedNodeIndex = null
      this.changeNode(0)
    } else {
      const items = this.draggable?.getAllItems() ?? []
      let index = items.findIndex((item: Element) =>
        item.classList.contains('selected')
      )
      if (index === -1) index = this.selectedNodeIndex ?? 0
      this.changeNode(index, true)
    }

    const ordered = [...nodes]
    this.draggable?.dispose()
    this.draggable = new DraggableList(this.innerNodesList, 'li')
    this.draggable.addEventListener('dragend', (e: Event) => {
      const detail = (e as DragEndEvent).detail
      const { oldPosition, newPosition } = detail
      if (oldPosition === newPosition) return
      ordered.splice(newPosition, 0, ordered.splice(oldPosition, 1)[0])
      for (let i = 0; i < ordered.length; i++) {
        const nodeIndex = ordered[i].index
        if (nodeIndex == null) continue
        this.storeModification({
          nodeIndex,
          section: ORDER,
          prop: 'order',
          value: i
        })
      }
    })
  }

  storeModification(props: {
    nodeIndex?: number
    section: string | typeof ORDER
    prop: string
    value: unknown
  }) {
    const { nodeIndex, section, prop, value } = props
    if (!this.selectedGroup) return

    const groupMod = (this.modifications[this.selectedGroup] ??= {})
    const nodesMod = (groupMod.nodes ??= {})
    const nodeKey = String(nodeIndex ?? this.selectedNodeInnerIndex)
    const nodeMod = (nodesMod[nodeKey] ??= {} as NodeModifications)

    if (section === ORDER) {
      nodeMod[ORDER] = { order: value as number }
    } else {
      const sectionMod = (nodeMod[section] ??= {})
      if (typeof value === 'object' && value !== null) {
        Object.assign(sectionMod, value)
      } else {
        Object.assign(sectionMod, { [prop]: value })
      }
    }
  }

  getEditElement(
    section: string,
    prop: string | number,
    value: string,
    placeholder: string,
    checked: boolean,
    checkable = true
  ) {
    if (value === placeholder) value = ''

    const mods = this.selectedGroup
      ? this.modifications[this.selectedGroup]?.nodes?.[
          this.selectedNodeInnerIndex
        ]?.[section]
      : undefined
    if (mods) {
      if (mods.name != null) {
        value = mods.name
      }
      if (mods.visible != null) {
        checked = mods.visible
      }
    }

    return $el('div', [
      $el('input', {
        value,
        placeholder,
        type: 'text',
        onchange: (e: Event) => {
          this.storeModification({
            section,
            prop: String(prop),
            value: { name: (e.target as HTMLInputElement).value }
          })
        }
      }),
      $el('label', { textContent: 'Visible' }, [
        $el('input', {
          type: 'checkbox',
          checked,
          disabled: !checkable,
          onchange: (e: Event) => {
            this.storeModification({
              section,
              prop: String(prop),
              value: { visible: !!(e.target as HTMLInputElement).checked }
            })
          }
        })
      ])
    ])
  }

  buildWidgetsPage() {
    const widgets =
      this.groupData?.oldToNewWidgetMap[this.selectedNodeInnerIndex]
    const items = Object.keys(widgets ?? {})
    const type = this.selectedGroup
      ? app.rootGraph.extra?.groupNodes?.[this.selectedGroup]
      : undefined
    const config = (
      type?.config as
        | Record<number, { input?: Record<string, { visible?: boolean }> }>
        | undefined
    )?.[this.selectedNodeInnerIndex]?.input
    this.widgetsPage.replaceChildren(
      ...items.map((oldName) => {
        return this.getEditElement(
          'input',
          oldName,
          widgets?.[oldName] ?? '',
          oldName,
          config?.[oldName]?.visible !== false
        )
      })
    )
    return !!items.length
  }

  buildInputsPage() {
    const inputs = this.groupData?.nodeInputs[this.selectedNodeInnerIndex] ?? {}
    const items = Object.keys(inputs)
    const type = this.selectedGroup
      ? app.rootGraph.extra?.groupNodes?.[this.selectedGroup]
      : undefined
    const config = (
      type?.config as
        | Record<number, { input?: Record<string, { visible?: boolean }> }>
        | undefined
    )?.[this.selectedNodeInnerIndex]?.input
    const filteredElements = items
      .map((oldName) => {
        const value = inputs[oldName]
        if (!value) {
          return null
        }

        return this.getEditElement(
          'input',
          oldName,
          value as string,
          oldName,
          config?.[oldName]?.visible !== false
        )
      })
      .filter((el): el is HTMLDivElement => el !== null)
    this.inputsPage.replaceChildren(...filteredElements)
    return !!items.length
  }

  buildOutputsPage() {
    const nodes = this.groupData?.nodeData.nodes ?? []
    const nodeData = nodes[this.selectedNodeInnerIndex]
    const innerNodeDef = nodeData
      ? this.groupData?.getNodeDef(
          nodeData as Parameters<typeof this.groupData.getNodeDef>[0]
        )
      : undefined
    const outputs = (innerNodeDef?.output ?? []) as string[]
    const groupOutputs =
      this.groupData?.oldToNewOutputMap[this.selectedNodeInnerIndex]

    const workflowType = this.selectedGroup
      ? app.rootGraph.extra?.groupNodes?.[this.selectedGroup]
      : undefined
    const config = (
      workflowType?.config as
        | Record<
            number,
            { output?: Record<number, { name?: string; visible?: boolean }> }
          >
        | undefined
    )?.[this.selectedNodeInnerIndex]?.output
    const node = nodes[this.selectedNodeInnerIndex]
    const checkable = node?.type !== 'PrimitiveNode'
    this.outputsPage.replaceChildren(
      ...outputs
        .map((outputType: string, slot: number) => {
          const groupOutputIndex = groupOutputs?.[slot]
          const oldName = (innerNodeDef?.output_name?.[slot] ??
            outputType) as string
          let value = config?.[slot]?.name ?? ''
          const visible = config?.[slot]?.visible || groupOutputIndex != null
          if (!value || value === oldName) {
            value = ''
          }
          return this.getEditElement(
            'output',
            slot,
            value,
            oldName,
            visible,
            checkable
          )
        })
        .filter(Boolean)
    )
    return !!outputs.length
  }

  override show(type?: string) {
    const groupNodes = Object.keys(app.rootGraph.extra?.groupNodes ?? {}).sort(
      (a, b) => a.localeCompare(b)
    )

    this.innerNodesList = $el(
      'ul.comfy-group-manage-list-items'
    ) as HTMLUListElement
    this.widgetsPage = $el('section.comfy-group-manage-node-page')
    this.inputsPage = $el('section.comfy-group-manage-node-page')
    this.outputsPage = $el('section.comfy-group-manage-node-page')
    const pages = $el('div', [
      this.widgetsPage,
      this.inputsPage,
      this.outputsPage
    ])

    type TabName = keyof ManageGroupDialog['tabs']
    this.tabs = (
      [
        ['Inputs', this.inputsPage],
        ['Widgets', this.widgetsPage],
        ['Outputs', this.outputsPage]
      ] as [TabName, HTMLElement][]
    ).reduce(
      (p, [name, page]) => {
        p[name] = {
          tab: $el('a', {
            onclick: () => {
              this.changeTab(name)
            },
            textContent: name
          }) as HTMLAnchorElement,
          page
        }
        return p
      },
      {} as ManageGroupDialog['tabs']
    )

    const outer = $el('div.comfy-group-manage-outer', [
      $el('header', [
        $el('h2', 'Group Nodes'),
        $el(
          'select',
          {
            onchange: (e: Event) => {
              this.changeGroup((e.target as HTMLSelectElement).value)
            }
          },
          groupNodes.map((g) =>
            $el('option', {
              textContent: g,
              selected: `${PREFIX}${SEPARATOR}${g}` === type,
              value: g
            })
          )
        )
      ]),
      $el('main', [
        $el('section.comfy-group-manage-list', this.innerNodesList),
        $el('section.comfy-group-manage-node', [
          $el(
            'header',
            Object.values(this.tabs).map((t) => t.tab)
          ),
          pages
        ])
      ]),
      $el('footer', [
        $el(
          'button.comfy-btn',
          {
            onclick: () => {
              const node = app.rootGraph.nodes.find(
                (n) => n.type === `${PREFIX}${SEPARATOR}` + this.selectedGroup
              )
              if (node) {
                useToastStore().addAlert(
                  'This group node is in use in the current workflow, please first remove these.'
                )
                return
              }
              if (
                confirm(
                  `Are you sure you want to remove the node: "${this.selectedGroup}"`
                )
              ) {
                if (this.selectedGroup && app.rootGraph.extra?.groupNodes) {
                  delete app.rootGraph.extra.groupNodes[this.selectedGroup]
                }
                LiteGraph.unregisterNodeType(
                  `${PREFIX}${SEPARATOR}` + this.selectedGroup
                )
              }
              this.show()
            }
          },
          'Delete Group Node'
        ),
        $el(
          'button.comfy-btn',
          {
            onclick: async () => {
              let nodesByType: Record<string, LGraphNode[]> | null = null
              const recreateNodes: LGraphNode[] = []
              const types: Record<string, GroupNodeWorkflowData> = {}
              for (const g in this.modifications) {
                const groupNodeData = app.rootGraph.extra?.groupNodes?.[g]
                if (!groupNodeData) continue

                let config = (groupNodeData.config ??= {}) as Record<
                  number,
                  unknown
                >

                let nodeMods = this.modifications[g]?.nodes
                if (nodeMods) {
                  const keys = Object.keys(nodeMods)
                  const firstMod = nodeMods[keys[0]]
                  if (firstMod?.[ORDER]) {
                    // If any node is reordered, they will all need sequencing
                    const orderedNodes: typeof groupNodeData.nodes = []
                    const orderedMods: Record<string, NodeModifications> = {}
                    const orderedConfig: Record<number, unknown> = {}

                    for (const n of keys) {
                      const order = nodeMods[n]?.[ORDER]?.order ?? 0
                      orderedNodes[order] = groupNodeData.nodes[+n]
                      orderedMods[order] = nodeMods[n]
                      orderedNodes[order].index = order
                    }

                    // Rewrite links
                    for (const l of groupNodeData.links) {
                      const srcIdx = l[1]
                      const tgtIdx = l[3]
                      if (srcIdx != null)
                        l[1] =
                          groupNodeData.nodes[srcIdx as number]?.index ?? srcIdx
                      if (tgtIdx != null)
                        l[3] =
                          groupNodeData.nodes[tgtIdx as number]?.index ?? tgtIdx
                    }

                    // Rewrite externals
                    if (groupNodeData.external) {
                      for (const ext of groupNodeData.external) {
                        if (ext[0] != null) {
                          ext[0] =
                            groupNodeData.nodes[ext[0] as number]?.index ??
                            ext[0]
                        }
                      }
                    }

                    // Rewrite modifications
                    for (const id of keys) {
                      const nodeIdx = +id
                      if (config[nodeIdx]) {
                        const newIdx =
                          groupNodeData.nodes[nodeIdx]?.index ?? nodeIdx
                        orderedConfig[newIdx] = config[nodeIdx]
                      }
                      delete config[nodeIdx]
                    }

                    groupNodeData.nodes = orderedNodes
                    nodeMods = orderedMods
                    groupNodeData.config = config = orderedConfig
                  }

                  merge(config, nodeMods as Record<string, unknown>)
                }

                types[g] = groupNodeData

                if (!nodesByType) {
                  nodesByType = app.rootGraph.nodes.reduce(
                    (p, n) => {
                      const nodeType = n.type ?? ''
                      ;(p[nodeType] ??= []).push(n)
                      return p
                    },
                    {} as Record<string, LGraphNode[]>
                  )
                }

                const groupTypeNodes = nodesByType[`${PREFIX}${SEPARATOR}` + g]
                if (groupTypeNodes) recreateNodes.push(...groupTypeNodes)
              }

              await GroupNodeConfig.registerFromWorkflow(types, [])

              for (const node of recreateNodes) {
                ;(node as LGraphNode & { recreate?: () => void }).recreate?.()
              }

              this.modifications = {}
              this.app.canvas.setDirty(true, true)
              if (this.selectedGroup) {
                this.changeGroup(this.selectedGroup, false)
              }
            }
          },
          'Save'
        ),
        $el(
          'button.comfy-btn',
          { onclick: () => this.element.close() },
          'Close'
        )
      ])
    ])

    this.element.replaceChildren(outer)
    this.changeGroup(
      type
        ? (groupNodes.find((g) => `${PREFIX}${SEPARATOR}${g}` === type) ??
            groupNodes[0])
        : groupNodes[0]
    )
    this.element.showModal()

    this.element.addEventListener('close', () => {
      this.draggable?.dispose()
      this.element.remove()
    })
  }
}
