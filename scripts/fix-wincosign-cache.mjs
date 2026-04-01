/**
 * Downloads winCodeSign and replaces symlinks with real file copies,
 * working around the "Cannot create symbolic link" error on Windows
 * without Developer Mode.
 *
 * Run once before `npm run dist`: node scripts/fix-wincosign-cache.mjs
 */
import { execSync } from 'child_process'
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, unlinkSync, readlinkSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { createWriteStream } from 'fs'
import { get } from 'https'
import { fileURLToPath } from 'url'

const CACHE_DIR = join(homedir(), 'AppData', 'Local', 'electron-builder', 'Cache', 'winCodeSign')
const WINCOSIGN_VERSION = 'winCodeSign-2.6.0'
const DOWNLOAD_URL = `https://github.com/electron-userland/electron-builder-binaries/releases/download/${WINCOSIGN_VERSION}/${WINCOSIGN_VERSION}.7z`
const SEVEN_ZIP = join(fileURLToPath(import.meta.url), '../../node_modules/7zip-bin/win/x64/7za.exe')

const targetDir = join(CACHE_DIR, WINCOSIGN_VERSION)

if (existsSync(targetDir)) {
  console.log('winCodeSign cache already exists, checking for symlinks...')
  replaceSymlinksWithCopies(targetDir)
  console.log('Done.')
  process.exit(0)
}

console.log('Downloading winCodeSign...')
mkdirSync(CACHE_DIR, { recursive: true })

const archivePath = join(CACHE_DIR, `${WINCOSIGN_VERSION}.7z`)

await new Promise((resolve, reject) => {
  const file = createWriteStream(archivePath)
  get(DOWNLOAD_URL, (res) => {
    if (res.statusCode === 302 || res.statusCode === 301) {
      get(res.headers.location, (res2) => res2.pipe(file))
    } else {
      res.pipe(file)
    }
    file.on('finish', resolve)
    file.on('error', reject)
  }).on('error', reject)
})

console.log('Extracting (ignoring symlink errors)...')
try {
  execSync(`"${SEVEN_ZIP}" x -bd "${archivePath}" "-o${targetDir}"`, { stdio: 'pipe' })
} catch {
  // 7-Zip exits with error code 2 when symlinks fail — that's expected, continue
}

console.log('Replacing symlinks with real file copies...')
replaceSymlinksWithCopies(targetDir)
console.log('Cache fixed. You can now run: npm run dist')

function replaceSymlinksWithCopies(dir) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    try {
      const st = statSync(full, { bigint: false })
      if (st.isDirectory()) {
        replaceSymlinksWithCopies(full)
      }
    } catch {
      // lstat instead to catch broken symlinks
      try {
        const lst = statSync(full) // broken symlink throws
      } catch {
        // It's a broken symlink — find the real source and copy
        try {
          const target = readlinkSync(full)
          const resolved = join(dirname(full), target)
          if (existsSync(resolved)) {
            unlinkSync(full)
            copyFileSync(resolved, full)
            console.log(`  Fixed: ${entry}`)
          } else {
            // libssl/libcrypto — copy from libcrypto.x.y.dylib sibling
            const base = entry.replace(/\.dylib$/, '')
            const siblings = readdirSync(dirname(full)).filter(
              (s) => s.startsWith(base) && s !== entry
            )
            if (siblings.length > 0) {
              unlinkSync(full)
              copyFileSync(join(dirname(full), siblings[0]), full)
              console.log(`  Fixed (sibling copy): ${entry}`)
            }
          }
        } catch { /* skip */ }
      }
    }
  }
}
