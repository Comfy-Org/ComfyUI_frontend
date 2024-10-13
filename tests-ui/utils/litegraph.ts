// @ts-strict-ignore
import fs from 'fs'
import path from 'path'
import { nop } from '../utils/nopProxy'

function forEachKey(cb) {
  for (const k of [
    'LiteGraph',
    'LGraph',
    'LLink',
    'LGraphNode',
    'LGraphGroup',
    'DragAndScale',
    'LGraphCanvas',
    'ContextMenu'
  ]) {
    cb(k)
  }
}

export default {
  setup(ctx) {},

  teardown(ctx) {
    // forEachKey((k) => delete ctx[k]);

    // Clear document after each run
    document.getElementsByTagName('html')[0].innerHTML = ''
  }
}
