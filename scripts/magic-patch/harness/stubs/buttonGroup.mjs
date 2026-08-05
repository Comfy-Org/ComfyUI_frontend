export class ComfyButtonGroup {
  constructor(...buttons) {
    this.buttons = buttons
    this.element = globalThis.document?.createElement('div')
  }
  append() {}
  insert() {}
  remove() {}
}
export default { ComfyButtonGroup }
