import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { calculateIntrinsicSize } from './calculateIntrinsicSize'

describe('calculateIntrinsicSize', () => {
  let element: HTMLElement

  beforeEach(() => {
    // Create a test element
    element = document.createElement('div')
    element.style.width = '200px'
    element.style.height = '100px'
    document.body.appendChild(element)
  })

  afterEach(() => {
    document.body.removeChild(element)
  })

  it('should calculate intrinsic size and convert to canvas coordinates', () => {
    // Mock getBoundingClientRect to return specific dimensions
    const originalGetBoundingClientRect = element.getBoundingClientRect
    element.getBoundingClientRect = () => ({
      width: 300,
      height: 150,
      top: 0,
      left: 0,
      bottom: 150,
      right: 300,
      x: 0,
      y: 0,
      toJSON: () => ({})
    })

    const scale = 2
    const result = calculateIntrinsicSize(element, scale)

    // Should divide by scale to convert from screen to canvas coordinates
    expect(result).toEqual({
      width: 150, // 300 / 2
      height: 75 // 150 / 2
    })

    element.getBoundingClientRect = originalGetBoundingClientRect
  })

  it('should restore original size after measuring', () => {
    const originalWidth = element.style.width
    const originalHeight = element.style.height

    element.getBoundingClientRect = () => ({
      width: 300,
      height: 150,
      top: 0,
      left: 0,
      bottom: 150,
      right: 300,
      x: 0,
      y: 0,
      toJSON: () => ({})
    })

    calculateIntrinsicSize(element, 1)

    // Should restore original styles
    expect(element.style.width).toBe(originalWidth)
    expect(element.style.height).toBe(originalHeight)
  })

  it('should handle scale of 1 correctly', () => {
    element.getBoundingClientRect = () => ({
      width: 400,
      height: 200,
      top: 0,
      left: 0,
      bottom: 200,
      right: 400,
      x: 0,
      y: 0,
      toJSON: () => ({})
    })

    const result = calculateIntrinsicSize(element, 1)

    expect(result).toEqual({
      width: 400,
      height: 200
    })
  })

  it('should handle fractional scales', () => {
    element.getBoundingClientRect = () => ({
      width: 300,
      height: 150,
      top: 0,
      left: 0,
      bottom: 150,
      right: 300,
      x: 0,
      y: 0,
      toJSON: () => ({})
    })

    const result = calculateIntrinsicSize(element, 0.5)

    expect(result).toEqual({
      width: 600, // 300 / 0.5
      height: 300 // 150 / 0.5
    })
  })

  it('should temporarily set width and height to auto during measurement', () => {
    let widthDuringMeasurement = ''
    let heightDuringMeasurement = ''

    element.getBoundingClientRect = function (this: HTMLElement) {
      widthDuringMeasurement = this.style.width
      heightDuringMeasurement = this.style.height
      return {
        width: 300,
        height: 150,
        top: 0,
        left: 0,
        bottom: 150,
        right: 300,
        x: 0,
        y: 0,
        toJSON: () => ({})
      }
    }

    calculateIntrinsicSize(element, 1)

    // During measurement, styles should be set to 'auto'
    expect(widthDuringMeasurement).toBe('auto')
    expect(heightDuringMeasurement).toBe('auto')
  })
})
