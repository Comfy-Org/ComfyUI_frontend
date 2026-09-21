import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'MiniMax RefMod schema-order wrappers',
  { tag: ['@vue-nodes', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.nodeOps.clearGraph()
      await comfyPage.page.evaluate(() => {
        const prototype = window.LiteGraph!.registered_node_types.Note.prototype
        const onNodeCreated = prototype.onNodeCreated
        prototype.onNodeCreated = function () {
          const result = onNodeCreated?.call(this)
          this.title = 'RefMod loader compatibility'
          this.widgets = []
          this.serialize_widgets = true
          const showInfo = this.addWidget('toggle', 'show_info', true, () => {})
          const mods = Array.from({ length: 8 }, (_, index) =>
            this.addWidget('combo', `mod_${index + 1}`, '(none)', () => {}, {
              values: ['(none)', 'voice.refmod']
            })
          )
          const strengths = Array.from({ length: 8 }, (_, index) =>
            this.addWidget('number', `strength_${index + 1}`, 1, () => {})
          )
          const schemaOrder = [...this.widgets]
          const serialize = this.serialize
          const configure = this.configure
          this.serialize = function () {
            const displayOrder = [...(this.widgets ?? [])]
            this.widgets = schemaOrder
            try {
              return serialize.call(this)
            } finally {
              this.widgets = displayOrder
            }
          }
          this.configure = function (info) {
            const displayOrder = [...(this.widgets ?? [])]
            this.widgets = schemaOrder
            try {
              configure.call(this, info)
            } finally {
              this.widgets = displayOrder
            }
            for (const [index, mod] of mods.entries()) {
              const visible =
                index === 0 ||
                mod.value !== '(none)' ||
                strengths[index].value !== 1
              mod.hidden = !visible
              strengths[index].hidden = !visible
            }
          }
          this.widgets = [
            ...mods.flatMap((mod, index) => [mod, strengths[index]]),
            showInfo
          ]
          for (const widget of [...mods.slice(1), ...strengths.slice(1)])
            widget.hidden = true
          return result
        }
        const node = window.LiteGraph!.createNode('Note')!
        node.pos = [400, 200]
        window.app!.graph.add(node)
        const mod = node.widgets?.find((widget) => widget.name === 'mod_1')
        const strength = node.widgets?.find(
          (widget) => widget.name === 'strength_1'
        )
        if (!mod || !strength) throw new Error('RefMod widgets not created')
        mod.value = 'voice.refmod'
        strength.value = 0.65
      })
      await comfyPage.nextFrame()
    })

    test('saving and reloading preserves values and unused-slot visibility', async ({
      comfyPage
    }) => {
      const mod = comfyPage.vueNodes.getWidgetByName(
        'RefMod loader compatibility',
        'mod_1'
      )
      const unused = comfyPage.vueNodes.getWidgetByName(
        'RefMod loader compatibility',
        'mod_8'
      )
      await expect(mod).toContainText('voice.refmod')
      await expect(unused).toBeHidden()

      const saved = await comfyPage.workflow.getExportedWorkflow()
      await comfyPage.workflow.loadGraphData(saved)

      const node = await comfyPage.nodeOps.getNodeRefByTitle(
        'RefMod loader compatibility'
      )
      const selected = await node.getWidgetByName('mod_1')
      const strength = await node.getWidgetByName('strength_1')

      await expect.poll(() => selected.getValue()).toBe('voice.refmod')
      await expect.poll(() => strength.getValue()).toBe(0.65)
      await expect(unused).toBeHidden()
    })
  }
)
