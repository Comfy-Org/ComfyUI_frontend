<script setup lang="ts">
import type { GraphNode } from '../../lib/workshop/workflow-graph'

const { node } = defineProps<{ node: GraphNode }>()

// The canvas has a palette of its own, and the point of the preview is that it
// reads like the canvas. These are the editor's greys, not the site's.
const BODY = '#1e1e22'
const EDGE = '#ffffff1f'
const TITLE_TEXT = '#f5f5f5'
const SLOT_TEXT = '#c9c9c9'
const WIDGET_FILL = '#00000040'
const WIDGET_EDGE = '#ffffff14'
const WIDGET_TEXT = '#d4d4d4'

const TITLE_BAR = 24
const CORNER = 10
const WIDGET_INSET = 8
const WIDGET_PAD = 9
const LINE_HEIGHT = 14

/** The header, drawn as a rounded top rather than a clipped rectangle. */
const header = (n: GraphNode) =>
  `M ${n.x} ${n.y + CORNER} a ${CORNER} ${CORNER} 0 0 1 ${CORNER} ${-CORNER} h ${n.width - CORNER * 2} a ${CORNER} ${CORNER} 0 0 1 ${CORNER} ${CORNER} v ${TITLE_BAR} h ${-n.width} z`
</script>

<template>
  <g :opacity="node.dimmed ? 0.4 : 1">
    <rect
      :x="node.x"
      :y="node.y"
      :width="node.width"
      :height="node.height"
      rx="10"
      :fill="node.body ?? BODY"
      :stroke="EDGE"
    />
    <path
      :d="header(node)"
      :fill="node.header ?? node.accent"
      :fill-opacity="node.header ? 1 : 0.28"
    />
    <text
      :x="node.x + 12"
      :y="node.y + 22"
      :fill="TITLE_TEXT"
      font-size="14"
      font-weight="600"
    >
      {{ node.title }}
    </text>

    <g v-for="slot in node.inputs" :key="`in-${slot.name}-${slot.y}`">
      <circle :cx="node.x" :cy="node.y + slot.y" r="4.5" :fill="slot.color" />
      <text
        :x="node.x + 12"
        :y="node.y + slot.y + 4"
        :fill="SLOT_TEXT"
        font-size="11"
      >
        {{ slot.name }}
      </text>
    </g>

    <g v-for="slot in node.outputs" :key="`out-${slot.name}-${slot.y}`">
      <circle
        :cx="node.x + node.width"
        :cy="node.y + slot.y"
        r="4.5"
        :fill="slot.color"
      />
      <text
        :x="node.x + node.width - 12"
        :y="node.y + slot.y + 4"
        :fill="SLOT_TEXT"
        font-size="11"
        text-anchor="end"
      >
        {{ slot.name }}
      </text>
    </g>

    <!-- The prompt, the file, the settings: what the node is actually set to,
      which is the difference between a diagram and a picture of this graph. -->
    <g v-for="widget in node.widgets" :key="widget.id">
      <rect
        :x="node.x + WIDGET_INSET"
        :y="node.y + widget.y"
        :width="node.width - WIDGET_INSET * 2"
        :height="widget.height"
        rx="9"
        :fill="WIDGET_FILL"
        :stroke="WIDGET_EDGE"
      />
      <text
        v-for="(line, index) in widget.lines"
        :key="index"
        :x="node.x + WIDGET_INSET + WIDGET_PAD"
        :y="node.y + widget.y + WIDGET_PAD + 11 + index * LINE_HEIGHT"
        :fill="WIDGET_TEXT"
        font-size="11"
      >
        {{ line }}
      </text>
    </g>

    <g v-if="node.picture">
      <clipPath :id="`sample-${node.id}`">
        <rect
          :x="node.x + WIDGET_INSET"
          :y="node.y + node.picture.y"
          :width="node.width - WIDGET_INSET * 2"
          :height="node.picture.height"
          rx="9"
        />
      </clipPath>
      <image
        :href="node.picture.href"
        :x="node.x + WIDGET_INSET"
        :y="node.y + node.picture.y"
        :width="node.width - WIDGET_INSET * 2"
        :height="node.picture.height"
        preserveAspectRatio="xMidYMid slice"
        :clip-path="`url(#sample-${node.id})`"
      />
    </g>
  </g>
</template>
