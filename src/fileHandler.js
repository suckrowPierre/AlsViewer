export const handleFile = async (
  file,
  xmlReader,
  setAndShowViewerFn,
  showErrorFn,
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
