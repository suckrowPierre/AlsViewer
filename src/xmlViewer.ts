import {
  EditorSelection,
  EditorState,
  RangeSetBuilder,
  StateEffect,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { xml } from "@codemirror/lang-xml";
import { search, searchKeymap, openSearchPanel } from "@codemirror/search";
import { foldGutter, codeFolding, foldKeymap } from "@codemirror/language";

type XmlNodeWithPosition = {
  lineNumber?: number;
  columnNumber?: number;
  tagName?: string;
  toString?: () => string;
};

const setActiveNodeEffect = StateEffect.define<{
  from: number;
  to: number;
} | null>();

const activeNodeMark = Decoration.mark({
  class: "cm-active-xml-node",
});

const activeNodeField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setActiveNodeEffect)) {
        const value = effect.value;

        if (!value) return Decoration.none;

        const builder = new RangeSetBuilder<Decoration>();
        builder.add(value.from, value.to, activeNodeMark);
        return builder.finish();
      }
    }

    if (tr.docChanged) {
      return Decoration.none;
    }

    return decorations.map(tr.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

const clearActiveNodeOnClick = EditorView.domEventHandlers({
  mousedown(_event, view) {
    view.dispatch({
      effects: setActiveNodeEffect.of(null),
    });

    return false;
  },
});

export const createXmlViewer = (parent: HTMLElement, initialDoc = "") => {
  const view = new EditorView({
    state: EditorState.create({
      doc: initialDoc,
      extensions: [
        xml(),
        EditorView.lineWrapping,
        lineNumbers(),
        codeFolding(),
        foldGutter(),
        search({ top: true }),
        keymap.of([...searchKeymap, ...foldKeymap]),
        activeNodeField,
        clearActiveNodeOnClick,
        EditorView.theme({
          ".cm-active-xml-node": {
            background: "rgba(201, 200, 189, 0.3)",
            borderRadius: "2px",
          },
        }),
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
      ],
    }),
    parent,
  });

  return view;
};

export const setXmlViewerContent = (view: EditorView, xmlText: string) => {
  view.dispatch({
    changes: {
      from: 0,
      to: view.state.doc.length,
      insert: xmlText,
    },
    effects: setActiveNodeEffect.of(null),
  });
};

export const openXmlViewerSearch = (view: EditorView) => {
  openSearchPanel(view);
  view.focus();
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getNodeRange(view: EditorView, node: XmlNodeWithPosition) {
  const lineNumber = node.lineNumber;
  const columnNumber = node.columnNumber ?? 1;

  if (!lineNumber || lineNumber < 1) return null;

  const line = view.state.doc.line(lineNumber);
  const start = Math.min(line.from + Math.max(columnNumber - 1, 0), line.to);

  const xmlText = view.state.doc.toString();
  const nodeText = node.toString?.();

  if (nodeText) {
    const exactIndex = xmlText.indexOf(nodeText, start);
    if (exactIndex !== -1) {
      return {
        from: exactIndex,
        to: exactIndex + nodeText.length,
      };
    }
  }

  const tagName = node.tagName;
  if (!tagName) {
    return { from: start, to: Math.min(start + 1, view.state.doc.length) };
  }

  const openTag = `<${tagName}`;
  const closeTag = `</${tagName}>`;

  const openIndex = xmlText.indexOf(openTag, start);
  if (openIndex === -1) {
    return {
      from: start,
      to: Math.min(start + openTag.length, view.state.doc.length),
    };
  }

  const selfClosingMatch = xmlText
    .slice(openIndex)
    .match(new RegExp(`^<${escapeRegExp(tagName)}\\b[^>]*\\/?>`, "s"));

  if (selfClosingMatch && selfClosingMatch[0].endsWith("/>")) {
    return {
      from: openIndex,
      to: openIndex + selfClosingMatch[0].length,
    };
  }

  const closeIndex = xmlText.indexOf(closeTag, openIndex);
  if (closeIndex === -1) {
    return {
      from: openIndex,
      to: Math.min(openIndex + openTag.length, view.state.doc.length),
    };
  }

  return {
    from: openIndex,
    to: closeIndex + closeTag.length,
  };
}

export const jumpToXmlViewerNode = (
  view: EditorView,
  node: XmlNodeWithPosition,
) => {
  const range = getNodeRange(view, node);
  if (!range) return;

  view.dispatch({
    selection: EditorSelection.cursor(range.from),
    effects: setActiveNodeEffect.of(range),
  });

  view.focus();

  const coords = view.coordsAtPos(range.from);
  if (coords) {
    const scrollTop = view.scrollDOM.scrollTop;
    const editorTop = view.scrollDOM.getBoundingClientRect().top;
    const topInScroll = coords.top - editorTop + scrollTop;
    view.scrollDOM.scrollTop = Math.max(0, topInScroll - 12);
  }
};
