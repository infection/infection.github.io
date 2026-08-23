/**
 * Reads Hexo-flavoured frontmatter without touching the source files.
 *
 * The migrated `.md` files are byte-identical copies of the Hexo originals, so
 * they carry two Hexo-isms VitePress cannot digest:
 *
 *  1. 18 of the 19 posts OMIT the opening `---`. Hexo tolerates that; gray-matter
 *     does not, so VitePress would render `layout: post\ntitle: ...` as prose.
 *  2. `layout: post` and `type: '{{type}}'` are Hexo keys. The default theme only
 *     knows `doc | home | page`, and an unknown `layout` renders a blank page.
 *
 * Rather than editing 19 files, both are normalised in memory:
 *  - `normalizeHexoFrontmatter()` for anything reading files off disk (the post
 *    index, the rewrites map, the Atom feed)
 *  - `hexoFrontmatterPlugin()`, an `enforce: 'pre'` Vite plugin, for the render
 *    path -- it runs before VitePress's own `.md` transform, so VitePress only
 *    ever sees well-formed frontmatter.
 *
 * If the source files are ever normalised for real, delete this module and drop
 * the plugin from `config.mts`; nothing else depends on it.
 */
import type { Plugin } from 'vite'

/**
 * Frontmatter lines with no meaning in VitePress, matched on the value as well
 * as the key: `layout` is a real VitePress key (`home`, `doc`, `page`), so only
 * Hexo's own `layout: post` may be dropped.
 */
const HEXO_ONLY_LINES = [/^layout:\s*post\s*$/, /^type:\s*/]

const DELIMITER = '---'

/**
 * Turns Hexo frontmatter into gray-matter-parseable frontmatter.
 * Files that already look right are returned untouched.
 */
export function normalizeHexoFrontmatter(src: string): string {
  const normalized = src.startsWith(`${DELIMITER}\n`) ? src : addOpeningDelimiter(src)
  if (normalized === null) return src

  return stripHexoKeys(normalized)
}

/**
 * Hexo lets a post open straight into `key: value` lines and close with `---`.
 * Only add the delimiter when the head of the file genuinely looks like that,
 * so a page that merely happens to start with a `---` horizontal rule, or with
 * prose, is left alone.
 */
function addOpeningDelimiter(src: string): string | null {
  const lines = src.split('\n')
  const end = lines.indexOf(DELIMITER)
  if (end <= 0) return null

  const looksLikeFrontmatter = lines
    .slice(0, end)
    .every((line) => line.trim() === '' || /^[A-Za-z_][\w-]*\s*:/.test(line))

  return looksLikeFrontmatter ? `${DELIMITER}\n${src}` : null
}

function stripHexoKeys(src: string): string {
  const lines = src.split('\n')
  const end = lines.indexOf(DELIMITER, 1)
  if (end < 0) return src

  const kept = lines
    .slice(1, end)
    .filter((line) => !HEXO_ONLY_LINES.some((rule) => rule.test(line)))

  return [DELIMITER, ...kept, ...lines.slice(end)].join('\n')
}

export function hexoFrontmatterPlugin(): Plugin {
  return {
    name: 'infection:hexo-frontmatter',
    // Must beat VitePress's own (unenforced) `.md` transform.
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.md')) return null
      const normalized = normalizeHexoFrontmatter(code)
      return normalized === code ? null : normalized
    }
  }
}
