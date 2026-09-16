# StudyPDF

StudyPDF is a Windows desktop notebook for school worksheets.

Homeschool platforms such as Miacademy and MiaPrep send a lot of printable PDFs. Instead of printing every page, a child can drop a worksheet into StudyPDF and write, type, highlight, and draw on it. The original PDF is never changed. Notes are stored beside it and can be exported as a normal PDF.

This is not Adobe Acrobat. It is a simple schoolwork workspace that happens to use PDFs as page backgrounds.

## Why it exists

Children should be able to:

1. Open the app
2. Choose their name
3. Choose a subject
4. Drop a PDF
5. Write on it immediately
6. Close the app without thinking about Save
7. Find the work later, still there

StudyPDF is built around that loop.

## Features

- Student profiles and per-student subjects
- Drag-and-drop PDF import
- Pencil, highlighter, text, lines, shapes, eraser
- Undo / redo
- Zoom that keeps writing aligned with the page
- Autosave and crash recovery
- Today view and recent work
- Lined, graph, dot, and blank note pages
- Portable PDF export
- Offline by design

## Privacy

StudyPDF has no cloud backend and does not upload children's schoolwork anywhere on its own.

There are no accounts, analytics, ads, telemetry, or crash-report uploads.

Files are saved only to the storage folder selected by the parent. If that folder is synchronized by Google Drive, OneDrive, Dropbox, Syncthing, or another service, that synchronization is handled by that service.

## How storage works

During setup, choose any normal folder as the schoolwork root. That can be:

- a folder on this computer
- a Google Drive for Desktop mirrored folder
- OneDrive
- Dropbox
- Syncthing
- a NAS or network drive

StudyPDF only sees a filesystem path. It does not need Google API credentials, OAuth, or vendor-specific storage code.

Default layout:

```
School/
  Alex/
    2026/
      09/
        2026-09-16/
          Math/
            2026-09-16 - Math - Fractions Practice/
              original.pdf
              annotations.study.json
              2026-09-16 - Math - Fractions Practice.pdf
```

`original.pdf` is an untouched copy of the worksheet. `annotations.study.json` is the editable work. The third file is the portable PDF generated when you save or mark the work completed.

## Installation

Unsigned Windows builds may trigger a SmartScreen warning.

Download the installer or portable executable from [Releases](https://github.com/ChrisRWade/study-pdf/releases), or build from source:

```bash
git clone https://github.com/ChrisRWade/study-pdf.git
cd study-pdf
npm install
npm run generate:samples
npm run package
```

The packaged app is written to `release/`.

## Development

Requires Node.js 20.19 or newer.

```bash
npm install
npm run generate:samples
npm run dev
```

Other commands:

| Command | What it does |
| --- | --- |
| `npm run typecheck` | TypeScript checks |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run build` | Production Electron bundle |
| `npm run package` | Windows installer + portable exe |

Sample worksheets live in `samples/`. Do not commit copyrighted curriculum PDFs.

## Keyboard shortcuts

Shortcuts help; they are never required.

| Key | Action |
| --- | --- |
| `V` | Select |
| `P` | Pencil |
| `H` | Highlighter |
| `T` | Text |
| `L` | Line |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+S` | Save and export now |
| `Ctrl+,` | Settings |
| `=` / `-` | Zoom |
| `Esc` | Cancel |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
