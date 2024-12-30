module.exports = async function () {
  jest.mock('vue-i18n', () => {
    return {
      useI18n: jest.fn()
    }
  })

  jest.mock('jsondiffpatch', () => {
    return {
      diff: jest.fn()
    }
  })
}
