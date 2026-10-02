/*
  Original implementation:
    https://github.com/TahaSh/drag-to-reorder
    MIT License

    Copyright (c) 2023 Taha Shashtari

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
*/
const styleElement = document.createElement('style')
styleElement.textContent = `
        .draggable-item {
            position: relative;
            will-change: transform;
            user-select: none;
        }
        .draggable-item.is-idle {
            transition: 0.25s ease transform;
        }
        .draggable-item.is-draggable {
            z-index: 10;
        }
    `
document.head.append(styleElement)

export class DraggableList extends EventTarget {
  listContainer: HTMLElement
  draggableItem: HTMLElement | null = null
  pointerStartX = 0
  pointerStartY = 0
  scrollYMax = 0
  itemsGap = 0
  items: HTMLElement[] = []
  itemSelector: string
  handleClass = 'drag-handle'
  off: Array<() => void> = []
  offDrag: Array<() => void> = []

  constructor(element: HTMLElement, itemSelector: string) {
    super()
    this.listContainer = element
    this.itemSelector = itemSelector

    this.off.push(this.on(this.listContainer, 'mousedown', this.dragStart))
    this.off.push(this.on(this.listContainer, 'touchstart', this.dragStart))
    this.off.push(this.on(document, 'mouseup', this.dragEnd))
    this.off.push(this.on(document, 'touchend', this.dragEnd))
    this.off.push(this.on(document, 'pointercancel', this.dragEnd))
  }

  getAllItems() {
    if (!this.items.length) {
      this.items = Array.from(
        this.listContainer.querySelectorAll(this.itemSelector)
      )
      this.items.forEach((element) => {
        element.classList.add('is-idle')
      })
    }
    return this.items
  }

  getIdleItems() {
    return this.getAllItems().filter((item) =>
      item.classList.contains('is-idle')
    )
  }

  isItemAbove(item: HTMLElement) {
    return item.hasAttribute('data-is-above')
  }

  isItemToggled(item: HTMLElement) {
    return item.hasAttribute('data-is-toggled')
  }

  on(
    source: EventTarget,
    event: string,
    listener: (event: Event) => void,
    options?: AddEventListenerOptions | boolean
  ) {
    const boundListener = listener.bind(this)
    source.addEventListener(event, boundListener, options)
    return () => source.removeEventListener(event, boundListener)
  }

  dragStart(e: Event) {
    if (e instanceof MouseEvent && e.button > 0) return

    if (
      e.target instanceof Element &&
      e.target.classList.contains(this.handleClass)
    ) {
      const item = e.target.closest(this.itemSelector)
      this.draggableItem = item instanceof HTMLElement ? item : null
    }

    if (!this.draggableItem) return

    const pointer = this.getPointerPosition(e)
    if (!pointer) return
    this.pointerStartX = pointer.x
    this.pointerStartY = pointer.y
    this.scrollYMax =
      this.listContainer.scrollHeight - this.listContainer.clientHeight

    this.setItemsGap()
    this.initDraggableItem()
    this.initItemsState()

    this.offDrag.push(this.on(document, 'mousemove', this.drag))
    this.offDrag.push(
      this.on(document, 'touchmove', this.drag, { passive: false })
    )

    this.dispatchEvent(
      new CustomEvent('dragstart', {
        detail: {
          element: this.draggableItem,
          position: this.getAllItems().indexOf(this.draggableItem)
        }
      })
    )
  }

  setItemsGap() {
    if (this.getIdleItems().length <= 1) {
      this.itemsGap = 0
      return
    }

    const item1 = this.getIdleItems()[0]
    const item2 = this.getIdleItems()[1]

    const item1Rect = item1.getBoundingClientRect()
    const item2Rect = item2.getBoundingClientRect()

    this.itemsGap = Math.abs(item1Rect.bottom - item2Rect.top)
  }

  initItemsState() {
    const draggableItem = this.draggableItem
    if (!draggableItem) return
    this.getIdleItems().forEach((item, i) => {
      if (this.getAllItems().indexOf(draggableItem) > i) {
        item.dataset.isAbove = ''
      }
    })
  }

  initDraggableItem() {
    const draggableItem = this.draggableItem
    if (!draggableItem) return
    draggableItem.classList.remove('is-idle')
    draggableItem.classList.add('is-draggable')
  }

  drag(e: Event) {
    if (!this.draggableItem) return

    e.preventDefault()

    const pointer = this.getPointerPosition(e)
    if (!pointer) return
    const clientX = pointer.x
    const clientY = pointer.y

    const listRect = this.listContainer.getBoundingClientRect()

    if (clientY > listRect.bottom) {
      if (this.listContainer.scrollTop < this.scrollYMax) {
        this.listContainer.scrollBy(0, 10)
        this.pointerStartY -= 10
      }
    } else if (clientY < listRect.top && this.listContainer.scrollTop > 0) {
      this.pointerStartY += 10
      this.listContainer.scrollBy(0, -10)
    }

    const pointerOffsetX = clientX - this.pointerStartX
    const pointerOffsetY = clientY - this.pointerStartY

    this.updateIdleItemsStateAndPosition()
    this.draggableItem.style.transform = `translate(${pointerOffsetX}px, ${pointerOffsetY}px)`
  }

  updateIdleItemsStateAndPosition() {
    const draggableItem = this.draggableItem
    if (!draggableItem) return
    const draggableItemRect = draggableItem.getBoundingClientRect()
    const draggableItemY = draggableItemRect.top + draggableItemRect.height / 2

    // Update state
    this.getIdleItems().forEach((item) => {
      const itemRect = item.getBoundingClientRect()
      const itemY = itemRect.top + itemRect.height / 2
      if (this.isItemAbove(item)) {
        if (draggableItemY <= itemY) {
          item.dataset.isToggled = ''
        } else {
          delete item.dataset.isToggled
        }
      } else {
        if (draggableItemY >= itemY) {
          item.dataset.isToggled = ''
        } else {
          delete item.dataset.isToggled
        }
      }
    })

    // Update position
    this.getIdleItems().forEach((item) => {
      if (this.isItemToggled(item)) {
        const direction = this.isItemAbove(item) ? 1 : -1
        item.style.transform = `translateY(${direction * (draggableItemRect.height + this.itemsGap)}px)`
      } else {
        item.style.transform = ''
      }
    })
  }

  dragEnd() {
    if (!this.draggableItem) return

    this.applyNewItemsOrder()
    this.cleanup()
  }

  getReorderedItems(draggableItem: HTMLElement): {
    items: HTMLElement[]
    oldPosition: number
  } {
    const allItems = this.getAllItems()
    const reorderedItems: Array<HTMLElement | undefined> = []

    let oldPosition = -1
    allItems.forEach((item, index) => {
      if (item === draggableItem) {
        oldPosition = index
        return
      }
      if (!this.isItemToggled(item)) {
        reorderedItems[index] = item
        return
      }
      const newIndex = this.isItemAbove(item) ? index + 1 : index - 1
      reorderedItems[newIndex] = item
    })

    const items = Array.from(
      { length: allItems.length },
      (_, index) => reorderedItems[index] ?? draggableItem
    )
    return { items, oldPosition }
  }

  applyNewItemsOrder() {
    const draggableItem = this.draggableItem
    if (!draggableItem) return
    const { items, oldPosition } = this.getReorderedItems(draggableItem)

    items.forEach((item) => this.listContainer.appendChild(item))
    this.items = items

    this.dispatchEvent(
      new CustomEvent('dragend', {
        detail: {
          element: draggableItem,
          oldPosition,
          newPosition: items.indexOf(draggableItem)
        }
      })
    )
  }

  cleanup() {
    this.itemsGap = 0
    this.items = []
    this.unsetDraggableItem()
    this.unsetItemState()

    this.offDrag.forEach((f) => f())
    this.offDrag = []
  }

  unsetDraggableItem() {
    if (!this.draggableItem) return
    this.draggableItem.removeAttribute('style')
    this.draggableItem.classList.remove('is-draggable')
    this.draggableItem = null
  }

  unsetItemState() {
    this.getIdleItems().forEach((item: HTMLElement) => {
      delete item.dataset.isAbove
      delete item.dataset.isToggled
      item.style.transform = ''

      // Defer re-adding is-idle (which enables CSS transitions) until after
      // the browser paints items in their final positions. Without this,
      // the transition animates the stale drag transform.
      item.classList.remove('is-idle')
      requestAnimationFrame(() => {
        item.classList.add('is-idle')
      })
    })
  }

  dispose() {
    this.off.forEach((f) => f())
  }

  private getPointerPosition(event: Event) {
    if (event instanceof MouseEvent) {
      return { x: event.clientX, y: event.clientY }
    }
    if (event instanceof TouchEvent) {
      const touch = event.touches[0]
      return { x: touch.clientX, y: touch.clientY }
    }
  }
}
