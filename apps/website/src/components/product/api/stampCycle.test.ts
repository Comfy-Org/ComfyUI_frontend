import { describe, expect, it } from 'vitest'

import { STAMP_PHASE_END, stampCycleAt } from './stampCycle'

describe('stampCycleAt', () => {
  it('rests at the start of the stamp phase', () => {
    expect(stampCycleAt(0)).toEqual({ stampAmt: 0, conveyorEject: 0 })
  })

  it('peaks the press mid-stamp', () => {
    expect(stampCycleAt(STAMP_PHASE_END / 2).stampAmt).toBeCloseTo(1, 5)
  })

  it('hands off with the press retracted as the conveyor starts', () => {
    expect(stampCycleAt(STAMP_PHASE_END)).toEqual({
      stampAmt: 0,
      conveyorEject: 0
    })
  })

  it('fully ejects at the end of the loop', () => {
    expect(stampCycleAt(0.999).conveyorEject).toBeCloseTo(1, 2)
  })

  it.for([0, 0.1, 0.34, STAMP_PHASE_END, 0.5, 0.9, 0.999])(
    'keeps both outputs within 0..1 at cycle %s',
    (cycle: number) => {
      const { stampAmt, conveyorEject } = stampCycleAt(cycle)

      expect(stampAmt).toBeGreaterThanOrEqual(0)
      expect(stampAmt).toBeLessThanOrEqual(1)
      expect(conveyorEject).toBeGreaterThanOrEqual(0)
      expect(conveyorEject).toBeLessThanOrEqual(1)
    }
  )

  it('never drives the press and the conveyor at the same time', () => {
    for (let cycle = 0; cycle < 1; cycle += 0.01) {
      const { stampAmt, conveyorEject } = stampCycleAt(cycle)

      expect(Math.min(stampAmt, conveyorEject)).toBe(0)
    }
  })
})
