# Release Guide

## Building Installers Locally

```bash
npm run dist
```

Output in `dist/`:
- Windows: `BearRecord-Setup-x.x.x.exe` (NSIS installer)
- macOS: `BearRecord-x.x.x.dmg`
- Linux: `BearRecord-x.x.x.AppImage`

---

## Version Bump

1. Update `version` in `package.json`.
2. Commit: `git commit -m "chore: bump version to x.x.x"`.
3. Tag: `git tag vx.x.x && git push --tags`.

---

## Code Signing

### Windows

Set environment variables before running `npm run dist`:

```bash
export CSC_LINK=/path/to/certificate.pfx
export CSC_KEY_PASSWORD=yourpassword
```

Or configure in `electron-builder.yml`:

```yaml
win:
  certificateFile: path/to/cert.pfx
  certificatePassword: ${env.CSC_KEY_PASSWORD}
```

### macOS

Requires an Apple Developer ID certificate. Set:

```bash
export APPLE_ID=your@email.com
export APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
export APPLE_TEAM_ID=XXXXXXXXXX
```

Notarization is handled automatically by `electron-builder` when these are set.

---

## GitHub Actions CI

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run dist
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
      - uses: actions/upload-artifact@v4
        with:
          name: dist-${{ matrix.os }}
          path: dist/
```

---

## Auto-Update

`electron-updater` is configured to check `latest.yml` / `latest-mac.yml` from the GitHub Releases feed. When a new tag is pushed and CI succeeds, users running the app will be prompted to update on next launch.
