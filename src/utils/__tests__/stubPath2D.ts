interface StubPathMethods {
  moveTo: Path2D['moveTo']
  lineTo: Path2D['lineTo']
  bezierCurveTo: Path2D['bezierCurveTo']
  quadraticCurveTo: Path2D['quadraticCurveTo']
  arc: Path2D['arc']
}

/** Recording stand-in for Path2D, which happy-dom does not implement. */
export class StubPath2D implements StubPathMethods {
  calls: Array<{ method: string; args: unknown[] }> = []

  moveTo(...args: unknown[]): void {
    this.calls.push({ method: 'moveTo', args })
  }

  lineTo(...args: unknown[]): void {
    this.calls.push({ method: 'lineTo', args })
  }

  bezierCurveTo(...args: unknown[]): void {
    this.calls.push({ method: 'bezierCurveTo', args })
  }

  quadraticCurveTo(...args: unknown[]): void {
    this.calls.push({ method: 'quadraticCurveTo', args })
  }

  arc(...args: unknown[]): void {
    this.calls.push({ method: 'arc', args })
  }
}
