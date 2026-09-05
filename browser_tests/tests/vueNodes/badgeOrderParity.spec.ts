import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const EXPERIMENTAL_NODE = 'LoadImageOutput'
const LIFECYCLE_TEXT = 'BETA'

// Soak S7 / #15662: computeBadges emits lifecycle → id → source; the canvas
// re-sorts to CORE_JOIN_ORDER (id → lifecycle → source) but the Vue renderer
// keeps emit order, so Vue shows "[BETA] #n" where the canvas draws
// "#n [BETA]". Pre-existing on main; also pinned by three unit it.fails in
// badgeRendererParity.test.ts.
test.describe('Badge order parity', { tag: ['@vue-nodes', '@node'] }, () => {
  test('vue node renders id badge before the lifecycle badge', async ({
    comfyPage
  }) => {
    // Guard: the pin depends on this node type carrying a lifecycle badge.
    // If it graduates out of experimental, skip instead of letting the
    // test.fail() keep "passing" for the wrong reason and silently
    // un-pinning #15662.
    const hasLifecycleBadge = await comfyPage.page.evaluate(
      async (nodeType) => {
        type LifecycleFlags = { experimental?: boolean; deprecated?: boolean }
        const response = await fetch(`api/object_info/${nodeType}`)
        const info = (await response.json()) as
          | Record<string, LifecycleFlags | undefined>
          | undefined
        const def = info?.[nodeType]
        return Boolean(def?.experimental || def?.deprecated)
      },
      EXPERIMENTAL_NODE
    )
    // oxlint-disable-next-line playwright/no-skipped-test -- conditional environment guard: lifecycle badge graduated
    test.skip(
      !hasLifecycleBadge,
      `${EXPERIMENTAL_NODE} no longer carries a lifecycle badge`
    )
    await comfyPage.settings.setSetting(
      'Comfy.NodeBadge.NodeIdBadgeMode',
      'Show all'
    )
    await comfyPage.settings.setSetting(
      'Comfy.NodeBadge.NodeLifeCycleBadgeMode',
      'Show all'
    )
    await comfyPage.nodeOps.clearGraph()
    const node = await comfyPage.nodeOps.addNode(EXPERIMENTAL_NODE, undefined, {
      x: 400,
      y: 300
    })
    await comfyPage.vueNodes.waitForNodes()

    const nodeLocator = comfyPage.vueNodes.getNodeLocator(String(node.id))
    const idBadgeText = `#${node.id}`
    await expect(
      nodeLocator.getByText(LIFECYCLE_TEXT, { exact: true }),
      'lifecycle badge renders'
    ).toBeVisible()
    await expect(
      nodeLocator.getByText(idBadgeText, { exact: true }),
      'id badge renders'
    ).toBeVisible()

    // Armed only now: guard and setup errors above must fail the test —
    // an early test.fail() would record them as the expected failure and
    // report a pass without exercising the pinned behaviour.
    test.fail()
    const text = await nodeLocator.innerText()
    const idIndex = text.indexOf(idBadgeText)
    const lifecycleIndex = text.indexOf(LIFECYCLE_TEXT)
    expect(
      idIndex,
      `id badge must precede the lifecycle badge as the canvas draws it (CORE_JOIN_ORDER) — got "${text.slice(0, 80)}"`
    ).toBeLessThan(lifecycleIndex)
  })
})
