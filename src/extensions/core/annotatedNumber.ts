import { LiteGraph, LGraphCanvas } from '@comfyorg/litegraph'
import { app } from '../../scripts/app.js'
import { LGraphNode } from '@comfyorg/litegraph'
//import { ComfyWidgets } from '../../scripts/widgets'

function inner_value_change(widget, value) {
  widget.value = value
  if (
    widget.options &&
    widget.options.property &&
    node.properties[widget.options.property] !== undefined
  ) {
    node.setProperty(widget.options.property, value)
  }
}

function button_action(widget) {
  if (
    widget.options?.reset == undefined &&
    widget.options?.disable == undefined
  ) {
    return 'None'
  }
  if (
    widget.options.reset != undefined &&
    widget.value != widget.options.reset
  ) {
    return 'Reset'
  }
  if (
    widget.options.disable != undefined &&
    widget.value != widget.options.disable
  ) {
    return 'Disable'
  }
  if (widget.options.reset) {
    return 'No Reset'
  }
  return 'No Disable'
}

function draw(ctx, node, widget_width, y, H) {
  const show_text = app.canvas.ds.scale > 0.5
  const margin = 15
  ctx.textAlign = 'left'
  ctx.strokeStyle = LiteGraph.WIDGET_OUTLINE_COLOR
  ctx.fillStyle = LiteGraph.WIDGET_BGCOLOR
  ctx.beginPath()
  if (show_text)
    ctx.roundRect(margin, y, widget_width - margin * 2, H, [H * 0.5])
  else ctx.rect(margin, y, widget_width - margin * 2, H)
  ctx.fill()
  if (show_text) {
    if (!this.disabled) ctx.stroke()
    const button = button_action(this)
    const padding = button == 'None' ? 0 : 20
    if (button != 'None') {
      ctx.save()
      ctx.font = ctx.font.split(' ')[0] + ' monospace'
      if (button.startsWith('No ')) {
        ctx.fillStyle = LiteGraph.WIDGET_OUTLINE_COLOR
      } else {
        ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR
      }
      if (button.endsWith('Reset')) {
        ctx.fillText('\u21ba', margin + 6, y + H * 0.7)
      } else {
        ctx.fillText('\u2298', margin + 6, y + H * 0.7)
      }
      ctx.restore()
    }
    ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR
    if (!this.disabled) {
      ctx.beginPath()
      ctx.moveTo(margin + 16 + padding, y + 5)
      ctx.lineTo(margin + 6 + padding, y + H * 0.5)
      ctx.lineTo(margin + 16 + padding, y + H - 5)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(widget_width - margin - 16, y + 5)
      ctx.lineTo(widget_width - margin - 6, y + H * 0.5)
      ctx.lineTo(widget_width - margin - 16, y + H - 5)
      ctx.fill()
    }
    ctx.fillStyle = LiteGraph.WIDGET_SECONDARY_TEXT_COLOR
    ctx.fillText(this.label || this.name, margin * 2 + 5 + padding, y + H * 0.7)
    ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR
    ctx.textAlign = 'right'
    const text = Number(this.value).toFixed(
      this.options.precision !== undefined ? this.options.precision : 3
    )
    ctx.fillText(text, widget_width - margin * 2 - 20, y + H * 0.7)
    if (this.options.mappedValues && this.value in this.options.mappedValues) {
      //TODO: measure this text
      ctx.fillStyle = LiteGraph.WIDGET_OUTLINE_COLOR
      const value_width = ctx.measureText(text).width
      ctx.fillText(
        this.options.mappedValues[this.value],
        widget_width - margin * 2 - 25 - value_width,
        y + H * 0.7
      )
    }
  }
}
function mouse(event, [x, y], node) {
  const button = button_action(this)
  const padding = button == 'None' ? 0 : 20
  const widget_width = this.width || node.size[0]
  const old_value = this.value
  const delta = x < 40 + padding ? -1 : x > widget_width - 40 ? 1 : 0
  const margin = 15
  var allow_scroll = true
  if (delta) {
    if (x > -3 && x < widget_width + 3) {
      allow_scroll = false
    }
  }
  if (allow_scroll && event.type == LiteGraph.pointerevents_method + 'move') {
    if (event.deltaX)
      this.value += event.deltaX * 0.1 * (this.options.step || 1)
    if (this.options.min != null && this.value < this.options.min) {
      this.value = this.options.min
    }
    if (this.options.max != null && this.value > this.options.max) {
      this.value = this.options.max
    }
  } else if (event.type == LiteGraph.pointerevents_method + 'down') {
    if (x < padding + margin) {
      if (button == 'Reset') {
        this.value = this.options.reset
      } else if (button == 'Disable') {
        this.value = this.options.disable
      }
    } else {
      this.value += delta * 0.1 * (this.options.step || 1)
      if (this.options.min != null && this.value < this.options.min) {
        this.value = this.options.min
      }
      if (this.options.max != null && this.value > this.options.max) {
        this.value = this.options.max
      }
    }
  } //end mousedown
  else if (event.type == LiteGraph.pointerevents_method + 'up') {
    if (event.click_time < 200 && delta == 0) {
      app.canvas.prompt(
        'Value',
        this.value,
        function (v) {
          //NOTE: Original code uses eval here. This will not be reproduced
          this.value = Number(v)
          if (this.callback) {
            this.callback(this.value, app.canvas, node, [x, y], event)
          }
        }.bind(this),
        event
      )
    }
  }

  if (old_value != this.value)
    setTimeout(
      function () {
        if (this.callback) {
          this.callback(this.value, app.canvas, node, [x, y], event)
        }
      }.bind(this),
      20
    )
  this.dirty_canvas = true
}

app.registerExtension({
  name: 'Comfy.MappedNumber',
  async getCustomWidgets(app) {
    return {
      MAPPEDNUMBER(node, inputName, inputData) {
        let w = {
          name: inputName,
          type: 'MAPPEDNUMBER',
          value: 0,
          draw: draw,
          mouse: mouse,
          computeSize: undefined, //TODO: calculate minimum width
          options: {}
        }
        if (inputData.length > 1) {
          w.options = inputData[1]
          for (let k of ['default', 'min', 'max']) {
            if (inputData[1][k] != undefined) {
              w.value = inputData[1][k]
              break
            }
          }
        }
        if (!node.widgets) {
          node.widgets = []
        }
        node.widgets.push(w)
        return w
      }
    }
  },
  registerCustomNodes() {
    class TestNum extends LGraphNode {
      static category = 'utils'

      color = LGraphCanvas.node_colors.yellow.color
      bgcolor = LGraphCanvas.node_colors.yellow.bgcolor
      groupcolor = LGraphCanvas.node_colors.yellow.groupcolor
      isVirtualNode = true
      collapsable = true
      title_mode = LiteGraph.NORMAL_TITLE
      title = 'testNum'

      constructor(title?: string) {
        super(title)
        app.widgets.MAPPEDNUMBER(
          // Should we extends LGraphNode?  Yesss
          this,
          'x',
          [
            'MAPPEDNUMBER',
            {
              default: 5,
              reset: 5,
              disable: 0,
              mappedValues: { 6: 'def+1', 5: 'default', 0: 'disabled' },
              step: 10
            }
          ],
          app
        )
      }
    }

    // Load default visibility

    LiteGraph.registerNodeType('TestNum', TestNum)
  }
})
