import { readAlsAsXml, getXmlDom, getSessionData } from "./alsParser";
import {
  createXmlViewer,
  setXmlViewerContent,
  openXmlViewerSearch,
} from "./xmlViewer";
import { createXmlTreeViewer, renderXmlTree } from "./xmlTreeViewer";
import { setupSplitDivider } from "./split";

setupSplitDivider();

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`${id} not found`);
  return element as T;
}

const input = requireElement<HTMLInputElement>("fileInput");
const uploadView = requireElement<HTMLDivElement>("upload-view");
const dropZone = requireElement<HTMLLabelElement>("drop-zone");
const xmlViewerEl = requireElement<HTMLDivElement>("xml-viewer");
const codeViewEl = requireElement<HTMLDivElement>("codeView");
const treeViewEl = requireElement<HTMLDivElement>("treeView");

const searchButton = requireElement<HTMLButtonElement>("searchButton");
const codeViewButton = requireElement<HTMLButtonElement>("codeViewButton");
const treeViewButton = requireElement<HTMLButtonElement>("treeViewButton");

const sessionNameEl = requireElement<HTMLElement>("sessionName");
const bpmDisplayEl = requireElement<HTMLElement>("bpmDisplay");
const lastModifiedEl = requireElement<HTMLElement>("lastModified");

const codeViewer = createXmlViewer(codeViewEl, "");
const treeViewer = createXmlTreeViewer(treeViewEl, 2);

function showViewer() {
  uploadView.classList.add("hidden");
  xmlViewerEl.classList.remove("hidden");
}

function showCodeView() {
  codeViewEl.classList.remove("hidden");
  treeViewEl.classList.add("hidden");
}

function showTreeView() {
  treeViewEl.classList.remove("hidden");
  codeViewEl.classList.add("hidden");
  treeViewer.cy.resize();
  treeViewer.cy.fit(undefined, 24);
}

function renderXml(xmlText: string) {
  setXmlViewerContent(codeViewer, xmlText);
  showViewer();
  showCodeView();

  searchButton.onclick = () => openXmlViewerSearch(codeViewer);
  codeViewButton.onclick = () => showCodeView();
  treeViewButton.onclick = () => showTreeView();
}

function formatLastModified(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function clearSessionInfo() {
  sessionNameEl.textContent = "_";
  bpmDisplayEl.textContent = "_";
  lastModifiedEl.textContent = "_";
}

function renderSessionData(file: File, xmlText: string) {
  const xml = getXmlDom(xmlText);
  const sessionData = getSessionData(xml, file);

  sessionNameEl.textContent = sessionData.name;
  bpmDisplayEl.textContent = sessionData.bpm
    ? String(sessionData.bpm.value)
    : "_";
  lastModifiedEl.textContent = formatLastModified(sessionData.lastModified);

  renderXmlTree(treeViewer, xml);
}

function showError(error: string) {
  clearSessionInfo();
  console.error(error);
}

async function processFile(file: File) {
  try {
    const xmlText = await readAlsAsXml(file);
    renderXml(xmlText);
    renderSessionData(file, xmlText);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process file";
    showError(message);
  }
}

function preventDefaults(event: Event) {
  event.preventDefault();
  event.stopPropagation();
}

function setDropZoneActive(isActive: boolean) {
  dropZone.classList.toggle("drag-active", isActive);
}

input.addEventListener("change", async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
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

dropZone.addEventListener("drop", async (event: DragEvent) => {
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  await processFile(file);
});
