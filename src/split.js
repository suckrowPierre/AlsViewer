import Split from "split.js";

export const setupSplitDivider = () => {
  Split(["#xml-pane", "#info-pane"], {
    sizes: [60, 40],
    minSize: 150,
    gutterSize: 12,
    cursor: "col-resize",
  });
};
