/**
 * Heading-anchor slugs, byte-compatible with the legacy Hexo site.
 *
 * The old site generated heading ids with `hexo-util`'s `slugize()`, which --
 * unlike every modern slugifier -- PRESERVES CAPITALISATION. Real anchors that
 * are live on the internet today and must keep working:
 *
 *   /guide/installation.html#Phar                (not #phar)
 *   /guide/installation.html#Compatibility-Note  (not #compatibility-note)
 *   /guide/command-line-options.html#threads-or-j
 *
 * VitePress's default slugify (@mdit-vue/shared) lowercases and strips
 * differently, so swapping it in would silently break ~225 internal deep links
 * plus every anchor ever pasted into a GitHub issue or release note.
 *
 * Algorithm, straight from hexo-util:
 *   1. fold diacritics (e-acute -> e), leaving other non-ASCII alone
 *      (curly quotes, hearts and rocket emoji all survive in real anchors)
 *   2. drop control characters
 *   3. collapse runs of whitespace/punctuation into a single "-"
 *   4. collapse repeated "-"
 *   5. trim leading/trailing "-"
 *   6. NO case change
 *
 * Duplicate headings get "-1", "-2", ... which is also markdown-it-anchor's
 * default, so uniqueness is left to it.
 *
 * Verified against the legacy build by `bin/check-urls.mjs`. Do not "clean up"
 * this function -- it is a compatibility shim, not a style choice.
 */

const COMBINING_MARK = /[\u0300-\u036f]/g
const CONTROL = /[\u0000-\u001f]/g
const SPECIAL_CHAR = /[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'<>,.?/]+/g
const REPEATED_DASH = /-{2,}/g
const EDGE_DASH = /^-|-$/g

export function slugify(str: string): string {
  return str
    .normalize('NFD')
    .replace(COMBINING_MARK, '')
    .replace(CONTROL, '')
    .replace(SPECIAL_CHAR, '-')
    .replace(REPEATED_DASH, '-')
    .replace(EDGE_DASH, '')
}
