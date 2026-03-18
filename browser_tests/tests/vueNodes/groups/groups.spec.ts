import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../fixtures/ComfyPage'
import type { ComfyPage } from '../../../fixtures/ComfyPage'

const CREATE_GROUP_HOTKEY = 'Control+g'

type NodeGroupCenteringError = {
  horizontal: number
  vertical: number
}

type NodeGroupCenteringErrors = {
  innerGroup: NodeGroupCenteringError
  outerGroup: NodeGroupCenteringError
}

const LEGACY_VUE_CENTERING_BASELINE: NodeGroupCenteringErrors = {
  innerGroup: {
    horizontal: 16.308832840862777,
    vertical: 17.390899314547084
  },
  outerGroup: {
    horizontal: 20.30164329441476,
    vertical: 42.196324096481476
  }
} as const

const CENTERING_TOLERANCE = {
  innerGroup: 6,
  outerGroup: 12
} as const

function expectWithinBaseline(
  actual: number,
  baseline: number,
  tolerance: number
) {
  expect(Math.abs(actual - baseline)).toBeLessThan(tolerance)
}

async function getNodeGroupCenteringErrors(
  comfyPage: ComfyPage
): Promise<NodeGroupCenteringErrors> {
  return comfyPage.page.evaluate(() => {
    type GraphNode = {
      id: number | string
      pos: ReadonlyArray<number>
    }
    type GraphGroup = {
      title: string
      pos: ReadonlyArray<number>
      size: ReadonlyArray<number>
    }

    const app = window.app!
    const node = app.graph.nodes[0] as GraphNode | undefined

    if (!node) {
      throw new Error('Expected a node in the loaded workflow')
    }

    const nodeElement = document.querySelector<HTMLElement>(
      `[data-node-id="${node.id}"]`
    )

    if (!nodeElement) {
      throw new Error(`Vue node element not found for node ${node.id}`)
    }

    const groups = app.graph.groups as GraphGroup[]
    const innerGroup = groups.find((group) => group.title === 'Inner Group')
    const outerGroup = groups.find((group) => group.title === 'Outer Group')

    if (!innerGroup || !outerGroup) {
      throw new Error('Expected both Inner Group and Outer Group in graph')
    }

    const nodeRect = nodeElement.getBoundingClientRect()

    const getCenteringError = (group: GraphGroup): NodeGroupCenteringError => {
      const [groupStartX, groupStartY] = app.canvasPosToClientPos([
        group.pos[0],
        group.pos[1]
      ])
      const [groupEndX, groupEndY] = app.canvasPosToClientPos([
        group.pos[0] + group.size[0],
        group.pos[1] + group.size[1]
      ])

      const groupLeft = Math.min(groupStartX, groupEndX)
      const groupRight = Math.max(groupStartX, groupEndX)
      const groupTop = Math.min(groupStartY, groupEndY)
      const groupBottom = Math.max(groupStartY, groupEndY)

      const leftGap = nodeRect.left - groupLeft
      const rightGap = groupRight - nodeRect.right
      const topGap = nodeRect.top - groupTop
      const bottomGap = groupBottom - nodeRect.bottom

      return {
        horizontal: Math.abs(leftGap - rightGap),
        vertical: Math.abs(topGap - bottomGap)
      }
    }

    return {
      innerGroup: getCenteringError(innerGroup),
      outerGroup: getCenteringError(outerGroup)
    }
  })
}

test.describe('Vue Node Groups', { tag: '@screenshot' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.settings.setSetting('Comfy.Minimap.ShowGroups', true)
    await comfyPage.vueNodes.waitForNodes()
  })

  test('should allow creating groups with hotkey', async ({ comfyPage }) => {
    await comfyPage.page.getByText('Load Checkpoint').click()
    await comfyPage.page.getByText('KSampler').click({ modifiers: ['Control'] })
    await comfyPage.page.keyboard.press(CREATE_GROUP_HOTKEY)
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'vue-groups-create-group.png'
    )
  })

  test('should allow fitting group to contents', async ({ comfyPage }) => {
    await comfyPage.setup()
    await comfyPage.workflow.loadWorkflow('groups/oversized_group')
    await comfyPage.keyboard.selectAll()
    await comfyPage.command.executeCommand('Comfy.Graph.FitGroupToContents')
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'vue-groups-fit-to-contents.png'
    )
  })

  test('should move nested groups together when dragging outer group', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('groups/nested-groups-1-inner-node')

    // Get initial positions with null guards
    const outerInitial =
      await comfyPage.canvasOps.getGroupPosition('Outer Group')
    const innerInitial =
      await comfyPage.canvasOps.getGroupPosition('Inner Group')

    const initialOffsetX = innerInitial.x - outerInitial.x
    const initialOffsetY = innerInitial.y - outerInitial.y

    // Drag the outer group
    const dragDelta = { x: 100, y: 80 }
    await comfyPage.canvasOps.dragGroup({
      name: 'Outer Group',
      deltaX: dragDelta.x,
      deltaY: dragDelta.y
    })

    // Use retrying assertion to wait for positions to update
    await expect(async () => {
      const outerFinal =
        await comfyPage.canvasOps.getGroupPosition('Outer Group')
      const innerFinal =
        await comfyPage.canvasOps.getGroupPosition('Inner Group')

      const finalOffsetX = innerFinal.x - outerFinal.x
      const finalOffsetY = innerFinal.y - outerFinal.y

      // Both groups should have moved
      expect(outerFinal.x).not.toBe(outerInitial.x)
      expect(innerFinal.x).not.toBe(innerInitial.x)

      // The relative offset should be maintained (inner group moved with outer)
      expect(finalOffsetX).toBeCloseTo(initialOffsetX, 0)
      expect(finalOffsetY).toBeCloseTo(initialOffsetY, 0)
    }).toPass({ timeout: 5000 })
  })

  test('should keep groups aligned after loading legacy Vue workflows', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('groups/nested-groups-1-inner-node')
    await comfyPage.vueNodes.waitForNodes(1)

    const workflowRendererVersion = await comfyPage.page.evaluate(() => {
      const extra = window.app!.graph.extra as
        | { workflowRendererVersion?: string }
        | undefined
      return extra?.workflowRendererVersion
    })

    expect(workflowRendererVersion).toMatch(/^Vue/)

    await expect(async () => {
      const centeringErrors = await getNodeGroupCenteringErrors(comfyPage)

      expectWithinBaseline(
        centeringErrors.innerGroup.horizontal,
        LEGACY_VUE_CENTERING_BASELINE.innerGroup.horizontal,
        CENTERING_TOLERANCE.innerGroup
      )
      expectWithinBaseline(
        centeringErrors.innerGroup.vertical,
        LEGACY_VUE_CENTERING_BASELINE.innerGroup.vertical,
        CENTERING_TOLERANCE.innerGroup
      )
      expectWithinBaseline(
        centeringErrors.outerGroup.horizontal,
        LEGACY_VUE_CENTERING_BASELINE.outerGroup.horizontal,
        CENTERING_TOLERANCE.outerGroup
      )
      expectWithinBaseline(
        centeringErrors.outerGroup.vertical,
        LEGACY_VUE_CENTERING_BASELINE.outerGroup.vertical,
        CENTERING_TOLERANCE.outerGroup
      )
    }).toPass({ timeout: 5000 })
  })
})
