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

type XmlNodeWithPosition = XmlElement & {
  lineNumber?: number;
  columnNumber?: number;
};

type ValueNodeRef<ValueType> = {
  value: ValueType;
  node: XmlNodeWithPosition;
};

type SessionData = {
  name: string;
  lastModified: Date;
  bpm: ValueNodeRef<number> | null;
};

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
  };
};
