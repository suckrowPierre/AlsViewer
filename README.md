# .AlsViewer

Inspect Ableton Live `.als` session files directly in the browser. [Demo](https://suckrowpierre.github.io/AlsViewer/)

`.AlsViewer` reads an Ableton session file, converts it to XML, and gives you a fast way to inspect the session structure without uploading the file to a server.

## Features

- Open `.als` files by file picker or drag and drop
- Convert Ableton session data to XML in the browser
- Browse the raw XML in a code view
- Explore the XML structure in a tree view
- Search inside the XML viewer
- Jump from parsed session info to the related XML node
- View session metadata such as:
  - session name
  - BPM
  - last modified date
  - tracks
  - audio resources
- Download the extracted XML

## Why this exists

Ableton `.als` files are not easy to inspect directly. This project makes it easier to understand session internals, debug projects, and explore how Ableton stores tracks and audio file references.

## How it works

The app:

1. accepts an `.als` file
2. reads and parses it in the browser
3. converts it into XML
4. extracts session level metadata
5. renders both a code view and a tree view for inspection

## Privacy

All processing happens locally in your browser. Your Ableton session file is not uploaded to a backend service.

## Usage

1. Open the site
2. Drop an `.als` file onto the upload area or select one manually
3. Inspect the parsed session details in the info panel
4. Switch between code view and tree view
5. Search the XML or download the extracted XML

## Tech stack

- TypeScript
- HTML
- CSS
- Browser File APIs
- Custom XML parsing and viewing utilities

## Local development

```bash
npm install
npm run dev
