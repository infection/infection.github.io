/**
 * Stops VitePress from appending `.html` to links that point at real files in
 * `public/`.
 *
 * With `cleanUrls: false` VitePress rewrites every extensionless internal link
 * to `<link>.html`. It skips a fixed list of asset extensions; `.pub` is not on
 * it, so `[with our GPG key](/files/infection.pub)` in the installation guide
 * silently becomes `/files/infection.pub.html` -- a 404 on the one link whose
 * whole job is letting people verify the PHAR signature.
 *
 * VitePress does this in its own `link_open` *renderer* rule, so undoing it in
 * a core rule is too early. This wraps that renderer rule and repairs the href
 * afterwards, but only where dropping `.html` names a file that actually
 * exists under `public/`.
 *
 * `markdown.config` is invoked after VitePress registers its plugins, so the
 * rule being wrapped here is always VitePress's own.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type MarkdownIt from 'markdown-it'

const INTERNAL_HTML_HREF = /href="(\/[^"?#]*)\.html"/g

export function publicAssetLinks(md: MarkdownIt, publicDir: string): void {
  const renderLink = md.renderer.rules.link_open

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const rendered = renderLink
      ? renderLink(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options)

    return rendered.replace(INTERNAL_HTML_HREF, (match, path: string) =>
      existsSync(join(publicDir, decodeURIComponent(path))) ? `href="${path}"` : match
    )
  }
}
