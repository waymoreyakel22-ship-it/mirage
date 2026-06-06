// Percent-space (0–100) overlap geometry for a single track lane.
// Clips on different tracks never collide, so every function operates on the
// spans of one track only. Positions are snapped to seconds upstream; the small
// epsilon keeps float rounding from registering a touching edge as an overlap.

const EPS = 0.01

export type Span = { left: number; width: number }

export const overlaps = (a: Span, b: Span) =>
  a.left + a.width > b.left + EPS && b.left + b.width > a.left + EPS

/**
 * The free gap [start, end] surrounding a clip: from its nearest left
 * neighbour's right edge to its nearest right neighbour's left edge (clamped to
 * the track). Both move and resize are constrained to this span.
 */
export function gapAround(others: Span[], origin: Span, track = 100): { start: number; end: number } {
  const originRight = origin.left + origin.width
  let start = 0
  let end = track
  for (const o of others) {
    const oRight = o.left + o.width
    if (oRight <= origin.left + EPS) start = Math.max(start, oRight)        // neighbour on the left
    else if (o.left >= originRight - EPS) end = Math.min(end, o.left)        // neighbour on the right
  }
  return { start, end: Math.max(end, originRight) }
}

/**
 * Nearest free position to `desiredLeft` where a `width`-wide clip fits without
 * overlapping `others`. Returns null when no gap is large enough.
 */
export function findSlot(others: Span[], desiredLeft: number, width: number, track = 100): number | null {
  if (width > track + EPS) return null
  const sorted = [...others].sort((a, b) => a.left - b.left)
  let cursor = 0
  let best: number | null = null
  let bestDist = Infinity

  const consider = (start: number, end: number) => {
    if (end - start < width - EPS) return
    const candidate = Math.min(Math.max(desiredLeft, start), end - width)
    const dist = Math.abs(candidate - desiredLeft)
    if (dist < bestDist) {
      bestDist = dist
      best = candidate
    }
  }

  for (const o of sorted) {
    consider(cursor, o.left)
    cursor = Math.max(cursor, o.left + o.width)
  }
  consider(cursor, track)
  return best
}
