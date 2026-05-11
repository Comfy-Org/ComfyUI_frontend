// Category: BC.29 — Graph enumeration, mutation, and cross-scope identity
// DB cross-ref: S11.G2, S14.ID1
// Exemplar: https://github.com/yolain/ComfyUI-Easy-Use/blob/main/web_version/v1/js/easy/easyExtraMenu.js#L439
// blast_radius: 5.13
// compat-floor: blast_radius ≥ 2.0
// migration: app.graph raw methods → comfyApp.graph typed API; parseNodeLocatorId → NodeLocatorId.parse

import { describe, it } from 'vitest'

describe('BC.29 migration — graph enumeration, mutation, and cross-scope identity', () => {
  describe('graph enumeration migration', () => {
    it.todo(
      'app.graph.findNodesByType(type) is replaced by comfyApp.graph.findByType(type) returning NodeHandle[]'
    )
    it.todo(
      'v2 compat shim forwards app.graph.findNodesByType calls to comfyApp.graph.findByType with a deprecation warning'
    )
  })

  describe('graph mutation migration', () => {
    it.todo(
      'app.graph.add(node) accepting a raw LiteGraph node is replaced by comfyApp.graph.addNode(opts)'
    )
    it.todo(
      'app.graph.remove(node) accepting a raw reference is replaced by comfyApp.graph.removeNode(handle)'
    )
    it.todo(
      'v2 compat shim wraps a raw LiteGraph node passed to add() as a NodeHandle automatically'
    )
  })

  describe('cross-scope identity migration', () => {
    it.todo(
      'parseNodeLocatorId(id) free function is replaced by NodeLocatorId.parse(id) static method'
    )
    it.todo(
      'createNodeLocatorId(scope, id) is replaced by NodeLocatorId.create(scope, id)'
    )
  })
})
