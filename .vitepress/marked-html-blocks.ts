/**
 * Renders markdown *inside* raw HTML blocks, the way the legacy site did.
 *
 * Hexo used `marked`, which lexes inline markdown inside an HTML block unless
 * the tag is pre/script/style. markdown-it does the opposite: an html_block is
 * copied out verbatim. Without this shim the site's 17 `<p class="tip">` boxes
 * and 5 `<span class="version-since">` badges would start showing literal
 * backticks instead of `<code>`, e.g.
 *
 *   <p class="tip">... using `infection config:list-sources --filter=<filter>`.</p>
 *
 * That example is also why this is not merely cosmetic: rendered verbatim, the
 * `<filter>` placeholder reaches the Vue template compiler as an unclosed
 * element and fails the build. Inline-rendered it becomes `&lt;filter&gt;`
 * inside a `<code>` -- byte-identical to the legacy output.
 */
import type MarkdownIt from 'markdown-it'

/** marked's exception list: content of these is never inline-lexed. */
const VERBATIM_TAGS = new Set(['pre', 'script', 'style'])

const OPENING_TAG = /^\s*<([a-zA-Z][a-zA-Z0-9-]*)/

export function markedHtmlBlocks(md: MarkdownIt): void {
  md.renderer.rules.html_block = (tokens, idx) => {
    const { content } = tokens[idx]
    const tag = OPENING_TAG.exec(content)?.[1]?.toLowerCase()

    if (!tag || VERBATIM_TAGS.has(tag)) return content

    // The tags themselves survive: markdown-it's inline html rule passes them
    // through unchanged, exactly like marked's inline `tag` rule did.
    return md.renderInline(content)
  }
}
