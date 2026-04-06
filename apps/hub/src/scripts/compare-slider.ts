import { initCompareSlider } from '../lib/initCompareSlider'

document.querySelectorAll('[data-compare-slider]').forEach((slider) => {
  initCompareSlider(slider as HTMLElement)
})
