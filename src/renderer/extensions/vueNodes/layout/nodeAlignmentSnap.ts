import type {
  Bounds,
  NodeAlignmentGuide,
  Point
} from '@/renderer/core/layout/types'
import { translateBounds } from '@/renderer/core/layout/utils/geometry'

const DEFAULT_THRESHOLD_PX = 8

type HorizontalAnchor = 'bottom' | 'centerY' | 'top'
type VerticalAnchor = 'centerX' | 'left' | 'right'

export interface NodeAlignmentSnapResult {
  delta: Point
  guides: NodeAlignmentGuide[]
}

interface AxisMatch {
  axis: 'horizontal' | 'vertical'
  anchor: HorizontalAnchor | VerticalAnchor
  candidateBounds: Bounds
  correction: number
}

interface ResolveNodeAlignmentSnapOptions {
  candidateBounds: Bounds[]
  delta: Point
  selectionBounds: Bounds
  thresholdPx?: number
  zoomScale: number
}

export function resolveNodeAlignmentSnap({
  candidateBounds,
  delta,
  selectionBounds,
  thresholdPx = DEFAULT_THRESHOLD_PX,
  zoomScale
}: ResolveNodeAlignmentSnapOptions): NodeAlignmentSnapResult {
  if (!candidateBounds.length || zoomScale <= 0) {
    return { delta, guides: [] }
  }

  const threshold = thresholdPx / zoomScale
  const translatedSelectionBounds = translateBounds(selectionBounds, delta)

  const verticalMatch = findBestVerticalMatch(
    translatedSelectionBounds,
    candidateBounds,
    threshold
  )
  const horizontalMatch = findBestHorizontalMatch(
    translatedSelectionBounds,
    candidateBounds,
    threshold
  )

  const snappedDelta = {
    x: delta.x + (verticalMatch?.correction ?? 0),
    y: delta.y + (horizontalMatch?.correction ?? 0)
  }
  const snappedSelectionBounds = translateBounds(selectionBounds, snappedDelta)
  const guides = [
    verticalMatch &&
      createVerticalGuide(
        snappedSelectionBounds,
        verticalMatch.candidateBounds
      ),
    horizontalMatch &&
      createHorizontalGuide(
        snappedSelectionBounds,
        horizontalMatch.candidateBounds
      )
  ].filter((guide): guide is NodeAlignmentGuide => guide !== undefined)

  return {
    delta: snappedDelta,
    guides
  }
}

function findBestVerticalMatch(
  selectionBounds: Bounds,
  candidateBounds: Bounds[],
  threshold: number
): AxisMatch | undefined {
  return findBestMatch<VerticalAnchor>(
    'vertical',
    getVerticalAnchorValues(selectionBounds),
    candidateBounds,
    threshold,
    getVerticalAnchorValues
  )
}

function findBestHorizontalMatch(
  selectionBounds: Bounds,
  candidateBounds: Bounds[],
  threshold: number
): AxisMatch | undefined {
  return findBestMatch<HorizontalAnchor>(
    'horizontal',
    getHorizontalAnchorValues(selectionBounds),
    candidateBounds,
    threshold,
    getHorizontalAnchorValues
  )
}

function findBestMatch<TAnchor extends HorizontalAnchor | VerticalAnchor>(
  axis: 'horizontal' | 'vertical',
  selectionAnchors: Record<TAnchor, number>,
  candidateBounds: Bounds[],
  threshold: number,
  getCandidateAnchors: (bounds: Bounds) => Record<TAnchor, number>
): AxisMatch | undefined {
  let bestMatch: AxisMatch | undefined

  for (const bounds of candidateBounds) {
    const candidateAnchors = getCandidateAnchors(bounds)

    for (const anchor of Object.keys(selectionAnchors) as TAnchor[]) {
      const correction = candidateAnchors[anchor] - selectionAnchors[anchor]
      if (Math.abs(correction) > threshold) {
        continue
      }

      if (!bestMatch || Math.abs(correction) < Math.abs(bestMatch.correction)) {
        bestMatch = {
          axis,
          anchor,
          candidateBounds: bounds,
          correction
        }
      }
    }
  }

  return bestMatch
}

function getVerticalAnchorValues(
  bounds: Bounds
): Record<VerticalAnchor, number> {
  return {
    left: bounds.x,
    centerX: bounds.x + bounds.width * 0.5,
    right: bounds.x + bounds.width
  }
}

function getHorizontalAnchorValues(
  bounds: Bounds
): Record<HorizontalAnchor, number> {
  return {
    top: bounds.y,
    centerY: bounds.y + bounds.height * 0.5,
    bottom: bounds.y + bounds.height
  }
}

function createVerticalGuide(
  selectionBounds: Bounds,
  candidateBounds: Bounds
): NodeAlignmentGuide {
  const candidateAnchors = getVerticalAnchorValues(candidateBounds)
  const selectionAnchors = getVerticalAnchorValues(selectionBounds)
  const coordinate = getSharedAnchorValue(selectionAnchors, candidateAnchors)

  return {
    axis: 'vertical',
    coordinate,
    start: Math.min(selectionBounds.y, candidateBounds.y),
    end: Math.max(
      selectionBounds.y + selectionBounds.height,
      candidateBounds.y + candidateBounds.height
    )
  }
}

function createHorizontalGuide(
  selectionBounds: Bounds,
  candidateBounds: Bounds
): NodeAlignmentGuide {
  const candidateAnchors = getHorizontalAnchorValues(candidateBounds)
  const selectionAnchors = getHorizontalAnchorValues(selectionBounds)
  const coordinate = getSharedAnchorValue(selectionAnchors, candidateAnchors)

  return {
    axis: 'horizontal',
    coordinate,
    start: Math.min(selectionBounds.x, candidateBounds.x),
    end: Math.max(
      selectionBounds.x + selectionBounds.width,
      candidateBounds.x + candidateBounds.width
    )
  }
}

function getSharedAnchorValue<
  TAnchor extends HorizontalAnchor | VerticalAnchor
>(
  selectionAnchors: Record<TAnchor, number>,
  candidateAnchors: Record<TAnchor, number>
): number {
  const anchors = Object.keys(selectionAnchors) as TAnchor[]

  for (const anchor of anchors) {
    if (selectionAnchors[anchor] === candidateAnchors[anchor]) {
      return selectionAnchors[anchor]
    }
  }

  return selectionAnchors[anchors[0]]
}
