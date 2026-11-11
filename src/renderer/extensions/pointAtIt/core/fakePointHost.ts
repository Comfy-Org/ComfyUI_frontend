import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import type { NodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

import type { Rect } from './geometry'
import type { HostNode, HostSetting, PointHost } from './pointHost'
import type {
  SettingAddress,
  SettingValue,
  TargetAddress
} from './targetAddress'

const ROW_HEIGHT = 18
const TITLE_HEIGHT = 24

interface SettingSeed {
  name: string
  value: SettingValue
  description?: string
}

interface NodeSeed {
  id: number
  type: string
  title: string
  description?: string
  rect: Rect | null
  settings?: SettingSeed[]
}

function rowRect(rect: Rect | null, index: number): Rect | null {
  if (!rect) return null
  return {
    x: rect.x,
    y: rect.y + TITLE_HEIGHT + index * ROW_HEIGHT,
    width: rect.width,
    height: ROW_HEIGHT
  }
}

export function hostNode(seed: NodeSeed): HostNode {
  return {
    id: createNodeLocatorId(null, seed.id),
    type: seed.type,
    title: seed.title,
    description: seed.description ?? '',
    rect: seed.rect,
    settings: (seed.settings ?? []).map((setting, index): HostSetting => ({
      name: setting.name,
      label: setting.name,
      description: setting.description ?? '',
      value: setting.value,
      rect: rowRect(seed.rect, index)
    }))
  }
}

/** A text-to-image workflow laid out in a 1280 by 800 window. */
export function textToImageNodes(): HostNode[] {
  return [
    hostNode({
      id: 3,
      type: 'KSampler',
      title: 'KSampler',
      description: 'Denoises a latent using the model and the prompts.',
      rect: { x: 490, y: 190, width: 170, height: 140 },
      settings: [
        { name: 'seed', value: 4127 },
        {
          name: 'steps',
          value: 20,
          description: 'The number of steps used in the denoising process.'
        },
        { name: 'cfg', value: 7 }
      ]
    }),
    hostNode({
      id: 5,
      type: 'EmptyLatentImage',
      title: 'Empty Latent Image',
      rect: { x: 260, y: 360, width: 180, height: 90 },
      settings: [
        { name: 'width', value: 1024 },
        { name: 'height', value: 1024 },
        { name: 'batch_size', value: 1 }
      ]
    }),
    hostNode({
      id: 9,
      type: 'SaveImage',
      title: 'Save Image',
      rect: { x: 700, y: 295, width: 190, height: 200 },
      settings: [{ name: 'filename_prefix', value: 'ComfyUI' }]
    })
  ]
}

export function settingAddress(
  nodeId: NodeLocatorId,
  setting: string
): SettingAddress {
  return { kind: 'setting', nodeId, setting }
}

interface FakePointHost extends PointHost {
  nodes: HostNode[]
  selection: NodeLocatorId[]
  revealed: TargetAddress[]
  forwardedWheels: WheelEvent[]
  rejectsWrites: boolean
  queueRun(): void
  setValue(target: SettingAddress, value: SettingValue): void
  removeNode(nodeId: NodeLocatorId): void
}

/** An in-memory host: tests change `nodes` and `selection` and read what was asked of it. */
export function createFakePointHost(
  nodes: HostNode[] = textToImageNodes()
): FakePointHost {
  const runListeners = new Set<() => void>()

  function findSetting(target: SettingAddress): HostSetting | undefined {
    return host.nodes
      .find((node) => node.id === target.nodeId)
      ?.settings.find((setting) => setting.name === target.setting)
  }

  const host: FakePointHost = {
    nodes,
    selection: [],
    revealed: [],
    forwardedWheels: [],
    rejectsWrites: false,
    readNodes: () => host.nodes,
    readSelection: () => host.selection,
    readTarget(target) {
      if (target.kind === 'control')
        return {
          rect: { x: 1180, y: 8, width: 80, height: 32 },
          value: undefined
        }
      const node = host.nodes.find(
        (candidate) => candidate.id === target.nodeId
      )
      if (!node) return null
      if (target.kind === 'node') return { rect: node.rect, value: undefined }
      const setting = findSetting(target)
      return setting ? { rect: setting.rect, value: setting.value } : null
    },
    viewport: () => ({ x: 0, y: 0, width: 1280, height: 800 }),
    reveal(target) {
      host.revealed.push(target)
      return Promise.resolve()
    },
    write(target, value) {
      const setting = findSetting(target)
      if (!setting || host.rejectsWrites) return false
      setting.value = value
      return true
    },
    onRunQueued(listener) {
      runListeners.add(listener)
      return () => runListeners.delete(listener)
    },
    forwardWheel(event) {
      host.forwardedWheels.push(event)
    },
    queueRun() {
      runListeners.forEach((listener) => listener())
    },
    setValue(target, value) {
      const setting = findSetting(target)
      if (setting) setting.value = value
    },
    removeNode(nodeId) {
      host.nodes = host.nodes.filter((node) => node.id !== nodeId)
    }
  }

  return host
}
