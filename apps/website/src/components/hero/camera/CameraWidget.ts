/**
 * Vendored from jtydhr88/ComfyUI-qwenmultiangle (MIT) — src/CameraWidget.ts.
 * Scene construction, drag math, and interaction model are unchanged.
 * See ATTRIBUTION.md in this directory for the license and the list of
 * local modifications.
 */
import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  GridHelper,
  LineBasicMaterial,
  LineCurve3,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Plane,
  Raycaster,
  RepeatWrapping,
  RingGeometry,
  SRGBColorSpace,
  Scene,
  SphereGeometry,
  Texture,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer
} from 'three'
import type { Camera, Material } from 'three'

import type { CameraPalette, CameraState, CameraWidgetOptions } from './types'

const DEFAULT_PALETTE: CameraPalette = {
  azimuth: 0xe93d82,
  elevation: 0x00ffd0,
  distance: 0xffb800,
  camera: 0xe93d82,
  fill: 0xe93d82,
  frame: 0xe93d82,
  cardFront: 0x3a3a4a,
  background: 0x0a0a0f,
  showGrid: true,
  showGlowRing: true,
  showGlows: true
}

export class CameraWidget {
  private container: HTMLElement
  private state: CameraState
  private onStateChange?: (state: CameraState) => void
  private pal: CameraPalette

  private scene!: Scene
  private camera!: PerspectiveCamera
  private previewCamera!: PerspectiveCamera
  private renderer!: WebGLRenderer
  private activeCamera!: Camera

  private cameraIndicator!: Mesh
  private camGlow!: Mesh
  private azimuthHandle!: Mesh
  private azGlow!: Mesh
  private elevationHandle!: Mesh
  private elGlow!: Mesh
  private distanceHandle!: Mesh
  private distGlow!: Mesh
  private glowRing!: Mesh
  private imagePlane!: Mesh
  private imageFrame!: LineSegments
  private planeMat!: MeshBasicMaterial
  private distanceTube: Mesh | null = null

  private azimuthRing!: Mesh
  private elevationArc!: Mesh
  private gridHelper!: GridHelper

  private readonly CENTER = new Vector3(0, 0.5, 0)
  private readonly AZIMUTH_RADIUS = 1.8
  private readonly ELEVATION_RADIUS = 1.4
  private readonly ELEV_ARC_X = -0.8

  private liveAzimuth = 0
  private liveElevation = 0
  private liveDistance = 5

  private isDragging = false
  private dragTarget: string | null = null
  private hoveredHandle: { mesh: Mesh; glow: Mesh; name: string } | null = null
  private raycaster = new Raycaster()
  private mouse = new Vector2()

  private useCameraView = false

  private isOrbitDragging = false
  private orbitStartX = 0
  private orbitStartY = 0
  private orbitStartAzimuth = 0
  private orbitStartElevation = 0

  private animationId: number | null = null
  private time = 0

  private resizeObserver: ResizeObserver | null = null
  private listenerController = new AbortController()
  private paused = false
  private disposed = false

  constructor(options: CameraWidgetOptions) {
    this.container = options.container
    this.onStateChange = options.onStateChange
    this.pal = { ...DEFAULT_PALETTE, ...options.palette }
    this.state = {
      azimuth: options.initialState?.azimuth ?? 0,
      elevation: options.initialState?.elevation ?? 0,
      distance: options.initialState?.distance ?? 5,
      imageUrl: options.initialState?.imageUrl ?? null
    }

    this.liveAzimuth = this.state.azimuth
    this.liveElevation = this.state.elevation
    this.liveDistance = this.state.distance

    this.initThreeJS()
    this.bindEvents()
    if (this.state.imageUrl) this.updateImage(this.state.imageUrl)
    this.animate()
  }

  private initThreeJS(): void {
    const width = this.container.clientWidth || 300
    const height = this.container.clientHeight || 300

    this.scene = new Scene()
    this.scene.background =
      this.pal.background === null ? null : new Color(this.pal.background)

    this.camera = new PerspectiveCamera(45, width / height, 0.1, 1000)
    this.camera.position.set(4, 3.5, 4)
    this.camera.lookAt(0, 0.3, 0)

    this.previewCamera = new PerspectiveCamera(50, width / height, 0.1, 100)
    this.activeCamera = this.camera

    this.renderer = new WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setSize(width, height, false)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = SRGBColorSpace
    this.container.appendChild(this.renderer.domElement)

    const canvas = this.renderer.domElement
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'

    const ambientLight = new AmbientLight(0xffffff, 0.4)
    this.scene.add(ambientLight)

    const mainLight = new DirectionalLight(0xffffff, 0.8)
    mainLight.position.set(5, 10, 5)
    this.scene.add(mainLight)

    const fillLight = new DirectionalLight(this.pal.fill, 0.3)
    fillLight.position.set(-5, 5, -5)
    this.scene.add(fillLight)

    this.gridHelper = new GridHelper(5, 20, 0x1a1a2e, 0x12121a)
    this.gridHelper.position.y = -0.01
    this.gridHelper.visible = this.pal.showGrid
    this.scene.add(this.gridHelper)

    this.createSubject()
    this.createCameraIndicator()
    this.createAzimuthRing()
    this.createElevationArc()
    this.createDistanceHandle()
    this.updateVisuals()
  }

  private createGridTexture(): CanvasTexture {
    const canvas = document.createElement('canvas')
    const size = 256
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    ctx.fillStyle = '#1a1a2a'
    ctx.fillRect(0, 0, size, size)

    ctx.strokeStyle = '#2a2a3a'
    ctx.lineWidth = 1
    const gridSize = 16
    for (let i = 0; i <= size; i += gridSize) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, size)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(size, i)
      ctx.stroke()
    }

    const texture = new CanvasTexture(canvas)
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.repeat.set(4, 4)
    return texture
  }

  private createSubject(): void {
    const cardThickness = 0.02
    const cardGeo = new BoxGeometry(1.2, 1.2, cardThickness)

    const frontMat = new MeshBasicMaterial({ color: this.pal.cardFront })
    const backMat = new MeshBasicMaterial({ map: this.createGridTexture() })
    const edgeMat = new MeshBasicMaterial({ color: 0x1a1a2a })

    const cardMaterials = [
      edgeMat,
      edgeMat,
      edgeMat,
      edgeMat,
      frontMat,
      backMat
    ]
    this.imagePlane = new Mesh(cardGeo, cardMaterials)
    this.imagePlane.position.copy(this.CENTER)
    this.scene.add(this.imagePlane)

    this.planeMat = frontMat

    const frameGeo = new EdgesGeometry(cardGeo)
    const frameMat = new LineBasicMaterial({ color: this.pal.frame })
    this.imageFrame = new LineSegments(frameGeo, frameMat)
    this.imageFrame.position.copy(this.CENTER)
    this.scene.add(this.imageFrame)

    const glowRingGeo = new RingGeometry(0.55, 0.58, 64)
    const glowRingMat = new MeshBasicMaterial({
      color: this.pal.frame,
      transparent: true,
      opacity: 0.4,
      side: DoubleSide
    })
    this.glowRing = new Mesh(glowRingGeo, glowRingMat)
    this.glowRing.position.set(0, 0.01, 0)
    this.glowRing.rotation.x = -Math.PI / 2
    this.glowRing.visible = this.pal.showGlowRing
    this.scene.add(this.glowRing)
  }

  private createCameraIndicator(): void {
    const camGeo = new ConeGeometry(0.15, 0.4, 4)
    const camMat = new MeshStandardMaterial({
      color: this.pal.camera,
      emissive: this.pal.camera,
      emissiveIntensity: 0.5,
      metalness: 0.8,
      roughness: 0.2
    })
    this.cameraIndicator = new Mesh(camGeo, camMat)
    this.scene.add(this.cameraIndicator)

    const camGlowGeo = new SphereGeometry(0.08, 16, 16)
    const camGlowMat = new MeshBasicMaterial({
      color: this.pal.camera,
      transparent: true,
      opacity: 0.8
    })
    this.camGlow = new Mesh(camGlowGeo, camGlowMat)
    this.camGlow.visible = this.pal.showGlows
    this.scene.add(this.camGlow)
  }

  private createAzimuthRing(): void {
    const azRingGeo = new TorusGeometry(this.AZIMUTH_RADIUS, 0.04, 16, 100)
    const azRingMat = new MeshBasicMaterial({
      color: this.pal.azimuth,
      transparent: true,
      opacity: 0.7
    })
    this.azimuthRing = new Mesh(azRingGeo, azRingMat)
    this.azimuthRing.rotation.x = Math.PI / 2
    this.azimuthRing.position.y = 0.02
    this.scene.add(this.azimuthRing)

    const azHandleGeo = new SphereGeometry(0.16, 32, 32)
    const azHandleMat = new MeshStandardMaterial({
      color: this.pal.azimuth,
      emissive: this.pal.azimuth,
      emissiveIntensity: 0.6,
      metalness: 0.3,
      roughness: 0.4
    })
    this.azimuthHandle = new Mesh(azHandleGeo, azHandleMat)
    this.scene.add(this.azimuthHandle)

    const azGlowGeo = new SphereGeometry(0.22, 16, 16)
    const azGlowMat = new MeshBasicMaterial({
      color: this.pal.azimuth,
      transparent: true,
      opacity: 0.2
    })
    this.azGlow = new Mesh(azGlowGeo, azGlowMat)
    this.azGlow.visible = this.pal.showGlows
    this.scene.add(this.azGlow)
  }

  private createElevationArc(): void {
    const arcPoints: Vector3[] = []
    for (let i = 0; i <= 32; i++) {
      const angle = ((-30 + (90 * i) / 32) * Math.PI) / 180
      arcPoints.push(
        new Vector3(
          this.ELEV_ARC_X,
          this.ELEVATION_RADIUS * Math.sin(angle) + this.CENTER.y,
          this.ELEVATION_RADIUS * Math.cos(angle)
        )
      )
    }
    const arcCurve = new CatmullRomCurve3(arcPoints)
    const elArcGeo = new TubeGeometry(arcCurve, 32, 0.04, 8, false)
    const elArcMat = new MeshBasicMaterial({
      color: this.pal.elevation,
      transparent: true,
      opacity: 0.8
    })
    this.elevationArc = new Mesh(elArcGeo, elArcMat)
    this.scene.add(this.elevationArc)

    const elHandleGeo = new SphereGeometry(0.16, 32, 32)
    const elHandleMat = new MeshStandardMaterial({
      color: this.pal.elevation,
      emissive: this.pal.elevation,
      emissiveIntensity: 0.6,
      metalness: 0.3,
      roughness: 0.4
    })
    this.elevationHandle = new Mesh(elHandleGeo, elHandleMat)
    this.scene.add(this.elevationHandle)

    const elGlowGeo = new SphereGeometry(0.22, 16, 16)
    const elGlowMat = new MeshBasicMaterial({
      color: this.pal.elevation,
      transparent: true,
      opacity: 0.2
    })
    this.elGlow = new Mesh(elGlowGeo, elGlowMat)
    this.elGlow.visible = this.pal.showGlows
    this.scene.add(this.elGlow)
  }

  private createDistanceHandle(): void {
    const distHandleGeo = new SphereGeometry(0.15, 32, 32)
    const distHandleMat = new MeshStandardMaterial({
      color: this.pal.distance,
      emissive: this.pal.distance,
      emissiveIntensity: 0.7,
      metalness: 0.5,
      roughness: 0.3
    })
    this.distanceHandle = new Mesh(distHandleGeo, distHandleMat)
    this.scene.add(this.distanceHandle)

    const distGlowGeo = new SphereGeometry(0.22, 16, 16)
    const distGlowMat = new MeshBasicMaterial({
      color: this.pal.distance,
      transparent: true,
      opacity: 0.25
    })
    this.distGlow = new Mesh(distGlowGeo, distGlowMat)
    this.distGlow.visible = this.pal.showGlows
    this.scene.add(this.distGlow)
  }

  private updateDistanceLine(start: Vector3, end: Vector3): void {
    if (this.distanceTube) {
      this.scene.remove(this.distanceTube)
      this.distanceTube.geometry.dispose()
      ;(this.distanceTube.material as Material).dispose()
    }
    const path = new LineCurve3(start, end)
    const tubeGeo = new TubeGeometry(path, 1, 0.025, 8, false)
    const tubeMat = new MeshBasicMaterial({
      color: this.pal.distance,
      transparent: true,
      opacity: 0.8
    })
    this.distanceTube = new Mesh(tubeGeo, tubeMat)
    this.scene.add(this.distanceTube)
  }

  private updateVisuals(): void {
    const azRad = (this.liveAzimuth * Math.PI) / 180
    const elRad = (this.liveElevation * Math.PI) / 180
    const visualDist = 2.6 - (this.liveDistance / 10) * 2.0

    const camX = visualDist * Math.sin(azRad) * Math.cos(elRad)
    const camY = this.CENTER.y + visualDist * Math.sin(elRad)
    const camZ = visualDist * Math.cos(azRad) * Math.cos(elRad)

    this.cameraIndicator.position.set(camX, camY, camZ)
    this.cameraIndicator.lookAt(this.CENTER)
    this.cameraIndicator.rotateX(Math.PI / 2)
    this.camGlow.position.copy(this.cameraIndicator.position)

    const azX = this.AZIMUTH_RADIUS * Math.sin(azRad)
    const azZ = this.AZIMUTH_RADIUS * Math.cos(azRad)
    this.azimuthHandle.position.set(azX, 0.16, azZ)
    this.azGlow.position.copy(this.azimuthHandle.position)

    const elY = this.CENTER.y + this.ELEVATION_RADIUS * Math.sin(elRad)
    const elZ = this.ELEVATION_RADIUS * Math.cos(elRad)
    this.elevationHandle.position.set(this.ELEV_ARC_X, elY, elZ)
    this.elGlow.position.copy(this.elevationHandle.position)

    const distT = 0.15 + ((10 - this.liveDistance) / 10) * 0.7
    this.distanceHandle.position.lerpVectors(
      this.CENTER,
      this.cameraIndicator.position,
      distT
    )
    this.distGlow.position.copy(this.distanceHandle.position)

    this.updateDistanceLine(
      this.CENTER.clone(),
      this.cameraIndicator.position.clone()
    )

    this.previewCamera.position.copy(this.cameraIndicator.position)
    this.previewCamera.lookAt(this.CENTER)

    this.glowRing.rotation.z += 0.005
  }

  private bindEvents(): void {
    const canvas = this.renderer.domElement
    const { signal } = this.listenerController

    canvas.addEventListener('mousedown', this.onPointerDown.bind(this), {
      signal
    })
    canvas.addEventListener('mousemove', this.onPointerMove.bind(this), {
      signal
    })
    canvas.addEventListener('mouseup', this.onPointerUp.bind(this), { signal })
    canvas.addEventListener('mouseleave', this.onPointerUp.bind(this), {
      signal
    })

    canvas.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault()
        this.onPointerDown({
          clientX: e.touches[0].clientX,
          clientY: e.touches[0].clientY
        } as MouseEvent)
      },
      { passive: false, signal }
    )

    canvas.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault()
        this.onPointerMove({
          clientX: e.touches[0].clientX,
          clientY: e.touches[0].clientY
        } as MouseEvent)
      },
      { passive: false, signal }
    )

    canvas.addEventListener('touchend', () => this.onPointerUp(), { signal })

    canvas.addEventListener('wheel', this.onWheel.bind(this), {
      passive: false,
      signal
    })

    this.resizeObserver = new ResizeObserver(() => {
      this.onResize()
    })
    this.resizeObserver.observe(this.container)
  }

  private getMousePos(event: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }

  private setHandleScale(handle: Mesh, glow: Mesh | null, scale: number): void {
    handle.scale.setScalar(scale)
    if (glow) glow.scale.setScalar(scale)
  }

  private onPointerDown(event: MouseEvent): void {
    this.getMousePos(event)

    if (this.useCameraView) {
      this.isOrbitDragging = true
      this.orbitStartX = event.clientX
      this.orbitStartY = event.clientY
      this.orbitStartAzimuth = this.liveAzimuth
      this.orbitStartElevation = this.liveElevation
      this.renderer.domElement.style.cursor = 'grabbing'
      return
    }

    this.raycaster.setFromCamera(this.mouse, this.camera)

    const handles = [
      { mesh: this.azimuthHandle, glow: this.azGlow, name: 'azimuth' },
      { mesh: this.elevationHandle, glow: this.elGlow, name: 'elevation' },
      { mesh: this.distanceHandle, glow: this.distGlow, name: 'distance' }
    ]

    for (const h of handles) {
      if (this.raycaster.intersectObject(h.mesh).length > 0) {
        this.isDragging = true
        this.dragTarget = h.name
        this.setHandleScale(h.mesh, h.glow, 1.3)
        this.renderer.domElement.style.cursor = 'grabbing'
        return
      }
    }
  }

  private onPointerMove(event: MouseEvent): void {
    this.getMousePos(event)

    if (this.useCameraView && this.isOrbitDragging) {
      const deltaX = event.clientX - this.orbitStartX
      const deltaY = event.clientY - this.orbitStartY

      const sensitivity = 0.5

      let newAzimuth = this.orbitStartAzimuth - deltaX * sensitivity
      while (newAzimuth < 0) newAzimuth += 360
      while (newAzimuth >= 360) newAzimuth -= 360
      this.liveAzimuth = newAzimuth
      this.state.azimuth = Math.round(this.liveAzimuth)

      let newElevation = this.orbitStartElevation + deltaY * sensitivity
      newElevation = Math.max(-30, Math.min(60, newElevation))
      this.liveElevation = newElevation
      this.state.elevation = Math.round(this.liveElevation)

      this.updateVisuals()
      this.notifyStateChange()
      return
    }

    this.raycaster.setFromCamera(this.mouse, this.camera)

    if (!this.isDragging) {
      const handles = [
        { mesh: this.azimuthHandle, glow: this.azGlow, name: 'azimuth' },
        { mesh: this.elevationHandle, glow: this.elGlow, name: 'elevation' },
        { mesh: this.distanceHandle, glow: this.distGlow, name: 'distance' }
      ]

      let foundHover: (typeof handles)[0] | null = null
      for (const h of handles) {
        if (this.raycaster.intersectObject(h.mesh).length > 0) {
          foundHover = h
          break
        }
      }

      if (this.hoveredHandle && this.hoveredHandle !== foundHover) {
        this.setHandleScale(
          this.hoveredHandle.mesh,
          this.hoveredHandle.glow,
          1.0
        )
      }

      if (foundHover) {
        this.setHandleScale(foundHover.mesh, foundHover.glow, 1.15)
        this.renderer.domElement.style.cursor = 'grab'
        this.hoveredHandle = foundHover
      } else {
        this.renderer.domElement.style.cursor = 'default'
        this.hoveredHandle = null
      }
      return
    }

    const plane = new Plane()
    const intersect = new Vector3()

    if (this.dragTarget === 'azimuth') {
      plane.setFromNormalAndCoplanarPoint(
        new Vector3(0, 1, 0),
        new Vector3(0, 0, 0)
      )
      if (this.raycaster.ray.intersectPlane(plane, intersect)) {
        let angle = Math.atan2(intersect.x, intersect.z) * (180 / Math.PI)
        if (angle < 0) angle += 360
        this.liveAzimuth = Math.max(0, Math.min(360, angle))
        this.state.azimuth = Math.round(this.liveAzimuth)
        this.updateVisuals()
        this.notifyStateChange()
      }
    } else if (this.dragTarget === 'elevation') {
      const elevPlane = new Plane(new Vector3(1, 0, 0), -this.ELEV_ARC_X)
      if (this.raycaster.ray.intersectPlane(elevPlane, intersect)) {
        const relY = intersect.y - this.CENTER.y
        const relZ = intersect.z
        let angle = Math.atan2(relY, relZ) * (180 / Math.PI)
        angle = Math.max(-30, Math.min(60, angle))
        this.liveElevation = angle
        this.state.elevation = Math.round(this.liveElevation)
        this.updateVisuals()
        this.notifyStateChange()
      }
    } else if (this.dragTarget === 'distance') {
      const newDist = 5 - this.mouse.y * 5
      this.liveDistance = Math.max(0, Math.min(10, newDist))
      this.state.distance = Math.round(this.liveDistance * 10) / 10
      this.updateVisuals()
      this.notifyStateChange()
    }
  }

  private onPointerUp(): void {
    if (this.isOrbitDragging) {
      this.isOrbitDragging = false
      this.renderer.domElement.style.cursor = this.useCameraView
        ? 'grab'
        : 'default'
      return
    }

    if (this.isDragging) {
      const handles = [
        { mesh: this.azimuthHandle, glow: this.azGlow },
        { mesh: this.elevationHandle, glow: this.elGlow },
        { mesh: this.distanceHandle, glow: this.distGlow }
      ]
      handles.forEach((h) => this.setHandleScale(h.mesh, h.glow, 1.0))
    }

    this.isDragging = false
    this.dragTarget = null
    this.renderer.domElement.style.cursor = 'default'
  }

  private onWheel(event: WheelEvent): void {
    if (!this.useCameraView) return

    event.preventDefault()

    const sensitivity = 0.01
    let newDistance = this.liveDistance - event.deltaY * sensitivity
    newDistance = Math.max(0, Math.min(10, newDistance))
    this.liveDistance = newDistance
    this.state.distance = Math.round(this.liveDistance * 10) / 10

    this.updateVisuals()
    this.notifyStateChange()
  }

  private onResize(): void {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (w === 0 || h === 0) return

    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.previewCamera.aspect = w / h
    this.previewCamera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }

  private animate(): void {
    if (this.paused || this.disposed) {
      this.animationId = null
      return
    }
    this.animationId = requestAnimationFrame(() => this.animate())

    this.time += 0.01
    const pulse = 1 + Math.sin(this.time * 2) * 0.03
    this.camGlow.scale.setScalar(pulse)
    this.glowRing.rotation.z += 0.003

    this.renderer.render(this.scene, this.activeCamera)
  }

  public pause(): void {
    this.paused = true
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  public resume(): void {
    if (this.disposed || !this.paused) return
    this.paused = false
    if (this.animationId === null) this.animate()
  }

  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange({ ...this.state })
    }
  }

  public setState(newState: Partial<CameraState>): void {
    if (newState.azimuth !== undefined) {
      this.state.azimuth = newState.azimuth
      this.liveAzimuth = newState.azimuth
    }
    if (newState.elevation !== undefined) {
      this.state.elevation = newState.elevation
      this.liveElevation = newState.elevation
    }
    if (newState.distance !== undefined) {
      this.state.distance = newState.distance
      this.liveDistance = newState.distance
    }
    if (newState.imageUrl !== undefined) {
      this.state.imageUrl = newState.imageUrl
      this.updateImage(newState.imageUrl)
    }
    this.updateVisuals()
  }

  public getState(): CameraState {
    return { ...this.state }
  }

  public resetToDefaults(): void {
    this.state.azimuth = 0
    this.state.elevation = 0
    this.state.distance = 5.0
    this.liveAzimuth = 0
    this.liveElevation = 0
    this.liveDistance = 5.0
    this.updateVisuals()
    this.notifyStateChange()
  }

  public setCameraView(enabled: boolean): void {
    this.useCameraView = enabled
    this.isOrbitDragging = false

    const gizmosVisible = !enabled
    this.activeCamera = enabled ? this.previewCamera : this.camera
    this.azimuthRing.visible = gizmosVisible
    this.azimuthHandle.visible = gizmosVisible
    this.azGlow.visible = gizmosVisible
    this.elevationArc.visible = gizmosVisible
    this.elevationHandle.visible = gizmosVisible
    this.elGlow.visible = gizmosVisible
    this.distanceHandle.visible = gizmosVisible
    this.distGlow.visible = gizmosVisible
    if (this.distanceTube) this.distanceTube.visible = gizmosVisible
    this.cameraIndicator.visible = gizmosVisible
    this.camGlow.visible = gizmosVisible
    this.glowRing.visible = gizmosVisible
    this.gridHelper.visible = gizmosVisible
    this.imageFrame.visible = gizmosVisible
    this.renderer.domElement.style.cursor = enabled ? 'grab' : 'default'
  }

  public updateImage(url: string | null): void {
    if (url) {
      const img = new Image()
      if (!url.startsWith('data:')) {
        img.crossOrigin = 'anonymous'
      }

      img.onload = () => {
        if (this.disposed) return
        const tex = new Texture(img)
        tex.colorSpace = SRGBColorSpace
        tex.needsUpdate = true
        this.planeMat.map?.dispose()
        this.planeMat.map = tex
        this.planeMat.color.set(0xffffff)
        this.planeMat.needsUpdate = true

        const ar = img.width / img.height
        const maxSize = 1.5
        let scaleX: number, scaleY: number
        if (ar > 1) {
          scaleX = maxSize
          scaleY = maxSize / ar
        } else {
          scaleY = maxSize
          scaleX = maxSize * ar
        }
        this.imagePlane.scale.set(scaleX, scaleY, 1)
        this.imageFrame.scale.set(scaleX, scaleY, 1)
      }

      img.onerror = () => {
        if (this.disposed) return
        this.planeMat.map = null
        this.planeMat.color.set(0xe93d82)
        this.planeMat.needsUpdate = true
      }

      img.src = url
    } else {
      this.planeMat.map = null
      this.planeMat.color.set(0x3a3a4a)
      this.planeMat.needsUpdate = true
      this.imagePlane.scale.set(1, 1, 1)
      this.imageFrame.scale.set(1, 1, 1)
    }
  }

  public dispose(): void {
    this.disposed = true
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }

    this.listenerController.abort()
    this.resizeObserver?.disconnect()
    this.resizeObserver = null

    this.scene.traverse((object) => {
      if (!(object instanceof Mesh || object instanceof LineSegments)) return
      object.geometry.dispose()
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material]
      for (const material of materials) {
        if ('map' in material && material.map instanceof Texture) {
          material.map.dispose()
        }
        material.dispose()
      }
    })
    this.scene.clear()

    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
