export const GRAPH_NODE_WIDTH = 224;
export const GRAPH_NODE_HEIGHT = 76;
export const GRAPH_NODE_SEPARATION = 36;
export const GRAPH_RANK_SEPARATION = 68;
export const GRAPH_MARGIN = 28;
export const TYPE_GRAPH_SEPARATION = 72;
export const TYPE_LANE_SEPARATION = 28;
export const TYPE_KIND_ORDER = ["declared", "compound", "primitive"] as const;
export const TYPE_GRAPH_NODE_WIDTHS = {
  declared: 360,
  compound: 300,
  primitive: 224,
} as const;
export const TYPE_GRAPH_NODE_HEIGHTS = {
  declared: 108,
  compound: 88,
  primitive: 76,
} as const;
