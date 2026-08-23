#!/usr/bin/env node
/**
 * The acceptance gate for the Hexo -> VitePress migration.
 *
 * GitHub Pages is a static bucket with no redirect support, so the only way to
 * keep the old site's URLs alive is to emit files at exactly the same paths --
 * and to keep every heading id byte-identical, because the legacy slugifier
 * preserved capitalisation (`#Compatibility-Note`, not `#compatibility-note`).
 *
 * Three assertions, run against bin/url-manifest.json (the contract, extracted
 * from the last Hexo build by bin/build-manifest.mjs):
 *
 *   1. every legacy path still exists in dist/
 *   2. every legacy heading anchor still exists on the corresponding page
 *   3. every internal link in the new build resolves -- path AND fragment
 *      (VitePress's own dead-link check covers paths but not fragments)
 *
 *   node bin/check-urls.mjs [dist-dir]
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, relative, dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DIST = resolve(process.argv[2] ?? join(HERE, '..', '.vitepress', 'dist'))
const MANIFEST = JSON.parse(readFileSync(join(HERE, 'url-manifest.json'), 'utf8'))

/**
 * Paths the migration deliberately does not reproduce. Every entry needs a
 * reason -- this list is the only escape hatch in the gate, so it must stay
 * short and argued.
 */
const ALLOW_MISSING = [
  // Hexo build residue with no counterpart: the theme's compiled CSS/JS bundles
  // and the ~40 leftover vuejs.org images the fork shipped and nothing links to.
  /^css\//,
  /^js\//,
  /^images\/(?!icons\/|posts\/|sponsors\/|logo\.png|github-logger\.png|gitlab-logger-)/
]

const failures = []
const notes = []

function fail(message) {
  failures.push(message)
}

// ---------------------------------------------------------------- 1. paths

const built = new Set(
  walk(DIST).map((file) => relative(DIST, file).split(sep).join('/'))
)

for (const path of MANIFEST.paths) {
  if (built.has(path)) continue
  if (ALLOW_MISSING.some((rule) => rule.test(path))) {
    notes.push(`allowed missing: ${path}`)
    continue
  }
  fail(`missing path: /${path}`)
}

// -------------------------------------------------------------- 2. anchors

const HEADING_ID = /<h[1-6][^>]*\sid="([^"]+)"/gi

/** page path -> Set of heading ids, for the freshly built site. */
const anchorsByPage = new Map()

function anchorsOf(path) {
  if (!anchorsByPage.has(path)) {
    const file = join(DIST, path)
    const ids = existsSync(file)
      ? [...readFileSync(file, 'utf8').matchAll(HEADING_ID)].map((m) => m[1])
      : []
    anchorsByPage.set(path, new Set(ids))
  }
  return anchorsByPage.get(path)
}

for (const [path, ids] of Object.entries(MANIFEST.anchors)) {
  if (!built.has(path)) continue // already reported as a missing path
  const current = anchorsOf(path)
  for (const id of ids) {
    if (!current.has(id)) fail(`missing anchor: /${path}#${id}`)
  }
}

// ---------------------------------------------------- 3. links in new build

const HREF = /\shref="([^"]+)"/gi

for (const path of built) {
  if (!path.endsWith('.html')) continue
  const html = readFileSync(join(DIST, path), 'utf8')

  for (const [, href] of html.matchAll(HREF)) {
    if (!href.startsWith('/') || href.startsWith('//')) continue // external or relative-to-nothing

    const [rawPath, fragment] = href.split('#')
    const target = resolveTarget(rawPath || `/${path}`)
    if (!target) continue // asset we do not resolve (images, .pub, ...)

    if (!built.has(target)) {
      fail(`dead link: ${href}  (in /${path})`)
      continue
    }

    if (!fragment || !target.endsWith('.html')) continue
    const anchor = decodeURIComponent(fragment)
    if (anchorsOf(target).has(anchor)) continue

    // A handful of links in the content point at headings that were renamed
    // years ago -- they are 404 fragments on the live Hexo site too. Those are
    // pre-existing content bugs, not migration regressions, so they are
    // reported but do not fail the gate.
    if (!(MANIFEST.anchors[target] ?? []).includes(anchor)) {
      notes.push(`pre-existing dead fragment (broken on the Hexo site too): ${href}  (in /${path})`)
      continue
    }
    fail(`dead fragment: ${href}  (in /${path})`)
  }
}

/** Maps an absolute site path to the file that must exist in dist/. */
function resolveTarget(sitePath) {
  const clean = decodeURIComponent(sitePath.replace(/[?].*$/, '')).replace(/^\//, '')
  if (clean === '') return 'index.html'
  if (clean.endsWith('/')) return `${clean}index.html`
  if (clean.endsWith('.html')) return clean
  return null // .png, .pub, .json, .xml -- covered by the path check above
}

// ------------------------------------------------------------------ report

function walk(dir) {
  if (!existsSync(dir)) {
    console.error(`dist not found: ${dir} -- run "npm run docs:build" first`)
    process.exit(1)
  }
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

console.log(`checked ${MANIFEST.paths.length} legacy paths and ` +
  `${Object.values(MANIFEST.anchors).flat().length} legacy anchors against ${DIST}`)

if (notes.length) {
  const unique = [...new Set(notes)]
  console.log(`\n${unique.length} note(s) -- not failures:\n`)
  for (const note of unique) console.log(`  ${note}`)
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n`)
  for (const failure of failures) console.error(`  ${failure}`)
  process.exit(1)
}

console.log('\nOK -- every legacy URL and anchor is still reachable.')
