import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { build } from 'esbuild'

const root = process.cwd()
const outdir = join(root, 'extension/dist')
const source = join(root, 'extension/src')
const publicDir = join(root, 'extension/public')

await rm(outdir, { recursive: true, force: true })
await mkdir(outdir, { recursive: true })

const shared = {
  bundle: true,
  platform: 'browser',
  target: ['chrome110'],
  logLevel: 'info',
  minify: false,
  sourcemap: false,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
}

const entries = [
  { entry: 'background.ts', outfile: 'background.js', format: 'esm' },
  { entry: 'relay.ts', outfile: 'relay.js', format: 'iife' },
  { entry: 'reader-extract.ts', outfile: 'reader-extract.js', format: 'iife' },
  { entry: 'popup.ts', outfile: 'popup.js', format: 'iife' },
  { entry: 'options.ts', outfile: 'options.js', format: 'iife' },
]

for (const item of entries) {
  await build({
    ...shared,
    entryPoints: [join(source, item.entry)],
    outfile: join(outdir, item.outfile),
    format: item.format,
  })
}

for (const entry of await readdir(publicDir, { withFileTypes: true })) {
  await cp(join(publicDir, entry.name), join(outdir, entry.name), { recursive: true })
}

const manifest = JSON.parse(await readFile(join(root, 'extension/manifest.json'), 'utf8'))
await writeFile(join(outdir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8')

console.log(`Extension built in ${outdir}`)
