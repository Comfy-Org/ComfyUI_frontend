import { render, screen, waitFor } from '@testing-library/vue'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'

import Dialog from '@comfyorg/design-system/dialog/Dialog'
import DialogContent from '@comfyorg/design-system/dialog/DialogContent'
import DialogPortal from '@comfyorg/design-system/dialog/DialogPortal'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'

import { installTranslationSafeDomOps } from './translationSafeDomOps'

function translatePageLikeChrome(root: Element) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const texts: Text[] = []
  while (walker.nextNode()) texts.push(walker.currentNode as Text)
  for (const text of texts) {
    if (!text.data.trim()) continue
    const outer = document.createElement('font')
    const inner = document.createElement('font')
    inner.textContent = `[${text.data}]`
    outer.append(inner)
    text.replaceWith(outer)
  }
}

describe('translationSafeDomOps', () => {
  const errors: unknown[] = []
  const handleError = (e: ErrorEvent) => errors.push(e.error)
  const installedSymbol = Symbol.for('comfy.translationSafeDomOps')
  const nativeInsertBefore = Node.prototype.insertBefore
  const installedDescriptor = Object.getOwnPropertyDescriptor(
    Node.prototype,
    installedSymbol
  )

  beforeAll(() => {
    window.addEventListener('error', handleError)
  })
  afterEach(() => {
    errors.length = 0
  })
  afterAll(() => {
    window.removeEventListener('error', handleError)
    Node.prototype.insertBefore = nativeInsertBefore
    if (installedDescriptor) {
      Object.defineProperty(
        Node.prototype,
        installedSymbol,
        installedDescriptor
      )
    } else {
      Reflect.deleteProperty(Node.prototype, installedSymbol)
    }
  })

  it('patches a translated dialog without a DOM NotFoundError', async () => {
    installTranslationSafeDomOps()
    const open = ref(true)
    const hint = ref(true)
    const vueErrors: unknown[] = []
    render(
      {
        components: { Dialog, DialogContent, DialogPortal, DialogTitle },
        setup: () => ({ open, hint }),
        template: `
          <Dialog v-model:open="open">
            <DialogPortal>
              <DialogContent :aria-describedby="undefined">
                <DialogTitle>Search nodes</DialogTitle>
                <p data-testid="row">
                  <span v-if="hint">Hint</span>
                  Load Image
                </p>
              </DialogContent>
            </DialogPortal>
          </Dialog>
        `
      },
      {
        global: {
          config: {
            errorHandler: (err) => {
              vueErrors.push(err)
            }
          }
        }
      }
    )
    const dialog = await screen.findByRole('dialog')
    translatePageLikeChrome(dialog)

    hint.value = false
    await nextTick()
    hint.value = true
    await nextTick()
    open.value = false
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    expect(vueErrors).toEqual([])
    expect(errors).toEqual([])
  })

  it('still inserts before a reference node that belongs to the parent', () => {
    installTranslationSafeDomOps()
    const parent = document.createElement('div')
    const ref = parent.appendChild(document.createElement('b'))
    const node = document.createElement('i')
    parent.insertBefore(node, ref)
    expect([...parent.childNodes]).toEqual([node, ref])
  })

  it('appends when the reference node was detached by a translator', () => {
    installTranslationSafeDomOps()
    const parent = document.createElement('div')
    const existing = parent.appendChild(document.createElement('b'))
    const detached = document.createTextNode('gone')
    const node = document.createElement('i')
    expect(parent.insertBefore(node, detached)).toBe(node)
    expect([...parent.childNodes]).toEqual([existing, node])
  })

  it('inserts before the wrapper that now holds the reference node', () => {
    installTranslationSafeDomOps()
    const parent = document.createElement('div')
    const text = parent.appendChild(document.createTextNode('Load Image'))
    const wrapper = document.createElement('font')
    text.replaceWith(wrapper)
    wrapper.append(text)
    const node = document.createElement('i')
    parent.insertBefore(node, text)
    expect([...parent.childNodes]).toEqual([node, wrapper])
  })
})
