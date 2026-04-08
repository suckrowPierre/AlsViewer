import { readAlsAsXml, getXmlDom, getSessionData } from "./alsParser";
import {
  createXmlViewer,
  setXmlViewerContent,
  openXmlViewerSearch,
} from "./xmlViewer";
import { setupSplitDivider } from "./split";

// setup

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
const searchButton = requireElement<HTMLButtonElement>("searchButton");

const sessionNameEl = requireElement<HTMLElement>("sessionName");
const bpmDisplayEl = requireElement<HTMLElement>("bpmDisplay");
const lastModifiedEl = requireElement<HTMLElement>("lastModified");

const viewer = createXmlViewer(xmlViewerEl, "");
const parser = new DOMParser();

// viewer

function showViewer() {
  uploadView.classList.add("hidden");
  xmlViewerEl.classList.remove("hidden");
}

function renderXml(xmlText: string) {
  setXmlViewerContent(viewer, xmlText);
  showViewer();
  searchButton.onclick = () => openXmlViewerSearch(viewer);
}

// info pane

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
}

// file handling

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

// drag and drop

function preventDefaults(event: Event) {
  event.preventDefault();
  event.stopPropagation();
}

function setDropZoneActive(isActive: boolean) {
  dropZone.classList.toggle("drag-active", isActive);
}

// events

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
