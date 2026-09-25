import { GraphCanvasMenu } from '@e2e/fixtures/components/GraphCanvasMenu'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

export const canvasMenuFixture = base.extend<{ canvasMenu: GraphCanvasMenu }>({
  canvasMenu: async ({ page }, use) => {
    await use(new GraphCanvasMenu(page))
  }
})
