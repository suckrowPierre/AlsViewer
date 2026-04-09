import { gunzipSync, strFromU8 } from "fflate";
import { DOMParser } from "@xmldom/xmldom";
import type {
  Document as XmlDocument,
  Element as XmlElement,
  Node as XmlNode,
} from "@xmldom/xmldom";

export const readAlsAsXml = async (file: File): Promise<string> => {
  const compressed = new Uint8Array(await file.arrayBuffer());
  const decompressed = gunzipSync(compressed);
  return strFromU8(decompressed);
};

export const getXmlDom = (xmlString: string): XmlDocument => {
  return new DOMParser().parseFromString(xmlString, "text/xml");
};

export type XmlNodeWithPosition = XmlElement & {
  lineNumber?: number;
  columnNumber?: number;
};

export type ValueNodeRef<ValueType> = {
  value: ValueType;
  node: XmlNodeWithPosition;
};

type TypeTrack = "AUDIO" | "MIDI" | "RETURN";

export type Track = {
  name: string;
  type: TypeTrack;
};

export type AudioResource = {
  relativePath: string;
  absolutePath: string;
  isCollected: boolean;
};

type SessionData = {
  name: string;
  lastModified: Date;
  bpm: ValueNodeRef<number> | null;
  tracks: ValueNodeRef<Track>[];
  audioResources: ValueNodeRef<AudioResource>[];
};

const AUDIO_FILE_EXTENSIONS = new Set([
  "wav",
  "aif",
  "aiff",
  "flac",
  "mp3",
  "m4a",
  "ogg",
  "oga",
  "aac",
  "caf",
  "snd",
  "w64",
]);

const getRequiredAttribute = (
  element: XmlElement,
  attributeName: string,
): string => {
  const value = element.getAttribute(attributeName);

  if (value == null) {
    throw new Error(
      `Missing attribute "${attributeName}" on <${element.tagName}>`,
    );
  }

  return value;
};

const isElementNode = (node: XmlNode): node is XmlElement => {
  return node.nodeType === 1;
};

const getDirectChild = (
  parent: XmlElement,
  tagName: string,
): XmlElement | null => {
  return (
    Array.from(parent.childNodes).find(
      (child): child is XmlElement =>
        isElementNode(child) && child.tagName === tagName,
    ) ?? null
  );
};

const hasAncestorTag = (node: XmlNode, tagName: string): boolean => {
  let current = node.parentNode;

  while (current) {
    if (isElementNode(current) && current.tagName === tagName) {
      return true;
    }

    current = current.parentNode;
  }

  return false;
};

const findTempoWithManual = (xml: XmlDocument): XmlNodeWithPosition | null => {
  const tempoNodes = Array.from(
    xml.getElementsByTagName("Tempo"),
  ) as XmlNodeWithPosition[];

  return (
    tempoNodes.find((tempoNode) =>
      Array.from(tempoNode.childNodes).some(
        (child) => isElementNode(child) && child.tagName === "Manual",
      ),
    ) ?? null
  );
};

const getTrackName = (trackNode: XmlNodeWithPosition): string => {
  const nameNode = Array.from(trackNode.childNodes).find(
    (child): child is XmlElement =>
      isElementNode(child) && child.tagName === "Name",
  );

  if (!nameNode) {
    throw new Error(`Missing <Name> on <${trackNode.tagName}>`);
  }

  const userNameNode = Array.from(nameNode.childNodes).find(
    (child): child is XmlElement =>
      isElementNode(child) && child.tagName === "UserName",
  );

  const effectiveNameNode = Array.from(nameNode.childNodes).find(
    (child): child is XmlElement =>
      isElementNode(child) && child.tagName === "EffectiveName",
  );

  const userName = userNameNode
    ? getRequiredAttribute(userNameNode, "Value").trim()
    : "";

  if (userName !== "") {
    return userName;
  }

  if (!effectiveNameNode) {
    throw new Error(
      `Missing <EffectiveName> inside <Name> on <${trackNode.tagName}>`,
    );
  }

  return getRequiredAttribute(effectiveNameNode, "Value");
};

const getTracks = (xml: XmlDocument): ValueNodeRef<Track>[] => {
  const audioTrackNodes = Array.from(
    xml.getElementsByTagName("AudioTrack"),
  ) as XmlNodeWithPosition[];

  const midiTrackNodes = Array.from(
    xml.getElementsByTagName("MidiTrack"),
  ) as XmlNodeWithPosition[];

  const returnTrackNodes = Array.from(
    xml.getElementsByTagName("ReturnTrack"),
  ) as XmlNodeWithPosition[];

  return [
    ...audioTrackNodes.map((node) => ({
      value: {
        name: getTrackName(node),
        type: "AUDIO" as const,
      },
      node,
    })),
    ...midiTrackNodes.map((node) => ({
      value: {
        name: getTrackName(node),
        type: "MIDI" as const,
      },
      node,
    })),
    ...returnTrackNodes.map((node) => ({
      value: {
        name: getTrackName(node),
        type: "RETURN" as const,
      },
      node,
    })),
  ];
};

const hasAudioFileExtension = (path: string): boolean => {
  const normalizedPath = path.trim().toLowerCase();
  const lastDotIndex = normalizedPath.lastIndexOf(".");

  if (lastDotIndex === -1) return false;

  const extension = normalizedPath.slice(lastDotIndex + 1);
  return AUDIO_FILE_EXTENSIONS.has(extension);
};

const getFileRefValue = (
  fileRefNode: XmlElement,
  tagName: string,
): string | null => {
  const child = getDirectChild(fileRefNode, tagName);
  if (!child) return null;

  const value = child.getAttribute("Value");
  return value == null ? null : value;
};

const isCollectedAudioResource = (
  relativePathType: string | null,
  relativePath: string,
): boolean => {
  return (
    (relativePathType === "3" || relativePathType === "6") &&
    (relativePath.startsWith("Samples/Imported/") ||
      relativePath.startsWith("Samples/Recorded/"))
  );
};

const getAudioResources = (xml: XmlDocument): ValueNodeRef<AudioResource>[] => {
  const fileRefNodes = Array.from(
    xml.getElementsByTagName("FileRef"),
  ) as XmlNodeWithPosition[];

  return fileRefNodes.flatMap((node) => {
    if (hasAncestorTag(node, "SourceContext")) {
      return [];
    }

    const relativePath = getFileRefValue(node, "RelativePath") ?? "";
    const absolutePath = getFileRefValue(node, "Path") ?? "";
    const relativePathType = getFileRefValue(node, "RelativePathType");

    const candidatePath = absolutePath || relativePath;

    if (!candidatePath || !hasAudioFileExtension(candidatePath)) {
      return [];
    }

    return [
      {
        value: {
          relativePath,
          absolutePath,
          isCollected: isCollectedAudioResource(relativePathType, relativePath),
        },
        node,
      },
    ];
  });
};

const parseBpm = (xml: XmlDocument): ValueNodeRef<number> | null => {
  const tempoNode = findTempoWithManual(xml);

  if (!tempoNode) {
    return null;
  }

  const manualNode = Array.from(tempoNode.childNodes).find(
    (child): child is XmlElement =>
      isElementNode(child) && child.tagName === "Manual",
  );

  if (!manualNode) {
    return null;
  }

  const bpm = Number(getRequiredAttribute(manualNode, "Value"));

  if (Number.isNaN(bpm)) {
    throw new Error("Tempo Manual Value is not a valid number");
  }

  return {
    value: bpm,
    node: tempoNode,
  };
};

export const getSessionData = (xml: XmlDocument, file: File): SessionData => {
  return {
    name: file.name,
    lastModified: new Date(file.lastModified),
    bpm: parseBpm(xml),
    tracks: getTracks(xml),
    audioResources: getAudioResources(xml),
  };
};
