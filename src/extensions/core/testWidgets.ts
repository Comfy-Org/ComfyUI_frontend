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
        this.size = [500, 1200]

        this.addOutput('output', 'STRING')

        this.addTestWidgets()

        this.serialize_widgets = true
      }

      addTestWidgets() {
        try {
          ComfyWidgets.STRING(
            this,
            'string_input',
            ['STRING', { default: 'Hello World', placeholder: '输入文本' }],
            app
          )

          ComfyWidgets.INT(
            this,
            'int_input',
            ['INT', { default: 42, min: 0, max: 100, step: 1 }],
            app
          )

          ComfyWidgets.FLOAT(
            this,
            'float_input',
            ['FLOAT', { default: 3.14, min: 0.0, max: 10.0, step: 0.1 }],
            app
          )

          ComfyWidgets.BOOLEAN(
            this,
            'boolean_toggle',
            ['BOOLEAN', { default: true }],
            app
          )

          ComfyWidgets.COMBO(
            this,
            'combo_select',
            [
              'COMBO',
              {
                values: ['Option A', 'Option B', 'Option C'],
                default: 'Option A'
              }
            ],
            app
          )

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

          ComfyWidgets.MULTISELECT(
            this,
            'multi_select',
            [
              'MULTISELECT',
              {
                values: ['Red', 'Green', 'Blue', 'Yellow', 'Purple'],
                default: ['Red', 'Blue']
              }
            ],
            app
          )

          ComfyWidgets.TREESELECT(
            this,
            'tree_select',
            [
              'TREESELECT',
              {
                values: [
                  {
                    key: '0',
                    label: 'Root',
                    children: [
                      { key: '0-0', label: 'Child 1' },
                      { key: '0-1', label: 'Child 2' }
                    ]
                  }
                ],
                default: '0-0'
              }
            ],
            app
          )

          ComfyWidgets.TEXTAREA(
            this,
            'textarea_input',
            [
              'TEXTAREA',
              {
                default: 'This is a multiline\ntext area for longer content.',
                rows: 4
              }
            ],
            app
          )

          ComfyWidgets.COLOR(
            this,
            'color_picker',
            ['COLOR', { default: 'ff6b6b' }],
            app
          )

          ComfyWidgets.FILEUPLOAD(
            this,
            'file_upload',
            [
              'FILEUPLOAD',
              {
                accept: '.jpg,.png,.gif,.webp',
                multiple: false
              }
            ],
            app
          )

          // ComfyWidgets.MARKDOWN(
          //   this,
          //   'markdown_display',
          //   ['MARKDOWN', {
          //     default: `# Test Markdown Widget

          //     This is a **Markdown** rendering component test.

          //     - Supports lists
          //     - Supports *italic* and **bold** text
          //     - Supports \`code\`

          //     > This is quoted text

          //     \`\`\`javascript
          //     console.log('Hello World!');
          //     \`\`\``
          //   }],
          //   app
          // )

          // ComfyWidgets.IMAGE(
          //   this,
          //   'image_display',
          //   ['IMAGE', {
          //     default: null,
          //     width: 200,
          //     height: 200
          //   }],
          //   app
          // )

          // ComfyWidgets.IMAGECOMPARE(
          //   this,
          //   'image_compare',
          //   ['IMAGECOMPARE', {
          //     default: { before: null, after: null }
          //   }],
          //   app
          // )

          // ComfyWidgets.GALLERIA(
          //   this,
          //   'image_gallery',
          //   ['GALLERIA', {
          //     default: [],
          //     thumbnailSize: 100
          //   }],
          //   app
          // )

          // ComfyWidgets.CHART(
          //   this,
          //   'chart_display',
          //   ['CHART', {
          //     default: {
          //       type: 'line',
          //       data: {
          //         labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
          //         datasets: [{
          //           label: 'Test Data',
          //           data: [10, 20, 15, 25, 30],
          //           borderColor: '#42A5F5',
          //           backgroundColor: '#42A5F5'
          //         }]
          //       },
          //       options: {
          //         responsive: true,
          //         plugins: {
          //           title: {
          //             display: true,
          //             text: 'Test Chart Widget'
          //           }
          //         }
          //       }
          //     }
          //   }],
          //   app
          // )
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
