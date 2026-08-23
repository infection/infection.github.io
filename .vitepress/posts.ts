/**
 * The blog half of the site.
 *
 * VitePress has no blog primitives -- no `permalink:`, no posts collection, no
 * feed. The legacy Hexo permalink scheme `/:year/:month/:day/:title/` is live
 * and linked from every release note, so it is reconstructed here by deriving a
 * `rewrites` map from each post's own `date:` frontmatter.
 *
 * The map is generated at config-load time and never hand-edited, so it cannot
 * drift from the posts.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'
import { normalizeHexoFrontmatter } from './hexo-frontmatter'

const POSTS_DIR = join(__dirname, '..', 'posts')

/**
 * Hexo wrote naive local timestamps ("2022-01-10 19:24:18") and built the
 * permalink from exactly those digits. Matched against the raw frontmatter
 * rather than a parsed value on purpose: YAML reads an unquoted timestamp as
 * UTC, and converting that back to local time moves three of the nineteen
 * posts into the next day -- silently changing their live URL.
 */
const DATE_LINE = /^date:\s*'?(\d{4})-(\d{2})-(\d{2})[T ](\d{2}:\d{2}:\d{2})/m

export interface Post {
  /** Source file relative to srcDir, e.g. `posts/whats-new-in-0.26.0.md` */
  source: string
  /** Live URL path, e.g. `/2022/01/10/whats-new-in-0.26.0/` */
  url: string
  title: string
  /** ISO-8601, for the Atom feed and for sorting. */
  date: string
}

let cached: Post[] | undefined

export function loadPosts(): Post[] {
  cached ??= readdirSync(POSTS_DIR)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const raw = readFileSync(join(POSTS_DIR, file), 'utf-8')
      const normalized = normalizeHexoFrontmatter(raw)
      const { data } = matter(normalized)
      // Sliced out by hand rather than read off gray-matter's `.matter`: that
      // property is non-enumerable, and gray-matter serves repeat calls from a
      // cache via Object.assign, which drops it. First call works, second
      // returns undefined.
      const stamp = DATE_LINE.exec(normalized.slice(0, normalized.indexOf('\n---', 3)))

      if (!stamp) {
        throw new Error(
          `posts/${file}: missing or unparseable "date:" frontmatter -- its permalink cannot be derived`
        )
      }

      const [, year, month, day, time] = stamp
      const slug = file.replace(/\.md$/, '')

      return {
        source: `posts/${file}`,
        url: `/${year}/${month}/${day}/${slug}/`,
        title: (data.title as string) ?? slug,
        // The feed needs a timezone; the originals carry none. Pinning to UTC
        // keeps builds reproducible. Only <published> shifts by an hour or two
        // against the old feed -- the <id>, which readers dedupe on, is
        // byte-identical.
        date: `${year}-${month}-${day}T${time}.000Z`
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))

  return cached
}

/**
 * `{ 'posts/whats-new-in-0.26.0.md': '2022/01/10/whats-new-in-0.26.0/index.md' }`
 * -- which VitePress emits as `/2022/01/10/whats-new-in-0.26.0/index.html`, the
 * exact file GitHub Pages serves for the trailing-slash URL.
 */
export function postRewrites(posts: Post[]): Record<string, string> {
  return Object.fromEntries(
    posts.map((post) => [post.source, `${post.url.slice(1)}index.md`])
  )
}
