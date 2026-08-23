// Extracts the URL + heading-anchor contract from the legacy Hexo build output
// so bin/check-urls.mjs can assert the VitePress build keeps every one of them.
//
//   node bin/build-manifest.mjs ../infection-site/public > bin/url-manifest.json
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const root = process.argv[2]
if (!root) {
  console.error('usage: node bin/build-manifest.mjs <legacy-public-dir>')
  process.exit(1)
}

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

const files = walk(root)
  .map((f) => relative(root, f).split(sep).join('/'))
  .sort()

// Heading ids only. Hexo's theme also emits ids on layout chrome (nav, sidebar),
// which the new theme has no obligation to reproduce.
const HEADING_ID = /<h[1-6][^>]*\sid="([^"]+)"/gi

const anchors = {}
for (const file of files) {
  if (!file.endsWith('.html')) continue
  const html = readFileSync(join(root, file), 'utf8')
  const ids = [...html.matchAll(HEADING_ID)].map((m) => m[1])
  if (ids.length) anchors[file] = [...new Set(ids)].sort()
}

process.stdout.write(
  JSON.stringify({ generatedFrom: root, paths: files, anchors }, null, 2) + '\n'
)
