import { gunzipSync, strFromU8 } from "fflate";

export const readAlsAsXml = async (file) => {
  const compressed = new Uint8Array(await file.arrayBuffer());
  const decompressed = gunzipSync(compressed);
  return strFromU8(decompressed);
};

export const getXmlDom = (parser, xmlString) => {
  return parser.parseFromString(xmlString, 'text/xml');
};


const SessionData = {
  name: null,
  lastModified: null,
  bpm: null,
  tracks: [],
  fileRefs: [],
};

