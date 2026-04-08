export const handleFile = async (
  file: File,
  xmlReader: (file: File) => Promise<string>,
  setAndShowViewerFn: (xmlText: string) => void,
  showErrorFn: (message: string) => void,
) => {
  if (!file) return;
  try {
    const xmlText = await xmlReader(file);
    setAndShowViewerFn(xmlText);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    showErrorFn(`Could not read file: ${message}`);
  }
};
