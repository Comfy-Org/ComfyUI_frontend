/** Scalar operations on a keyed element in the caller's mounted UI.
 * The secure provider enforces the mounted tag's allowlist and ownership.
 * No DOM node is returned; removed elements reject until remounted.
 */
export interface OwnedElementHandle {
  get(
    property:
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
  ): Promise<number>
  get(property: 'paused' | 'ended' | 'muted' | 'complete'): Promise<boolean>
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
    event:
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
      | 'change',
    listener: (detail: {
      readonly currentTime?: number
      readonly duration?: number
      readonly value?: string
    }) => void
  ): Promise<void>
}
