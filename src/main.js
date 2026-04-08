import { readAlsAsXml } from "./alsParser";
import {
  createXmlViewer,
  setXmlViewerContent,
  openXmlViewerSearch,
} from "./xmlViewer";
import { setupSplitDivider } from "./split";
import { handleFile } from "./fileHandler";

// setup

setupSplitDivider();

function requireElement(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`${id} not found`);
  return element;
}

const input = requireElement("fileInput");
const uploadView = requireElement("upload-view");
const dropZone = requireElement("drop-zone");
const xmlViewerEl = requireElement("xml-viewer");
const searchButton = requireElement("searchButton");

const viewer = createXmlViewer(xmlViewerEl, "");

// viewer

function showViewer() {
  uploadView.classList.add("hidden");
  xmlViewerEl.classList.remove("hidden");
}

function renderXml(xmlText) {
  setXmlViewerContent(viewer, xmlText);
  showViewer();
  searchButton.onclick = () => openXmlViewerSearch(viewer);
}

// file handling

function showError(error) {
  console.error(error);
}

async function processFile(file) {
  await handleFile(file, readAlsAsXml, renderXml, showError);
}

// drag and drop

function preventDefaults(event) {
  event.preventDefault();
  event.stopPropagation();
}

function setDropZoneActive(isActive) {
  dropZone.classList.toggle("drag-active", isActive);
}

// events

input.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  await processFile(file);
});

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    preventDefaults(event);
    setDropZoneActive(true);
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    preventDefaults(event);
    setDropZoneActive(false);
  });
});

dropZone.addEventListener("drop", async (event) => {
  const file = event.dataTransfer?.files?.[0];
  await processFile(file);
});
