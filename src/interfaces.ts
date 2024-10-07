import type { ContextMenu } from "./ContextMenu";
import type { LGraphNode } from "./LGraphNode";
import type { LinkDirection, RenderShape } from "./types/globalEnums";
import type { LinkId } from "./LLink";
import type { SlotDirection } from "./draw";

export type Dictionary<T> = { [key: string]: T };

export type CanvasColour = string | CanvasGradient | CanvasPattern;

export interface IInputOrOutput {
  // If an input, this will be defined
  input?: INodeInputSlot;
  // If an output, this will be defined
  output?: INodeOutputSlot;
}

export interface IFoundSlot extends IInputOrOutput {
  // Slot index
  slot: number;
  // Centre point of the rendered slot connection
  link_pos: Point;
}

/** A point on the canvas: x, y */
export type Point = [x: number, y: number] | Float32Array | Float64Array;

/** A size: width, height */
export type Size =
  | [width: number, height: number]
  | Float32Array
  | Float64Array;

/** A very firm array */
type ArRect = [x: number, y: number, width: number, height: number];

/** A rectangle starting at top-left coordinates: x, y, width, height */
export type Rect = ArRect | Float32Array | Float64Array;

// TODO: Need regular arrays also?
export type Rect32 = Float32Array;

/** Union of property names that are of type Match */
export type KeysOfType<T, Match> = {
  [P in keyof T]: T[P] extends Match ? P : never;
}[keyof T];

/** A new type that contains only the properties of T that are of type Match */
export type PickByType<T, Match> = { [P in keyof T]: Extract<T[P], Match> };

/** The names of all methods and functions in T */
export type MethodNames<T> = KeysOfType<T, (...args: any) => any>;

export interface IBoundaryNodes {
  top: LGraphNode;
  right: LGraphNode;
  bottom: LGraphNode;
  left: LGraphNode;
}

export type Direction = "top" | "bottom" | "left" | "right";

// TODO: Rename IOptionalSlotsData
export interface IOptionalInputsData {
  content: string;
  value?;
  className?: string;
}

export type ISlotType = number | string;

export interface INodeSlot {
  name: string;
  type: ISlotType;
  dir?: LinkDirection & SlotDirection;
  removable?: boolean;
  shape?: RenderShape;
  not_subgraph_input?: boolean;
  color_off?: CanvasColour;
  color_on?: CanvasColour;
  label?: string;
  locked?: boolean;
  nameLocked?: boolean;
  pos?: Point;
  widget?: unknown;
}

export interface INodeFlags {
  skip_repeated_outputs?: boolean;
  allow_interaction?: boolean;
  pinned?: boolean;
  collapsed?: boolean;
}

export interface INodeInputSlot extends INodeSlot {
  link?: LinkId;
  not_subgraph_input?: boolean;
}

export interface INodeOutputSlot extends INodeSlot {
  links?: LinkId[];
  _data?: unknown;
  slot_index?: number;
  not_subgraph_output?: boolean;
}

/** Links */
export interface ConnectingLink extends IInputOrOutput {
  node: LGraphNode;
  slot: number;
  pos: Point;
  direction?: LinkDirection;
}

/** ContextMenu */
export interface IContextMenuOptions {
  ignore_item_callbacks?: boolean;
  title?: string;
  parentMenu?: ContextMenu;
  className?: string;
  event?: MouseEvent;
  extra?: unknown;
  scroll_speed?: number;
  left?: number;
  top?: number;
  scale?: string;
  node?: LGraphNode;
  autoopen?: boolean;
  callback?(
    value?: unknown,
    options?: unknown,
    event?: MouseEvent,
    previous_menu?: ContextMenu,
    node?: LGraphNode,
  ): void;
}

export interface IContextMenuValue {
  title?: string;
  content: string;
  has_submenu?: boolean;
  disabled?: boolean;
  className?: any;
  submenu?: unknown;
  property?: string;
  type?: string;
  slot?: IFoundSlot;
  callback?: IContextMenuOptions["callback"];
}
