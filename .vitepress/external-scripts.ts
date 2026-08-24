/**
 * Moves third-party `<script src="...">` tags from the body into the page head.
 *
 * 16 posts end with the GitHub star button loader and two embed a Twitter
 * widget, all written as raw `<script src>` tags -- fine under Hexo, which
 * emitted them verbatim into the page.
 *
 * VitePress compiles the rendered markdown as a Vue template, and the template
 * compiler refuses tags with side effects:
 *
 *   Tags with side effect (<script> and <style>) are ignored in client
 *   component templates.
 *
 * In dev that is a hard 500 on every affected post; in a build it degrades to a
 * warning and the script is dropped from the client bundle, so the star button
 * never initialises after the first navigation.
 *
 * Hoisting them into `frontmatter.head` is the VitePress-native equivalent of
 * what Hexo did: the tag still loads, still only on the pages that ask for it,
 * and never reaches the template compiler.
 *
 * Note this deliberately only touches scripts with a `src`. A `<script setup>`
 * block (see `archives/index.md`) belongs to the page's SFC and is left for
 * mdit-vue's own sfc plugin to hoist.
 */
import type MarkdownIt from 'markdown-it'

/** An external script tag: has a `src`, and carries no inline body. */
const EXTERNAL_SCRIPT = /<script\b([^>]*\bsrc\s*=[^>]*)>\s*<\/script>/gi

const ATTRIBUTE = /([a-zA-Z_:][-\w:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

type HeadTag = [string, Record<string, string>]

export function externalScripts(md: MarkdownIt): void {
  const next = md.renderer.rules.html_block!

  md.renderer.rules.html_block = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const stripped = hoistScripts(token.content, env)

    if (stripped === token.content) return next(tokens, idx, options, env, self)
    // A block that was nothing but the script leaves no markup behind.
    if (!stripped.trim()) return ''

    token.content = stripped
    return next(tokens, idx, options, env, self)
  }
}

/**
 * `env.frontmatter` is read out of `env` *after* `md.render()` returns, so a
 * renderer rule can still contribute to it.
 */
function hoistScripts(content: string, env: Record<string, any>): string {
  return content.replace(EXTERNAL_SCRIPT, (_match, attrs: string) => {
    addHeadTag(env, ['script', parseAttributes(attrs)])
    return ''
  })
}

function addHeadTag(env: Record<string, any>, tag: HeadTag): void {
  const frontmatter = (env.frontmatter ??= {})
  const head: HeadTag[] = (frontmatter.head ??= [])

  const alreadyThere = head.some(
    ([name, attrs]) => name === tag[0] && attrs?.src === tag[1].src
  )
  if (!alreadyThere) head.push(tag)
}

/** Valueless attributes (`async`, `defer`) become `""`, as VitePress expects. */
function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {}

  for (const [, name, doubleQuoted, singleQuoted, bare] of source.matchAll(ATTRIBUTE)) {
    attributes[name] = doubleQuoted ?? singleQuoted ?? bare ?? ''
  }

  return attributes
}
