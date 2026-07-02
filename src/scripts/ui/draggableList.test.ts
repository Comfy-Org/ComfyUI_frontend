import { afterEach, describe, expect, it, vi } from 'vitest'

import { DraggableList } from './draggableList'

function createList(itemCount: number) {
  const container = document.createElement('div')
  const items = Array.from({ length: itemCount }, (_, index) => {
    const item = document.createElement('div')
    item.className = 'item'
    item.dataset.index = String(index)

    const handle = document.createElement('button')
    handle.className = 'drag-handle'
    item.append(handle)
    container.append(item)

    return item
  })
  document.body.append(container)
  return { container, items }
}

function setRect(element: Element, top: number, height = 20) {
  return vi
    .spyOn(element, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(0, top, 100, height))
}

function defineScrollMetrics(
  container: HTMLElement,
  scrollHeight: number,
  clientHeight: number
) {
  Object.defineProperty(container, 'scrollHeight', {
    configurable: true,
    value: scrollHeight
  })
  Object.defineProperty(container, 'clientHeight', {
    configurable: true,
    value: clientHeight
  })
}

function mouseDragEvent(
  target: Element,
  overrides: Partial<MouseEvent> = {}
): MouseEvent {
  return {
    button: 0,
    clientX: 0,
    clientY: 0,
    preventDefault: vi.fn(),
    target,
    ...overrides
  } satisfies Partial<MouseEvent> as MouseEvent
}

describe('DraggableList', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('ignores missing containers and non-primary drag starts', () => {
    const listWithoutContainer = new DraggableList(null, '.item')
    const { container, items } = createList(1)
    const list = new DraggableList(container, '.item')

    list.dragStart(
      mouseDragEvent(items[0].querySelector('.drag-handle')!, { button: 1 })
    )
    list.dragEnd()

    expect(listWithoutContainer.listContainer).toBeNull()
    expect(list.draggableItem).toBeUndefined()
  })

  it('starts from a handle, scrolls downward, and reorders upward', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    const { container, items } = createList(3)
    const scrollBy = vi.fn((_left: number, top: number) => {
      container.scrollTop += top
    })
    container.scrollBy = scrollBy as unknown as typeof container.scrollBy
    defineScrollMetrics(container, 120, 80)
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 100, 80)
    )
    setRect(items[0], 0)
    setRect(items[1], 30)
    setRect(items[2], 60)

    const list = new DraggableList(container, '.item')
    const dragStart = vi.fn()
    const dragEnd = vi.fn()
    list.addEventListener('dragstart', dragStart)
    list.addEventListener('dragend', dragEnd)

    list.dragStart(
      mouseDragEvent(items[2].querySelector('.drag-handle')!, {
        clientX: 10,
        clientY: 70
      })
    )
    list.drag(
      mouseDragEvent(items[2].querySelector('.drag-handle')!, {
        clientX: 20,
        clientY: 100
      })
    )
    items[1].dataset.isToggled = ''
    list.dragEnd()

    expect(dragStart).toHaveBeenCalledOnce()
    expect(dragEnd).toHaveBeenCalledOnce()
    expect(scrollBy).toHaveBeenCalledWith(0, 10)
    expect([...container.children]).toEqual([items[0], items[2], items[1]])
    expect(items[0].classList.contains('is-idle')).toBe(true)
    expect(items[1].classList.contains('is-idle')).toBe(true)
  })

  it('supports touch coordinates, upward scrolling, and downward reorder', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    const { container, items } = createList(3)
    const scrollBy = vi.fn((_left: number, top: number) => {
      container.scrollTop += top
    })
    container.scrollTop = 10
    container.scrollBy = scrollBy as unknown as typeof container.scrollBy
    defineScrollMetrics(container, 120, 80)
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 20, 100, 80)
    )
    setRect(items[0], 0)
    setRect(items[1], 30)
    setRect(items[2], 60)

    const list = new DraggableList(container, '.item')
    const touchStart = {
      button: 0,
      clientX: 0,
      clientY: 0,
      preventDefault: vi.fn(),
      target: items[0].querySelector('.drag-handle')!,
      touches: [{ clientX: 5, clientY: 30 }]
    } as unknown as TouchEvent
    const touchMove = {
      clientX: 0,
      clientY: 0,
      preventDefault: vi.fn(),
      target: items[0].querySelector('.drag-handle')!,
      touches: [{ clientX: 8, clientY: 10 }]
    } as unknown as TouchEvent

    list.dragStart(touchStart)
    list.drag(touchMove)
    items[1].dataset.isToggled = ''
    list.dragEnd()

    expect(scrollBy).toHaveBeenCalledWith(0, -10)
    expect([...container.children]).toEqual([items[1], items[0], items[2]])
  })

  it('updates idle item state around the dragged item midpoint', () => {
    const { container, items } = createList(3)
    const list = new DraggableList(container, '.item')
    const state = list as unknown as {
      items: HTMLElement[]
      draggableItem: HTMLElement
    }
    state.items = items
    state.draggableItem = items[1]
    list.itemsGap = 5
    items[0].classList.add('is-idle')
    items[1].classList.add('is-idle')
    items[2].classList.add('is-idle')
    items[0].dataset.isAbove = ''
    const draggedRect = setRect(items[1], -10)
    setRect(items[0], 0)
    setRect(items[2], 60)

    list.updateIdleItemsStateAndPosition()

    expect(items[0].dataset.isToggled).toBe('')
    expect(items[0].style.transform).toBe('translateY(25px)')
    expect(items[2].style.transform).toBe('')

    draggedRect.mockReturnValue(new DOMRect(0, 100, 100, 20))
    list.updateIdleItemsStateAndPosition()

    expect(items[0].dataset.isToggled).toBeUndefined()
    expect(items[2].dataset.isToggled).toBe('')
    expect(items[2].style.transform).toBe('translateY(-25px)')
  })

  it('uses zero gap for short lists and disposes listeners', () => {
    const { container } = createList(1)
    const list = new DraggableList(container, '.item')
    const off = vi.fn()
    const disposableList = list as unknown as { off: Array<() => void> }
    disposableList.off = [off]

    list.setItemsGap()
    list.dispose()

    expect(list.itemsGap).toBe(0)
    expect(off).toHaveBeenCalledOnce()
  })
})
