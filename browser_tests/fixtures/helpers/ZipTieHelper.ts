import type { RerouteId } from '@comfyorg/graph-model/rerouteId'
import {
  zComfyWorkflow,
  zComfyWorkflow1
} from '@comfyorg/graph-model/workflowSchema'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export class ZipTieHelper {
  readonly workflowName = 'zip-tie-e2e'
  private initialRerouteIds: RerouteId[] = []

  constructor(private readonly comfyPage: ComfyPage) {}

  get workflowPath() {
    return `workflows/${this.workflowName}.json`
  }

  async setup() {
    await this.comfyPage.workflow.loadWorkflow('links/zip-tie')
    this.initialRerouteIds = await this.comfyPage.page.evaluate(() => [
      ...window.app!.graph.reroutes.keys()
    ])
  }

  async routing() {
    return this.comfyPage.page.evaluate(() => {
      const graph = window.app!.graph
      return {
        connections: [...graph.links.values()].map((link) => link.serialize()),
        reroutes: [...graph.reroutes.values()]
          .map((reroute) => reroute.asSerialisable())
          .sort((a, b) => a.id - b.id),
        ties: Array.isArray(graph.extra.zipTies)
          ? graph.extra.zipTies.length
          : 0
      }
    })
  }

  async beginMarquee() {
    const handle = await this.comfyPage.page.waitForFunction(() => {
      const app = window.app!
      const graph = app.graph
      if (![...graph.links.values()].every((link) => link.path)) return null
      const source = graph.nodes.find(
        (node) => node.type === 'EmptyLatentImage'
      )
      const targets = graph.nodes.filter(
        (node) => node.type === 'LatentUpscaleBy'
      )
      if (!source || targets.length !== 3)
        throw new Error(
          'Zip tie workflow must contain one source and three branches'
        )
      const left = source.pos[0] + source.size[0] + 80
      const right = Math.min(...targets.map((node) => node.pos[0])) - 80
      const top = Math.min(...targets.map((node) => node.pos[1])) - 60
      const bottom =
        Math.max(...targets.map((node) => node.pos[1] + node.size[1])) + 60
      return {
        from: app.canvasPosToClientPos([left, top]),
        to: app.canvasPosToClientPos([right, bottom])
      }
    })
    const box = await handle.jsonValue()
    if (!box)
      throw new Error('Workflow wires must render before the zip gesture')
    await this.comfyPage.canvas.focus()
    await this.comfyPage.page.keyboard.down('Meta')
    await this.comfyPage.page.keyboard.down('Shift')
    await this.comfyPage.page.mouse.move(box.from[0], box.from[1])
    await this.comfyPage.page.mouse.down()
    await this.comfyPage.page.mouse.move(box.to[0], box.to[1], { steps: 10 })
    await this.comfyPage.nextFrame()
  }

  async finishMarquee() {
    try {
      await this.comfyPage.page.mouse.up()
    } finally {
      await this.releaseModifiers()
    }
    await this.comfyPage.nextFrame()
  }

  async cancelMarquee() {
    await this.comfyPage.page.keyboard.press('Escape')
    await this.finishMarquee()
  }

  async releaseModifiers() {
    await this.comfyPage.page.keyboard.up('Shift')
    await this.comfyPage.page.keyboard.up('Meta')
  }

  async clasp() {
    return this.comfyPage.page.evaluate((existingIds) => {
      const app = window.app!
      const reroutes = [...app.graph.reroutes.values()].filter(
        (reroute) => !existingIds.includes(reroute.id)
      )
      if (!reroutes.length) throw new Error('An editable zip tie must exist')
      const x =
        (Math.min(...reroutes.map((reroute) => reroute.pos[0])) +
          Math.max(...reroutes.map((reroute) => reroute.pos[0]))) /
        2
      const y =
        (Math.min(...reroutes.map((reroute) => reroute.pos[1])) +
          Math.max(...reroutes.map((reroute) => reroute.pos[1]))) /
        2
      return {
        x,
        y,
        client: app.canvasPosToClientPos([x, y]),
        destination: app.canvasPosToClientPos([x + 80, y + 50])
      }
    }, this.initialRerouteIds)
  }

  async moveClasp() {
    const { client, destination } = await this.clasp()
    await this.comfyPage.canvasOps.dragAndDrop(
      { x: client[0], y: client[1] },
      { x: destination[0], y: destination[1] }
    )
  }

  async releaseClasp() {
    const { client } = await this.clasp()
    await this.comfyPage.canvasOps.rightClick(client[0], client[1])
    await this.comfyPage.contextMenu.clickMenuItemExact('Release zip tie')
    await this.comfyPage.nextFrame()
  }

  async save() {
    await this.comfyPage.menu.topbar.saveWorkflow(this.workflowName)
  }

  async savedWorkflow() {
    const response = await this.comfyPage.request.get(
      `${this.comfyPage.apiUrl}/api/userdata/${encodeURIComponent(this.workflowPath)}`,
      { headers: { 'Comfy-User': this.comfyPage.id } }
    )
    if (!response.ok())
      throw new Error(`Saved workflow GET returned ${response.status()}`)
    return zComfyWorkflow.or(zComfyWorkflow1).parse(await response.json())
  }
}
