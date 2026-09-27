<p align="center">
  <img src="src/renderer/src/assets/pagesprig-logo.svg" alt="PageSprig" width="420" />
</p>

# PageSprig

PageSprig is a desktop notebook for school worksheets on Windows and Linux Mint.

Homeschool platforms such as Miacademy and MiaPrep send a lot of printable PDFs. Instead of printing every page, a child can drop a worksheet into PageSprig and write, type, highlight, and draw on it. The original PDF is never changed. Notes are stored beside it and can be exported as a normal PDF.

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

PageSprig is built around that loop.

## Features

- Student profiles and per-student subjects
- Drag-and-drop PDF import
- Pencil, highlighter, text, lines, shapes, eraser
- Undo / redo
- Zoom that keeps writing aligned with the page
- Autosave and crash recovery
- Today view and recent work
- Parent calendar: check a day's work and record an optional score such as 8/9
- Lined, graph, dot, and blank note pages
- Portable PDF export
- Offline by design

## Privacy

PageSprig has no cloud backend and does not upload children's schoolwork anywhere on its own.

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

PageSprig only sees a filesystem path. It does not need Google API credentials, OAuth, or vendor-specific storage code.

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

Kids and parents should install from GitHub Releases, not from the source code.

1. Open [Releases](https://github.com/ChrisRWade/pagesprig/releases).
2. Download the installer for that computer:
   - **Windows:** `PageSprig-*-win-x64.exe` (skip the file whose name includes `portable` unless you want a USB copy).
   - **Linux Mint:** `PageSprig-*-linux-amd64.deb`
3. Install it:
   - **Windows:** run the installer. Unsigned builds may show a SmartScreen warning; choose **More info**, then **Run anyway**.
   - **Linux Mint:** double-click the `.deb`, or in a terminal run `sudo apt install ./PageSprig-*-linux-amd64.deb`.
4. Point PageSprig at the same schoolwork folder on every computer that should see the same worksheets.

If a Mint machine cannot install a `.deb`, use the AppImage instead: mark `PageSprig-*-linux-x86_64.AppImage` executable and run it.

The original PDFs and writing live in the schoolwork folder, not inside the app.

### Updates

There is no in-app auto-update. A new version is a new installer on the same Releases page.

Install the newer Windows `.exe` or Linux `.deb` over the existing one. Children's work stays in the schoolwork folder, so updating does not delete worksheets.

Maintainers: bump `version` in `package.json`, tag `vX.Y.Z`, and push the tag. GitHub Actions builds the unsigned Windows and Linux installers and attaches them to that release.

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
| `npm run package` | Installer for this computer's OS |
| `npm run package:win` | Windows installer + portable exe |
| `npm run package:linux` | Linux Mint `.deb` + AppImage |

To build a local installer:

```bash
npm run generate:samples
npm run package
```

The packaged app is written to `release/`.

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
