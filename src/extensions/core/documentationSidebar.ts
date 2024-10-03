import { app } from '../../scripts/app'
import { getColorPalette } from './colorPalette'
import type { CustomSidebarTabExtension } from '../../types/extensionTypes'
import { LiteGraph } from '@comfyorg/litegraph'

var helpDOM = document.createElement('div')
var cdef

function setCollapse(el, doCollapse) {
  if (doCollapse) {
    el.children[0].children[0].innerHTML = '+'
    Object.assign(el.children[1].style, {
      color: '#CCC',
      overflowX: 'hidden',
      width: '0px',
      minWidth: 'calc(100% - 20px)',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    })
    for (let child of el.children[1].children) {
      if (child.style.display != 'none') {
        child.origDisplay = child.style.display
      }
      child.style.display = 'none'
    }
  } else {
    el.children[0].children[0].innerHTML = '-'
    Object.assign(el.children[1].style, {
      color: '',
      overflowX: '',
      width: '100%',
      minWidth: '',
      textOverflow: '',
      whiteSpace: ''
    })
    for (let child of el.children[1].children) {
      child.style.display = child.origDisplay
    }
  }
}
function collapseOnClick() {
  let doCollapse = this.children[0].innerHTML == '-'
  setCollapse(this.parentElement, doCollapse)
}
//TODO: connect with doc tooltips
//If doc sidebar is opened, the current node should not display tooltips,
//but navigate the sidebar pane as appropriate.
function selectHelp(name: string, value?: string) {
  if (cdef[2]?.select) {
    return cdef[2].select(this, name, value)
  }
  //attempt to navigate to name in help
  function collapseUnlessMatch(items, t) {
    var match = items.querySelector('[doc_title="' + t + '"]')
    if (!match) {
      for (let i of items.children) {
        if (i.innerHTML.slice(0, t.length + 5).includes(t)) {
          match = i
          break
        }
      }
    }
    if (!match) {
      return null
    }
    //For longer documentation items with fewer collapsable elements,
    //scroll to make sure the entirety of the selected item is visible
    match.scrollIntoView({ block: 'nearest' })
    //The previous floating help implementation would try to scroll the window
    //itself if the display was partiall offscreen. As the sidebar documentation
    //does not pan with the canvas, this should no longer be needed
    //window.scrollTo(0, 0)
    for (let i of items.querySelectorAll('.doc_collapse')) {
      if (i.contains(match)) {
        setCollapse(i, false)
      } else {
        setCollapse(i, true)
      }
    }
    return match
  }
  let target = collapseUnlessMatch(helpDOM, name)
  if (target) {
    target.focus()
    if (value) {
      collapseUnlessMatch(target, value)
    }
  }
}
app.tooltipCallback = function (node, name, value) {
  if (node != app.canvas.current_node) {
    return false
  }
  if (name == 'DESCRIPTION') {
    return false
  }
  selectHelp(name, value)
  return true
}
function updateNode(node?) {
  //Always use latest node. If it lacks documentation, that should be communicated
  //instead of confusing users by picking a different recent node that does
  node ||= app.canvas.current_node
  const def = LiteGraph.getNodeType(node.type).nodeData
  if (cdef == def) {
    return
  }
  cdef = def
  if (Array.isArray(def.description)) {
    helpDOM.innerHTML = def.description[1]
  } else {
    //do additional parsing to prettify output and combine tooltips
    let content = ''
    if (def.description) {
      content += '<section>' + def.description + '</section>'
    }
    let inputs = []
    for (let input in def?.input?.required || {}) {
      if (def.input.required[input][1]?.tooltip) {
        inputs.push([input, def.input.required[input][1].tooltip])
      }
    }
    for (let input in def?.input?.optional || {}) {
      if (def.input.optional[input][1]?.tooltip) {
        inputs.push([input, def.input.optional[input][1].tooltip])
      }
    }
    if (inputs.length) {
      content += '<div class="doc-section">Inputs</div>'
      for (let [k, v] of inputs) {
        content +=
          '<div tabindex=-1 class="doc-item">' +
          k +
          '<div>' +
          v +
          '</div></div>'
      }
      //content += "</div>"
      //content += '<br><br><div>' + inputs.join('</div><div>') + '</div>'
    }
    if (def.output_tooltips) {
      content += '<div class="doc-section">Outputs</div>'
      let outputs = def.output_name || def.output
      for (let i = 0; i < outputs.length; i++) {
        content +=
          '<div tabindex=-1 class="doc-item">' +
          outputs[i] +
          '<div>' +
          def.output_tooltips[i] +
          '</div></div>'
      }
      //outputs += '</div>'
    }
    if (content == '') {
      content = 'No documentation available'
    }
    content = '<div class="doc-node">' + def.display_name + '</div>' + content
    helpDOM.innerHTML = content
  }
}
let docStyleElement = document.createElement('style')
docStyleElement.innerHTML = `
.doc-node {
  font-size: 1.5em
}
.doc-section {
  background-color: var(--comfy-menu-bg)
}
.doc-item div {
  margin-inline-start: 1vw;
}
@keyframes selectAnimation {
  0% { background-color: #5555}
  80% { background-color: #5555}
  100% { background-color: #0000}
}
.doc-item:focus {
  animation: selectAnimation 2s;
}
.DocumentationIcon:before {
  font-size: 1.5em; content: '?';
}
`
document.body.append(docStyleElement)

var bringToFront
class DocumentationSidebar implements CustomSidebarTabExtension {
  id = 'documentationSidebar'
  title = 'Documentation'
  type
  icon = 'DocumentationIcon'
  render(e) {
    if (!bringToFront) {
      var bringToFront = app.canvas.bringToFront
      app.canvas.bringToFront = function (node) {
        updateNode(node)
        return bringToFront.apply(this, arguments)
      }
    }
    updateNode()
    if (!e?.children?.length) {
      e.appendChild(helpDOM)
    }
    if (cdef.description[2]?.render) {
      cdef.description[2].render(e)
    }
  }
}
app.extensionManager.registerSidebarTab(new DocumentationSidebar())
