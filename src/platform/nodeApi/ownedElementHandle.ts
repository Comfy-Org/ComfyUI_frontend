import type { Unsubscribe } from './widgetHandle'

export interface OwnedElementScope {
  readonly nodeId: string
  readonly widget: string
}

export type OwnedElementNumberProperty =
  | 'currentTime'
  | 'duration'
  | 'videoWidth'
  | 'videoHeight'
  | 'readyState'
  | 'volume'
  | 'naturalWidth'
  | 'naturalHeight'
  | 'width'
  | 'height'
  | 'selectionStart'
  | 'selectionEnd'
  | 'scrollTop'

export type OwnedElementBooleanProperty =
  | 'paused'
  | 'ended'
  | 'muted'
  | 'complete'

export type OwnedElementEvent =
  | 'timeupdate'
  | 'loadedmetadata'
  | 'loadeddata'
  | 'play'
  | 'pause'
  | 'ended'
  | 'seeked'
  | 'error'
  | 'load'
  | 'input'
  | 'change'

export interface OwnedElementEventDetail {
  readonly currentTime?: number
  readonly duration?: number
  readonly value?: string
}

export interface OwnedElementHandle {
  get(property: OwnedElementNumberProperty): Promise<number>
  get(property: OwnedElementBooleanProperty): Promise<boolean>
  get(property: 'value'): Promise<string>
  set(
    property:
      | 'currentTime'
      | 'volume'
      | 'playbackRate'
      | 'width'
      | 'height'
      | 'scrollTop',
    value: number
  ): Promise<void>
  set(property: 'muted' | 'loop', value: boolean): Promise<void>
  set(property: 'value' | 'src' | 'alt', value: string): Promise<void>
  invoke(
    method: 'play' | 'pause' | 'load' | 'focus' | 'select' | 'click'
  ): Promise<void>
  invoke(
    method: 'setSelectionRange',
    start: number,
    end: number,
    direction?: 'forward' | 'backward' | 'none'
  ): Promise<void>
  listen(
    event: OwnedElementEvent,
    listener: (detail: OwnedElementEventDetail) => void
  ): Promise<Unsubscribe>
}
