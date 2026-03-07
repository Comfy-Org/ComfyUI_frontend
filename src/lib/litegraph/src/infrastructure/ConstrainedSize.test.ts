import { describe, expect, it } from 'vitest'

import { ConstrainedSize } from '@/lib/litegraph/src/infrastructure/ConstrainedSize'

describe('ConstrainedSize', () => {
  describe('constructor', () => {
    it('sets width and height from arguments', () => {
      const cs = new ConstrainedSize(100, 200)
      expect(cs.width).toBe(100)
      expect(cs.height).toBe(200)
    })
  })

  describe('width clamping', () => {
    it('clamps width to minWidth', () => {
      const cs = new ConstrainedSize(50, 50)
      cs.minWidth = 100
      cs.desiredWidth = 50

      expect(cs.width).toBe(100)
    })

    it('clamps width to maxWidth', () => {
      const cs = new ConstrainedSize(50, 50)
      cs.maxWidth = 80
      cs.desiredWidth = 200

      expect(cs.width).toBe(80)
    })

    it('allows width within min/max range', () => {
      const cs = new ConstrainedSize(50, 50)
      cs.minWidth = 10
      cs.maxWidth = 200
      cs.desiredWidth = 150

      expect(cs.width).toBe(150)
    })
  })

  describe('height clamping', () => {
    it('clamps height to minHeight', () => {
      const cs = new ConstrainedSize(50, 50)
      cs.minHeight = 100
      cs.desiredHeight = 30

      expect(cs.height).toBe(100)
    })

    it('clamps height to maxHeight', () => {
      const cs = new ConstrainedSize(50, 50)
      cs.maxHeight = 60
      cs.desiredHeight = 200

      expect(cs.height).toBe(60)
    })
  })

  describe('desiredWidth/desiredHeight store unclamped values', () => {
    it('preserves desiredWidth even when width is clamped', () => {
      const cs = new ConstrainedSize(50, 50)
      cs.maxWidth = 80
      cs.desiredWidth = 200

      expect(cs.desiredWidth).toBe(200)
      expect(cs.width).toBe(80)
    })

    it('preserves desiredHeight even when height is clamped', () => {
      const cs = new ConstrainedSize(50, 50)
      cs.minHeight = 100
      cs.desiredHeight = 30

      expect(cs.desiredHeight).toBe(30)
      expect(cs.height).toBe(100)
    })
  })

  describe('fromSize', () => {
    it('creates instance from [width, height] tuple', () => {
      const cs = ConstrainedSize.fromSize([300, 400])
      expect(cs.width).toBe(300)
      expect(cs.height).toBe(400)
    })
  })

  describe('fromRect', () => {
    it('creates instance using rect width and height (indices 2 and 3)', () => {
      const cs = ConstrainedSize.fromRect([10, 20, 300, 400])
      expect(cs.width).toBe(300)
      expect(cs.height).toBe(400)
    })
  })

  describe('setSize', () => {
    it('updates both width and height from a size tuple', () => {
      const cs = new ConstrainedSize(10, 10)
      cs.setSize([250, 350])

      expect(cs.width).toBe(250)
      expect(cs.height).toBe(350)
    })

    it('respects constraints when setting size', () => {
      const cs = new ConstrainedSize(10, 10)
      cs.maxWidth = 100
      cs.minHeight = 200
      cs.setSize([500, 50])

      expect(cs.width).toBe(100)
      expect(cs.height).toBe(200)
    })
  })

  describe('setValues', () => {
    it('updates both width and height from individual values', () => {
      const cs = new ConstrainedSize(10, 10)
      cs.setValues(150, 250)

      expect(cs.width).toBe(150)
      expect(cs.height).toBe(250)
    })
  })

  describe('toSize', () => {
    it('returns clamped [width, height] tuple', () => {
      const cs = new ConstrainedSize(100, 200)
      cs.maxWidth = 80
      cs.desiredWidth = 100

      expect(cs.toSize()).toEqual([80, 200])
    })
  })
})
