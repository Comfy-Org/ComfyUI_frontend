import { app } from "../../scripts/app.js";
import { t } from '@/i18n'
import { LiteGraph } from '@comfyorg/litegraph';
import { LGraphNode } from '@comfyorg/litegraph/dist/LGraphNode';
import { getStorageValue, setStorageValue } from '@/scripts/utils';


declare global {
  interface Window {
    app: typeof app;
    LiteGraph: typeof LiteGraph;
  }
  
  interface HTMLElement {
    lgraphcanvas?: ComfyCanvas;
    dataset: DOMStringMap;
  }
}

interface ComfyNode {
  pos: [number, number];
  size: [number, number];
  color?: string;
  bgcolor?: string;
  is_selected?: boolean;
  mode?: number;
}

interface ComfyGroup {
  pos: [number, number];
  size: [number, number];
  color?: string;
  selected?: boolean;
}

interface ComfyGraph {
  _nodes: ComfyNode[];
  groups?: ComfyGroup[];
  setDirtyCanvas: (a: boolean, b: boolean) => void;
}

interface ComfyCanvas {
  graph: ComfyGraph;
  selected_nodes?: Record<string, LGraphNode>;
  selected_groups?: ComfyGroup[];
}

const DEFAULT_CONFIG = {
  iconSize: 36,
  spacing: 112,
  horizontalMinSpacing: 30,
  verticalMinSpacing: 25,
  colors: {
    circle1: '#a93232',
    circle2: '#79461d',
    circle3: '#6e6e1d',
    circle4: '#2b652b',
    circle5: '#248382',
    circle6: '#246283',
    circle7: '#3c3c83',
    circle8: '#ffffff',      
    moon: 'linear-gradient(135deg, #ffd700, #ffb700, #ffd700, #fff6a9)',
    icon: 'rgba(198, 198, 198, 0.8)',
    bg: 'rgba(12, 12, 12, 0.95)',
    hover: 'rgba(255,255,255,0.2)',
    circle9: '#ffd700'
  } as Record<string, string>, 
  colorMap: {
    'red': 'circle1',
    'orange': 'circle2',
    'yellow': 'circle3',
    'green': 'circle4',
    'cyan': 'circle5',
    'blue': 'circle6',
    'purple': 'circle7',
    'clear': 'circle8',
    'moon': 'moon'
  } as Record<string, string>, 
  transition: 'all 0.2s ease',
  shortcut: 'alt+a',
  applyToHeader: true,
  applyToPanel: false,
  safetyMargin: {
    horizontal: 20,
    vertical: 30
  },
  minNodeSize: {
    width: 100,
    height: 60
  }
};

namespace AlignerPlugin {
  export const CONFIG = {...DEFAULT_CONFIG};

  interface State {
    container: HTMLElement | null;
    visible: boolean;
    lastX: number;
    lastY: number;
    icons: Record<string, HTMLElement>;
    styleElement: HTMLStyleElement | null;
    initialized: boolean;
    shiftKeyPressed: boolean;
    altKeyPressed: boolean;
    isToggleExpanded: boolean;
    animationFrameId: number | null;
    isUtilsExpanded: boolean;
  }

  interface Icon {
    id: string;
    type: string;
  }

  interface ActionResult {
    success: boolean;
    message?: string;
  }

  // Internal state object that tracks UI components, visibility, and interaction coordinates
  const state: State = {
    container: null,
    visible: false,
    lastX: 0,
    lastY: 0,
    icons: {},
    styleElement: null,
    initialized: false,
    shiftKeyPressed: false,
    altKeyPressed: false,
    isToggleExpanded: false,
    animationFrameId: null,
    isUtilsExpanded: false
  };

  const ICONS: Icon[] = [
    { id: 'left', type: 'align' },
    { id: 'horizontalCenter', type: 'align' },
    { id: 'leftStretch', type: 'stretch' },
    { id: 'top', type: 'align' },
    { id: 'verticalCenter', type: 'align' },
    { id: 'topStretch', type: 'stretch' },
    { id: 'right', type: 'align' },
    { id: 'horizontalStretch', type: 'stretch' },
    { id: 'rightStretch', type: 'stretch' },
    { id: 'bottom', type: 'align' },
    { id: 'verticalStretch', type: 'stretch' },
    { id: 'bottomStretch', type: 'stretch' },
    { id: 'redCircle', type: 'color' },
    { id: 'orangeCircle', type: 'color' },
    { id: 'yellowCircle', type: 'color' },
    { id: 'greenCircle', type: 'color' },
    { id: 'cyanCircle', type: 'color' },
    { id: 'blueCircle', type: 'color' },
    { id: 'purpleCircle', type: 'color' },
    { id: 'moonCircle', type: 'color' },
    { id: 'clearCircle', type: 'color' },
    { id: 'toggleArrowCircle', type: 'toggle' },
    { id: 'bypassCircle', type: 'bypass' },
    { id: 'muteCircle', type: 'mute' },
    { id: 'pinCircle', type: 'pin' }
  ];

  const SVG_PATHS: Record<string, string> = {
    left: 'M96 0a32 32 0 0 1 32 32v960a32 32 0 0 1-64 0V32A32 32 0 0 1 96 0z m128 192h448a32 32 0 0 1 32 32v192a32 32 0 0 1-32 32h-448a32 32 0 0 1-32-32v-192a32 32 0 0 1 32-32z m0 384h704a32 32 0 0 1 32 32v192a32 32 0 0 1-32 32h-704a32 32 0 0 1-32-32v-192a32 32 0 0 1 32-32z',
    leftStretch: 'M800 224a128 128 0 0 1 128 128v320a128 128 0 0 1-128 128h-320a128 128 0 0 1-128-128v-320a128 128 0 0 1 128-128h320z m0 64h-320a64 64 0 0 0-64 64v320a64 64 0 0 0 64 64h320a64 64 0 0 0 64-64v-320a64 64 0 0 0-64-64z M128 128m32 0l0 0q32 0 32 32l0 704q0 32-32 32l0 0q-32 0-32-32l0-704q0-32 32-32Z" p-id="21492',
    top: 'M1170.285714 36.571429a36.571429 36.571429 0 0 1-36.571428 36.571428H36.571429a36.571429 36.571429 0 0 1 0-73.142857h1097.142857a36.571429 36.571429 0 0 1 36.571428 36.571429z m-219.428571 146.285714v512a36.571429 36.571429 0 0 1-36.571429 36.571428h-219.428571a36.571429 36.571429 0 0 1-36.571429-36.571428v-512a36.571429 36.571429 0 0 1 36.571429-36.571429h219.428571a36.571429 36.571429 0 0 1 36.571429 36.571429z m-438.857143 0v804.571428a36.571429 36.571429 0 0 1-36.571429 36.571429h-219.428571a36.571429 36.571429 0 0 1-36.571429-36.571429v-804.571428a36.571429 36.571429 0 0 1 36.571429-36.571429h219.428571a36.571429 36.571429 0 0 1 36.571429 36.571429z',
    topStretch: 'M672 352a128 128 0 0 1 128 128v320a128 128 0 0 1-128 128h-320a128 128 0 0 1-128-128v-320a128 128 0 0 1 128-128h320z m0 64h-320a64 64 0 0 0-64 64v320a64 64 0 0 0 64 64h320a64 64 0 0 0 64-64v-320a64 64 0 0 0-64-64zM128 160h768a32 32 0 1 0 0-64H128a32 32 0 0 0 0 64z',
    right: 'M928 0a32 32 0 0 1 32 32v960a32 32 0 0 1-64 0V32a32 32 0 0 1 32-32z m-576 192h448a32 32 0 0 1 32 32v192a32 32 0 0 1-32 32h-448a32 32 0 0 1-32-32v-192a32 32 0 0 1 32-32z m-256 384h704a32 32 0 0 1 32 32v192a32 32 0 0 1-32 32H96a32 32 0 0 1-32-32v-192A32 32 0 0 1 96 576z',
    rightStretch: 'M544 224a128 128 0 0 1 128 128v320a128 128 0 0 1-128 128h-320a128 128 0 0 1-128-128v-320a128 128 0 0 1 128-128h320z m0 64h-320a64 64 0 0 0-64 64v320a64 64 0 0 0 64 64h320a64 64 0 0 0 64-64v-320a64 64 0 0 0-64-64z M896 128m32 0l0 0q32 0 32 32l0 704q0 32-32 32l0 0q-32 0-32-32l0-704q0-32 32-32Z',
    bottom: 'M1170.285714 987.428571a36.571429 36.571429 0 0 0-36.571428-36.571428H36.571429a36.571429 36.571429 0 0 0 0 73.142857h1097.142857a36.571429 36.571429 0 0 0 36.571428-36.571429z m-219.428571-146.285714v-512a36.571429 36.571429 0 0 0-36.571429-36.571428h-219.428571a36.571429 36.571429 0 0 0-36.571429 36.571428v512a36.571429 36.571429 0 0 0 36.571429 36.571429h219.428571a36.571429 36.571429 0 0 0 36.571429-36.571429z m-438.857143 0V36.571429a36.571429 36.571429 0 0 0-36.571429-36.571429h-219.428571a36.571429 36.571429 0 0 0-36.571429 36.571429v804.571428a36.571429 36.571429 0 0 0 36.571429 36.571429h219.428571a36.571429 36.571429 0 0 0 36.571429-36.571429z',
    bottomStretch: 'M672 96a128 128 0 0 1 128 128v320a128 128 0 0 1-128 128h-320a128 128 0 0 1-128-128v-320a128 128 0 0 1 128-128h320z m0 64h-320a64 64 0 0 0-64 64v320a64 64 0 0 0 64 64h320a64 64 0 0 0 64-64v-320a64 64 0 0 0-64-64zM128 928h768a32 32 0 1 0 0-64H128a32 32 0 1 0 0 64z',
    verticalCenter: 'M960 128l0 64-832 0L128 128zM960 896l0 64-832 0 0-64z M832 384m0 64l0 192q0 64-64 64l-448 0q-64 0-64-64l0-192q0-64 64-64l448 0q64 0 64 64Z',
    verticalStretch: 'M670.421333 353.578667v316.842666H353.578667V353.578667h316.842666z m40.021334-71.978667H313.6a32 32 0 0 0-32 32v396.842667a32 32 0 0 0 32 32h396.842667a32 32 0 0 0 32-32V313.6a32 32 0 0 0-32-32zM904.021333 840.021333H120.021333a7.978667 7.978667 0 0 0-8.021333 7.978667v56.021333c0 4.394667 3.584 7.978667 8.021333 7.978667h784a7.978667 7.978667 0 0 0 7.978667-8.021333v-55.978667a7.978667 7.978667 0 0 0-8.021333-8.021333zM904.021333 112H120.021333a8.021333 8.021333 0 0 0-8.021333 8.021333v55.978667c0 4.437333 3.584 8.021333 8.021333 8.021333h784a7.978667 7.978667 0 0 0 7.978667-8.021333V119.978667a7.978667 7.978667 0 0 0-8.021333-7.978667z',
    horizontalCenter: 'M128 128h64v832H128zM896 128h64v832h-64z M384 256m64 0l192 0q64 0 64 64l0 448q0 64-64 64l-192 0q-64 0-64-64l0-448q0-64 64-64Z',
    horizontalStretch: 'M697.088 670.421333H380.16V353.578667h316.885333v316.842666z m71.978667 40.021334V313.6a32 32 0 0 0-32-32H340.224a32 32 0 0 0-32 32v396.842667a32 32 0 0 0 32 32h396.842667a32 32 0 0 0 32-32zM210.688 904.021333V120.021333a8.021333 8.021333 0 0 0-8.021333-8.021333H146.645333a8.021333 8.021333 0 0 0-7.978666 8.021333v784c0 4.394667 3.584 7.978667 8.021333 7.978667H202.666667a7.978667 7.978667 0 0 0 8.021333-8.021333zM938.666667 904.021333V120.021333a7.978667 7.978667 0 0 0-8.021334-8.021333H874.666667a7.978667 7.978667 0 0 0-8.021334 8.021333v784c0 4.394667 3.584 7.978667 8.021334 7.978667h56.021333a7.978667 7.978667 0 0 0 7.978667-8.021333z',
    clearColor: 'M0 0h341.333333v341.333333H0z M0 682.666667h341.333333v341.333333H0z M682.666667 0h341.333333v341.333333H682.666667z M682.666667 682.666667h341.333333v341.333333H682.666667z M341.333333 341.333333h341.333334v341.333334H341.333333z',
    byPass: 'M323.86 326.69m-179.24 0a179.24 179.24 0 1 0 358.48 0 179.24 179.24 0 1 0-358.48 0Z M984.95 29.09L751.56 57.07c-7.38 0.88-10.5 9.89-5.24 15.15l82.75 82.75c-15.16 20.65-27.79 43.04-37.71 66.99-16.2 39.1-24.41 80.39-24.41 122.71v165.59c0 141.52-115.13 256.65-256.65 256.65H342.75c-42.63 0-84.19 8.33-123.53 24.75s-74.48 40.12-104.46 70.42l-65.53 66.26c-12.43 12.57-12.32 32.83 0.25 45.25 6.24 6.17 14.37 9.25 22.5 9.25s16.49-3.17 22.75-9.5l65.53-66.26c47.88-48.41 114.39-76.18 182.48-76.18h167.55c85.65 0 166.17-33.35 226.73-93.92s93.92-141.08 93.92-226.73V344.66c0-52.03 15.39-101.69 44-143.81l76.77 76.77c5.26 5.26 14.26 2.14 15.15-5.24l27.98-233.39c0.69-5.73-4.17-10.59-9.91-9.91z',
    muteNode: 'M774.929 560.071c3.905-3.905 10.237-3.905 14.142 0L956.93 727.93c3.905 3.905 3.905 10.237 0 14.142L789.07 909.93a10 10 0 0 1-7.071 2.929c-5.523 0-10-4.477-10-10V771.693l-189.326-0.454c-59.193-0.142-109.479-38.083-128.033-90.944L519 615.936v19.304c0 34.933 27.992 63.341 62.79 63.988l1.057 0.011 189.153 0.454v-132.55a10 10 0 0 1 2.699-6.834zM174 332c-60.751 0-110-49.249-110-110s49.249-110 110-110c48.143 0 89.063 30.928 103.974 74H383c74.36 0 134.78 59.678 135.982 133.751L519 322v28.064l-72 72V322c0-34.993-28.084-63.426-62.942-63.991L383 258l-105.027 0.002C263.062 301.072 222.143 332 174 332z m0-148c-20.987 0-38 17.013-38 38s17.013 38 38 38 38-17.013 38-38-17.013-38-38-38zM205.986 796.014c-13.919-13.918-14.058-36.398-0.418-50.487l0.418-0.424 509.117-509.117c14.058-14.06 36.852-14.06 50.911 0 13.919 13.918 14.058 36.398 0.418 50.487l-0.418 0.424-509.117 509.117c-14.058 14.06-36.852 14.06-50.911 0z',
    pin: 'M648.728381 130.779429a73.142857 73.142857 0 0 1 22.674286 15.433142l191.561143 191.756191a73.142857 73.142857 0 0 1-22.137905 118.564571l-67.876572 30.061715-127.341714 127.488-10.093714 140.239238a73.142857 73.142857 0 0 1-124.684191 46.445714l-123.66019-123.782095-210.724572 211.699809-51.833904-51.614476 210.846476-211.821714-127.926857-128.024381a73.142857 73.142857 0 0 1 46.299428-124.635429l144.237715-10.776381 125.074285-125.220571 29.379048-67.779048a73.142857 73.142857 0 0 1 96.207238-38.034285z m-29.086476 67.120761l-34.913524 80.530286-154.087619 154.331429-171.398095 12.751238 303.323428 303.542857 12.044191-167.399619 156.233143-156.428191 80.384-35.59619-191.585524-191.73181z',
    toggleArrow: 'M262.144 405.504l255.68-170.432a128 128 0 0 1 198.976 106.496v340.864a128 128 0 0 1-199.008 106.496l-255.648-170.432a128 128 0 0 1 0-212.992z'
  };

  // Utility functions for SVG creation, position calculation and color handling
  const utils = {
    // Creates SVG elements with specified attributes
    createSVGElement(
      tag: string,
      attributes: Record<string, string> = {}
    ): SVGElement {
      const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
      
      Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
      
      return element;
    },
    
    // Make a color deeper/darker for visual effects
    getDeeperColor(hexColor: string): string {
      if (!hexColor || hexColor.startsWith('linear-gradient') || !hexColor.startsWith('#')) {
        return '#3a3a3a';
      }
      
      try {
        // Remove # prefix
        const hex = hexColor.slice(1);
        
        // Convert hex to RGB
        const bigint = parseInt(hex, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        
        // Make darker by reducing RGB values
        const darkerR = Math.max(0, Math.floor(r * 0.7));
        const darkerG = Math.max(0, Math.floor(g * 0.7));
        const darkerB = Math.max(0, Math.floor(b * 0.7));
        
        // Convert back to hex
        return `#${((darkerR << 16) | (darkerG << 8) | darkerB).toString(16).padStart(6, '0')}`;
      } catch (e) {
        return '#3a3a3a';
      }
    },
    
    /**
     * Creates an SVG icon element based on the provided ID
     * @param id - The identifier used to lookup the SVG path in SVG_PATHS
     * @param size - The width and height of the SVG element (default: 20px)
     * @returns A configured SVGSVGElement ready to be added to the DOM
     */
    createSVG(id: string, size = 20): SVGSVGElement {
      // Create the main SVG element with specified dimensions and viewBox
      const svg = this.createSVGElement("svg", {
        'width': size.toString(),
        'height': size.toString(),
        'viewBox': '0 0 1024 1024'
      }) as SVGSVGElement;
      
      // Set relative positioning to work within container elements
      svg.style.position = 'relative';
      svg.style.zIndex = '1';
      
      // If a path definition exists for this ID, create and add the path element
      if (SVG_PATHS[id]) {
        const path = this.createSVGElement("path", {
          'd': SVG_PATHS[id]
        });
        // Apply the icon color from configuration
        path.style.fill = CONFIG.colors.icon;
        svg.appendChild(path);
      }
      
      return svg;
    },

    // Determines the relative position of each alignment icon in the circular UI layout
    // Maps each icon index (0-11) to a specific [x,y] coordinate relative to the center
    // Returns null for indices outside the valid range (12 alignment icons total)
    calculatePosition(index: number): [number, number] | null {
      const { iconSize, spacing } = CONFIG;
      const halfSize = iconSize / 2;
      const effectiveSpacing = spacing + halfSize;

      if (index >= 12) {
        return null;
      }
      
      const positions: [number, number][] = [
        [-effectiveSpacing, -halfSize - iconSize - 5],  // Left top
        [-effectiveSpacing, -halfSize],                 // Left middle
        [-effectiveSpacing, halfSize + 5],              // Left bottom
        [-halfSize - iconSize - 5, -effectiveSpacing],  // Top left
        [-halfSize, -effectiveSpacing],                 // Top middle
        [halfSize + 5, -effectiveSpacing],              // Top right
        [effectiveSpacing - iconSize, -halfSize - iconSize - 5],  // Right top
        [effectiveSpacing - iconSize, -halfSize],                 // Right middle
        [effectiveSpacing - iconSize, halfSize + 5],              // Right bottom
        [-halfSize - iconSize - 5, effectiveSpacing - iconSize],  // Bottom left
        [-halfSize, effectiveSpacing - iconSize],                 // Bottom middle
        [halfSize + 5, effectiveSpacing - iconSize],              // Bottom right
      ];

      return positions[index] || [0, 0];
    },

    // Adjusts position coordinates to ensure an element stays within the viewport boundaries
    // Adds margin padding to prevent elements from touching the edge of the screen
    keepInViewport(x: number, y: number, entireWidth: number, entireHeight: number): [number, number] {
      const margin = 20;
      return [
        Math.max(margin, Math.min(x, window.innerWidth - entireWidth - margin)),
        Math.max(margin, Math.min(y, window.innerHeight - entireHeight - margin))
      ];
    },
    
    calculateUIBoundingBox(centerX: number, centerY: number) {
      const { iconSize, spacing } = CONFIG;
      const effectiveSpacing = spacing + iconSize / 2;

      const width = effectiveSpacing * 2;
      const height = effectiveSpacing * 2;

      const colorPickerHeight = 50;
      const totalHeight = height + colorPickerHeight + 15;

      const left = centerX - effectiveSpacing;
      const top = centerY - effectiveSpacing;
      
      return {
        width,
        height: totalHeight,
        left,
        top
      };
    },
    
    // Bezier easing function implementation - common utility function for animations
    cubicBezier(_x1: number, y1: number, _x2: number, y2: number, t: number): number {
      const p0 = 0;
      const p1 = y1;
      const p2 = y2;
      const p3 = 1;
      
      return p0 * Math.pow(1 - t, 3) + 
             3 * p1 * Math.pow(1 - t, 2) * t + 
             3 * p2 * (1 - t) * Math.pow(t, 2) + 
             p3 * Math.pow(t, 3);
    },
    
    // Rotate element with animation - common utility function
    animateRotation(element: SVGElement, targetDegree: number, stateVar: keyof typeof state, removeExpanded = false) {
      if (!element) return;
      
      // Cancel existing animation
      if (state.animationFrameId) {
        cancelAnimationFrame(state.animationFrameId);
        state.animationFrameId = null;
      }
      
      // Use the appropriate state variable for start degree
      const startDegree = state[stateVar] ? 0 : 180;
      const duration = 500;
      const startTime = performance.now();
      
      if (removeExpanded) {
        element.classList.remove('expanded');
      }
      
      // Animation frame function
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Use easing function for natural animation
        const easeProgress = this.cubicBezier(0.34, 1.56, 0.64, 1, progress);
        const currentDegree = startDegree + (targetDegree - startDegree) * easeProgress;
        
        element.style.transform = `rotate(${currentDegree}deg)`;
        
        if (progress < 1) {
          state.animationFrameId = requestAnimationFrame(animate);
        } else {
          state.animationFrameId = null;
        }
      };
      
      state.animationFrameId = requestAnimationFrame(animate);
    },
  };

  // DOM manipulation and UI handling functions
  const dom = {
    // Creates a DOM element with className and attributes
    createElement(
      tag: string, 
      className: string = '', 
      attributes: Record<string, string> = {}
    ): HTMLElement {
      const element = document.createElement(tag);
      if (className) element.className = className;
      
      Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
      
      return element;
    },
    
    // Creates the main container for the alignment UI
    createContainer() {
      if (!state.container) {
        state.container = this.createElement('div', 'aligner-container');
        
        // Add color selection container
        const colorCirclesContainer = this.createElement('div', 'color-circles-container');
        state.container.appendChild(colorCirclesContainer);
        
        // Add utility icons container
        const utilCirclesContainer = this.createElement('div', 'util-circles-container');
        state.container.appendChild(utilCirclesContainer);
        
        document.body.appendChild(state.container);
      }
    },
    
    // Injects CSS styles for the alignment UI into the document head
    injectStyles() {
      if (state.styleElement) return;

      state.styleElement = document.createElement('style');
      state.styleElement.textContent = `
        .aligner-container {
          position: fixed;
          z-index: 99999;
          pointer-events: none;
          display: none;
          filter: drop-shadow(0 2px 6px rgba(0,0,0,0.3));
        }
        
        .aligner-icon {
          position: absolute;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: ${CONFIG.transition};
          cursor: pointer;
          border-radius: 6px;
          pointer-events: auto;
        }
        
        .aligner-icon-circle {
          position: relative !important;
          transform: none !important;
          margin: 0 4px !important;
          border-radius: 50%;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
          transition: all 0.2s ease;
        }
        
        .aligner-icon-circle:hover {
          transform: scale(1.1) !important;
        }
        
        .aligner-icon-bg {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 6px;
          background-color: ${CONFIG.colors.bg};
          transition: background-color 0.2s ease;
        }
        
        .aligner-icon-circle .aligner-icon-bg {
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          transition: box-shadow 0.2s ease, transform 0.2s ease;
        }

        .color-circles-container {
          position: absolute;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: space-evenly;
          gap: 0;
          padding: 6px 10px;
          pointer-events: auto;
          background: rgba(0, 0, 0, 0.6);
          border-radius: 10px;
          width: auto;
        }
        
        .util-circles-container {
          position: absolute;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: space-evenly;
          gap: 0;
          padding: 6px 10px;
          pointer-events: auto;
          background: rgba(0, 0, 0, 0.6);
          border-radius: 10px;
          width: auto;
          transition: transform 0.3s ease, opacity 0.3s ease;
        }
        
        .util-circles-container.collapsed {
          transform: translateX(-10px);
          opacity: 0;
          pointer-events: none;
        }
        
        .toggle-arrow {
          transition: none;
          transform-origin: center;
        }
        
        .toggle-arrow.expanded {
          /* Controlled only by JS */
        }
        
        .aligner-notification {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          padding: 10px 20px;
          border-radius: 4px;
          font-size: 14px;
          z-index: 10000;
          transition: opacity 0.3s ease;
          background-color: rgba(255, 0, 0, 0.8);
          color: white;
        }
      `;
      document.head.appendChild(state.styleElement);
    },

    // Create specific icon types
    createMoonIcon(size: number): HTMLElement {
      const bg = this.createElement('div', 'aligner-icon-bg');
      bg.style.background = 'transparent';
      bg.style.width = `${size}px`;
      bg.style.height = `${size}px`;
      
      const moonContainer = this.createElement('div', '', {
        style: 'position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: 50%;'
      });
      
      // Create moon base circle
      const moonBase = this.createElement('div', '', {
        style: `
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background-color: ${CONFIG.colors.circle9};
          box-shadow: 0 0 5px rgba(255, 215, 0, 0.3);
        `
      });
      
      // Create a mask circle, offset to create a crescent moon shape
      const moonMask = this.createElement('div', '', {
        style: `
          position: absolute;
          top: -25%;
          left: -25%;
          width: 95%;
          height: 95%;
          border-radius: 50%;
          background-color: ${CONFIG.colors.bg};
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1);
        `
      });
      
      moonContainer.appendChild(moonBase);
      moonContainer.appendChild(moonMask);
      bg.appendChild(moonContainer);
      
      return bg;
    },

    createClearColorIcon(size: number): HTMLElement {
      const bg = this.createElement('div', 'aligner-icon-bg');
      bg.style.background = 'transparent';
      
      const circleContainer = this.createElement('div', '', {
        style: 'position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: 50%;'
      });
      
      // Create black background circle
      const circleBase = this.createElement('div', '', {
        style: `
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background-color: rgba(12, 12, 12, 0.95);
          box-shadow: 0 0 1px rgba(255, 255, 255, 0.2);
        `
      });
      
      // Create white icon using SVG path
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute('width', `${size * 0.8}`);
      svg.setAttribute('height', `${size * 0.8}`);
      svg.setAttribute('viewBox', '0 0 1024 1024');
      svg.style.position = 'absolute';
      svg.style.top = '50%';
      svg.style.left = '50%';
      svg.style.transform = 'translate(-50%, -50%) scale(0.8)';
      svg.style.zIndex = '1';
      
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute('d', SVG_PATHS.clearColor);
      path.style.fill = '#ffffff'; 
      path.style.strokeWidth = '4';
      
      svg.appendChild(path);
      
      circleContainer.appendChild(circleBase);
      circleContainer.appendChild(svg);
      bg.appendChild(circleContainer);
      
      return bg;
    },

    createFunctionIcon(id: string, size: number): HTMLElement {
      const bg = this.createElement('div', 'aligner-icon-bg');
      bg.style.background = CONFIG.colors.bg;
      
      // Map circular icon IDs to SVG paths
      const svgIcon = id === 'bypassCircle' ? 'byPass' : 
                    id === 'muteCircle' ? 'muteNode' : 'pin';
      
      const svg = utils.createSVG(svgIcon, size * 0.8);
      svg.style.position = 'absolute';
      svg.style.top = '50%';
      svg.style.left = '50%';
      svg.style.transform = 'translate(-50%, -50%)';
      
      bg.appendChild(svg);
      return bg;
    },

    createToggleArrowIcon(size: number): HTMLElement {
      const bg = this.createElement('div', 'aligner-icon-bg');
      bg.style.background = CONFIG.colors.bg;
      
      // Create arrow icon container
      const svgContainer = document.createElement('div');
      svgContainer.style.position = 'absolute';
      svgContainer.style.top = '50%';
      svgContainer.style.left = '50%';
      svgContainer.style.transform = 'translate(-50%, -50%)';
      svgContainer.style.width = '100%';
      svgContainer.style.height = '100%';
      svgContainer.style.display = 'flex';
      svgContainer.style.alignItems = 'center';
      svgContainer.style.justifyContent = 'center';
      
      // Create arrow icon
      const svg = utils.createSVG('toggleArrow', size * 0.8);
      svg.classList.add('toggle-arrow');
      
      svgContainer.appendChild(svg);
      bg.appendChild(svgContainer);
      
      return bg;
    },

    createColorIcon(id: string): HTMLElement {
      const bg = this.createElement('div', 'aligner-icon-bg');
      
      // Extract color name from ID and look up the corresponding color
      const colorName = id.replace('Circle', '').toLowerCase();
      const colorKey = CONFIG.colorMap[colorName];
      
      if (colorKey && CONFIG.colors[colorKey]) {
        bg.style.backgroundColor = CONFIG.colors[colorKey];
      } else {
        console.warn(`Unknown color circle: ${id}`);
        bg.style.backgroundColor = '#555555';
      }
      
      return bg;
    },

    // Creates an icon button element based on the provided icon info
    createIcon(iconInfo: Icon, _index?: number, colorCirclesFragment?: DocumentFragment, utilCirclesFragment?: DocumentFragment, mainFragment?: DocumentFragment): HTMLElement {
      const { id, type } = iconInfo;
      const isCircle = id.includes('Circle');
      const size = isCircle ? CONFIG.iconSize / 2 : CONFIG.iconSize;

      // Create icon wrapper element
      const iconWrapper = this.createElement('div', `aligner-icon ${isCircle ? 'aligner-icon-circle' : ''}`);
      iconWrapper.dataset.id = id;
      iconWrapper.dataset.type = type;
      iconWrapper.style.width = `${size}px`;
      iconWrapper.style.height = `${size}px`;
      iconWrapper.style.pointerEvents = 'auto';

      // Create background based on icon type
      let bg;
      
      if (isCircle) {
        if (id === 'moonCircle') {
          bg = this.createMoonIcon(size);
        } else if (id === 'clearCircle') {
          bg = this.createClearColorIcon(size);
        } else if (id === 'bypassCircle' || id === 'muteCircle' || id === 'pinCircle') {
          bg = this.createFunctionIcon(id, size);
        } else if (id === 'toggleArrowCircle') {
          bg = this.createToggleArrowIcon(size);
        } else {
          // Regular color circle
          bg = this.createColorIcon(id);
        }
      } else {
        // Non-circular alignment icons
        bg = this.createElement('div', 'aligner-icon-bg');
      }

      iconWrapper.appendChild(bg);

      // Add SVG for non-circular icons
      if (!isCircle) {
        const svg = utils.createSVG(id);
        iconWrapper.appendChild(svg);
      }

      // Add the icon to the appropriate container
      if (isCircle) {
        if (type === 'color' || type === 'toggle') {
          if (colorCirclesFragment) {
            colorCirclesFragment.appendChild(iconWrapper);
          }
        } else {
          if (utilCirclesFragment) {
            utilCirclesFragment.appendChild(iconWrapper);
          }
        }
      } else if (mainFragment) {
        mainFragment.appendChild(iconWrapper);
      }
      
      return iconWrapper;
    },

    // Creates all alignment and color icons and appends them to the UI
    createAllIcons() {
      // Use DocumentFragment to reduce DOM reflows
      const mainFragment = document.createDocumentFragment();
      const colorCirclesFragment = document.createDocumentFragment();
      const utilCirclesFragment = document.createDocumentFragment();
      
      ICONS.forEach((iconInfo, index) => {
        const icon = this.createIcon(iconInfo, index, colorCirclesFragment, utilCirclesFragment, mainFragment);
        state.icons[iconInfo.id] = icon;
      });
      
      // Add fragments to containers
      const colorCirclesContainer = state.container?.querySelector('.color-circles-container');
      if (colorCirclesContainer) {
        colorCirclesContainer.appendChild(colorCirclesFragment);
      }
      
      const utilCirclesContainer = state.container?.querySelector('.util-circles-container');
      if (utilCirclesContainer) {
        utilCirclesContainer.appendChild(utilCirclesFragment);
      }
      
      // Add non-circular icons to main container
      if (state.container) {
        state.container.appendChild(mainFragment);
      }
      
      // Initialize utility icons display state
      this.updateUtilIconsVisibility();
    },
    
    // Update the position and visibility of utility icon containers
    updateUtilIconsVisibility(immediate = false) {
      const utilCirclesContainer = state.container?.querySelector('.util-circles-container');
      if (utilCirclesContainer instanceof HTMLElement) {
        // Now safe to access style property
        if (immediate) {
          const originalTransition = utilCirclesContainer.style.transition;
          utilCirclesContainer.style.transition = 'none';
          
          // Apply visibility state
          if (state.isUtilsExpanded) {
            utilCirclesContainer.classList.remove('collapsed');
            const toggleArrow = state.container?.querySelector('.toggle-arrow');
            if (toggleArrow instanceof SVGElement) {
              toggleArrow.style.transition = 'none';
              // Set rotation angle directly, don't use class
              toggleArrow.style.transform = `rotate(180deg)`;
            }
          } else {
            utilCirclesContainer.classList.add('collapsed');
            const toggleArrow = state.container?.querySelector('.toggle-arrow');
            if (toggleArrow instanceof SVGElement) {
              toggleArrow.style.transition = 'none';
              // Set rotation angle directly, don't use class
              toggleArrow.style.transform = `rotate(0deg)`;
            }
          }
          
          // Force reflow
          utilCirclesContainer.offsetHeight;
          // Get toggleArrow element - defined externally for use in subsequent code
          const toggleArrow = state.container?.querySelector('.toggle-arrow');
          if (toggleArrow instanceof HTMLElement) {
            toggleArrow.offsetHeight; // Force reflow
          }
          
          // Restore transition effect
          setTimeout(() => {
            utilCirclesContainer.style.transition = originalTransition;
          }, 50);
        } else {
          // Normal apply visibility state
          if (state.isUtilsExpanded) {
            utilCirclesContainer.classList.remove('collapsed');
          } else {
            utilCirclesContainer.classList.add('collapsed');
          }
          // Rotation animation handled by animateRotation in toggleUtilIcons
        }
      }
    },
    
    // Toggle utility icons display state
    toggleUtilIcons() {
      state.isUtilsExpanded = !state.isUtilsExpanded;
      this.updateUtilIconsVisibility();
      
      // Add rotation animation
      const toggleArrow = state.container?.querySelector('.toggle-arrow');
      if (toggleArrow instanceof SVGElement) {
        // Use JS animation method
        this.animateRotation(toggleArrow, state.isUtilsExpanded ? 180 : 0);
      }
      
      // Save state using utility function
      try {
        setStorageValue('ComfyUI-Align.isUtilsExpanded', state.isUtilsExpanded ? 'true' : 'false');
      } catch (e) {
        console.warn("Failed to save state to storage", e);
      }
    },

    // Rotate element using JS animation
    animateRotation(element: SVGElement, targetDegree: number) {
      utils.animateRotation(element, targetDegree, 'isUtilsExpanded', true);
    },
    
    // Displays a temporary notification message to the user
    showNotification(message: string, isError = true) {
      if (!message) return;
      
      const notification = document.createElement('div');
      notification.className = 'aligner-notification';
      notification.textContent = message;
      
      if (!isError) {
        notification.style.backgroundColor = 'rgba(21, 87, 36, 0.8)';
      }
      
      document.body.appendChild(notification);

      notification.style.opacity = '1';
      
      setTimeout(() => {
        notification.style.opacity = '0';
        notification.addEventListener('transitionend', () => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, { once: true });
      }, 3000);
    },

    // Initializes the UI components if not already initialized
    initializeOnce() {
      if (state.initialized) return;
      
      try {
        this.injectStyles();
        this.createContainer();
        
        // Safely load state using utility function
        try {
          const savedState = getStorageValue('ComfyUI-Align.isUtilsExpanded');
          if (savedState !== null) {
            state.isUtilsExpanded = savedState === 'true';
          }
        } catch (e) {
          console.warn("Failed to load state from storage", e);
        }
        
        this.createAllIcons();
        
        if (state.container) {
          state.container.style.display = 'none';
        }
        
        if (state.lastX === 0 && state.lastY === 0) {
          state.lastX = window.innerWidth / 2;
          state.lastY = window.innerHeight / 2;
        }
        
        state.initialized = true;
        events.handleIconInteraction();
      } catch (error) {
        console.error("Failed to initialize Aligner plugin:", error);
        AlignerPlugin.destroy();
      }
    },

    // Makes the alignment UI visible and positions it
    showUI() {
      if (!state.container) return;
      
      state.container.style.display = 'block';
      state.visible = true;
      
      actions.updateIconPositions();
      this.updateUtilIconsVisibility(true);
      
      const toggleArrow = state.container.querySelector('.toggle-arrow');
      if (toggleArrow instanceof SVGElement) {
        toggleArrow.style.transform = `rotate(${state.isUtilsExpanded ? 180 : 0}deg)`;
      }
      
      setTimeout(() => {
        if (state.container) {
          state.container.style.pointerEvents = 'auto';
        }
      }, 100);
    },
    
    // Hides the alignment UI
    hideUI() {
      if (!state.container) return;
      
      state.container.style.display = 'none';
      state.container.style.pointerEvents = 'none';
      state.visible = false;
    },
    
    // Toggles the visibility of the alignment UI
    toggleVisibility() {
      if (state.visible) {
        this.hideUI();
      } else {
        this.showUI();
      }
    },
    
    // Removes all DOM elements and resets the state
    cleanupDOM() {
      if (state.container) {
        document.body.removeChild(state.container);
        state.container = null;
      }
      
      if (state.styleElement) {
        document.head.removeChild(state.styleElement);
        state.styleElement = null;
      }
      
      state.visible = false;
      state.icons = {};
      state.initialized = false;
    }
  };

  const actions = {
    // Executes node operations on selected nodes with error handling
    performNodeOperation(
      operationFn: (nodes: ComfyNode[]) => void, 
      requireMultipleNodes = true
    ): ActionResult {
      try {
        const appInstance = this.getComfyUIAppInstance();
        if (!appInstance) {
          return { success: false, message: t('alignNodes.errors.appInstance') };
        }

        const selectedNodes = this.getSelectedNodes(appInstance);
        
        if (selectedNodes.length === 0) {
          return { success: false, message: t('alignNodes.errors.noNodesSelected') };
        }
        
        if (requireMultipleNodes && selectedNodes.length < 2) {
          return { success: false, message: t('alignNodes.errors.selectTwoNodes') };
        }
        
        if (selectedNodes.some(node => (node as any).flags?.pinned)) {
          return { success: false, message: t('alignNodes.errors.someNodesPinned') };
        }

        operationFn(selectedNodes);
        appInstance.graph.setDirtyCanvas(true, true);
        
        return { success: true };
      } catch (error) {
        console.error("Node operation failed:", error);
        return { success: false, message: t('alignNodes.errors.operationFailed', {error: (error as Error).message}) };
      }
    },

    // Toggle bypass state of selected nodes
    toggleNodesBypass(): ActionResult {
      return this.toggleNodeProperty('mode', 4, 0);
    },

    // Executes color operations on selected nodes and groups with error handling
    performColorOperation(
      operationFn: (nodes: ComfyNode[], groups: ComfyGroup[]) => void
    ): ActionResult {
      try {
        const appInstance = this.getComfyUIAppInstance();
        if (!appInstance) {
          return { success: false, message: t('alignNodes.errors.appInstance') };
        }

        const selectedNodes = this.getSelectedNodes(appInstance);
        const selectedGroups = this.getSelectedGroups(appInstance) as ComfyGroup[];
        
        if (selectedNodes.length === 0 && selectedGroups.length === 0) {
          return { success: false, message: t('alignNodes.errors.selectOneNode') };
        }
        
        operationFn(selectedNodes, selectedGroups);
        appInstance.graph.setDirtyCanvas(true, true);
        
        return { success: true };
      } catch (error) {
        console.error("Color operation failed:", error);
        return { success: false, message: t('alignNodes.errors.operationFailed', {error: (error as Error).message}) };
      }
    },

    // Toggles the alignment UI visibility
    toggle() {
      dom.initializeOnce();
      
      dom.toggleVisibility();
    },
    
    // Updates the positions of all alignment icons based on mouse position
    updateIconPositions() {
      const boundingBox = utils.calculateUIBoundingBox(state.lastX, state.lastY);
      
      // Prevent UI from going outside viewport bounds
      const [safeX, safeY] = utils.keepInViewport(
        boundingBox.left, 
        boundingBox.top,
        boundingBox.width,
        boundingBox.height
      );
      
      // Calculate relative positions for alignment icons
      const { spacing, iconSize } = CONFIG;
      const halfSize = iconSize / 2;
      const effectiveSpacing = spacing + halfSize;
      
      const centerX = safeX + effectiveSpacing;
      const centerY = safeY + effectiveSpacing;
      
      // Position each non-circle icon
      Object.entries(state.icons).forEach(([id, icon], index) => {
        if (id.includes('Circle')) return;
        
        const position = utils.calculatePosition(index);
        if (position) {
          const [relX, relY] = position;
          icon.style.transform = `translate(${centerX + relX}px, ${centerY + relY}px)`;
        }
      });
      
      // Position color circles container
      const colorCirclesContainer = state.container?.querySelector('.color-circles-container');
      if (colorCirclesContainer && colorCirclesContainer instanceof HTMLElement) {
        const colorX = centerX - (colorCirclesContainer.offsetWidth / 2);
        const colorY = centerY + spacing + halfSize + 15;
        colorCirclesContainer.style.transform = `translate(${colorX}px, ${colorY}px)`;
      }
      
      // Position utility circles container
      const utilCirclesContainer = state.container?.querySelector('.util-circles-container');
      if (utilCirclesContainer && utilCirclesContainer instanceof HTMLElement && colorCirclesContainer instanceof HTMLElement) {
        const utilX = centerX + colorCirclesContainer.offsetWidth / 2 + 10;
        const utilY = centerY + spacing + halfSize + 15;
        utilCirclesContainer.style.transform = `translate(${utilX}px, ${utilY}px)`;
      }
    },

    // Gets the ComfyUI application instance using various methods
    getComfyUIAppInstance() {
      if (window.app?.canvas && window.app?.graph) {
        return window.app;
      }

      if (window.LiteGraph?.LGraphCanvas?.active_canvas) {
        const canvas = window.LiteGraph.LGraphCanvas.active_canvas;
        if (canvas?.graph) {
          return { canvas, graph: canvas.graph };
        }
      }

      const canvasElement = document.querySelector(".litegraph.litegraph-canvas") as HTMLElement;
      if (canvasElement?.lgraphcanvas) {
        const canvas = canvasElement.lgraphcanvas;
        if (canvas?.graph) {
          return { canvas, graph: canvas.graph };
        }
      }
      
      return null;
    },
    
    // Retrieves selected nodes from the ComfyUI canvas
    getSelectedNodes(appInstance: ReturnType<typeof this.getComfyUIAppInstance>) {
      if (!appInstance) return [];
      
      if (appInstance.canvas.selected_nodes) {
        if (Array.isArray(appInstance.canvas.selected_nodes)) {
          return [...appInstance.canvas.selected_nodes];
        } else {
          return Object.values(appInstance.canvas.selected_nodes);
        }
      }

      const selectedNodes: unknown[] = [];
      if (appInstance.graph?._nodes) {
        for (const node of appInstance.graph._nodes) {
          if ('is_selected' in node && node.is_selected) {
            selectedNodes.push(node);
          }
        }
      }
      
      return selectedNodes;
    },
    
    // Retrieves selected groups from the ComfyUI canvas
    getSelectedGroups(appInstance: ReturnType<typeof this.getComfyUIAppInstance>) {
      if (!appInstance) return [];
      
      const selectedGroups: unknown[] = [];

      if (appInstance.canvas && 'selected_groups' in appInstance.canvas && Array.isArray(appInstance.canvas.selected_groups)) {
        return [...appInstance.canvas.selected_groups];
      }

      if (appInstance.graph && 'groups' in appInstance.graph && Array.isArray(appInstance.graph.groups)) {
        for (const group of appInstance.graph.groups) {
          if ('selected' in group && group.selected) {
            selectedGroups.push(group);
          }
        }
      }
      
      return selectedGroups;
    },

    // Routes alignment actions to the appropriate handler function
    handleAlignAction(action: string) {
      let result: ActionResult | undefined;
      
      switch(action) {
        case 'left':
          result = this.alignNodesToLeft();
          break;
        case 'right':
          result = this.alignNodesToRight();
          break;
        case 'top':
          result = this.alignNodesToTop();
          break;
        case 'bottom':
          result = this.alignNodesToBottom();
          break;
        case 'horizontalCenter':
          result = this.alignNodesToHorizontalCenter();
          break;
        case 'verticalCenter':
          result = this.alignNodesToVerticalCenter();
          break;
        case 'leftStretch':
          result = this.stretchNodesToLeft();
          break;
        case 'rightStretch':
          result = this.stretchNodesToRight();
          break;
        case 'topStretch':
          result = this.stretchNodesToTop();
          break;
        case 'bottomStretch':
          result = this.stretchNodesToBottom();
          break;
        case 'horizontalStretch':
          result = this.horizontalStretch();
          break;
        case 'verticalStretch':
          result = this.verticalStretch();
          break;
        case 'redCircle':
        case 'orangeCircle':
        case 'yellowCircle':
        case 'greenCircle':
        case 'cyanCircle':
        case 'blueCircle':
        case 'purpleCircle':
        case 'clearCircle':
          result = this.setNodesColor(action);
          break;
        case 'moonCircle':
          this.openNativeColorPicker();
          return;
        case 'toggleArrowCircle':
          dom.toggleUtilIcons();
          return;
        case 'bypassCircle':
          result = this.toggleNodesBypass();
          break;
        case 'muteCircle':
          result = this.toggleNodesMute();
          break;
        case 'pinCircle':
          result = this.toggleNodesPin();
          break;
        default:
          return;
      }
      
      if (result && !result.success) {
        dom.showNotification(result.message || t('alignNodes.errors.operationFailed', {error: "Unknown error"}), true);
      }
    },

    // Opens the browser's native color picker for applying custom colors
    openNativeColorPicker() {
      const appInstance = this.getComfyUIAppInstance();
      if (!appInstance) {
        dom.showNotification(t('alignNodes.errors.appInstance'));
        return;
      }

      const selectedNodes = this.getSelectedNodes(appInstance);
      const selectedGroups = this.getSelectedGroups(appInstance);
      
      if (selectedNodes.length === 0 && selectedGroups.length === 0) {
        dom.showNotification(t('alignNodes.errors.selectOneNode'));
        return;
      }

      const colorInput = document.createElement('input');
      colorInput.type = 'color';

      let initialColor = '#3355aa';
      if (selectedNodes.length > 0) {
        const firstNode = selectedNodes[0] as { color?: string };
        initialColor = firstNode.color?.replace(/rgba?\(.*\)/, '#000000') || '#3355aa';
      } else if (selectedGroups.length > 0) {
        const firstGroup = selectedGroups[0] as { color?: string };
        initialColor = firstGroup.color || '#3355aa';
      }
      
      colorInput.value = initialColor;
      colorInput.style.position = 'absolute';
      colorInput.style.visibility = 'hidden';
      document.body.appendChild(colorInput);

      const handleColorChange = (e: Event) => {
        const color = (e.target as HTMLInputElement).value;

        selectedNodes.forEach(node => {
          const nodeWithColor = node as { color?: string; bgcolor?: string };
          if (CONFIG.applyToHeader && CONFIG.applyToPanel) {
            nodeWithColor.color = utils.getDeeperColor(color);
            nodeWithColor.bgcolor = color;
          } else {
            if (CONFIG.applyToHeader) {
              nodeWithColor.color = color;
            }
            if (CONFIG.applyToPanel) {
              nodeWithColor.bgcolor = color;
            }
          }
        });

        selectedGroups.forEach(group => {
          (group as { color: string }).color = color;
        });

        appInstance.graph.setDirtyCanvas(true, true);
      };

      colorInput.addEventListener('input', handleColorChange);
      colorInput.addEventListener('change', () => {
        document.body.removeChild(colorInput);
      });
      
      colorInput.click();
    },

    alignNodesToLeft(): ActionResult {
      return this.performAlignOperation('left');
    },
    
    alignNodesToRight(): ActionResult {
      return this.performAlignOperation('right');
    },

    alignNodesToTop(): ActionResult {
      return this.performAlignOperation('top');
    },

    alignNodesToBottom(): ActionResult {
      return this.performAlignOperation('bottom');
    },
    
    stretchNodesToLeft(): ActionResult {
      return this.performAlignOperation('left', true);
    },

    stretchNodesToRight(): ActionResult {
      return this.performAlignOperation('right', true);
    },

    stretchNodesToTop(): ActionResult {
      return this.performAlignOperation('top', true);
    },

    stretchNodesToBottom(): ActionResult {
      return this.performAlignOperation('bottom', true);
    },
    
    alignNodesToHorizontalCenter(): ActionResult {
      return this.performAlignOperation('horizontalCenter');
    },

    alignNodesToVerticalCenter(): ActionResult {
      return this.performAlignOperation('verticalCenter');
    },
    stretchNodesHorizontally(nodes: ComfyNode[]): void {
      // Based on Alt key state, select the reference width
      let targetWidth: number;
      if (state.altKeyPressed) {
        // When Alt key is pressed, use the minimum width
        targetWidth = Math.min(...nodes.map(node => node.size[0]));
      } else {
        // By default, use the maximum width
        targetWidth = Math.max(...nodes.map(node => node.size[0]));
      }

      targetWidth = Math.max(targetWidth, CONFIG.minNodeSize.width);

      nodes.forEach(node => {
        if (node.size[0] !== targetWidth) {
          const centerX = node.pos[0] + (node.size[0] / 2);
          node.size[0] = targetWidth;
          node.pos[0] = centerX - (targetWidth / 2);
        }
      });
    },

    // Stretches selected nodes to have the same height
    stretchNodesVertically(nodes: ComfyNode[]): void {
      // Based on Alt key state, select the reference height
      let targetHeight: number;
      if (state.altKeyPressed) {
        // When Alt key is pressed, use the minimum height
        targetHeight = Math.min(...nodes.map(node => node.size[1]));
      } else {
        // By default, use the maximum height
        targetHeight = Math.max(...nodes.map(node => node.size[1]));
      }

      targetHeight = Math.max(targetHeight, CONFIG.minNodeSize.height);

      nodes.forEach(node => {
        if (node.size[1] !== targetHeight) {
          const centerY = node.pos[1] + (node.size[1] / 2);
          node.size[1] = targetHeight;
          node.pos[1] = centerY - (targetHeight / 2);
        }
      });
    },

    horizontalStretch(): ActionResult {
      return this.performAlignOperation('horizontalCenter', true);
    },

    verticalStretch(): ActionResult {
      return this.performAlignOperation('verticalCenter', true);
    },

    // Applies color to selected nodes and groups
    setNodesColor(colorType: string): ActionResult {
      return this.performColorOperation((nodes, groups) => {
        let color: string = '';
        // Extract color name from the button ID and convert to lowercase
        const colorName = colorType.replace('Circle', '').toLowerCase();

        // Special case: 'moon' is handled by the native color picker
        if (colorName === 'moon') {
          return { success: false, message: t('alignNodes.errors.operationFailed', {error: "Moon color should be handled by color picker"}) };
        }
        
        // Look up the actual color value using the color mapping
        const colorKey = CONFIG.colorMap[colorName];
        
        // Validate that the color exists in our configuration
        if (!colorKey || !CONFIG.colors[colorKey]) {
          return { success: false, message: t('alignNodes.errors.operationFailed', {error: `Unknown color type: ${colorType}`}) };
        }

        // Special case: 'black' means remove all colors (reset to default)
        if (colorName === 'clear') {
          // Remove colors from nodes
          nodes.forEach(node => {
            const nodeWithColor = node as { color?: string; bgcolor?: string };
            delete nodeWithColor.color;
            delete nodeWithColor.bgcolor;
          });
          
          // Remove colors from groups
          groups.forEach(group => {
            const groupWithColor = group as { color?: string };
            delete groupWithColor.color;
          });
        } else {
          // Get the actual color value from the configuration
          color = CONFIG.colors[colorKey];
          
          // Apply colors to nodes based on user settings
          nodes.forEach(node => {
            const nodeWithColor = node as { color?: string; bgcolor?: string };
            if (CONFIG.applyToHeader && CONFIG.applyToPanel) {
              // If both header and panel coloring is enabled, use a darker color for the header
              nodeWithColor.color = utils.getDeeperColor(color);
              nodeWithColor.bgcolor = color;
            } else {
              // Apply colors selectively based on settings
              if (CONFIG.applyToHeader) {
                nodeWithColor.color = color;
              }
              if (CONFIG.applyToPanel) {
                nodeWithColor.bgcolor = color;
              }
            }
          });
          
          // Apply colors to groups
          groups.forEach(group => {
            (group as { color: string }).color = color;
          });
        }
      });
    },

    performAlignOperation(
      type: 'left' | 'right' | 'top' | 'bottom' | 'horizontalCenter' | 'verticalCenter',
      isStretch: boolean = false
    ): ActionResult {
      // Universal alignment function that handles both alignment and stretching operations
      return this.performNodeOperation(nodes => {
        if (type === 'horizontalCenter') {
          if (isStretch) {
            this.stretchNodesHorizontally(nodes);
          } else {
            this.alignNodesToHorizontalCenterInternal(nodes);
          }
          return;
        }
        
        if (type === 'verticalCenter') {
          if (isStretch) {
            this.stretchNodesVertically(nodes);
          } else {
            this.alignNodesToVerticalCenterInternal(nodes);
          }
          return;
        }
        
        let posIndex = 0;
        let sizeIndex = 0;
        
        // Set axis indexes: 0 for horizontal (left/right), 1 for vertical (top/bottom)
        if (type === 'top' || type === 'bottom') {
          posIndex = 1;
          sizeIndex = 1;
        }
        
        let targetValue: number;
        
        if (type === 'left' || type === 'top') {
          // Find the leftmost/topmost position
          targetValue = Math.min(...nodes.map(node => node.pos[posIndex]));
          
          if (isStretch) {
            // Check if nodes are already aligned
            const isAligned = nodes.every(node => 
              Math.abs(node.pos[posIndex] - targetValue) < 1
            );
            
            if (isAligned) {
              // If nodes are already aligned, standardize their size to the minimum width/height
              const minSize = Math.min(...nodes.map(node => node.size[sizeIndex]));
              
              nodes.forEach(node => {
                if (node.size[sizeIndex] > minSize) {
                  node.size[sizeIndex] = minSize;
                }
              });
            } else {
              // Stretch unaligned nodes to the leftmost/topmost position
              nodes.forEach(node => {
                if (node.pos[posIndex] > targetValue) {
                  const rightEdge = node.pos[posIndex] + node.size[sizeIndex];
                  node.pos[posIndex] = targetValue;
                  const minSize = sizeIndex === 0 ? 
                    CONFIG.minNodeSize.width : CONFIG.minNodeSize.height;
                  const newSize = Math.max(rightEdge - targetValue, minSize);
                  node.size[sizeIndex] = newSize;
                }
              });
            }
          } else {
            // Simple alignment - move all nodes to the same position
            nodes.forEach(node => {
              node.pos[posIndex] = targetValue;
            });
          }
        } else { 
          // Find the rightmost/bottommost edge
          targetValue = Math.max(...nodes.map(node => node.pos[posIndex] + node.size[sizeIndex]));
          
          if (isStretch) {
            // Check if nodes are already aligned at the edge
            const isAligned = nodes.every(node => 
              Math.abs((node.pos[posIndex] + node.size[sizeIndex]) - targetValue) < 1
            );
            
            if (isAligned) {
              // If nodes are already aligned, standardize their size to the minimum width/height
              const minSize = Math.min(...nodes.map(node => node.size[sizeIndex]));
              
              nodes.forEach(node => {
                if (node.size[sizeIndex] > minSize) {
                  const edge = node.pos[posIndex] + node.size[sizeIndex];
                  node.size[sizeIndex] = minSize;
                  node.pos[posIndex] = edge - minSize;
                }
              });
            } else {
              // Stretch unaligned nodes to the rightmost/bottommost edge
              nodes.forEach(node => {
                if (node.pos[posIndex] + node.size[sizeIndex] < targetValue) {
                  const minSize = sizeIndex === 0 ? 
                    CONFIG.minNodeSize.width : CONFIG.minNodeSize.height;
                  const newSize = Math.max(targetValue - node.pos[posIndex], minSize);
                  node.size[sizeIndex] = newSize;
                }
              });
            }
          } else {
            // Simple alignment - align all nodes to the same edge
            nodes.forEach(node => {
              node.pos[posIndex] = targetValue - node.size[sizeIndex];
            });
          }
        }
      });
    },

    // Create a unified alignment function for both horizontal and vertical axes
    alignNodesInternalByAxis(
      nodes: ComfyNode[], 
      isHorizontal: boolean
    ): void {
      // Determine dimensions based on axis
      const posIndex = isHorizontal ? 0 : 1;
      const sizeIndex = isHorizontal ? 0 : 1;
      const otherPosIndex = isHorizontal ? 1 : 0;
      const otherSizeIndex = isHorizontal ? 1 : 0;
      const minSpacing = isHorizontal ? CONFIG.horizontalMinSpacing : CONFIG.verticalMinSpacing;
      const safetyMargin = isHorizontal ? CONFIG.safetyMargin.horizontal : CONFIG.safetyMargin.vertical;
      
      // Sort nodes by position on the primary axis
      const sortedNodes = [...nodes].sort((a, b) => a.pos[posIndex] - b.pos[posIndex]);
      const nodeSizeSum = sortedNodes.reduce((sum, node) => sum + node.size[sizeIndex], 0);
      
      const minPos = Math.min(...nodes.map(node => node.pos[posIndex]));
      const maxPos = Math.max(...nodes.map(node => node.pos[posIndex] + node.size[sizeIndex]));
      const totalSpace = maxPos - minPos;
      
      // Select reference node based on Alt key state
      const referenceNode = state.altKeyPressed 
        ? sortedNodes[sortedNodes.length - 1] // Right/bottom-most node
        : sortedNodes[0];                     // Left/top-most node
      
      // Align nodes on the secondary axis
      if (isHorizontal) {
        // For horizontal alignment, set all nodes to same Y position
        const referenceY = referenceNode.pos[otherPosIndex];
        nodes.forEach(node => {
          node.pos[otherPosIndex] = referenceY;
        });
      } else {
        // For vertical alignment, center nodes horizontally
        const referenceCenterX = referenceNode.pos[otherPosIndex] + (referenceNode.size[otherSizeIndex] / 2);
        nodes.forEach(node => {
          const nodeCenterX = node.pos[otherPosIndex] + (node.size[otherSizeIndex] / 2);
          const offsetX = referenceCenterX - nodeCenterX;
          node.pos[otherPosIndex] += offsetX;
        });
      }
      
      // Calculate spacing between nodes
      const effectiveMinSpacing = minSpacing + safetyMargin;
      const totalRequiredSpace = nodeSizeSum + (sortedNodes.length - 1) * effectiveMinSpacing;
      let spacing = effectiveMinSpacing;
      
      if (totalSpace > totalRequiredSpace) {
        spacing = (totalSpace - nodeSizeSum) / (sortedNodes.length - 1);
        spacing = Math.max(spacing, effectiveMinSpacing);
      }
      
      // Distribute nodes based on Alt key state
      if (state.altKeyPressed) {
        // Distribute from right/bottom
        const edgePos = referenceNode.pos[posIndex] + referenceNode.size[sizeIndex];
        let currentPos = edgePos;
        
        for (let i = sortedNodes.length - 1; i >= 0; i--) {
          const node = sortedNodes[i];
          currentPos -= node.size[sizeIndex];
          node.pos[posIndex] = currentPos;
          
          if (i > 0) {
            currentPos -= spacing;
          }
        }
      } else {
        // Distribute from left/top
        let currentPos = minPos;
        sortedNodes.forEach((node, index) => {
          node.pos[posIndex] = currentPos;
          
          if (index < sortedNodes.length - 1) {
            const nextMinPos = currentPos + node.size[sizeIndex] + effectiveMinSpacing;
            currentPos += node.size[sizeIndex] + spacing;
            
            if (currentPos < nextMinPos) {
              currentPos = nextMinPos;
            }
          }
        });
      }
    },

    alignNodesToHorizontalCenterInternal(nodes: ComfyNode[]): void {
      this.alignNodesInternalByAxis(nodes, true);
    },

    alignNodesToVerticalCenterInternal(nodes: ComfyNode[]): void {
      this.alignNodesInternalByAxis(nodes, false);
    },
    
    // Function to handle toggle arrow rotation
    toggleArrowRotation() {
      // Toggle the expanded state
      state.isToggleExpanded = !state.isToggleExpanded;
      
      // Get the toggle arrow element
      const toggleArrow = document.querySelector('.toggle-arrow') as SVGSVGElement;
      if (!toggleArrow) return;
      
      // Use CSS animation to rotate the icon
      toggleArrow.style.transform = `rotate(${state.isToggleExpanded ? '180deg' : '0deg'})`;
      
      // Additional UI elements can be toggled here
      // For example, when the feature is fully implemented, this can control the tool panel visibility
      console.log(`Toggle arrow clicked, expanded: ${state.isToggleExpanded}`);
    },
    
    // JS animation method for more complex animations
    animateRotation(element: SVGElement, targetDegree: number) {
      utils.animateRotation(element, targetDegree, 'isToggleExpanded', false);
    },
    
    // Toggle mute state for selected nodes
    toggleNodesMute(): ActionResult {
      return this.toggleNodeProperty('mode', 2, 0);
    },

    // Toggle pin state for selected nodes
    toggleNodesPin(): ActionResult {
      try {
        const appInstance = this.getComfyUIAppInstance();
        if (!appInstance) {
          return { success: false, message: t('alignNodes.errors.appInstance') };
        }

        const selectedNodes = this.getSelectedNodes(appInstance);
        if (selectedNodes.length === 0) {
          return { success: false, message: t('alignNodes.errors.noNodesSelected') };
        }

        const allPinned = selectedNodes.every(node => (node as any).flags?.pinned);
        
        selectedNodes.forEach(node => {
          const nodeWithFlags = node as any;
          if (!nodeWithFlags.flags) {
            nodeWithFlags.flags = {};
          }
          nodeWithFlags.flags.pinned = !allPinned;
        });

        appInstance.graph.setDirtyCanvas(true, true);
        
        return { success: true };
      } catch (error) {
        console.error("Failed to toggle pin state:", error);
        return { success: false, message: t('alignNodes.errors.operationFailed', {error: (error as Error).message}) };
      }
    },

    toggleNodeProperty(property: string, value: any, resetValue: any): ActionResult {
      try {
        const appInstance = this.getComfyUIAppInstance();
        if (!appInstance) {
          return { success: false, message: t('alignNodes.errors.appInstance') };
        }

        const selectedNodes = this.getSelectedNodes(appInstance);
        if (selectedNodes.length === 0) {
          return { success: false, message: t('alignNodes.errors.noNodesSelected') };
        }

        const allHaveProperty = selectedNodes.every(node => (node as any)[property] === value);
        
        selectedNodes.forEach(node => {
          (node as any)[property] = allHaveProperty ? resetValue : value;
        });

        appInstance.graph.setDirtyCanvas(true, true);
        return { success: true };
      } catch (error) {
        console.error("Failed to toggle node property:", error);
        return { success: false, message: t('alignNodes.errors.operationFailed', {error: (error as Error).message}) };
      }
    }
  };

  // Event handling and listeners
  const events = {
    // Track mouse position for UI placement
    trackMousePosition(e: MouseEvent) {
      state.lastX = e.clientX;
      state.lastY = e.clientY;
    },

    // Sets up event handlers for icon interactions (hover, click)
    handleIconInteraction() {
      if (!state.container) return;

      state.container.addEventListener('mouseover', (e) => {
        const icon = (e.target as HTMLElement).closest('.aligner-icon') as HTMLElement;
        if (!icon) return;
        
        const bg = icon.querySelector('.aligner-icon-bg') as HTMLElement;
        if (!bg) return;
        
        this.handleIconHover(icon, bg, true);
      });

      state.container.addEventListener('mouseout', (e) => {
        const icon = (e.target as HTMLElement).closest('.aligner-icon') as HTMLElement;
        if (!icon) return;
        
        const bg = icon.querySelector('.aligner-icon-bg') as HTMLElement;
        if (!bg) return;
        
        this.handleIconHover(icon, bg, false);
      });

      state.container.addEventListener('click', (e) => {
        const icon = (e.target as HTMLElement).closest('.aligner-icon') as HTMLElement;
        if (!icon) return;
        
        e.stopPropagation();
        
        const action = icon.dataset.id;
        if (action) {
          actions.handleAlignAction(action);
        }
        
        // Don't close the panel if clicking on toggleArrow or Shift key is pressed
        if (!state.shiftKeyPressed && action !== 'toggleArrowCircle') {
          actions.toggle();
        }
      });
    },

    // Get shadow color for circle icon based on its ID
    getIconShadowColor(id: string): string {
      if (!id) return 'rgba(255, 255, 255, 0.7)';
      
      const colorName = id.replace('Circle', '').toLowerCase();
      const colorKey = CONFIG.colorMap[colorName];
      
      if (!colorKey || !CONFIG.colors[colorKey]) {
        return 'rgba(255, 255, 255, 0.7)';
      }
      
      if (colorKey === 'circle8') {
        return 'rgba(255, 255, 255, 0.8)';
      } else if (colorKey === 'moon') {
        return 'rgba(255, 215, 0, 0.5)';
      }
      
      const shadowColor = CONFIG.colors[colorKey];
      if (shadowColor.includes('gradient')) {
        return 'rgba(255, 215, 0, 0.5)';
      }
      
      return shadowColor;
    },

    // Handle hover effects for icons
    handleIconHover(icon: HTMLElement, bg: HTMLElement, isHovering: boolean) {
      if (!icon.classList.contains('aligner-icon-circle')) {
        bg.style.backgroundColor = isHovering ? CONFIG.colors.hover : CONFIG.colors.bg;
        return;
      }
      
      const id = icon.dataset.id;
      if (!id) return;
      
      if (isHovering) {
        const shadowColor = this.getIconShadowColor(id);
        bg.style.boxShadow = `0 0 12px 4px ${shadowColor}`;
        icon.style.zIndex = '2';
      } else {
        bg.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        icon.style.zIndex = '1';
      }
    },

    // Handles keyboard shortcuts for activating the alignment UI
    handleKeyDown(e: KeyboardEvent) {
      const shortcut = CONFIG.shortcut.toLowerCase();
      const parts = shortcut.split('+');

      if (parts.length === 1) {
        if (e.key.toLowerCase() === parts[0]) {
          e.preventDefault();
          actions.toggle();
        }
        return;
      }

      if (parts.length === 2) {
        const [modifier, key] = parts;

        let modifierPressed = false;
        if (modifier === 'alt' && e.altKey) modifierPressed = true;
        if (modifier === 'ctrl' && (e.ctrlKey || e.metaKey)) modifierPressed = true;
        if (modifier === 'shift' && e.shiftKey) modifierPressed = true;

        if (modifierPressed && e.key.toLowerCase() === key) {
          e.preventDefault();
          actions.toggle();
        }
      }
    },

    // Closes the alignment UI when clicking outside of it
    handleOutsideClick(e: MouseEvent) {
      if (state.visible && state.container && !state.container.contains(e.target as Node)) {
        if (!state.shiftKeyPressed) {
          actions.toggle();
        }
      }
    },

    // Handles shift key events
    handleShiftKey(e: KeyboardEvent) {
      if (e.key === 'Shift') {
        state.shiftKeyPressed = e.type === 'keydown';
        
        if (e.type === 'keyup' && state.visible && !state.shiftKeyPressed) {
          actions.toggle();
        }
      }
    },

    // Handles alt key events
    handleAltKey(e: KeyboardEvent) {
      if (e.key === 'Alt') {
        state.altKeyPressed = e.type === 'keydown';
      }
    },

    // Registers all event listeners when the plugin is initialized
    registerEventListeners() {
      // Register keyboard event handlers
      this.registerHandler('keydown', this.handleKeyDown);
      this.registerHandler('keydown', this.handleShiftKey);
      this.registerHandler('keydown', this.handleAltKey);
      
      this.registerHandler('keyup', this.handleShiftKey);
      this.registerHandler('keyup', this.handleAltKey);
      
      // Register mouse event handlers
      this.registerHandler('mousemove', this.trackMousePosition);
      this.registerHandler('click', this.handleOutsideClick);
    },

    // Removes all event listeners when the plugin is disabled
    removeEventListeners() {
      // Clear all registered event handlers
      Object.entries(this.eventHandlers).forEach(([eventType, handlers]) => {
        handlers.forEach(handler => {
          document.removeEventListener(eventType, handler as EventListener);
        });
        handlers.length = 0; // Clear the array
      });
    },

    // Event handler registry for tracking registered handlers
    eventHandlers: {
      keydown: [] as ((e: KeyboardEvent) => void)[],
      keyup: [] as ((e: KeyboardEvent) => void)[],
      mousemove: [] as ((e: MouseEvent) => void)[],
      click: [] as ((e: MouseEvent) => void)[]
    },

    // Register a specific event handler
    registerHandler<K extends keyof HTMLElementEventMap>(
      eventType: K, 
      handler: (e: HTMLElementEventMap[K]) => void
    ) {
      document.addEventListener(eventType, handler as EventListener);
      if (eventType in this.eventHandlers) {
        (this.eventHandlers[eventType as keyof typeof this.eventHandlers] as any[]).push(handler);
      }
    },

    // Remove a specific event handler
    removeHandler<K extends keyof HTMLElementEventMap>(
      eventType: K, 
      handler: (e: HTMLElementEventMap[K]) => void
    ) {
      document.removeEventListener(eventType, handler as EventListener);
      if (eventType in this.eventHandlers) {
        const handlers = this.eventHandlers[eventType as keyof typeof this.eventHandlers];
        const index = handlers.indexOf(handler as any);
        if (index !== -1) {
          handlers.splice(index, 1);
        }
      }
    }
  };

  // Initialize the extension
  export function init() {
    if (!safeGetApp()) {
      console.error('ComfyUI-Align: Cannot initialize in this environment');
      return false;
    }
    CONFIG.horizontalMinSpacing = DEFAULT_CONFIG.horizontalMinSpacing;
    CONFIG.verticalMinSpacing = DEFAULT_CONFIG.verticalMinSpacing;

    const shortcutSetting = app.extensionManager.setting.get("Comfy.Align.Shortcut");
    if (shortcutSetting !== undefined) {
      CONFIG.shortcut = shortcutSetting;
    }
    
    events.registerEventListeners();
    return true;
  }

  // Clean up resources when extension is disabled
  export function destroy() {
    events.removeEventListeners();
    dom.cleanupDOM();
  }
}

// Updates a configuration value in the AlignerPlugin.CONFIG object
// Used by settings callbacks and during extension initialization
function updateConfig(key: string, value: any) {
  (AlignerPlugin.CONFIG as any)[key] = value;
}

app.registerExtension({
  name: "Comfy.Align",
  settings: [
    {
      id: "Comfy.Align.Spacing.horizontalMin",
      name: t('Align_Spacing_horizontalMin.name') || "Horizontal Min Spacing",
      type: "slider",
      defaultValue: DEFAULT_CONFIG.horizontalMinSpacing,
      attrs: {
        min: 10,
        max: 200,
        step: 1
      },
      tooltip: t('Comfy.Align_Spacing_horizontalMin.tooltip') || "Minimum horizontal spacing between nodes when aligning (in pixels)",
      category: ["Align", "Spacing", "Horizontal"],
      onChange: (value: number) => {
        updateConfig('horizontalMinSpacing', value);
      }
    },
    {
      id: "Comfy.Align.Spacing.verticalMin",
      name: t('Align_Spacing_verticalMin.name') || "Vertical Min Spacing",
      type: "slider",
      defaultValue: DEFAULT_CONFIG.verticalMinSpacing,
      attrs: {
        min: 10,
        max: 200,
        step: 1
      },
      tooltip: t('Align_Spacing_verticalMin.tooltip') || "Minimum vertical spacing between nodes when aligning (in pixels)",
      category: ["Align", "Spacing", "Vertical"],
      onChange: (value: number) => {
        updateConfig('verticalMinSpacing', value);
      }
    },
    {
      id: "Comfy.Align.Shortcut",
      name: t('Align_Shortcut.name') || "Shortcut",
      type: "text",
      defaultValue: DEFAULT_CONFIG.shortcut,
      tooltip: t('Align_Shortcut.tooltip') || "Shortcut to open the alignment tool (e.g. 'alt+a', 'shift+s', etc.)",
      category: ["Align", "Keyboard", "Activation"],
      onChange: (value: string) => {
        updateConfig('shortcut', value);
      }
    },
    {
      id: "Comfy.Align.Color.applyToPanel",
      name: t('Align_Color_applyToPanel.name') || "Apply color to node panel (background)",
      type: "boolean",
      defaultValue: DEFAULT_CONFIG.applyToPanel,
      tooltip: t('Align_Color_applyToPanel.tooltip') || "When checked, colors will be applied to node panels (background area)",
      category: ["Align", "Color Application", "Panel"],
      onChange: (value: boolean) => {
        updateConfig('applyToPanel', value);
      }
    },
    {
      id: "Comfy.Align.Color.applyToHeader",
      name: t('Align_Color_applyToHeader.name') || "Apply color to node header",
      type: "boolean",
      defaultValue: DEFAULT_CONFIG.applyToHeader,
      tooltip: t('Align_Color_applyToHeader.tooltip') || "When checked, colors will be applied to node headers",
      category: ["Align", "Color Application", "Header"],
      onChange: (value: boolean) => {
        updateConfig('applyToHeader', value);
      }
    }
  ] as any[], // Cast settings array to any[]
  // Extension initialization function called by ComfyUI when loading the extension
  async setup() {
    // Define mapping between UI setting IDs and internal configuration keys
    const settingMappings = [
      { id: "Comfy.Align.Spacing.horizontalMin", configKey: "horizontalMinSpacing", defaultValue: DEFAULT_CONFIG.horizontalMinSpacing },
      { id: "Comfy.Align.Spacing.verticalMin", configKey: "verticalMinSpacing", defaultValue: DEFAULT_CONFIG.verticalMinSpacing },
      { id: "Comfy.Align.Color.applyToPanel", configKey: "applyToPanel", defaultValue: DEFAULT_CONFIG.applyToPanel },
      { id: "Comfy.Align.Color.applyToHeader", configKey: "applyToHeader", defaultValue: DEFAULT_CONFIG.applyToHeader },
      { id: "Comfy.Align.Shortcut", configKey: "shortcut", defaultValue: DEFAULT_CONFIG.shortcut }
    ];
    
    // Load saved settings or set defaults for each configuration item
    for (const { id, configKey, defaultValue } of settingMappings) {
      const savedValue = app.extensionManager.setting.get(id);
      if (savedValue !== undefined) {
        // Apply saved setting if it exists
        updateConfig(configKey, savedValue);
      } else {
        // Otherwise, save the default value for future use
        await app.extensionManager.setting.set(id, defaultValue);
      }
    }

    // Delay initialization slightly to ensure ComfyUI is fully loaded
    // This helps prevent conflicts with other extensions or components
    setTimeout(() => {
      AlignerPlugin.init();
    }, 1000);
  }
});

// Safely retrieves the ComfyUI app instance, returning null if not available
// Used during extension initialization to verify the environment
function safeGetApp() {
  if (typeof window.app === 'undefined' || !window.app) {
    console.warn('ComfyUI-Align: window.app is not available');
    return null;
  }
  return window.app;
}