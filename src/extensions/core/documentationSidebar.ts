import { app } from '../../scripts/app.js'
import { api } from '../../scripts/api.js'

let iconOverride = document.createElement('style')
iconOverride.innerHTML = `.VHSTestIcon:before {font-size: 1.5em; content: '?';}`
document.body.append(iconOverride)

var helpDOM
helpDOM = document.createElement('div')

function initHelpDOM() {
  helpDOM.className = 'litegraph'
  let scrollbarStyle = document.createElement('style')
  scrollbarStyle.innerHTML = `
            * {
                scrollbar-width: 6px;
                scrollbar-color: #0003  #0000;
            }
            ::-webkit-scrollbar {
                background: transparent;
                width: 6px;
            }
            ::-webkit-scrollbar-thumb {
                background: #0005;
                border-radius: 20px
            }
            ::-webkit-scrollbar-button {
                display: none;
            }
            .VHS_loopedvideo::-webkit-media-controls-mute-button {
                display:none;
            }
            .VHS_loopedvideo::-webkit-media-controls-fullscreen-button {
                display:none;
            }
    `
  scrollbarStyle.id = 'scroll-properties'
  parentDOM.appendChild(scrollbarStyle)
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
  helpDOM.collapseOnClick = function () {
    let doCollapse = this.children[0].innerHTML == '-'
    setCollapse(this.parentElement, doCollapse)
  }
  helpDOM.selectHelp = function (name, value) {
    //attempt to navigate to name in help
    function collapseUnlessMatch(items, t) {
      var match = items.querySelector('[vhs_title="' + t + '"]')
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
      //This has the unfortunate side effect of trying to scroll the main
      //window if the documentation windows is forcibly offscreen,
      //but it's easy to simply scroll the main window back and seems to
      //have no visual side effects
      match.scrollIntoView(false)
      window.scrollTo(0, 0)
      for (let i of items.querySelectorAll('.VHS_collapse')) {
        if (i.contains(match)) {
          setCollapse(i, false)
        } else {
          setCollapse(i, true)
        }
      }
      return match
    }
    let target = collapseUnlessMatch(helpDOM, name)
    if (target && value) {
      collapseUnlessMatch(target, value)
    }
  }
  helpDOM.addHelp = function (node, nodeType, description) {
    let timeout = null
    chainCallback(node, 'onMouseMove', function (e, pos, canvas) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      if (helpDOM.node != this) {
        return
      }
      timeout = setTimeout(() => {
        let n = this
        if (
          pos[0] > 0 &&
          pos[0] < n.size[0] &&
          pos[1] > 0 &&
          pos[1] < n.size[1]
        ) {
          //TODO: provide help specific to element clicked
          let inputRows = Math.max(
            n.inputs?.length || 0,
            n.outputs?.length || 0
          )
          if (pos[1] < LiteGraph.NODE_SLOT_HEIGHT * inputRows) {
            let row = Math.floor((pos[1] - 7) / LiteGraph.NODE_SLOT_HEIGHT)
            if (pos[0] < n.size[0] / 2) {
              if (row < n.inputs.length) {
                helpDOM.selectHelp(n.inputs[row].name)
              }
            } else {
              if (row < n.outputs.length) {
                helpDOM.selectHelp(n.outputs[row].name)
              }
            }
          } else {
            //probably widget, but widgets have variable height.
            let basey = LiteGraph.NODE_SLOT_HEIGHT * inputRows + 6
            for (let w of n.widgets) {
              if (w.y) {
                basey = w.y
              }
              let wheight = LiteGraph.NODE_WIDGET_HEIGHT + 4
              if (w.computeSize) {
                wheight = w.computeSize(n.size[0])[1]
              }
              if (pos[1] < basey + wheight) {
                helpDOM.selectHelp(w.name, w.value)
                break
              }
              basey += wheight
            }
          }
        }
      }, 500)
    })
    chainCallback(node, 'onMouseLeave', function (e, pos, canvas) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
    })
  }
}
function updateNode(node) {
  //Always use latest node. If it lacks documentation, that should be communicated
  //instead of confusing users by picking a different recent node that does
  node ||= app.graph._nodes[app.graph._nodes.length - 1]
  const def = LiteGraph.getNodeType(node.type).nodeData
  if (helpDOM.def == def) {
    return
  }
  helpDOM.def = def
  if (def.longDescription) {
    helpDOM.innerHTML = def.longDescription
  } else {
    //do additional parsing to prettify output and combine tooltips
    let content = ''
    if (def.description) {
      content += def.description
    }
    let inputs = []
    for (let input in def?.input?.required || {}) {
      if (def.input.required[input][1]?.tooltip) {
        inputs.push(
          '<b>' + input + '</b>: ' + def.input.required[input][1].tooltip
        )
      }
    }
    for (let input in def?.input?.optional || {}) {
      if (def.input.optional[input][1]?.tooltip) {
        inputs.push(
          '<b>' + input + '</b>: ' + def.input.optional[input][1].tooltip
        )
      }
    }
    if (inputs.length) {
      content += '<br><br><div>' + inputs.join('</div><div>') + '</div>'
    }
    if (def.output_tooltips) {
      content += '<br><br>'
      let outputs = def.output_name || def.output
      for (let i = 0; i < outputs.length; i++) {
        content +=
          '<div><b>' + outputs[i] + '</b>: ' + def.output_tooltips[i] + '</div>'
      }
    }
    helpDOM.innerHTML = content
  }
}
var bringToFront

let documentationSidebar = {
  id: 'documentationSidebar',
  title: 'Documentation',
  icon: 'VHSTestIcon',
  type: 'custom',
  render: (e) => {
    if (!bringToFront) {
      var bringToFront = app.canvas.bringToFront
      app.canvas.bringToFront = function (node) {
        updateNode(node)
        return bringToFront.apply(this, arguments)
      }
    }
    updateNode()
    e.parentElement.style.overflowX = ''
    if (!e?.children?.length) {
      e.appendChild(helpDOM)
    }
  }
}
app.extensionManager.registerSidebarTab(documentationSidebar)
