export interface StampCycle {
  /** Press travel, 0 at rest and 1 at full stamp. */
  stampAmt: number
  /** Outfeed travel, 0 before eject and 1 when fully ejected. */
  conveyorEject: number
}

/** Stamp occupies the first 35% of the loop; the conveyor ejects across the rest. */
export const STAMP_PHASE_END = 0.35

export function stampCycleAt(cycle: number): StampCycle {
  if (cycle < STAMP_PHASE_END) {
    const p = cycle / STAMP_PHASE_END
    return { stampAmt: Math.pow(Math.sin(p * Math.PI), 1.2), conveyorEject: 0 }
  }
  const p = (cycle - STAMP_PHASE_END) / (1 - STAMP_PHASE_END)
  return { stampAmt: 0, conveyorEject: (1 - Math.cos(p * Math.PI)) / 2 }
}
