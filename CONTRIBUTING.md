# Contributing to PageSprig

Thank you for helping make a calmer way for children to do schoolwork on PDFs.

## Product rules

1. Never lose schoolwork.
2. Keep the child UI obvious to an 8-year-old.
3. Keep writing, highlighting, and typing responsive.
4. Never modify the original PDF. Annotations live in `annotations.study.json`.
5. Do not add accounts, analytics, cloud APIs, or Google Drive OAuth.

## Development

```bash
npm install
npm run generate:samples
npm run dev
```

Useful checks before a pull request:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Pull requests

- Keep changes focused.
- Add tests when you touch coordinates, saving, recovery, templates, or history.
- Do not commit personal student names, real worksheets, or local folder paths.
- Use sample PDFs in `samples/` for screenshots and tests.

## Releases

Bump `version` in `package.json` (and `APP_VERSION` in `src/shared/constants.ts` to match). Tag `vX.Y.Z` and push the tag. GitHub Actions builds unsigned Windows and Linux Mint installers and attaches them to the GitHub Release.

Do not reuse an old tag. Each update needs a new version so the installer can replace the previous one.
