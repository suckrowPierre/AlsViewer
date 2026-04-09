import {
  readAlsAsXml,
  getXmlDom,
  getSessionData,
  Track,
  AudioResource,
  ValueNodeRef,
} from "./alsParser";
import {
  createXmlViewer,
  setXmlViewerContent,
  openXmlViewerSearch,
  jumpToXmlViewerNode,
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
const loadingOverlay = requireElement<HTMLDivElement>("loadingOverlay");

const searchButton = requireElement<HTMLButtonElement>("searchButton");
const codeViewButton = requireElement<HTMLButtonElement>("codeViewButton");
const treeViewButton = requireElement<HTMLButtonElement>("treeViewButton");
const downloadButton = requireElement<HTMLButtonElement>("downloadButton");
const cancelButton = requireElement<HTMLButtonElement>("cancelButton");

const sessionNameEl = requireElement<HTMLElement>("sessionName");
const bpmDisplayEl = requireElement<HTMLElement>("bpmDisplay");
const lastModifiedEl = requireElement<HTMLElement>("lastModified");
const trackInfoEl = requireElement<HTMLElement>("trackInfo");
const trackCountEl = requireElement<HTMLElement>("trackCount");
const audioResourcesEl = requireElement<HTMLElement>("audioResourceInfo");
const audioResourcesCountEl = requireElement<HTMLElement>("audioResourceCount");

const codeViewer = createXmlViewer(codeViewEl, "");
const treeViewer = createXmlTreeViewer(treeViewEl, 2);

let currentXmlText = "";
let currentFileName = "";

function showViewer() {
  uploadView.classList.add("hidden");
  xmlViewerEl.classList.remove("hidden");
}

function hideViewer() {
  xmlViewerEl.classList.add("hidden");
  uploadView.classList.remove("hidden");
}

function showLoading() {
  showViewer();
  loadingOverlay.classList.remove("hidden");
}

function hideLoading() {
  loadingOverlay.classList.add("hidden");
}

function setActiveViewButton(activeButton: HTMLButtonElement) {
  const inactiveClasses = ["bg-transparent"];
  const activeClasses = ["bg-black", "rounded-sm"];

  [codeViewButton, treeViewButton].forEach((button) => {
    button.classList.remove(...activeClasses);
    button.classList.add(...inactiveClasses);
  });

  activeButton.classList.remove(...inactiveClasses);
  activeButton.classList.add(...activeClasses);
}

function showCodeView() {
  codeViewEl.classList.remove("hidden");
  treeViewEl.classList.add("hidden");
  setActiveViewButton(codeViewButton);
}

function showTreeView() {
  treeViewEl.classList.remove("hidden");
  codeViewEl.classList.add("hidden");
  setActiveViewButton(treeViewButton);
  treeViewer.cy.resize();
  treeViewer.cy.fit(undefined, 24);
}

function getDownloadFileName(fileName: string) {
  return fileName.replace(/\.als$/i, "") + ".xml";
}

function downloadXml() {
  if (!currentXmlText) return;

  const blob = new Blob([currentXmlText], { type: "application/xml" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = getDownloadFileName(currentFileName || "session.als");
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function resetViewer() {
  hideLoading();
  hideViewer();
  clearSessionInfo();
  input.value = "";
  currentXmlText = "";
  currentFileName = "";
  setXmlViewerContent(codeViewer, "");
  treeViewer.cy.elements().remove();
  setActiveViewButton(codeViewButton);
}

function renderXml(xmlText: string) {
  currentXmlText = xmlText;

  setXmlViewerContent(codeViewer, xmlText);
  showViewer();
  showCodeView();

  searchButton.onclick = () => openXmlViewerSearch(codeViewer);
  codeViewButton.onclick = () => showCodeView();
  treeViewButton.onclick = () => showTreeView();
  downloadButton.onclick = () => downloadXml();
  cancelButton.onclick = () => resetViewer();
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
  trackInfoEl.textContent = "";
  trackCountEl.textContent = "0";
  audioResourcesEl.textContent = "";
  audioResourcesCountEl.textContent = "0";
}

function renderTrackInfo(tracks: ValueNodeRef<Track>[]) {
  trackInfoEl.replaceChildren();

  for (const track of tracks) {
    const row = document.createElement("div");
    row.className = "cursor-pointer py-1 hover:underline";

    row.innerHTML = `<span class="font-bold">${track.value.type}</span>: ${track.value.name}`;

    row.addEventListener("click", () => {
      showCodeView();
      jumpToXmlViewerNode(codeViewer, track.node);
    });

    trackInfoEl.appendChild(row);
  }
}

function renderAudioResources(audioResources: ValueNodeRef<AudioResource>[]) {
  audioResourcesEl.replaceChildren();

  for (const audioResource of audioResources) {
    const row = document.createElement("div");
    row.className = "cursor-pointer py-2 hover:underline";

    row.innerHTML = `<div>
      <div><span class="font-bold">RelativePath:</span> ${audioResource.value.relativePath}</div>
      <div><span class="font-bold">AbsolutePath:</span> ${audioResource.value.absolutePath}</div>
      <div>
        <span class="font-bold">IsCollected</span> (Inside Project Folder):
        <span class="font-bold ${audioResource.value.isCollected ? "text-green-600" : "text-red-600"}">
          ${String(audioResource.value.isCollected).toUpperCase()}
        </span>
      </div>
    </div>`;

    row.addEventListener("click", () => {
      showCodeView();
      jumpToXmlViewerNode(codeViewer, audioResource.node);
    });

    audioResourcesEl.appendChild(row);
  }
}

function renderSessionData(file: File, xmlText: string) {
  const xml = getXmlDom(xmlText);
  const sessionData = getSessionData(xml, file);

  sessionNameEl.textContent = sessionData.name;
  bpmDisplayEl.textContent = sessionData.bpm
    ? String(sessionData.bpm.value)
    : "_";
  lastModifiedEl.textContent = formatLastModified(sessionData.lastModified);
  trackCountEl.textContent = String(sessionData.tracks.length);
  renderTrackInfo(sessionData.tracks);
  audioResourcesCountEl.textContent = String(sessionData.audioResources.length);
  renderAudioResources(sessionData.audioResources);

  renderXmlTree(treeViewer, xml);
}

function showError(error: string) {
  clearSessionInfo();
  console.error(error);
}

async function processFile(file: File) {
  currentFileName = file.name;
  showLoading();

  try {
    const xmlText = await readAlsAsXml(file);
    renderXml(xmlText);
    renderSessionData(file, xmlText);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process file";
    showError(message);
  } finally {
    hideLoading();
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
