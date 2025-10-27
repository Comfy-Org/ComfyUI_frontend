import type { Callback } from '../types'

export class MessageBroker {
  private pushTopics: Record<string, Callback[]> = {}
  private pullTopics: Record<string, (data?: any) => Promise<any>> = {}

  constructor() {
    this.registerListeners()
  }

  // Push

  private registerListeners() {
    // Register listeners
    this.createPushTopic('panStart')
    this.createPushTopic('paintBucketFill')
    this.createPushTopic('saveState')
    this.createPushTopic('brushAdjustmentStart')
    this.createPushTopic('drawStart')
    this.createPushTopic('panMove')
    this.createPushTopic('updateBrushPreview')
    this.createPushTopic('brushAdjustment')
    this.createPushTopic('draw')
    this.createPushTopic('paintBucketCursor')
    this.createPushTopic('panCursor')
    this.createPushTopic('drawEnd')
    this.createPushTopic('zoom')
    this.createPushTopic('undo')
    this.createPushTopic('redo')
    this.createPushTopic('cursorPoint')
    this.createPushTopic('panOffset')
    this.createPushTopic('zoomRatio')
    this.createPushTopic('getMaskCanvas')
    this.createPushTopic('getCanvasContainer')
    this.createPushTopic('screenToCanvas')
    this.createPushTopic('isKeyPressed')
    this.createPushTopic('isCombinationPressed')
    this.createPushTopic('setPaintBucketTolerance')
    this.createPushTopic('setBrushSize')
    this.createPushTopic('setBrushHardness')
    this.createPushTopic('setBrushOpacity')
    this.createPushTopic('setBrushShape')
    this.createPushTopic('initZoomPan')
    this.createPushTopic('setTool')
    this.createPushTopic('setActiveLayer')
    this.createPushTopic('pointerDown')
    this.createPushTopic('pointerMove')
    this.createPushTopic('pointerUp')
    this.createPushTopic('wheel')
    this.createPushTopic('initPaintBucketTool')
    this.createPushTopic('setBrushVisibility')
    this.createPushTopic('setBrushPreviewGradientVisibility')
    this.createPushTopic('handleTouchStart')
    this.createPushTopic('handleTouchMove')
    this.createPushTopic('handleTouchEnd')
    this.createPushTopic('colorSelectFill')
    this.createPushTopic('setColorSelectTolerance')
    this.createPushTopic('setLivePreview')
    this.createPushTopic('updateCursor')
    this.createPushTopic('setColorComparisonMethod')
    this.createPushTopic('clearLastPoint')
    this.createPushTopic('setWholeImage')
    this.createPushTopic('setMaskBoundary')
    this.createPushTopic('setMaskTolerance')
    this.createPushTopic('setBrushSmoothingPrecision')
    this.createPushTopic('setZoomText')
    this.createPushTopic('resetZoom')
    this.createPushTopic('invert')
    this.createPushTopic('setRGBColor')
    this.createPushTopic('paintedurl')
    this.createPushTopic('setSelectionOpacity')
    this.createPushTopic('setFillOpacity')
  }

  /**
   * Creates a new push topic (listener is notified)
   *
   * @param {string} topicName - The name of the topic to create.
   * @throws {Error} If the topic already exists.
   */
  createPushTopic(topicName: string) {
    if (this.topicExists(this.pushTopics, topicName)) {
      throw new Error('Topic already exists')
    }
    this.pushTopics[topicName] = []
  }

  /**
   * Subscribe a callback function to the given topic.
   *
   * @param {string} topicName - The name of the topic to subscribe to.
   * @param {Callback} callback - The callback function to be subscribed.
   * @throws {Error} If the topic does not exist.
   */
  subscribe(topicName: string, callback: Callback) {
    if (!this.topicExists(this.pushTopics, topicName)) {
      throw new Error(`Topic "${topicName}" does not exist!`)
    }
    this.pushTopics[topicName].push(callback)
  }

  /**
   * Removes a callback function from the list of subscribers for a given topic.
   *
   * @param {string} topicName - The name of the topic to unsubscribe from.
   * @param {Callback} callback - The callback function to remove from the subscribers list.
   * @throws {Error} If the topic does not exist in the list of topics.
   */
  unsubscribe(topicName: string, callback: Callback) {
    if (!this.topicExists(this.pushTopics, topicName)) {
      throw new Error('Topic does not exist')
    }
    const index = this.pushTopics[topicName].indexOf(callback)
    if (index > -1) {
      this.pushTopics[topicName].splice(index, 1)
    }
  }

  /**
   * Publishes data to a specified topic with variable number of arguments.
   * @param {string} topicName - The name of the topic to publish to.
   * @param {...any[]} args - Variable number of arguments to pass to subscribers
   * @throws {Error} If the specified topic does not exist.
   */
  publish(topicName: string, ...args: any[]) {
    if (!this.topicExists(this.pushTopics, topicName)) {
      throw new Error(`Topic "${topicName}" does not exist!`)
    }

    this.pushTopics[topicName].forEach((callback) => {
      callback(...args)
    })
  }

  // Pull

  /**
   * Creates a new pull topic (listener must request data)
   *
   * @param {string} topicName - The name of the topic to create.
   * @param {() => Promise<any>} callBack - The callback function to be called when data is requested.
   * @throws {Error} If the topic already exists.
   */
  createPullTopic(topicName: string, callBack: (data?: any) => Promise<any>) {
    if (this.topicExists(this.pullTopics, topicName)) {
      throw new Error('Topic already exists')
    }
    this.pullTopics[topicName] = callBack
  }

  /**
   * Requests data from a specified pull topic.
   * @param {string} topicName - The name of the topic to request data from.
   * @returns {Promise<any>} - The data from the pull topic.
   * @throws {Error} If the specified topic does not exist.
   */
  async pull(topicName: string, data?: any): Promise<any> {
    if (!this.topicExists(this.pullTopics, topicName)) {
      throw new Error('Topic does not exist')
    }

    const callBack = this.pullTopics[topicName]
    try {
      const result = await callBack(data)
      return result
    } catch (error) {
      console.error(`Error pulling data from topic "${topicName}":`, error)
      throw error
    }
  }

  // Helper Methods

  /**
   * Checks if a topic exists in the given topics object.
   * @param {Record<string, any>} topics - The topics object to check.
   * @param {string} topicName - The name of the topic to check.
   * @returns {boolean} - True if the topic exists, false otherwise.
   */
  private topicExists(topics: Record<string, any>, topicName: string): boolean {
    return topics.hasOwnProperty(topicName)
  }
}
