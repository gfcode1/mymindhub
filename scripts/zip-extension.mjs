import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { zipSync } from 'fflate'

const root = process.cwd()
const dist = join(root, 'extension/dist')
const release = join(root, 'extension/release')
const manifest = JSON.parse(await readFile(join(root, 'extension/manifest.json'), 'utf8'))

async function collect(dir, files = {}) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      await collect(full, files)
    } else {
      files[relative(dist, full).split('\\').join('/')] = new Uint8Array(await readFile(full))
    }
  }
  return files
}

const files = await collect(dist)
const zipped = zipSync(files, { level: 9 })
await mkdir(release, { recursive: true })
const target = join(release, `binhub-capture-${manifest.version}.zip`)
await writeFile(target, zipped)
console.log(`Extension package written to ${target}`)
