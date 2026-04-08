import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import dagre, { type DagreLayoutOptions } from "cytoscape-dagre";
import type {
  Document as XmlDocument,
  Element as XmlElement,
  Node as XmlNode,
} from "@xmldom/xmldom";

cytoscape.use(dagre);

type XmlTreeViewer = {
  cy: Core;
  setData: (xml: XmlDocument) => void;
};

type TreeNodeRecord = {
  id: string;
  parentId: string | null;
  depth: number;
  label: string;
  tooltipLines: string[];
};

function isElementNode(node: XmlNode): node is XmlElement {
  return node.nodeType === 1;
}

function getElementChildren(element: XmlElement): XmlElement[] {
  return Array.from(element.childNodes).filter(isElementNode);
}

function getLeafText(element: XmlElement): string {
  const value = element.getAttribute("Value");
  const id = element.getAttribute("Id");
  const text = element.textContent?.trim();

  if (value != null && value !== "") {
    return `${element.tagName}: ${value}`;
  }

  if (id != null && id !== "") {
    return `${element.tagName}: ${id}`;
  }

  if (text) {
    return `${element.tagName}: ${text}`;
  }

  return element.tagName;
}

function buildNodeRecord(
  element: XmlElement,
  parentId: string | null,
  depth: number,
  id: string,
): TreeNodeRecord {
  const children = getElementChildren(element);
  const branchChildren = children.filter(
    (child) => getElementChildren(child).length > 0,
  );
  const leafChildren = children.filter(
    (child) => getElementChildren(child).length === 0,
  );

  const ownId = element.getAttribute("Id");
  const baseName = ownId ? `${element.tagName} #${ownId}` : element.tagName;

  return {
    id,
    parentId,
    depth,
    label: `${baseName} (${branchChildren.length})`,
    tooltipLines: leafChildren.map(getLeafText),
  };
}

function flattenXmlTree(xml: XmlDocument): TreeNodeRecord[] {
  const root = xml.documentElement;
  if (!root) return [];

  const result: TreeNodeRecord[] = [];
  let counter = 0;

  const visit = (
    element: XmlElement,
    parentId: string | null,
    depth: number,
  ) => {
    const id = `n${counter++}`;
    result.push(buildNodeRecord(element, parentId, depth, id));

    const branchChildren = getElementChildren(element).filter(
      (child) => getElementChildren(child).length > 0,
    );

    for (const child of branchChildren) {
      visit(child, id, depth + 1);
    }
  };

  visit(root, null, 0);
  return result;
}

function buildTreeIndexes(nodes: TreeNodeRecord[]) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string, TreeNodeRecord[]>();

  for (const node of nodes) {
    if (!node.parentId) continue;
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  }

  return { nodeById, childrenByParent };
}

function buildVisibleElements(
  nodes: TreeNodeRecord[],
  expandedNodeIds: Set<string>,
  collapsedNodeIds: Set<string>,
  initialMaxDepth: number,
): ElementDefinition[] {
  const { nodeById, childrenByParent } = buildTreeIndexes(nodes);
  const root = nodes.find((node) => node.depth === 0);

  if (!root) return [];

  const visibleIds = new Set<string>();

  function visit(nodeId: string, forceVisible: boolean) {
    const node = nodeById.get(nodeId);
    if (!node) return;

    const isWithinInitialDepth = node.depth <= initialMaxDepth;
    const isVisible = forceVisible || isWithinInitialDepth;

    if (!isVisible) return;

    visibleIds.add(nodeId);

    if (collapsedNodeIds.has(nodeId)) {
      return;
    }

    const children = childrenByParent.get(nodeId) ?? [];

    for (const child of children) {
      const childForceVisible = expandedNodeIds.has(nodeId);
      visit(child.id, childForceVisible);
    }
  }

  visit(root.id, true);

  const elements: ElementDefinition[] = [];

  for (const node of nodes) {
    if (!visibleIds.has(node.id)) continue;

    const children = childrenByParent.get(node.id) ?? [];
    const hasAnyChildren = children.length > 0;
    const hasVisibleChildren = children.some((child) =>
      visibleIds.has(child.id),
    );
    const hasHiddenChildren =
      hasAnyChildren && children.some((child) => !visibleIds.has(child.id));
    const isCollapsed = collapsedNodeIds.has(node.id);
    const isExpanded =
      expandedNodeIds.has(node.id) || (hasVisibleChildren && !isCollapsed);

    let label = node.label;
    if (hasAnyChildren) {
      if (isCollapsed || hasHiddenChildren) {
        label = `${label} [+]`;
      } else if (isExpanded) {
        label = `${label} [-]`;
      }
    }

    elements.push({
      data: {
        id: node.id,
        label,
        tooltip: node.tooltipLines.join("\n"),
        hasAnyChildren,
        hasHiddenChildren,
        hasVisibleChildren,
        isCollapsed,
        isExpanded,
      },
    });
  }

  for (const node of nodes) {
    if (!node.parentId) continue;
    if (!visibleIds.has(node.id) || !visibleIds.has(node.parentId)) continue;

    elements.push({
      data: {
        id: `e_${node.parentId}_${node.id}`,
        source: node.parentId,
        target: node.id,
      },
    });
  }

  return elements;
}

function runTreeLayout(cy: Core, fit: boolean) {
  const layout: DagreLayoutOptions = {
    name: "dagre",
    rankDir: "TB",
    nodeSep: 30,
    rankSep: 80,
    edgeSep: 10,
    fit,
    padding: 24,
    animate: false,
    nodeDimensionsIncludeLabels: true,
  };

  cy.layout(layout).run();
}

function createTooltipElement(text: string): HTMLDivElement {
  const tooltip = document.createElement("div");
  tooltip.className = "xml-tree-tooltip";
  tooltip.textContent = text || "No leaf fields";
  return tooltip;
}

function positionTooltip(
  tooltip: HTMLElement,
  container: HTMLElement,
  renderedPosition: { x: number; y: number },
) {
  const containerRect = container.getBoundingClientRect();
  const offsetX = 12;
  const offsetY = 0;

  tooltip.style.left = `${containerRect.left + renderedPosition.x + offsetX}px`;
  tooltip.style.top = `${containerRect.top + renderedPosition.y + offsetY}px`;
}

function shiftAllNodePositions(cy: Core, deltaX: number, deltaY: number) {
  cy.nodes().forEach((node) => {
    const pos = node.position();
    node.position({
      x: pos.x + deltaX,
      y: pos.y + deltaY,
    });
  });
}

export function createXmlTreeViewer(
  container: HTMLElement,
  initialMaxDepth = 2,
): XmlTreeViewer {
  const cy = cytoscape({
    container,
    elements: [],
    style: [
      {
        selector: "node",
        style: {
          label: "data(label)",
          shape: "round-rectangle",
          width: 150,
          height: 34,
          "font-size": 10,
          "text-wrap": "ellipsis",
          "text-valign": "center",
          "text-halign": "center",
          "background-color": "#f5f1d6",
          "border-width": 1,
          "border-color": "#000",
          color: "#000",
        },
      },
      {
        selector: "edge",
        style: {
          width: 1,
          "line-color": "#000",
          "target-arrow-color": "#000",
          "target-arrow-shape": "triangle",
          "curve-style": "taxi",
          "taxi-direction": "vertical",
          "source-endpoint": "outside-to-node",
          "target-endpoint": "outside-to-node",
        },
      },
    ],
    layout: {
      name: "dagre",
    },
  });

  let allNodes: TreeNodeRecord[] = [];
  let expandedNodeIds = new Set<string>();
  let collapsedNodeIds = new Set<string>();
  let activeTooltip: HTMLDivElement | null = null;
  let hoveredNodeId: string | null = null;
  let isHoveringTooltip = false;
  let hideTooltipTimer: number | null = null;

  function clearHideTooltipTimer() {
    if (hideTooltipTimer != null) {
      window.clearTimeout(hideTooltipTimer);
      hideTooltipTimer = null;
    }
  }

  function destroyTooltip() {
    clearHideTooltipTimer();

    if (activeTooltip) {
      activeTooltip.remove();
      activeTooltip = null;
    }
  }

  function scheduleTooltipHide() {
    clearHideTooltipTimer();

    hideTooltipTimer = window.setTimeout(() => {
      if (!hoveredNodeId && !isHoveringTooltip) {
        destroyTooltip();
      }
    }, 80);
  }

  function showTooltipForNode(nodeId: string) {
    clearHideTooltipTimer();
    destroyTooltip();

    const node = cy.getElementById(nodeId);
    if (!node || node.empty()) return;

    const tooltipText = String(node.data("tooltip") ?? "").trim();
    if (!tooltipText) return;

    const tooltip = createTooltipElement(tooltipText);

    tooltip.addEventListener("mouseenter", () => {
      isHoveringTooltip = true;
      clearHideTooltipTimer();
    });

    tooltip.addEventListener("mouseleave", () => {
      isHoveringTooltip = false;
      scheduleTooltipHide();
    });

    document.body.appendChild(tooltip);
    activeTooltip = tooltip;

    positionTooltip(tooltip, container, node.renderedPosition());
  }

  function collapseNodeAndDescendants(nodeId: string) {
    const { childrenByParent } = buildTreeIndexes(allNodes);

    const walk = (id: string) => {
      expandedNodeIds.delete(id);
      collapsedNodeIds.add(id);

      const children = childrenByParent.get(id) ?? [];
      for (const child of children) {
        walk(child.id);
      }
    };

    walk(nodeId);
  }

  function expandNode(nodeId: string) {
    collapsedNodeIds.delete(nodeId);
    expandedNodeIds.add(nodeId);
  }

  function rerender(options?: { fit?: boolean; anchorNodeId?: string }) {
    destroyTooltip();

    const fit = options?.fit ?? false;
    const anchorNodeId = options?.anchorNodeId ?? null;

    const currentZoom = cy.zoom();
    const currentPan = cy.pan();

    const oldAnchorPosition = anchorNodeId
      ? cy.getElementById(anchorNodeId).nonempty()
        ? cy.getElementById(anchorNodeId).position()
        : null
      : null;

    const elements = buildVisibleElements(
      allNodes,
      expandedNodeIds,
      collapsedNodeIds,
      initialMaxDepth,
    );

    cy.elements().remove();
    cy.add(elements);

    runTreeLayout(cy, fit);

    if (!fit && anchorNodeId && oldAnchorPosition) {
      const newAnchor = cy.getElementById(anchorNodeId);
      if (newAnchor.nonempty()) {
        const newAnchorPosition = newAnchor.position();
        const deltaX = oldAnchorPosition.x - newAnchorPosition.x;
        const deltaY = oldAnchorPosition.y - newAnchorPosition.y;
        shiftAllNodePositions(cy, deltaX, deltaY);
      }
    }

    cy.zoom(currentZoom);
    cy.pan(currentPan);

    if (hoveredNodeId) {
      showTooltipForNode(hoveredNodeId);
    }
  }

  cy.on("tap", "node", (event) => {
    const node = event.target;
    const nodeId = node.id();
    const hasAnyChildren = Boolean(node.data("hasAnyChildren"));
    const isCollapsed = Boolean(node.data("isCollapsed"));
    const isExpanded = Boolean(node.data("isExpanded"));

    if (!hasAnyChildren) {
      return;
    }

    if (isExpanded && !isCollapsed) {
      collapseNodeAndDescendants(nodeId);
      rerender({ fit: false, anchorNodeId: nodeId });
      return;
    }

    expandNode(nodeId);
    rerender({ fit: false, anchorNodeId: nodeId });
  });

  cy.on("mouseover", "node", (event) => {
    const node = event.target;
    hoveredNodeId = node.id();
    showTooltipForNode(node.id());
  });

  cy.on("mouseout", "node", () => {
    hoveredNodeId = null;
    scheduleTooltipHide();
  });

  cy.on("pan zoom resize", () => {
    if (!hoveredNodeId || !activeTooltip) return;
    const node = cy.getElementById(hoveredNodeId);
    if (!node || node.empty()) return;
    positionTooltip(activeTooltip, container, node.renderedPosition());
  });

  return {
    cy,
    setData(xml: XmlDocument) {
      allNodes = flattenXmlTree(xml);
      expandedNodeIds = new Set<string>();
      collapsedNodeIds = new Set<string>();
      hoveredNodeId = null;
      isHoveringTooltip = false;
      destroyTooltip();
      rerender({ fit: true });
    },
  };
}

export function renderXmlTree(viewer: XmlTreeViewer, xml: XmlDocument) {
  viewer.setData(xml);
}
