// eslint-disable-next-line import-x/no-unresolved -- import is correct at time of test execution
import { app } from '../../scripts/app.js'

const NODE_TYPE = 'DevToolsNodeWithHiddenAriaDialog'

app.registerExtension({
  name: 'DevTools.HiddenAriaDialog',
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_TYPE) return

    const onNodeCreated = nodeType.prototype.onNodeCreated
    nodeType.prototype.onNodeCreated = function (...args) {
      onNodeCreated?.apply(this, args)

      const dialog = document.createElement('div')
      dialog.setAttribute('role', 'dialog')
      dialog.setAttribute('aria-modal', 'true')
      dialog.dataset.devtoolsHiddenAriaDialog = ''
      dialog.hidden = true
      dialog.tabIndex = -1
      document.body.appendChild(dialog)

      const hiddenAncestor = document.createElement('div')
      hiddenAncestor.setAttribute('aria-hidden', 'true')
      hiddenAncestor.style.display = 'none'
      const ancestorHiddenDialog = document.createElement('section')
      ancestorHiddenDialog.setAttribute('role', 'dialog')
      ancestorHiddenDialog.setAttribute('aria-modal', 'true')
      ancestorHiddenDialog.dataset.devtoolsAncestorHiddenAriaDialog = ''
      hiddenAncestor.appendChild(ancestorHiddenDialog)
      document.body.appendChild(hiddenAncestor)

      const onRemoved = this.onRemoved
      this.onRemoved = function (...removeArgs) {
        dialog.remove()
        hiddenAncestor.remove()
        onRemoved?.apply(this, removeArgs)
      }
    }
  }
})
