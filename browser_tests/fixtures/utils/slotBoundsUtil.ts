import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export interface SlotMeasurement {
  key: string
  offsetX: number
  offsetY: number
}

export interface NodeSlotData {
  nodeId: string
  nodeW: number
  nodeH: number
  slots: SlotMeasurement[]
}

/**
 * Collect slot center offsets relative to the parent node element.
 * Returns `null` when the node element is not found.
 */
export async function measureNodeSlotOffsets(
  page: Page,
  nodeId: string
): Promise<NodeSlotData | null> {
  return page.evaluate((id) => {
    const nodeEl = document.querySelector(`[data-node-id="${id}"]`)
    if (!nodeEl || !(nodeEl instanceof HTMLElement)) return null

    const nodeRect = nodeEl.getBoundingClientRect()
    const slotEls = nodeEl.querySelectorAll('[data-slot-key]')
    const slots: SlotMeasurement[] = []

    for (const slotEl of slotEls) {
      const slotRect = slotEl.getBoundingClientRect()
      slots.push({
        key: (slotEl as HTMLElement).dataset.slotKey ?? 'unknown',
        offsetX: slotRect.left + slotRect.width / 2 - nodeRect.left,
        offsetY: slotRect.top + slotRect.height / 2 - nodeRect.top
      })
    }

    return {
      nodeId: id,
      nodeW: nodeRect.width,
      nodeH: nodeRect.height,
      slots
    }
  }, nodeId)
}

/**
 * Assert that every slot falls within the node dimensions (± `margin` px).
 */
export function expectSlotsWithinBounds(
  data: NodeSlotData,
  margin: number,
  label?: string
) {
  const prefix = label ? `${label}: ` : ''

  for (const slot of data.slots) {
    expect(
      slot.offsetX,
      `${prefix}Slot ${slot.key} X=${slot.offsetX} outside width=${data.nodeW}`
    ).toBeGreaterThanOrEqual(-margin)
    expect(
      slot.offsetX,
      `${prefix}Slot ${slot.key} X=${slot.offsetX} outside width=${data.nodeW}`
    ).toBeLessThanOrEqual(data.nodeW + margin)

    expect(
      slot.offsetY,
      `${prefix}Slot ${slot.key} Y=${slot.offsetY} outside height=${data.nodeH}`
    ).toBeGreaterThanOrEqual(-margin)
    expect(
      slot.offsetY,
      `${prefix}Slot ${slot.key} Y=${slot.offsetY} outside height=${data.nodeH}`
    ).toBeLessThanOrEqual(data.nodeH + margin)
  }
}

/**
 * Wait for slots, measure, and assert within bounds — single-node convenience.
 */
export async function assertNodeSlotsWithinBounds(
  page: Page,
  nodeId: string,
  margin: number = 20
) {
  await page
    .locator(`[data-node-id="${nodeId}"] [data-slot-key]`)
    .first()
    .waitFor()

  const data = await measureNodeSlotOffsets(page, nodeId)
  expect(data, `Node ${nodeId} not found in DOM`).not.toBeNull()
  expectSlotsWithinBounds(data!, margin, `Node ${nodeId}`)
}
