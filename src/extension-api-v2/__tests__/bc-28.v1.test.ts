// Category: BC.28 — Subgraph fan-out via set/get virtual nodes
// DB cross-ref: S9.SG1
// Exemplar: https://github.com/kijai/ComfyUI-KJNodes/blob/main/web/js/setgetnodes.js#L1406
// blast_radius: 4.97
// compat-floor: blast_radius ≥ 2.0
// v1 contract: custom virtual node classes with isVirtualNode=true + graphToPrompt rewriting
//              to resolve set/get references

import { describe, it } from 'vitest'

describe('BC.28 v1 contract — subgraph fan-out via set/get virtual nodes', () => {
  describe('S9.SG1 — virtual node registration and isVirtualNode flag', () => {
    it.todo(
      'registering a node class with isVirtualNode=true excludes it from prompt serialization'
    )
    it.todo(
      'virtual Set node stores a named value in a global registry keyed by node title'
    )
    it.todo(
      'virtual Get node reads from the same named registry and wires its output as if linked'
    )
  })

  describe('S9.SG1 — graphToPrompt rewriting', () => {
    it.todo(
      'graphToPrompt resolves all Get references to the corresponding Set node output before serialization'
    )
    it.todo(
      'multiple Get nodes referencing the same Set name all resolve to the same upstream value'
    )
    it.todo(
      'a Get node with no matching Set name is flagged as an error during graphToPrompt'
    )
  })
})
