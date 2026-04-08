import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { xml } from "@codemirror/lang-xml";
import { search, searchKeymap, openSearchPanel } from "@codemirror/search";
import { foldGutter, codeFolding, foldKeymap } from "@codemirror/language";

export const createXmlViewer = (parent, initialDoc = "") => {
  const view = new EditorView({
    state: EditorState.create({
      doc: initialDoc,
      extensions: [
        xml(),

        // visual behavior
        EditorView.lineWrapping,
        lineNumbers(),

        // folding
        codeFolding(),
        foldGutter(),

        // search
        search({ top: true }),
        keymap.of([...searchKeymap, ...foldKeymap]),

        // readonly viewer
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
      ],
    }),
    parent,
  });

  return view;
};

export const setXmlViewerContent = (view, xmlText) => {
  view.dispatch({
    changes: {
      from: 0,
      to: view.state.doc.length,
      insert: xmlText,
    },
  });
};

export const openXmlViewerSearch = (view) => {
  openSearchPanel(view);
  view.focus();
};
