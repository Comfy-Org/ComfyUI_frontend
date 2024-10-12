// @ts-strict-ignore
import { $el } from '../../ui'
import { applyClasses, ClassList, toggleElement } from '../utils'
import { prop } from '../../utils'
import type { ComfyPopup } from './popup'
import type { ComfyComponent } from '.'
import type { ComfyApp } from '@/scripts/app'
import { Settings } from '@/types/apiTypes'

type ComfyButtonProps = {
  icon?: string
  overIcon?: string
  iconSize?: number
  content?: string | HTMLElement
  tooltip?: string
  enabled?: boolean
  action?: (e: Event, btn: ComfyButton) => void
  classList?: ClassList
  visibilitySetting?: { id: keyof Settings; showValue: boolean }
  app?: ComfyApp
}

export class ComfyButton implements ComfyComponent<HTMLElement> {
  #over = 0
  #popupOpen = false
  isOver = false
  iconElement = $el('i.mdi')
  contentElement = $el('span')
  popup: ComfyPopup
  element: HTMLElement
  overIcon: string
  iconSize: number
  content: string | HTMLElement
  icon: string
  tooltip: string
  classList: ClassList
  hidden: boolean
  enabled: boolean
  action: (e: Event, btn: ComfyButton) => void

  constructor({
    icon,
    overIcon,
    iconSize,
    content,
    tooltip,
    action,
    classList = 'comfyui-button',
    visibilitySetting,
    app,
    enabled = true
  }: ComfyButtonProps) {
    this.element = $el(
      'button',
      {
        onmouseenter: () => {
          this.isOver = true
          if (this.overIcon) {
            this.updateIcon()
          }
        },
        onmouseleave: () => {
          this.isOver = false
          if (this.overIcon) {
            this.updateIcon()
          }
        }
      },
      [this.iconElement, this.contentElement]
    )

    this.icon = prop(
      this,
      'icon',
      icon,
      toggleElement(this.iconElement, { onShow: this.updateIcon })
    )
    this.overIcon = prop(this, 'overIcon', overIcon, () => {
      if (this.isOver) {
        this.updateIcon()
      }
    })
    this.iconSize = prop(this, 'iconSize', iconSize, this.updateIcon)
    this.content = prop(
      this,
      'content',
      content,
      toggleElement(this.contentElement, {
        onShow: (el, v) => {
          if (typeof v === 'string') {
            el.textContent = v
          } else {
            el.replaceChildren(v)
          }
        }
      })
    )

    this.tooltip = prop(this, 'tooltip', tooltip, (v) => {
      if (v) {
        this.element.title = v
      } else {
        this.element.removeAttribute('title')
      }
    })
    if (tooltip !== undefined) {
      this.element.setAttribute('aria-label', tooltip)
    }
    this.classList = prop(this, 'classList', classList, this.updateClasses)
    this.hidden = prop(this, 'hidden', false, this.updateClasses)
    this.enabled = prop(this, 'enabled', enabled, () => {
      this.updateClasses()
      ;(this.element as HTMLButtonElement).disabled = !this.enabled
    })
    this.action = prop(this, 'action', action)
    this.element.addEventListener('click', (e) => {
      if (this.popup) {
        // we are either a touch device or triggered by click not hover
        if (!this.#over) {
          this.popup.toggle()
        }
      }
      this.action?.(e, this)
    })

    if (visibilitySetting?.id) {
      const settingUpdated = () => {
        this.hidden =
          app.ui.settings.getSettingValue(visibilitySetting.id) !==
          visibilitySetting.showValue
      }
      app.ui.settings.addEventListener(
        visibilitySetting.id + '.change',
        settingUpdated
      )
      settingUpdated()
    }
  }

  updateIcon = () =>
    (this.iconElement.className = `mdi mdi-${(this.isOver && this.overIcon) || this.icon}${this.iconSize ? ' mdi-' + this.iconSize + 'px' : ''}`)
  updateClasses = () => {
    const internalClasses = []
    if (this.hidden) {
      internalClasses.push('hidden')
    }
    if (!this.enabled) {
      internalClasses.push('disabled')
    }
    if (this.popup) {
      if (this.#popupOpen) {
        internalClasses.push('popup-open')
      } else {
        internalClasses.push('popup-closed')
      }
    }
    applyClasses(this.element, this.classList, ...internalClasses)
  }

  withPopup(popup: ComfyPopup, mode: 'click' | 'hover' = 'click') {
    this.popup = popup

    if (mode === 'hover') {
      for (const el of [this.element, this.popup.element]) {
        el.addEventListener('mouseenter', () => {
          this.popup.open = !!++this.#over
        })
        el.addEventListener('mouseleave', () => {
          this.popup.open = !!--this.#over
        })
      }
    }

    popup.addEventListener('change', () => {
      this.#popupOpen = popup.open
      this.updateClasses()
    })

    return this
  }
}
