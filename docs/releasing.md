# Releasing StudyPDF

1. Update `version` in `package.json` and `APP_VERSION` in `src/shared/constants.ts`.
2. Commit the version bump.
3. Tag the release:

```bash
git tag v0.1.1
git push origin v0.1.1
```

The Release workflow builds:

- a Windows NSIS installer
- a portable `.exe`

Builds are **not code-signed**. Windows SmartScreen may show a warning. That is expected for community builds until a certificate is added.

Never put signing certificates or secrets in this repository.
