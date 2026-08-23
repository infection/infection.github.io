/**
 * The guide sidebar, derived from the guide pages' own frontmatter.
 *
 * Hexo built this from `type: guide` + a numeric `order:`, with `order > 1000`
 * starting a "Miscellaneous" group. Those keys are still in the (byte-identical)
 * source files, so the order is read from them rather than being duplicated as a
 * hand-maintained array that would drift the first time a page is added.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'
import type { DefaultTheme } from 'vitepress'

const GUIDE_DIR = join(__dirname, '..', 'guide')

/** Hexo's cut-off between the main docs list and the "Miscellaneous" group. */
const MISCELLANEOUS_FROM = 1000

export function guideSidebar(): DefaultTheme.SidebarItem[] {
  const pages = readdirSync(GUIDE_DIR)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const { data } = matter(readFileSync(join(GUIDE_DIR, file), 'utf-8'))
      return {
        text: data.title as string,
        link: `/guide/${file.replace(/index\.md$/, '').replace(/\.md$/, '.html')}`,
        order: (data.order as number) ?? Number.MAX_SAFE_INTEGER
      }
    })
    .sort((a, b) => a.order - b.order)

  const toItem = ({ text, link }: (typeof pages)[number]) => ({ text, link })

  return [
    {
      text: 'Documentation',
      collapsed: false,
      items: pages.filter((page) => page.order < MISCELLANEOUS_FROM).map(toItem)
    },
    {
      text: 'Miscellaneous',
      collapsed: false,
      items: pages.filter((page) => page.order >= MISCELLANEOUS_FROM).map(toItem)
    }
  ]
}
