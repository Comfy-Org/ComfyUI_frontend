/**
 * Test Widgets Extension - 用于测试各种 Widget 组件的测试节点
 */
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { ComfyWidgets } from '@/scripts/widgets'

app.registerExtension({
  name: 'comfy.TestWidgets',

  registerCustomNodes() {
    class TestWidgetsNode extends LGraphNode {
      static override title = 'Test Widgets'
      static override category = 'testing'

      constructor(title: string) {
        super(title)
        this.title = 'Test Widgets'
        this.size = [450, 800]

        // 添加输出端口
        this.addOutput('output', 'STRING')

        // 添加基础 widgets
        this.addTestWidgets()

        this.serialize_widgets = true
      }

      addTestWidgets() {
        try {
          // 主题选择器
          ComfyWidgets.SELECTBUTTON(
            this,
            'theme_selector',
            [
              'SELECTBUTTON',
              {
                values: ['Light', 'Dark', 'Auto'],
                default: 'Auto'
              }
            ],
            app
          )

          // 质量设置
          ComfyWidgets.SELECTBUTTON(
            this,
            'quality_setting',
            [
              'SELECTBUTTON',
              {
                values: ['Low', 'Medium', 'High', 'Ultra'],
                default: 'High'
              }
            ],
            app
          )

          // 方向选择
          ComfyWidgets.SELECTBUTTON(
            this,
            'orientation',
            [
              'SELECTBUTTON',
              {
                values: ['Portrait', 'Landscape', 'Square'],
                default: 'Portrait'
              }
            ],
            app
          )

          // 6. 可选的高级 widgets
          if (ComfyWidgets.COLOR) {
            ComfyWidgets.COLOR(
              this,
              'color_test',
              ['COLOR', { default: '#ff0000' }],
              app
            )
          }

          if (ComfyWidgets.MARKDOWN) {
            ComfyWidgets.MARKDOWN(
              this,
              'markdown_test',
              ['MARKDOWN', { default: '# Test Markdown' }],
              app
            )
          }
        } catch (error) {
          console.error('Error adding widgets:', error)
        }
      }

      override onExecute() {
        // 收集所有 widget 的值
        const values: Record<string, any> = {}
        if (this.widgets) {
          for (const widget of this.widgets) {
            values[widget.name] = widget.value
          }
        }

        // 输出 JSON 格式的值
        this.setOutputData(0, JSON.stringify(values, null, 2))
      }
    }
    LiteGraph.registerNodeType('TestWidgets', TestWidgetsNode)
  }
})
