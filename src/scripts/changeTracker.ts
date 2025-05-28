import { LGraphCanvas, LiteGraph } from '@comfyorg/litegraph'
import * as jsondiffpatch from 'jsondiffpatch'
import _ from 'lodash'
import log from 'loglevel'

import type { ExecutedWsMessage } from '@/schemas/apiSchema'
import type { ComfyWorkflowJSON } from '@/schemas/comfyWorkflowSchema'
import { useExecutionStore } from '@/stores/executionStore'
import { ComfyWorkflow, useWorkflowStore } from '@/stores/workflowStore'

import { api } from './api'
import type { ComfyApp } from './app'
import { app } from './app'

import type { LGraphNode } from '@comfyorg/litegraph'

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

const logger = log.getLogger('ChangeTracker')
// Change to debug for more verbose logging
logger.setLevel('info')

export class ChangeTracker {
  static MAX_HISTORY = 50
  /**
   * The active state of the workflow.
   */
  activeState: ComfyWorkflowJSON
  undoQueue: ComfyWorkflowJSON[] = []
  redoQueue: ComfyWorkflowJSON[] = []
  changeCount: number = 0
  /**
   * Whether the redo/undo restoring is in progress.
   */
  _restoringState: boolean = false

  ds?: { scale: number; offset: [number, number] }
  nodeOutputs?: Record<string, any>

  constructor(
    /**
     * The workflow that this change tracker is tracking
     */
    public workflow: ComfyWorkflow,
    /**
     * The initial state of the workflow
     */
    public initialState: ComfyWorkflowJSON
  ) {
    this.activeState = initialState
  }

  /**
   * Save the current state as the initial state.
   */
  reset(state?: ComfyWorkflowJSON) {
    // Do not reset the state if we are restoring.
    if (this._restoringState) return

    logger.debug('Reset State')
    if (state) this.activeState = clone(state)
    this.initialState = clone(this.activeState)
  }

  store() {
    this.ds = {
      scale: app.canvas.ds.scale,
      offset: [app.canvas.ds.offset[0], app.canvas.ds.offset[1]]
    }
  }

  restore() {
    if (this.ds) {
      app.canvas.ds.scale = this.ds.scale
      app.canvas.ds.offset = this.ds.offset
    }
    if (this.nodeOutputs) {
      app.nodeOutputs = this.nodeOutputs
    }
  }

  updateModified() {
    api.dispatchCustomEvent('graphChanged', this.activeState)

    // Get the workflow from the store as ChangeTracker is raw object, i.e.
    // `this.workflow` is not reactive.
    const workflow = useWorkflowStore().getWorkflowByPath(this.workflow.path)
    if (workflow) {
      workflow.isModified = !ChangeTracker.graphEqual(
        this.initialState,
        this.activeState
      )
      if (logger.getLevel() <= logger.levels.DEBUG && workflow.isModified) {
        const diff = ChangeTracker.graphDiff(
          this.initialState,
          this.activeState
        )
        logger.debug('Graph diff:', diff)
      }
    }
  }

  checkState() {
    if (!app.graph || this.changeCount) return
    const currentState = clone(app.graph.serialize()) as ComfyWorkflowJSON
    if (!this.activeState) {
      this.activeState = currentState
      return
    }
    if (!ChangeTracker.graphEqual(this.activeState, currentState)) {
      this.undoQueue.push(this.activeState)
      if (this.undoQueue.length > ChangeTracker.MAX_HISTORY) {
        this.undoQueue.shift()
      }
      logger.debug('Diff detected. Undo queue length:', this.undoQueue.length)

      this.activeState = currentState
      this.redoQueue.length = 0
      this.updateModified()
    }
  }

  async updateState(source: ComfyWorkflowJSON[], target: ComfyWorkflowJSON[]) {
    const prevState = source.pop()
    if (prevState) {
      target.push(this.activeState)
      this._restoringState = true
      try {
        await app.loadGraphData(prevState, false, false, this.workflow, {
          showMissingModelsDialog: false,
          showMissingNodesDialog: false,
          checkForRerouteMigration: false
        })
        this.activeState = prevState
        this.updateModified()
      } finally {
        this._restoringState = false
      }
    }
  }

  async undo() {
    await this.updateState(this.undoQueue, this.redoQueue)
    logger.debug(
      'Undo. Undo queue length:',
      this.undoQueue.length,
      'Redo queue length:',
      this.redoQueue.length
    )
  }

  async redo() {
    await this.updateState(this.redoQueue, this.undoQueue)
    logger.debug(
      'Redo. Undo queue length:',
      this.undoQueue.length,
      'Redo queue length:',
      this.redoQueue.length
    )
  }

  async undoRedo(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const key = e.key.toUpperCase()
      // Redo: Ctrl + Y, or Ctrl + Shift + Z
      if ((key === 'Y' && !e.shiftKey) || (key == 'Z' && e.shiftKey)) {
        await this.redo()
        return true
      } else if (key === 'Z' && !e.shiftKey) {
        await this.undo()
        return true
      }
    }
  }

  beforeChange() {
    this.changeCount++
  }

  afterChange() {
    if (!--this.changeCount) {
      this.checkState()
    }
  }

  static init() {
    const getCurrentChangeTracker = () =>
      useWorkflowStore().activeWorkflow?.changeTracker
    const checkState = () => getCurrentChangeTracker()?.checkState()

    let keyIgnored = false
    window.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        // Do not trigger on repeat events (Holding down a key)
        // This can happen when user is holding down "Space" to pan the canvas.
        if (e.repeat) return

        // If the mask editor is opened, we don't want to trigger on key events
        const comfyApp = app.constructor as typeof ComfyApp
        if (comfyApp.maskeditor_is_opended?.()) return

        const activeEl = document.activeElement
        requestAnimationFrame(async () => {
          let bindInputEl: Element | null = null
          // If we are auto queue in change mode then we do want to trigger on inputs
          if (!app.ui.autoQueueEnabled || app.ui.autoQueueMode === 'instant') {
            if (
              activeEl?.tagName === 'INPUT' ||
              (activeEl && 'type' in activeEl && activeEl.type === 'textarea')
            ) {
              // Ignore events on inputs, they have their native history
              return
            }
            bindInputEl = activeEl
          }

          keyIgnored =
            e.key === 'Control' ||
            e.key === 'Shift' ||
            e.key === 'Alt' ||
            e.key === 'Meta'
          if (keyIgnored) return

          const changeTracker = getCurrentChangeTracker()
          if (!changeTracker) return

          // Check if this is a ctrl+z ctrl+y
          if (await changeTracker.undoRedo(e)) return

          // If our active element is some type of input then handle changes after they're done
          if (ChangeTracker.bindInput(bindInputEl)) return
          logger.debug('checkState on keydown')
          changeTracker.checkState()
        })
      },
      true
    )

    window.addEventListener('keyup', () => {
      if (keyIgnored) {
        keyIgnored = false
        logger.debug('checkState on keyup')
        checkState()
      }
    })

    // Handle clicking DOM elements (e.g. widgets)
    window.addEventListener('mouseup', () => {
      logger.debug('checkState on mouseup')
      checkState()
    })

    // Handle prompt queue event for dynamic widget changes
    api.addEventListener('promptQueued', () => {
      logger.debug('checkState on promptQueued')
      checkState()
    })

    api.addEventListener('graphCleared', () => {
      logger.debug('checkState on graphCleared')
      checkState()
    })

    // Store a reference to the original functions
    const originalProcessMouseDown = LGraphCanvas.prototype.processMouseDown;
    const originalProcessMouseUp = LGraphCanvas.prototype.processMouseUp;

    LGraphCanvas.prototype.processMouseDown = function (e) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this as any;
      // console.log('[ChangeTracker] processMouseDown called'); // Reduced verbosity

      const result = originalProcessMouseDown.apply(this, [e]);

      // Store a reference to the node under the mouse when the drag starts.
      // This is used in processMouseUp to reliably identify the dragged node,
      // as this.dragging_node might be undefined at that point.
      self._temp_dragged_node_ref = self.node_over;
      // console.log('[ChangeTracker] processMouseDown - _temp_dragged_node_ref (from self.node_over after original call):', self._temp_dragged_node_ref); // Reduced verbosity

      return result;
    };

    LGraphCanvas.prototype.processMouseUp = function (e) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this as any;
      // Retrieve the node that was being dragged, captured in processMouseDown.
      const activeNodeFromMouseDown = self._temp_dragged_node_ref;

      // --- START: Revert highlighted link colors on mouse up ---
      // This section ensures any links highlighted during drag-move are reverted to their original colors
      // when the mouse button is released, cleaning up temporary visual feedback.
      if (self._temp_highlighted_links_original_colors && self._temp_highlighted_links_original_colors.size > 0) {
        console.log('[Drag Link Highlight] processMouseUp: Reverting all highlighted links.');
        let needsRedrawForMouseUp = false;
        self._temp_highlighted_links_original_colors.forEach((originalColor: string, linkId: number) => {
          const linkInfo = self.graph.links[linkId];
          if (linkInfo && linkInfo.color !== originalColor) {
            linkInfo.color = originalColor;
            needsRedrawForMouseUp = true;
            // console.log(`  [Link Highlight] MouseUp - Reverted link ID ${linkId} to ${originalColor}`);
          }
        });
        self._temp_highlighted_links_original_colors.clear();
        if (needsRedrawForMouseUp) {
          self.setDirty(true, true);
        }
      }
      // --- END: Revert highlighted link colors on mouse up ---

      const v = originalProcessMouseUp.apply(this, [e]);

      // Proceed with overlap and re-wiring checks if a node was actually dragged.
      if (activeNodeFromMouseDown && self.graph) {
        const draggedNodeObject = activeNodeFromMouseDown;
        // Ensure the dragged node is still part of the graph.
        if (self.graph._nodes.includes(draggedNodeObject)) {
          // console.log(`[MouseUp Check] Processing dragged node: '${draggedNodeObject.title}' (ID: ${draggedNodeObject.id})`); 

          for (const otherNodeObject of self.graph._nodes) {
            // console.log(`  [MouseUp Check] Comparing with other node: '${otherNodeObject.title}' (ID: ${otherNodeObject.id})`); 
            
            // Skip self-comparison.
            if (otherNodeObject.id === draggedNodeObject.id) { 
              // console.log(`    [MouseUp Check] Skipping self-comparison.`); 
              continue; 
            }

            let areOverlapping = false;
            const r1_mouseup = draggedNodeObject.getBounding(); 
            const r2_mouseup = otherNodeObject.getBounding();
            let overlapCheckMethod = "";

            // Check for overlap, preferring LiteGraph.overlap if available,
            // otherwise use a manual Axis-Aligned Bounding Box (AABB) check.
            const overlapFunc_mouseup = LiteGraph.overlap || (LiteGraph.Nodes?.LiteGraph as any)?.overlap;
            if (typeof overlapFunc_mouseup === 'function') {
              areOverlapping = overlapFunc_mouseup(r1_mouseup, r2_mouseup);
              overlapCheckMethod = "LiteGraph.overlap function";
            } else {
              overlapCheckMethod = "Manual AABB check";
              if (r1_mouseup && r2_mouseup) { 
                areOverlapping = r1_mouseup[0] < r2_mouseup[0] + r2_mouseup[2] &&
                                 r1_mouseup[0] + r1_mouseup[2] > r2_mouseup[0] &&
                                 r1_mouseup[1] < r2_mouseup[1] + r2_mouseup[3] &&
                                 r1_mouseup[1] + r1_mouseup[3] > r2_mouseup[1];
              }
            }

            if (areOverlapping) {
              console.log(`  [MouseUp Check] Overlap DETECTED between '${draggedNodeObject.title}' (ID: ${draggedNodeObject.id}) and '${otherNodeObject.title}' (ID: ${otherNodeObject.id})`);
              console.log(`    [MouseUp Check] Dragged Node ('${draggedNodeObject.title}') BBox: [${r1_mouseup.join(', ')}]`);
              console.log(`    [MouseUp Check] Other Node ('${otherNodeObject.title}') BBox: [${r2_mouseup.join(', ')}]`);
              console.log(`    [MouseUp Check] Overlap determined by: ${overlapCheckMethod}`);

              // Log AABB check details if it was used.
              if (overlapCheckMethod === "Manual AABB check" && r1_mouseup && r2_mouseup) {
                const cond1 = r1_mouseup[0] < r2_mouseup[0] + r2_mouseup[2]; // r1.x < r2.x + r2.width
                const cond2 = r1_mouseup[0] + r1_mouseup[2] > r2_mouseup[0]; // r1.x + r1.width > r2.x
                const cond3 = r1_mouseup[1] < r2_mouseup[1] + r2_mouseup[3]; // r1.y < r2.y + r2.height
                const cond4 = r1_mouseup[1] + r1_mouseup[3] > r2_mouseup[1]; // r1.y + r1.height > r2.y
                console.log(`      [Manual AABB Details] r1.x (${r1_mouseup[0]}) < r2.x + r2.w (${r2_mouseup[0] + r2_mouseup[2]}) : ${cond1}`);
                console.log(`      [Manual AABB Details] r1.x + r1.w (${r1_mouseup[0] + r1_mouseup[2]}) > r2.x (${r2_mouseup[0]}) : ${cond2}`);
                console.log(`      [Manual AABB Details] r1.y (${r1_mouseup[1]}) < r2.y + r2.h (${r2_mouseup[1] + r2_mouseup[3]}) : ${cond3}`);
                console.log(`      [Manual AABB Details] r1.y + r1.h (${r1_mouseup[1] + r1_mouseup[3]}) > r2.y (${r2_mouseup[1]}) : ${cond4}`);
              }

              // Determine which node is visually on top based on their order in the graph._nodes array.
              // The node with the higher index is considered to be on top.
              let topNodeObject: any, bottomNodeObject: any;
              const draggedNodeIndex = self.graph._nodes.indexOf(draggedNodeObject);
              const otherNodeIndex = self.graph._nodes.indexOf(otherNodeObject);
              if (draggedNodeIndex > otherNodeIndex) {
                topNodeObject = draggedNodeObject;
                bottomNodeObject = otherNodeObject;
              } else {
                topNodeObject = otherNodeObject;
                bottomNodeObject = draggedNodeObject;
              }
              console.log('[ChangeTracker] Node on top:', topNodeObject.title, '; Node on bottom:', bottomNodeObject.title);
              
              let anyRewiringOccurredThisOverlap = false;
    
              // Helper function to get detailed information about a node's input slots,
              // including their types (handling comma-separated types) and connection status.
              const getNodeInputInfo = (nodeToProcess: any, graph: any) => {
                const processedInputs: { originalInput: any, slotIndex: number, types: Set<string>, isConnected: boolean, linkId: number | null, name: string }[] = [];
                if (nodeToProcess.inputs && nodeToProcess.inputs.length > 0) {
                  nodeToProcess.inputs.forEach((input: any, index: number) => {
                    const isConnected = input.link !== null && input.link !== undefined;
                    let linkId = null;
                    if (isConnected) linkId = input.link;
                    const currentTypes = new Set<string>();
                    if (input.type && typeof input.type === 'string') {
                      input.type.split(',').forEach((singleType: string) => {
                        if (singleType.trim()) currentTypes.add(singleType.trim());
                      });
                    }
                    processedInputs.push({ originalInput: input, slotIndex: index, types: currentTypes, isConnected, linkId, name: input.name || `slot ${index}` });
                  });
                }
                return processedInputs;
              };

              // --- Input Rewiring Logic ---
              // This section implements the "steal connection" feature for inputs.
              // If the top node has an available input slot of a type that matches
              // a connected input slot on the bottom node, the connection is moved.
              const topNodeProcessedInputs = getNodeInputInfo(topNodeObject, self.graph);
              const bottomNodeProcessedInputs = getNodeInputInfo(bottomNodeObject, self.graph);
              const allTopNodeInputTypes = new Set<string>(); 
              topNodeProcessedInputs.forEach(pInput => pInput.types.forEach(t => allTopNodeInputTypes.add(t)));
              const allBottomNodeInputTypes = new Set<string>(); 
              bottomNodeProcessedInputs.forEach(pInput => pInput.types.forEach(t => allBottomNodeInputTypes.add(t)));
              
              const commonInputTypeStrings = new Set<string>(); 
              allTopNodeInputTypes.forEach(type => {
                if (allBottomNodeInputTypes.has(type)) {
                  commonInputTypeStrings.add(type);
                }
              });

              if (commonInputTypeStrings.size > 0) {
                console.log('[ChangeTracker] Common input types found:', Array.from(commonInputTypeStrings).join(', '));
                commonInputTypeStrings.forEach(commonType => {
                  const availableTopSlots = topNodeProcessedInputs.filter(pInput => pInput.types.has(commonType) && !pInput.isConnected);
                  const connectedBottomSlots = bottomNodeProcessedInputs.filter(pInput => pInput.types.has(commonType) && pInput.isConnected && pInput.linkId !== null);
                  const numToRewire = Math.min(availableTopSlots.length, connectedBottomSlots.length);
                  if (numToRewire > 0) {
                    console.log(`[ChangeTracker] Input Action: Attempting to re-wire ${numToRewire} input connection(s) for type '${commonType}'.`);
                    for (let i = 0; i < numToRewire; i++) {
                      const topSlotToConnect = availableTopSlots[i];
                      const bottomSlotToDisconnect = connectedBottomSlots[i];
                      if (bottomSlotToDisconnect.linkId === null) continue;
                      const linkInfo = self.graph.links[bottomSlotToDisconnect.linkId];
                      if (linkInfo) {
                        const originNodeId = linkInfo.origin_id;
                        const originSlot = linkInfo.origin_slot;
                        const originNode = self.graph.getNodeById(originNodeId);
                        if (originNode) {
                          console.log(`  Re-wiring input pair ${i + 1} for type '${commonType}':`);
                          console.log(`    Disconnecting input '${bottomSlotToDisconnect.name}' (slot ${bottomSlotToDisconnect.slotIndex}) from bottom node '${bottomNodeObject.title}'.`);
                          bottomNodeObject.disconnectInput(bottomSlotToDisconnect.slotIndex);
                          console.log(`    Connecting input '${topSlotToConnect.name}' (slot ${topSlotToConnect.slotIndex}) on top node '${topNodeObject.title}' to '${originNode.title}' (slot ${originSlot}).`);
                          originNode.connect(originSlot, topNodeObject, topSlotToConnect.slotIndex);
                          anyRewiringOccurredThisOverlap = true;
                        }
                      }
                    }
                  }
                });
              }
              // --- End Input Rewiring Logic ---

              // --- Output Rewiring Logic ---
              // This section implements the "steal connection" feature for outputs.
              // If the top node has an available output slot of a type that matches
              // a connected output slot on the bottom node, all connections from the
              // bottom node's output are moved to the top node's output.
              const getNodeOutputInfo = (nodeToProcess: any, graph: any) => {
                const processedOutputs: {
                  originalOutput: any,
                  slotIndex: number,
                  types: Set<string>,
                  name: string,
                  connections: Array<{ linkId: number, targetNodeId: number, targetSlot: number }>
                }[] = [];
                if (nodeToProcess.outputs && nodeToProcess.outputs.length > 0) {
                  nodeToProcess.outputs.forEach((output: any, index: number) => {
                    const currentTypes = new Set<string>();
                    if (output.type && typeof output.type === 'string') {
                      output.type.split(',').forEach((singleType: string) => {
                        if (singleType.trim()) currentTypes.add(singleType.trim());
                      });
                    }
                    const currentConnections: Array<{ linkId: number, targetNodeId: number, targetSlot: number }> = [];
                    if (output.links && output.links.length > 0) {
                      output.links.forEach((linkId: number) => {
                        const linkInfo = graph.links[linkId];
                        if (linkInfo) {
                          currentConnections.push({
                            linkId,
                            targetNodeId: linkInfo.target_id,
                            targetSlot: linkInfo.target_slot
                          });
                        }
                      });
                    }
                    processedOutputs.push({
                      originalOutput: output,
                      slotIndex: index,
                      types: currentTypes,
                      name: output.name || `slot ${index}`,
                      connections: currentConnections
                    });
                  });
                }
                return processedOutputs;
              };

              const topNodeProcessedOutputs = getNodeOutputInfo(topNodeObject, self.graph);
              const bottomNodeProcessedOutputs = getNodeOutputInfo(bottomNodeObject, self.graph);

              const allTopNodeOutputTypes = new Set<string>();
              topNodeProcessedOutputs.forEach(pOutput => pOutput.types.forEach(t => allTopNodeOutputTypes.add(t)));
              const allBottomNodeOutputTypes = new Set<string>();
              bottomNodeProcessedOutputs.forEach(pOutput => pOutput.types.forEach(t => allBottomNodeOutputTypes.add(t)));

              const commonOutputTypes = new Set<string>();
              allTopNodeOutputTypes.forEach(type => {
                if (allBottomNodeOutputTypes.has(type)) {
                  commonOutputTypes.add(type);
                }
              });

              if (commonOutputTypes.size > 0) {
                console.log('[ChangeTracker] Common output types found for potential output re-wiring:', Array.from(commonOutputTypes).join(', '));
                
                commonOutputTypes.forEach(commonType => {
                  const availableTopOutputSlots = topNodeProcessedOutputs.filter(
                    pOutput => pOutput.types.has(commonType) && pOutput.connections.length === 0
                  );
                  const connectedBottomOutputSlots = bottomNodeProcessedOutputs.filter(
                    pOutput => pOutput.types.has(commonType) && pOutput.connections.length > 0
                  );

                  const numToRewireOutput = Math.min(availableTopOutputSlots.length, connectedBottomOutputSlots.length);

                  if (numToRewireOutput > 0) {
                    console.log(`[ChangeTracker] Output Action: Attempting to re-wire ${numToRewireOutput} output connection(s) for type '${commonType}' from bottom node to top node.`);
                    for (let i = 0; i < numToRewireOutput; i++) {
                      const topOutputToConnectFrom = availableTopOutputSlots[i];
                      const bottomOutputToDisconnectFrom = connectedBottomOutputSlots[i];
                      const originalTargets = [...bottomOutputToDisconnectFrom.connections];

                      console.log(`  Re-wiring output pair ${i + 1} for type '${commonType}':`);
                      console.log(`    Disconnecting all targets from output '${bottomOutputToDisconnectFrom.name}' (slot ${bottomOutputToDisconnectFrom.slotIndex}) of bottom node '${bottomNodeObject.title}'.`);
                      bottomNodeObject.disconnectOutput(bottomOutputToDisconnectFrom.slotIndex); // Disconnects all links from this output slot.
                      
                      originalTargets.forEach(targetDetail => {
                        const targetNodeInstance = self.graph.getNodeById(targetDetail.targetNodeId);
                        if (targetNodeInstance) {
                          console.log(`    Connecting output '${topOutputToConnectFrom.name}' (slot ${topOutputToConnectFrom.slotIndex}) on top node '${topNodeObject.title}' to target node '${targetNodeInstance.title}' (input slot ${targetDetail.targetSlot}).`);
                          // Connect the top node's output to the original target's input.
                          topNodeObject.connect(topOutputToConnectFrom.slotIndex, targetNodeInstance, targetDetail.targetSlot);
                          anyRewiringOccurredThisOverlap = true;
                        } else {
                          console.warn(`    Could not find target node ID ${targetDetail.targetNodeId} for re-wiring output.`);
                        }
                      });
                    }
                  }
                });
              }
              // --- End Output Rewiring Logic ---
              
              // If any re-wiring (input or output) occurred, mark the canvas as dirty to redraw.
              if (anyRewiringOccurredThisOverlap) {
                self.graph.setDirtyCanvas(true, true);
              }
            }
          }
        }
      }
      
      // Clean up the temporary dragged node reference.
      if (self._temp_dragged_node_ref) {
        delete self._temp_dragged_node_ref;
      }

      if (self.graph?.changeTracker) {
        self.graph.changeTracker.checkState()
      }
      return v
    }

    // Patch LGraphCanvas.prototype.processMouseMove for live overlap, common types, and link highlighting
    const originalProcessMouseMove = LGraphCanvas.prototype.processMouseMove;
    LGraphCanvas.prototype.processMouseMove = function(e: PointerEvent) { 
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this as any; // LGraphCanvas instance
      
      const result = originalProcessMouseMove.apply(self, [e]);

      // Only proceed if the primary mouse button is down (indicating a drag) and the graph exists.
      if (e.buttons === 1 && self.graph) { 
        // Initialize or retrieve the map storing original link colors for highlighting.
        // This map is crucial for reverting colors once highlighting is no longer needed.
        self._temp_highlighted_links_original_colors = self._temp_highlighted_links_original_colors || new Map<number, string>();
        // Keeps track of link IDs that are determined to need highlighting in the current mouse move frame.
        const currentFrameOverlappedLinkIds = new Set<number>();
        let needsRedraw = false; // Flag to trigger a canvas redraw if any link colors change.

        // Identify the node being dragged. 
        // Prefers self.current_node (node directly under mouse during some drag operations),
        // falls back to the selected node if only one is selected.
        let draggedNode: LGraphNode | null = null;
        if (self.current_node && typeof self.current_node.getBounding === 'function') {
          draggedNode = self.current_node;
        } else if (self.graph.selected_nodes) {
          const selectedNodeIds = Object.keys(self.graph.selected_nodes);
          if (selectedNodeIds.length === 1) {
            const node = self.graph.getNodeById(selectedNodeIds[0]);
            if (node && typeof node.getBounding === 'function') {
              draggedNode = node;
            }
          }
        }

        if (draggedNode) {
          const draggedNodeTitle = draggedNode.title || `ID: ${draggedNode.id}`;
          const r1 = draggedNode.getBounding(); // Bounding box of the dragged node.

          if (r1 && self.graph._nodes) {
            // Helper to get unique input types from a node, handling comma-separated types.
            const getBasicInputTypes = (nodeToProcess: LGraphNode): Set<string> => {
              const types = new Set<string>();
              if (nodeToProcess.inputs && nodeToProcess.inputs.length > 0) {
                nodeToProcess.inputs.forEach((input: { name: string, type: string | number, link: number | null }) => {
                  const typeVal = input.type;
                  if (typeVal != null) { // Handles both string and number, excludes null/undefined
                    String(typeVal).split(',').forEach((singleType: string) => {
                      if (singleType.trim()) types.add(singleType.trim());
                    });
                  }
                });
              }
              return types;
            };
            
            // Helper to get unique output types from a node, handling comma-separated types.
            const getBasicOutputTypes = (nodeToProcess: LGraphNode): Set<string> => {
              const types = new Set<string>();
              if (nodeToProcess.outputs && nodeToProcess.outputs.length > 0) {
                nodeToProcess.outputs.forEach((output: { name: string, type: string | number, links: number[] | null }) => {
                  const typeVal = output.type;
                  if (typeVal != null) { // Handles both string and number, excludes null/undefined
                    String(typeVal).split(',').forEach((singleType: string) => {
                      if (singleType.trim()) types.add(singleType.trim());
                    });
                  }
                });
              }
              return types;
            };

            // Iterate over all nodes in the graph to check for overlaps with the dragged node.
            for (const existingNode of self.graph._nodes) {
              if (existingNode.id === draggedNode.id) continue; // Skip self-comparison.

              const r2 = existingNode.getBounding(); // Bounding box of the other node.
              if (r2) {
                let areOverlapping = false;
                // Use LiteGraph.overlap if available, otherwise manual AABB check.
                const overlapFunc = LiteGraph.overlap || (LiteGraph.Nodes?.LiteGraph as any)?.overlap;
                if (typeof overlapFunc === 'function') areOverlapping = overlapFunc(r1, r2);
                else areOverlapping = r1[0] < r2[0] + r2[2] && r1[0] + r1[2] > r2[0] && r1[1] < r2[1] + r2[3] && r1[1] + r1[3] > r2[1];

                if (areOverlapping) {
                  const existingNodeTitle = existingNode.title || `ID: ${existingNode.id}`;
                  console.log(`[Drag Overlap] '${draggedNodeTitle}' is overlapping with '${existingNodeTitle}'`);
                  
                  // Log common input types between dragged and overlapped node.
                  const draggedNodeInputTypes = getBasicInputTypes(draggedNode);
                  const existingNodeInputTypes = getBasicInputTypes(existingNode);
                  const commonInputTypes = new Set<string>();
                  draggedNodeInputTypes.forEach(type => { if (existingNodeInputTypes.has(type)) commonInputTypes.add(type); });
                  if (commonInputTypes.size > 0) console.log(`  [Common Input Types] Shared with '${existingNodeTitle}': ${Array.from(commonInputTypes).join(', ')}`);

                  // Log common output types and highlight relevant connected output links on the overlapped node.
                  const draggedNodeOutputTypes = getBasicOutputTypes(draggedNode);
                  const existingNodeOutputTypes = getBasicOutputTypes(existingNode);
                  const commonOutputTypes = new Set<string>();
                  draggedNodeOutputTypes.forEach(type => {
                    if (existingNodeOutputTypes.has(type)) {
                      commonOutputTypes.add(type);
                    }
                  });

                  if (commonOutputTypes.size > 0) {
                    console.log(`  [Common Output Types] Dragged '${draggedNodeTitle}' and Overlapped '${existingNodeTitle}' share output types: ${Array.from(commonOutputTypes).join(', ')}`);
                    // Highlight connected output links of the overlapped (existing) node if they match common types.
                    if (existingNode.outputs) {
                      existingNode.outputs.forEach((output: any, outputIndex: number) => {
                        const currentOutputTypes = new Set<string>();
                        if (output.type && typeof output.type === 'string') {
                          output.type.split(',').forEach((singleType: string) => {
                            if (singleType.trim()) currentOutputTypes.add(singleType.trim());
                          });
                        }
                        
                        let outputHasCommonType = false;
                        currentOutputTypes.forEach(ot => {
                          if (commonOutputTypes.has(ot)) outputHasCommonType = true;
                        });

                        if (outputHasCommonType && output.links && output.links.length > 0) {
                          output.links.forEach((linkId: number) => {
                            const linkInfo = self.graph.links[linkId];
                            if (linkInfo) {
                              currentFrameOverlappedLinkIds.add(linkId); // Mark this link for highlight in this frame.
                              const targetNode = self.graph.getNodeById(linkInfo.target_id);
                              const targetNodeTitle = targetNode ? (targetNode.title || `ID: ${targetNode.id}`) : 'Unknown Target Node';
                              const targetSlotInfo = targetNode && targetNode.inputs && targetNode.inputs[linkInfo.target_slot] ? targetNode.inputs[linkInfo.target_slot].name : `slot ${linkInfo.target_slot}`;
                              console.log(`    [Output Connection] Overlapped node '${existingNodeTitle}' output '${output.name || `slot ${outputIndex}`}' (type: ${output.type}) is connected to '${targetNodeTitle}' input '${targetSlotInfo}' (slot ${linkInfo.target_slot})`);

                              const newHighlightColor = '#00A0A0'; // Teal/Cyan for output links.
                              if (!self._temp_highlighted_links_original_colors.has(linkId)) {
                                const originalColor = linkInfo.color || self.default_link_color;
                                self._temp_highlighted_links_original_colors.set(linkId, originalColor);
                                linkInfo.color = newHighlightColor;
                                needsRedraw = true;
                                console.log(`    [Output Link Highlight] Highlighting output link ID ${linkId} from '${existingNodeTitle}' (output '${output.name || `slot ${outputIndex}`}'). Original: ${originalColor}, New: ${newHighlightColor}`);
                              } else if (linkInfo.color !== newHighlightColor) { 
                                linkInfo.color = newHighlightColor; 
                                needsRedraw = true;
                              }
                            }
                          });
                        }
                      });
                    }
                  }

                  // Highlight connected INPUT links of the overlapped existingNode based on new rules.
                  if (commonInputTypes.size > 0 && existingNode.inputs) {
                    // Helper to check if a slot's type (string or number) matches/includes the target string type.
                    const slotMatchesTargetType = (slotTypeRaw: string | number | undefined, targetType: string): boolean => {
                      if (slotTypeRaw == null) return false;
                      const slotTypes = String(slotTypeRaw).split(',').map(s => s.trim());
                      return slotTypes.includes(targetType);
                    };

                    commonInputTypes.forEach(commonType => {
                      // Check if the draggedNode has an available (unconnected) input slot of this commonType.
                      const draggedNodeHasAvailableSlotForCommonType = draggedNode.inputs?.some(
                        (draggedInput: any) => slotMatchesTargetType(draggedInput.type, commonType) && (draggedInput.link === null || draggedInput.link === undefined)
                      );

                      if (draggedNodeHasAvailableSlotForCommonType) {
                        // If dragged node has an available slot, then highlight relevant connected inputs on the existingNode.
                        for (const input of existingNode.inputs) {
                          if (input.link != null && slotMatchesTargetType(input.type, commonType)) {
                            const linkId = input.link;
                            const linkInfo = self.graph.links[linkId];
                            if (linkInfo) {
                              currentFrameOverlappedLinkIds.add(linkId); // Mark this link for highlight.
                              const inputHighlightColor = '#A00000'; // Deep red for input links.
                              if (!self._temp_highlighted_links_original_colors.has(linkId)) {
                                const originalColor = linkInfo.color || self.default_link_color;
                                self._temp_highlighted_links_original_colors.set(linkId, originalColor);
                                linkInfo.color = inputHighlightColor;
                                needsRedraw = true;
                                console.log(`  [Input Link Highlight (Refined)] Highlighting link ID ${linkId} to '${existingNodeTitle}' for common type '${commonType}'. Original: ${originalColor}, New: ${inputHighlightColor}`);
                              } else if (linkInfo.color !== inputHighlightColor && linkInfo.color !== '#00A0A0') {
                                linkInfo.color = inputHighlightColor;
                                needsRedraw = true;
                              }
                            }
                          }
                        }
                      }
                    });
                  }
                }
              }
            } // End for existingNode loop.

            // Revert colors for links that were highlighted in previous frames but are no longer overlapping in this frame.
            if (self._temp_highlighted_links_original_colors.size > 0) {
                self._temp_highlighted_links_original_colors.forEach((originalColor, linkId) => {
                    if (!currentFrameOverlappedLinkIds.has(linkId)) { // If not marked for highlight in current frame...
                        const linkInfo = self.graph.links[linkId];
                        if (linkInfo && linkInfo.color !== originalColor) { // ...and color is not original...
                            linkInfo.color = originalColor; // ...revert it.
                            console.log(`  [Link Highlight] Reverting link ID ${linkId} to ${originalColor}`);
                            needsRedraw = true;
                        }
                        // Remove from map only if its color has been reverted and it wasn't re-highlighted this frame.
                        // This check is implicitly handled by currentFrameOverlappedLinkIds: if it was re-highlighted, 
                        // it would be in currentFrameOverlappedLinkIds and skipped by the `if` above. 
                        // If it was not re-highlighted and needed revert, it's reverted. If it didn't need revert, it means 
                        // it was not highlighted in the first place or its highlight is still active from this frame.
                        // To simplify, always remove if not in currentFrameOverlappedLinkIds because its state for this frame is now final.
                        self._temp_highlighted_links_original_colors.delete(linkId);
                    }
                });
            }
            if (needsRedraw) self.setDirty(true, true); // Apply redraw if any color changes occurred.
          }
        } else if (self._temp_highlighted_links_original_colors && self._temp_highlighted_links_original_colors.size > 0) {
          // Fallback: If mouse button is up OR no node is being dragged, but there are lingering highlights,
          // revert all of them. This handles cases like drag ending outside the canvas or abruptly.
          console.log('[Drag Link Highlight] Mouse button up or no dragged node, reverting all lingering highlighted links.');
          self._temp_highlighted_links_original_colors.forEach((originalColor: string, linkId: number) => {
            const linkInfo = self.graph.links[linkId];
            if (linkInfo && linkInfo.color !== originalColor) {
                linkInfo.color = originalColor;
                needsRedraw = true; // Ensure redraw if any reverts happen here.
            }
          });
          self._temp_highlighted_links_original_colors.clear();
          if(needsRedraw) self.setDirty(true, true);
        }
      }
      return result;
    };

    // Handle litegraph dialog popup for number/string widgets
    const prompt = LGraphCanvas.prototype.prompt
    LGraphCanvas.prototype.prompt = function (
      title: string,
      value: any,
      callback: (v: any) => void,
      event: any
    ) {
      const extendedCallback = (v: any) => {
        callback(v)
        checkState()
      }
      logger.debug('checkState on prompt')
      return prompt.apply(this, [title, value, extendedCallback, event])
    }

    // Handle litegraph context menu for COMBO widgets
    const close = LiteGraph.ContextMenu.prototype.close
    LiteGraph.ContextMenu.prototype.close = function (e: MouseEvent) {
      const v = close.apply(this, [e])
      logger.debug('checkState on contextMenuClose')
      checkState()
      return v
    }

    // Handle multiple commands as a single transaction
    document.addEventListener('litegraph:canvas', (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail.subType === 'before-change') {
        getCurrentChangeTracker()?.beforeChange()
      } else if (detail.subType === 'after-change') {
        getCurrentChangeTracker()?.afterChange()
      }
    })

    // Store node outputs
    api.addEventListener('executed', (e: CustomEvent<ExecutedWsMessage>) => {
      const detail = e.detail
      const workflow =
        useExecutionStore().queuedPrompts[detail.prompt_id]?.workflow
      const changeTracker = workflow?.changeTracker
      if (!changeTracker) return
      changeTracker.nodeOutputs ??= {}
      const nodeOutputs = changeTracker.nodeOutputs
      const output = nodeOutputs[detail.node]
      if (detail.merge && output) {
        for (const k in detail.output ?? {}) {
          const v = output[k]
          if (v instanceof Array) {
            output[k] = v.concat(detail.output[k])
          } else {
            output[k] = detail.output[k]
          }
        }
      } else {
        nodeOutputs[detail.node] = detail.output
      }
    })

    // Patch LGraph.prototype.add to log, bring to front, select, and check overlap for new node
    const originalLGraphAdd = LiteGraph.LGraph.prototype.add;
    LiteGraph.LGraph.prototype.add = function (newNode: LGraphNode, skip_compute_order?: boolean) {
      const graphInstance = this as any; // graphInstance is the LGraph itself
      const result = originalLGraphAdd.apply(graphInstance, [newNode, skip_compute_order]);

      if (newNode && graphInstance._nodes.includes(newNode)) {
        console.log(`[ChangeTracker] New node created: '${newNode.title || 'Untitled'}' (ID: ${newNode.id}) at initial position [${newNode.pos[0]}, ${newNode.pos[1]}]`);

        if (app && app.canvas) {
          console.log(`[ChangeTracker] Bringing node '${newNode.title}' (ID: ${newNode.id}) to front.`);
          app.canvas.bringToFront(newNode);
          console.log(`[ChangeTracker] Selecting node '${newNode.title}' (ID: ${newNode.id}).`);
          app.canvas.selectNode(newNode, false);
          app.canvas.setDirty(true, true);
        } else {
          console.warn('[ChangeTracker] app.canvas not available for new node actions.');
        }

        requestAnimationFrame(() => {
          // console.log(`[ChangeTracker] (rAF) Before BBox for overlap: New node '${newNode.title}' (ID: ${newNode.id}) - Pos: [${newNode.pos[0]}, ${newNode.pos[1]}], Size: [${newNode.size[0]}, ${newNode.size[1]}]`);
          // console.log(`[ChangeTracker] (rAF) Detailed Overlap Check for New Node '${newNode.title}' (ID: ${newNode.id}):`);
          let anyOverlapFoundWithNewNode = false;
          let anyRewiringDoneOverall = false;

          const getNodeInputInfoWithConnections = (nodeToProcess: LGraphNode, currentGraph: any) => {
            const processedInputs: { originalInput: any, slotIndex: number, types: Set<string>, name: string, isConnected: boolean, linkId: number | null }[] = [];
            if (nodeToProcess.inputs && nodeToProcess.inputs.length > 0) {
              nodeToProcess.inputs.forEach((input: any, index: number) => {
                const currentTypes = new Set<string>();
                if (input.type && typeof input.type === 'string') {
                  input.type.split(',').forEach((singleType: string) => {
                    if (singleType.trim()) currentTypes.add(singleType.trim());
                  });
                }
                const isConnected = input.link !== null && input.link !== undefined;
                const linkId = isConnected ? input.link : null;
                processedInputs.push({ originalInput: input, slotIndex: index, types: currentTypes, name: input.name || `slot ${index}`, isConnected, linkId });
              });
            }
            return processedInputs;
          };

          // Helper function to get output info for a node (similar to input one)
          const getNodeOutputInfoWithConnections = (nodeToProcess: LGraphNode, currentGraph: any) => {
            const processedOutputs: {
              originalOutput: any,
              slotIndex: number,
              types: Set<string>,
              name: string,
              connections: Array<{ linkId: number, targetNodeId: number, targetSlot: number }>
            }[] = [];
            if (nodeToProcess.outputs && nodeToProcess.outputs.length > 0) {
              nodeToProcess.outputs.forEach((output: any, index: number) => {
                const currentTypes = new Set<string>();
                if (output.type && typeof output.type === 'string') {
                  output.type.split(',').forEach((singleType: string) => {
                    if (singleType.trim()) currentTypes.add(singleType.trim());
                  });
                }
                const currentConnections: Array<{ linkId: number, targetNodeId: number, targetSlot: number }> = [];
                if (output.links && output.links.length > 0) {
                  output.links.forEach((linkId: number) => {
                    const linkInfo = currentGraph.links[linkId];
                    if (linkInfo) {
                      currentConnections.push({
                        linkId,
                        targetNodeId: linkInfo.target_id,
                        targetSlot: linkInfo.target_slot
                      });
                    }
                  });
                }
                processedOutputs.push({
                  originalOutput: output,
                  slotIndex: index,
                  types: currentTypes,
                  name: output.name || `slot ${index}`,
                  connections: currentConnections
                });
              });
            }
            return processedOutputs;
          };

          graphInstance._nodes.forEach((existingNode: LGraphNode) => {
            if (existingNode.id !== newNode.id) {
              const r1 = newNode.getBounding();
              const r2 = existingNode.getBounding();

              let areOverlapping = false;
              const overlapFunc = LiteGraph.overlap || (LiteGraph.Nodes?.LiteGraph as any)?.overlap;

              if (r1 && r2 && r1.length === 4 && r2.length === 4) {
                if (typeof overlapFunc === 'function') {
                  areOverlapping = overlapFunc(r1, r2);
                } else {
                  areOverlapping = r1[0] < r2[0] + r2[2] && r1[0] + r1[2] > r2[0] && r1[1] < r2[1] + r2[3] && r1[1] + r1[3] > r2[1];
                }

                if (areOverlapping) {
                  console.log(`    (rAF) Overlap DETECTED between new node '${newNode.title}' (ID: ${newNode.id}) and existing node '${existingNode.title}' (ID: ${existingNode.id}).`);
                  anyOverlapFoundWithNewNode = true;

                  // --- Input Rewiring for New Node ---
                  const newNodeProcessedInputs = getNodeInputInfoWithConnections(newNode, graphInstance);
                  const existingNodeProcessedInputs = getNodeInputInfoWithConnections(existingNode, graphInstance);

                  const allNewNodeInputTypes = new Set<string>();
                  newNodeProcessedInputs.forEach(pInput => pInput.types.forEach(t => allNewNodeInputTypes.add(t)));
                  const allExistingNodeInputTypes = new Set<string>();
                  existingNodeProcessedInputs.forEach(pInput => pInput.types.forEach(t => allExistingNodeInputTypes.add(t)));

                  const commonInputTypeStringsNewNode = new Set<string>();
                  allNewNodeInputTypes.forEach(type => {
                    if (allExistingNodeInputTypes.has(type)) {
                      commonInputTypeStringsNewNode.add(type);
                    }
                  });

                  if (commonInputTypeStringsNewNode.size > 0) {
                    console.log(`      (rAF) Common input types found with '${existingNode.title}': ${Array.from(commonInputTypeStringsNewNode).join(', ')}. Attempting input re-wire.`);
                    commonInputTypeStringsNewNode.forEach(commonType => {
                      const availableNewNodeSlots = newNodeProcessedInputs.filter(pInput => pInput.types.has(commonType) && !pInput.isConnected);
                      const connectedExistingNodeSlots = existingNodeProcessedInputs.filter(pInput => pInput.types.has(commonType) && pInput.isConnected && pInput.linkId !== null);
                      const numToRewireInput = Math.min(availableNewNodeSlots.length, connectedExistingNodeSlots.length);

                      if (numToRewireInput > 0) {
                        console.log(`        (rAF) Input Action: Attempting to re-wire ${numToRewireInput} input connection(s) for type '${commonType}' from '${existingNode.title}' to new node '${newNode.title}'.`);
                        for (let i = 0; i < numToRewireInput; i++) {
                          const newSlotToConnect = availableNewNodeSlots[i];
                          const existingSlotToDisconnect = connectedExistingNodeSlots[i];
                          if (existingSlotToDisconnect.linkId === null) continue;
                          const linkInfo = graphInstance.links[existingSlotToDisconnect.linkId];
                          if (linkInfo) {
                            const originNodeId = linkInfo.origin_id;
                            const originSlot = linkInfo.origin_slot;
                            const originNode = graphInstance.getNodeById(originNodeId);
                            if (originNode) {
                              console.log(`          (rAF) Re-wiring pair ${i + 1} for type '${commonType}':`);
                              console.log(`            Disconnecting input '${existingSlotToDisconnect.name}' (slot ${existingSlotToDisconnect.slotIndex}) from existing node '${existingNode.title}'.`);
                              existingNode.disconnectInput(existingSlotToDisconnect.slotIndex);
                              console.log(`            Connecting input '${newSlotToConnect.name}' (slot ${newSlotToConnect.slotIndex}) on new node '${newNode.title}' to original source '${originNode.title}' (slot ${originSlot}).`);
                              originNode.connect(originSlot, newNode, newSlotToConnect.slotIndex);
                              anyRewiringDoneOverall = true;
                            }
                          }
                        }
                      }
                    });
                  }
                  // --- End Input Rewiring for New Node ---
                  
                  // --- Output Rewiring for New Node (newNode is topNode, existingNode is bottomNode) ---
                  const newNodeProcessedOutputs = getNodeOutputInfoWithConnections(newNode, graphInstance);
                  const existingNodeProcessedOutputs = getNodeOutputInfoWithConnections(existingNode, graphInstance);

                  const allNewNodeOutputTypes = new Set<string>();
                  newNodeProcessedOutputs.forEach(pOutput => pOutput.types.forEach(t => allNewNodeOutputTypes.add(t)));
                  const allExistingNodeOutputTypes = new Set<string>();
                  existingNodeProcessedOutputs.forEach(pOutput => pOutput.types.forEach(t => allExistingNodeOutputTypes.add(t)));
                  
                  const commonOutputTypeStringsNewNode = new Set<string>();
                  allNewNodeOutputTypes.forEach(type => {
                    if (allExistingNodeOutputTypes.has(type)) {
                      commonOutputTypeStringsNewNode.add(type);
                    }
                  });

                  if (commonOutputTypeStringsNewNode.size > 0) {
                    console.log(`      (rAF) Common output types found with '${existingNode.title}': ${Array.from(commonOutputTypeStringsNewNode).join(', ')}. Attempting output re-wire.`);
                    commonOutputTypeStringsNewNode.forEach(commonType => {
                      const availableNewNodeOutputSlots = newNodeProcessedOutputs.filter(
                        pOutput => pOutput.types.has(commonType) && pOutput.connections.length === 0
                      );
                      const connectedExistingNodeOutputSlots = existingNodeProcessedOutputs.filter(
                        pOutput => pOutput.types.has(commonType) && pOutput.connections.length > 0
                      );
                      const numToRewireOutput = Math.min(availableNewNodeOutputSlots.length, connectedExistingNodeOutputSlots.length);

                      if (numToRewireOutput > 0) {
                        console.log(`        (rAF) Output Action: Attempting to re-wire ${numToRewireOutput} output connection(s) for type '${commonType}' from '${existingNode.title}' to new node '${newNode.title}'.`);
                        for (let i = 0; i < numToRewireOutput; i++) {
                          const newOutputToConnectFrom = availableNewNodeOutputSlots[i];
                          const existingOutputToDisconnectFrom = connectedExistingNodeOutputSlots[i];
                          const originalTargets = [...existingOutputToDisconnectFrom.connections];

                          console.log(`          (rAF) Re-wiring output pair ${i + 1} for type '${commonType}':`);
                          console.log(`            Disconnecting all targets from output '${existingOutputToDisconnectFrom.name}' (slot ${existingOutputToDisconnectFrom.slotIndex}) of existing node '${existingNode.title}'.`);
                          existingNode.disconnectOutput(existingOutputToDisconnectFrom.slotIndex);

                          originalTargets.forEach(targetDetail => {
                            const targetNodeInstance = graphInstance.getNodeById(targetDetail.targetNodeId);
                            if (targetNodeInstance) {
                              console.log(`            Connecting output '${newOutputToConnectFrom.name}' (slot ${newOutputToConnectFrom.slotIndex}) on new node '${newNode.title}' to target node '${targetNodeInstance.title}' (input slot ${targetDetail.targetSlot}).`);
                              newNode.connect(newOutputToConnectFrom.slotIndex, targetNodeInstance, targetDetail.targetSlot);
                              anyRewiringDoneOverall = true;
                            } else {
                              console.warn(`            (rAF) Could not find target node ID ${targetDetail.targetNodeId} for re-wiring output.`);
                            }
                          });
                        }
                      }
                    });
                  }
                  // --- End Output Rewiring for New Node ---
                }
              }
            }
          });
          if (anyRewiringDoneOverall) {
            console.log("(rAF) Canvas marked dirty due to re-wiring operations.");
            graphInstance.setDirtyCanvas(true, true);
          }
          // if (!anyOverlapFoundWithNewNode && !anyRewiringDoneOverall) { // Modified to reflect that action might happen even if no overlap for THIS node but for others
          //   console.log(`[ChangeTracker] (rAF) Summary: New node '${newNode.title}' caused no overlaps or re-wiring.`);
          // }
        });
      }
      return result;
    };
  }

  static bindInput(activeEl: Element | null): boolean {
    if (
      !activeEl ||
      activeEl.tagName === 'CANVAS' ||
      activeEl.tagName === 'BODY'
    ) {
      return false
    }

    for (const evt of ['change', 'input', 'blur']) {
      const htmlElement = activeEl as HTMLElement
      if (`on${evt}` in htmlElement) {
        const listener = () => {
          useWorkflowStore().activeWorkflow?.changeTracker?.checkState?.()
          htmlElement.removeEventListener(evt, listener)
        }
        htmlElement.addEventListener(evt, listener)
        return true
      }
    }
    return false
  }

  static graphEqual(a: ComfyWorkflowJSON, b: ComfyWorkflowJSON) {
    if (a === b) return true

    if (typeof a == 'object' && a && typeof b == 'object' && b) {
      // Compare nodes ignoring order
      if (
        !_.isEqualWith(a.nodes, b.nodes, (arrA, arrB) => {
          if (Array.isArray(arrA) && Array.isArray(arrB)) {
            return _.isEqual(new Set(arrA), new Set(arrB))
          }
        })
      ) {
        return false
      }

      // Compare extra properties ignoring ds
      if (
        !_.isEqual(_.omit(a.extra ?? {}, ['ds']), _.omit(b.extra ?? {}, ['ds']))
      )
        return false

      // Compare other properties normally
      for (const key of ['links', 'floatingLinks', 'reroutes', 'groups']) {
        if (!_.isEqual(a[key], b[key])) {
          return false
        }
      }

      return true
    }

    return false
  }

  private static graphDiff(a: ComfyWorkflowJSON, b: ComfyWorkflowJSON) {
    function sortGraphNodes(graph: ComfyWorkflowJSON) {
      return {
        links: graph.links,
        groups: graph.groups,
        nodes: graph.nodes.sort((a, b) => {
          if (typeof a.id === 'number' && typeof b.id === 'number') {
            return a.id - b.id
          }
          return 0
        })
      }
    }
    return jsondiffpatch.diff(sortGraphNodes(a), sortGraphNodes(b))
  }
}

