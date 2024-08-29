module.exports = async function () {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  require('reflect-metadata')
  const { nop } = require('./utils/nopProxy')
  global.enableWebGLCanvas = nop

  HTMLCanvasElement.prototype.getContext = nop

  localStorage['Comfy.Settings.Comfy.Logging.Enabled'] = 'false'

  jest.mock('@/services/dialogService', () => {
    return {
      showLoadWorkflowWarning: jest.fn(),
      showMissingModelsWarning: jest.fn()
    }
  })
}
