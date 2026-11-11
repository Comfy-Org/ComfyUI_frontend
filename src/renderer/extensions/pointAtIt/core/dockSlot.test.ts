import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { keepDocked, placeAfterMarker } from './dockSlot'

const BAR =
  '<div id="bar"><button id="user"></button><span id="separator"></span><button id="agent"></button></div>'

function find(selector: string): Element {
  const element = document.querySelector(selector)
  if (!element) throw new Error(`No element matches ${selector}`)
  return element
}

function dock() {
  const slot = document.createElement('div')
  slot.id = 'slot'
  const onChange = vi.fn()
  const undock = keepDocked(
    slot,
    () => placeAfterMarker(slot, '#bar', '#separator'),
    onChange
  )
  onTestFinished(undock)
  return { slot, onChange }
}

function order(): string[] {
  return [...find('#bar').children].map((child) => child.id)
}

async function nextFrame() {
  await vi.advanceTimersByTimeAsync(32)
}

describe('keepDocked', () => {
  it('P-01: puts the trigger directly before the Agent entry button', () => {
    document.body.innerHTML = BAR

    const { onChange } = dock()

    expect(order()).toEqual(['user', 'separator', 'slot', 'agent'])
    expect(onChange).toHaveBeenLastCalledWith(true)
  })

  it('P-03: puts it back after the bar re-renders without it', async () => {
    document.body.innerHTML = BAR
    dock()

    find('#bar').innerHTML =
      '<button id="user"></button><span id="separator"></span><button id="agent"></button>'
    await nextFrame()

    expect(order()).toEqual(['user', 'separator', 'slot', 'agent'])
  })

  it('P-02: sits at the end of the bar when the Agent entry button is not there, and moves back when it returns', async () => {
    document.body.innerHTML = '<div id="bar"><button id="user"></button></div>'
    dock()
    expect(order()).toEqual(['user', 'slot'])

    find('#bar').insertAdjacentHTML(
      'beforeend',
      '<span id="separator"></span><button id="agent"></button>'
    )
    await nextFrame()

    expect(order()).toEqual(['user', 'separator', 'slot', 'agent'])
  })

  it('P-02: reports that there is no place when the bar is not on screen, and docks when it appears', async () => {
    const { slot, onChange } = dock()
    expect(onChange).toHaveBeenLastCalledWith(false)
    expect(slot.isConnected).toBe(false)

    document.body.innerHTML = BAR
    await nextFrame()

    expect(onChange).toHaveBeenLastCalledWith(true)
    expect(order()).toEqual(['user', 'separator', 'slot', 'agent'])
  })
})
