import { app } from '../../scripts/app.js'

const NODE_TYPE = 'DevToolsNodeWithHiddenAriaDialog'

app.registerExtension({
  name: 'DevTools.HiddenAriaDialog',
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_TYPE) return

    const onNodeCreated = nodeType.prototype.onNodeCreated
    nodeType.prototype.onNodeCreated = function (...args) {
      onNodeCreated?.apply(this, args)

      const hiddenDialog = document.createElement('div')
      hiddenDialog.setAttribute('role', 'dialog')
      hiddenDialog.setAttribute('aria-modal', 'true')
      hiddenDialog.dataset.devtoolsHiddenDialog = ''
      hiddenDialog.hidden = true

      const directHiddenDialog = document.createElement('div')
      directHiddenDialog.setAttribute('role', 'dialog')
      directHiddenDialog.setAttribute('aria-modal', 'true')
      directHiddenDialog.dataset.devtoolsDirectHiddenDialog = ''
      directHiddenDialog.style.display = 'none'
      directHiddenDialog.setAttribute('aria-hidden', 'true')

      const hiddenAncestor = document.createElement('div')
      hiddenAncestor.hidden = true
      const ancestorHiddenDialog = document.createElement('section')
      ancestorHiddenDialog.setAttribute('role', 'dialog')
      ancestorHiddenDialog.setAttribute('aria-modal', 'true')
      ancestorHiddenDialog.dataset.devtoolsHiddenAncestorDialog = ''
      hiddenAncestor.appendChild(ancestorHiddenDialog)

      const cssHiddenAncestor = document.createElement('div')
      cssHiddenAncestor.className = 'devtools-hidden-modal-root'
      cssHiddenAncestor.setAttribute('aria-hidden', 'true')
      const cssHiddenDialog = document.createElement('section')
      cssHiddenDialog.setAttribute('role', 'dialog')
      cssHiddenDialog.setAttribute('aria-modal', 'true')
      cssHiddenDialog.dataset.devtoolsClassHiddenAncestorDialog = ''
      cssHiddenAncestor.appendChild(cssHiddenDialog)

      const inlineHiddenAncestor = document.createElement('div')
      inlineHiddenAncestor.style.display = 'none'
      const inlineHiddenDialog = document.createElement('section')
      inlineHiddenDialog.setAttribute('role', 'dialog')
      inlineHiddenDialog.setAttribute('aria-modal', 'true')
      inlineHiddenDialog.dataset.devtoolsInlineHiddenAncestorDialog = ''
      inlineHiddenAncestor.appendChild(inlineHiddenDialog)

      const style = document.createElement('style')
      style.textContent = '.devtools-hidden-modal-root { display: none; }'

      document.body.append(
        hiddenDialog,
        directHiddenDialog,
        hiddenAncestor,
        cssHiddenAncestor,
        inlineHiddenAncestor,
        style
      )

      const onRemoved = this.onRemoved
      this.onRemoved = function (...removeArgs) {
        hiddenDialog.remove()
        directHiddenDialog.remove()
        hiddenAncestor.remove()
        cssHiddenAncestor.remove()
        inlineHiddenAncestor.remove()
        style.remove()
        onRemoved?.apply(this, removeArgs)
      }
    }
  }
})
