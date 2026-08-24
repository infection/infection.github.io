<script setup lang="ts">
/**
 * Landing-page easter egg: the visitor plays the test suite.
 *
 * Typing `mutate` on the home page injects real Infection mutators into the
 * copy already on screen -- an `!` slipped into the tagline, an off-by-one in
 * a statistic, a framework quietly dropped from a list.
 *
 * The run has two beats, mirroring an actual `infection` run:
 *
 *   hunting  the mutations land and the mutants surface on top of them at
 *            once; hovering one shows the diff it made, clicking it kills it
 *   report   whatever survived is revealed inline, and scored as an MSI
 *
 * Costs nothing until triggered: no DOM is touched and no timer runs until
 * the trigger word is typed.
 */
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useData } from 'vitepress'

const { frontmatter } = useData()
const isHome = computed(() => frontmatter.value.layout === 'home')

const TRIGGER = 'mutate'
/** Seconds on the clock. */
const DURATION = 40
const MIN_MSI = 80
/** How long the kill diff stays on screen before settling to the original. */
const DIFF_LINGER = 2000

type Spec = {
  mutator: string
  /** Must match inside a single text node -- true for all of the copy below. */
  pattern: RegExp
  replace: string | ((m: RegExpMatchArray) => string)
}

/**
 * Every entry is an actual Infection mutator applied to actual page copy. A
 * spec whose pattern no longer matches (the marketing text changed, Packagist
 * returned a different shape) is skipped silently and drops out of the count,
 * so the game degrades instead of breaking.
 */
const SPECS: Spec[] = [
  {
    // Hero tagline. The `!` that flips the whole promise of the product.
    mutator: 'LogicalNot',
    pattern: /tests you are missing/,
    replace: 'tests you are not missing'
  },
  {
    // Feature 1 -- the same mutator, the other direction: a dropped `!`.
    mutator: 'LogicalNot',
    pattern: /coverage cannot see/,
    replace: 'coverage can see'
  },
  {
    // Feature 2. `>` becomes `<`: the CI gate now passes on any suite.
    mutator: 'GreaterThan',
    pattern: /--min-msi/,
    replace: '--max-msi'
  },
  {
    // Feature 3. `&&` becomes `||`.
    mutator: 'LogicalAnd',
    pattern: /coverage, and --git-diff-lines/,
    replace: 'coverage, or --git-diff-lines'
  },
  {
    // Feature 4. One element removed from the list -- you have to notice an
    // absence, which is the hardest kind of mutant to catch.
    mutator: 'ArrayItemRemoval',
    pattern: /PHPUnit, Pest, Codeception/,
    replace: 'PHPUnit, Codeception'
  },
  {
    // Feature 4 again -- one card can carry several mutants, as in a real run.
    mutator: 'IncrementInteger',
    pattern: /60\+ mutators/,
    replace: '61+ mutators'
  },
  {
    // Adoption stats. `+` becomes `-`, turning a floor into a ceiling.
    mutator: 'Plus',
    pattern: /(\d+(?:\.\d+)?M)\+/,
    replace: '$1-'
  },
  {
    // Adoption stats. A true off-by-one on a number nobody reads twice.
    mutator: 'DecrementInteger',
    pattern: /about ([\d,]+) every day/,
    replace: (m) => {
      const n = Number(m[1].replace(/,/g, ''))
      if (!Number.isFinite(n) || n <= 0) return m[0]
      return `about ${(n - 1).toLocaleString('en-US')} every day`
    }
  }
]

/** A blobby single-cell thing with two eyes -- legible down to ~14px. */
const MUTANT_SVG = `
<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <path class="mh-antenna" d="M8.5 5.2 6.6 2.4M15.5 5.2l1.9-2.8"/>
  <circle class="mh-antenna-tip" cx="6.4" cy="1.9" r="1.25"/>
  <circle class="mh-antenna-tip" cx="17.6" cy="1.9" r="1.25"/>
  <path class="mh-body" d="M12 4c4.1 0 7 2.4 7.6 6 .3 2-.3 3.6-1.1 5-.7 1.2-1 2-1.2 3.1-.3 1.7-1.6 2.9-3.3 2.9-.8 0-1.4-.3-2-.3s-1.2.3-2 .3c-1.7 0-3-1.2-3.3-2.9-.2-1.1-.5-1.9-1.2-3.1-.8-1.4-1.4-3-1.1-5C5 6.4 7.9 4 12 4Z"/>
  <circle class="mh-eye" cx="9.2" cy="11.4" r="1.75"/>
  <circle class="mh-eye" cx="14.8" cy="11.4" r="1.75"/>
  <circle class="mh-glint" cx="8.6" cy="10.8" r="0.6"/>
  <circle class="mh-glint" cx="14.2" cy="10.8" r="0.6"/>
</svg>`

type Injected = {
  id: number
  mutator: string
  original: string
  mutated: string
  el: HTMLElement
  tag: HTMLElement | null
  killed: boolean
  bornAt: number
}

type Phase = 'idle' | 'hunting' | 'report'

const phase = ref<Phase>('idle')
const remaining = ref(DURATION)
const injected = shallowRef<Injected[]>([])
const log = ref('')
const best = ref<number | null>(null)
const tip = ref<{ mutator: string; original: string; mutated: string; x: number; y: number; below: boolean } | null>(null)

const running = computed(() => phase.value === 'hunting')
const total = computed(() => injected.value.length)
const killed = computed(() => injected.value.filter((i) => i.killed).length)
const escaped = computed(() => total.value - killed.value)
const msi = computed(() =>
  total.value === 0 ? 0 : Math.round((killed.value / total.value) * 100)
)
const passed = computed(() => msi.value >= MIN_MSI)

const clock = computed(() => {
  const s = Math.max(0, remaining.value)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
})

const escapees = computed(() => injected.value.filter((i) => !i.killed))

/** Tally by mutator, the way Infection groups its own summary. */
const tally = computed(() => {
  const counts = new Map<string, { killed: number; escaped: number }>()
  for (const i of injected.value) {
    const row = counts.get(i.mutator) ?? { killed: 0, escaped: 0 }
    row[i.killed ? 'killed' : 'escaped']++
    counts.set(i.mutator, row)
  }
  return [...counts.entries()].map(([mutator, row]) => ({ mutator, ...row }))
})

let timer: ReturnType<typeof setInterval> | null = null
const linger = new Set<ReturnType<typeof setTimeout>>()
let buffer = ''

function scope(): HTMLElement | null {
  return document.querySelector('.VPHome')
}

function reduceMotion(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Wraps the first match of `spec` in a bare <span> carrying the mutated text.
 * The span gets no styling of its own; the creature parked next to it as a
 * sibling is what marks the spot.
 */
function inject(root: HTMLElement, spec: Spec, id: number): Injected | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT
      // Never mutate a mutant, and keep the HUD out of range.
      if (node.parentElement?.closest('.mh-mutant, .mh-ui')) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    }
  })

  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node.nodeValue as string
    const m = text.match(spec.pattern)
    if (!m || m.index === undefined) continue

    const original = m[0]
    const mutated =
      typeof spec.replace === 'function'
        ? spec.replace(m)
        : original.replace(spec.pattern, spec.replace)
    if (mutated === original) continue

    const range = document.createRange()
    range.setStart(node, m.index)
    range.setEnd(node, m.index + original.length)

    const span = document.createElement('span')
    span.className = 'mh-mutant'
    span.textContent = mutated

    range.deleteContents()
    range.insertNode(span)

    return {
      id,
      mutator: spec.mutator,
      original,
      mutated,
      el: span,
      tag: null,
      killed: false,
      bornAt: 0
    }
  }

  return null
}

/** The clickable creature, parked immediately after the text it corrupted. */
function surface(inj: Injected) {
  const tag = document.createElement('button')
  tag.type = 'button'
  tag.className = 'mh-tag'
  tag.setAttribute('aria-label', `Kill the ${inj.mutator} mutant`)
  tag.dataset.mhId = String(inj.id)
  // Stagger the idle wobble so they do not pulse in lockstep.
  tag.style.setProperty('--mh-delay', `${(inj.id % 5) * 0.19}s`)
  tag.innerHTML = MUTANT_SVG

  tag.addEventListener('mouseenter', () => showTip(inj, tag))
  tag.addEventListener('focus', () => showTip(inj, tag))
  tag.addEventListener('mouseleave', hideTip)
  tag.addEventListener('blur', hideTip)

  inj.el.after(tag)
  inj.tag = tag
  inj.bornAt = Date.now()
}

function showTip(inj: Injected, tag: HTMLElement) {
  if (phase.value !== 'hunting') return
  const r = tag.getBoundingClientRect()
  const below = r.top < 120
  tip.value = {
    mutator: inj.mutator,
    original: inj.original,
    mutated: inj.mutated,
    x: r.left + r.width / 2,
    y: below ? r.bottom + 10 : r.top - 10,
    below
  }
}

function hideTip() {
  tip.value = null
}

/** Puts the span's original text back and unwraps it, leaving the DOM as found. */
function restore(inj: Injected) {
  inj.tag?.remove()
  inj.tag = null
  const parent = inj.el.parentNode
  if (!parent) return
  parent.replaceChild(document.createTextNode(inj.original), inj.el)
  parent.normalize()
}

/** Renders `<s>what it said</s> <b>what it should say</b>` into a mutant span. */
function paintDiff(inj: Injected) {
  inj.el.textContent = ''
  const was = document.createElement('s')
  was.textContent = inj.mutated
  const should = document.createElement('b')
  should.textContent = inj.original
  inj.el.append(was, document.createTextNode(' '), should)
}

/**
 * Every feature card and hero action is a link, so navigation has to be held
 * off for the duration of the run.
 *
 * `preventDefault` alone is not enough: VitePress's router listens on `window`
 * with `capture: true`, which fires ahead of any document-level listener, so
 * it would have navigated before this handler ever ran. It does skip links
 * carrying a `target` attribute, though -- so the run tags them with the
 * no-op `target="_self"` and takes it back off on reset.
 */
function holdLinks(root: HTMLElement, hold: boolean) {
  for (const a of root.querySelectorAll('a')) {
    if (hold) {
      if (a.hasAttribute('target')) continue // already opted out of the router
      a.setAttribute('target', '_self')
      a.setAttribute('data-mh-held', '')
    } else if (a.hasAttribute('data-mh-held')) {
      a.removeAttribute('target')
      a.removeAttribute('data-mh-held')
    }
  }
}

function start() {
  const root = scope()
  if (!root || phase.value !== 'idle') return

  const found: Injected[] = []
  SPECS.forEach((spec, i) => {
    const inj = inject(root, spec, i)
    if (inj) found.push(inj)
  })
  if (found.length === 0) return

  injected.value = found
  // The mutations and the creatures sitting on top of them land together --
  // there is nothing to wait for.
  for (const inj of found) surface(inj)

  phase.value = 'hunting'
  remaining.value = DURATION
  log.value = `${found.length} mutants loose. Hover for the diff, click to kill.`

  document.body.classList.add('mh-hunting')
  holdLinks(root, true)
  if (!reduceMotion()) {
    root.classList.add('mh-flicker')
    setTimeout(() => root.classList.remove('mh-flicker'), 420)
  }

  document.addEventListener('click', onClick, true)
  timer = setInterval(() => {
    remaining.value--
    if (remaining.value <= 0) finish()
  }, 1000)
}

function kill(inj: Injected) {
  inj.killed = true
  hideTip()

  const survived = inj.bornAt ? Math.round((Date.now() - inj.bornAt) / 1000) : 0
  log.value = `☠ ${inj.mutator} — killed after ${survived}s`

  // Burst the creature, then take it out of the layout.
  if (inj.tag) {
    const tag = inj.tag
    inj.tag = null
    tag.disabled = true
    tag.classList.add('mh-tag-dying')
    setTimeout(() => tag.remove(), reduceMotion() ? 0 : 420)
  }

  // Show what it had done, then let the sentence settle back to the truth.
  paintDiff(inj)
  inj.el.classList.add('mh-killed')
  const t = setTimeout(() => {
    linger.delete(t)
    if (inj.el.isConnected) {
      inj.el.textContent = inj.original
      inj.el.classList.remove('mh-killed')
    }
  }, DIFF_LINGER)
  linger.add(t)

  injected.value = [...injected.value]
  if (killed.value === total.value) setTimeout(finish, DIFF_LINGER)
}

function onClick(event: MouseEvent) {
  const root = scope()
  const target = event.target as HTMLElement | null
  if (!root || !target) return
  if (target.closest('.mh-ui')) return // the HUD's own buttons still work
  if (!root.contains(target)) return

  event.preventDefault()
  event.stopPropagation()

  // Either the creature or the text it corrupted counts as a hit.
  const tag = target.closest('.mh-tag') as HTMLElement | null
  const span = target.closest('.mh-mutant') as HTMLElement | null
  const hit = injected.value.find(
    (i) => !i.killed && ((tag && i.tag === tag) || (span && i.el === span))
  )

  if (hit) kill(hit)
}

function finish() {
  if (!running.value) return
  stopTimers()
  phase.value = 'report'
  hideTip()
  document.body.classList.remove('mh-hunting')
  document.removeEventListener('click', onClick, true)
  const root = scope()
  if (root) holdLinks(root, false) // links are only ever held while running

  // Settle every killed mutant, and reveal whatever got through.
  for (const inj of injected.value) {
    if (inj.killed) {
      inj.el.textContent = inj.original
      inj.el.classList.remove('mh-killed')
      continue
    }
    inj.tag?.remove()
    inj.tag = null
    inj.el.classList.add('mh-escaped')
    paintDiff(inj)
  }

  record(msi.value)
}

function stopTimers() {
  if (timer) clearInterval(timer)
  for (const t of linger) clearTimeout(t)
  linger.clear()
  timer = null
}

/** Reverts every mutant and takes the page back to how it shipped. */
function reset() {
  stopTimers()
  phase.value = 'idle'
  hideTip()
  document.body.classList.remove('mh-hunting')
  document.removeEventListener('click', onClick, true)
  const root = scope()
  if (root) {
    root.classList.remove('mh-flicker')
    holdLinks(root, false)
  }
  for (const inj of injected.value) restore(inj)
  injected.value = []
  log.value = ''
}

function again() {
  reset()
  // Let the DOM settle before re-walking it.
  setTimeout(start, 60)
}

function record(value: number) {
  try {
    const prev = Number(localStorage.getItem('infection.msi.best') ?? '')
    const next = Number.isFinite(prev) ? Math.max(prev, value) : value
    localStorage.setItem('infection.msi.best', String(next))
    best.value = next
  } catch {
    best.value = value // private windows and blocked storage
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && phase.value !== 'idle') {
    reset()
    return
  }
  if (phase.value !== 'idle') return

  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, select, [contenteditable]')) return
  if (event.metaKey || event.ctrlKey || event.altKey) return
  if (event.key.length !== 1) return

  buffer = (buffer + event.key.toLowerCase()).slice(-TRIGGER.length)
  if (buffer === TRIGGER) {
    buffer = ''
    start()
  }
}

onMounted(() => {
  if (!isHome.value) return

  try {
    const stored = Number(localStorage.getItem('infection.msi.best') ?? '')
    if (Number.isFinite(stored) && stored > 0) best.value = stored
  } catch {
    /* storage unavailable -- the game still runs, it just forgets */
  }

  document.addEventListener('keydown', onKeydown)
  window.addEventListener('scroll', hideTip, { passive: true })

  // eslint-disable-next-line no-console
  console.log(
    '%c  ⌁ infection %c\n\n' +
      '   Some of the words on this page are lying to you.\n' +
      "   Type `mutate` to find out which, and see how many you'd catch.\n",
    'background:#42b983;color:#fff;font-weight:700;padding:2px 6px;border-radius:3px',
    'color:#42b983;font-family:ui-monospace,monospace;line-height:1.5'
  )
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', hideTip)
  reset()
})

// Leaving the home page mid-run tears everything down.
watch(isHome, (home) => {
  if (!home) reset()
})
</script>

<template>
  <div v-if="isHome && phase !== 'idle'" class="mh-ui">
    <!-- HUD -->
    <aside v-if="running" class="mh-hud" role="status" aria-live="polite">
      <div class="mh-hud-top">
        <span class="mh-hud-count">{{ killed }}/{{ total }} killed</span>
        <span class="mh-hud-clock">{{ clock }}</span>
      </div>
      <div class="mh-bar"><i :style="{ width: msi + '%' }" /></div>
      <p class="mh-hud-log">{{ log }}</p>
      <div class="mh-hud-actions">
        <button type="button" @click="finish">Report</button>
        <button type="button" class="mh-ghost" @click="reset">esc to abort</button>
      </div>
    </aside>

    <!-- Hover diff, in Infection's own unified-diff shape -->
    <div
      v-if="tip"
      class="mh-tip"
      :class="{ 'mh-tip-below': tip.below }"
      :style="{ left: tip.x + 'px', top: tip.y + 'px' }"
    >
      <span class="mh-tip-mutator">{{ tip.mutator }}</span>
      <span class="mh-tip-del">- {{ tip.original }}</span>
      <span class="mh-tip-add">+ {{ tip.mutated }}</span>
    </div>

    <!-- Report card, in the shape of Infection's own CLI summary -->
    <div v-if="phase === 'report'" class="mh-overlay" @click.self="reset">
      <section class="mh-report" role="dialog" aria-label="Mutation testing result">
        <pre class="mh-cli"><span class="mh-dim">{{ total }} mutations were generated:</span>
   <span class="mh-ok">{{ killed }} mutants were killed</span>
   <span class="mh-bad">{{ escaped }} mutants escaped</span>

<span class="mh-dim">Metrics:</span>
   Mutation Score Indicator (MSI): <span :class="passed ? 'mh-ok' : 'mh-bad'">{{ msi }}%</span>
<span v-for="row in tally" :key="row.mutator">   <span class="mh-dim">{{ row.mutator }}</span>: {{ row.killed }} killed, {{ row.escaped }} escaped
</span></pre>

        <p :class="['mh-verdict', passed ? 'mh-ok' : 'mh-bad']">
          {{
            passed
              ? `Your build would have passed --min-msi=${MIN_MSI}.`
              : `Your build would have failed with --min-msi=${MIN_MSI}.`
          }}
        </p>

        <p v-if="escaped" class="mh-note">
          The {{ escaped === 1 ? 'mutant' : 'mutants' }} you missed
          {{ escaped === 1 ? 'is' : 'are' }} marked on the page behind this
          panel — struck out, with what the sentence should have said.
          That is what an escaped mutant looks like in your own code.
        </p>
        <p v-else class="mh-note">
          Nothing got past you. Your test suite should be so lucky.
        </p>

        <p v-if="best !== null" class="mh-best">Best MSI on this browser: {{ best }}%</p>

        <div class="mh-report-actions">
          <button type="button" class="mh-primary" @click="again">Run again</button>
          <a class="mh-link" href="/guide/mutators.html">See the real mutators</a>
          <button type="button" class="mh-ghost" @click="reset">Close</button>
        </div>
      </section>
    </div>
  </div>
</template>

<style>
/* Not scoped: the mutant spans and creatures live inside VitePress's own
   markup, not this component's tree. Every selector is `mh-` prefixed. */

/* A mutant span is deliberately indistinguishable from the text around it:
   the creature beside it is what marks the spot, so that the corrupted
   sentence still reads as ordinary copy until you look at the diff. */
.mh-mutant {
  all: unset;
}

body.mh-hunting {
  user-select: none;
}

/* The creature */
/* The button box stays perfectly still -- only the creature inside wobbles.
   A hit target that drifts under the cursor is annoying to click, and it also
   makes the element permanently "unstable" to anything driving the page. */
.mh-tag {
  display: inline-block;
  /* Buttons do not inherit font-size, so `em` would size against the browser
     default rather than the copy the mutant is sitting in. */
  font-size: inherit;
  /* ...but they DO inherit line-height, and a 36px strut inside a 22px button
     shoves the block-level <svg> a whole line down the page. */
  line-height: 0;
  width: clamp(16px, 1.05em, 22px);
  height: clamp(16px, 1.05em, 22px);
  margin: 0 0.1em 0 0.16em;
  padding: 0;
  border: 0;
  background: none;
  /* Sits on the text's optical centre rather than hanging off the baseline
     like a descender. */
  vertical-align: middle;
  cursor: crosshair;
}

.mh-tag svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  transform-origin: 50% 60%;
  animation: mh-wobble 2.4s ease-in-out infinite;
  animation-delay: var(--mh-delay, 0s);
  transition: transform 0.14s ease-out;
}

.mh-tag .mh-body {
  fill: #42b983;
  stroke: #2f8c60;
  stroke-width: 1.1;
}

.mh-tag .mh-eye {
  fill: #14351f;
}

.mh-tag .mh-glint {
  fill: #ffffff;
}

.mh-tag .mh-antenna {
  stroke: #2f8c60;
  stroke-width: 1.4;
  stroke-linecap: round;
  fill: none;
}

.mh-tag .mh-antenna-tip {
  fill: #2f8c60;
}

.mh-tag:focus-visible {
  outline: none;
}

.mh-tag:hover svg,
.mh-tag:focus-visible svg {
  transform: scale(1.4);
  animation-play-state: paused;
}

.mh-tag:hover .mh-body,
.mh-tag:focus-visible .mh-body {
  fill: #f0616f;
  stroke: #b8323f;
}

.mh-tag:hover .mh-antenna,
.mh-tag:focus-visible .mh-antenna {
  stroke: #b8323f;
}

.mh-tag:hover .mh-antenna-tip,
.mh-tag:focus-visible .mh-antenna-tip {
  fill: #b8323f;
}

.mh-tag-dying {
  pointer-events: none;
}

.mh-tag-dying svg {
  animation: mh-burst 0.4s ease-out forwards;
}

@keyframes mh-wobble {
  0%, 100% { transform: translateY(0) rotate(-5deg); }
  50% { transform: translateY(-2px) rotate(5deg); }
}

@keyframes mh-burst {
  0% { transform: scale(1.35); opacity: 1; }
  40% { transform: scale(1.9) rotate(18deg); opacity: 0.75; }
  100% { transform: scale(0.1) rotate(-30deg); opacity: 0; }
}

/* The inline diff, both on kill and on escape */
.mh-killed,
.mh-escaped {
  border-radius: 3px;
  padding: 0 3px;
}

.mh-killed {
  background-color: rgba(66, 185, 131, 0.16);
  box-shadow: inset 0 -2px 0 rgba(66, 185, 131, 0.85);
}

.mh-escaped {
  background-color: rgba(224, 62, 62, 0.16);
  box-shadow: inset 0 -2px 0 rgba(224, 62, 62, 0.8);
}

/* The stat headlines paint their text with a clipped gradient and an
   inherited `-webkit-text-fill-color: transparent`. Anything nested in them
   inherits that transparency, so the diff has to opt back out or it renders
   as a coloured box with no readable text. */
.mh-killed,
.mh-escaped,
.mh-killed s,
.mh-escaped s,
.mh-killed b,
.mh-escaped b {
  -webkit-text-fill-color: currentColor;
}

.mh-killed s,
.mh-escaped s {
  color: var(--vp-c-text-2);
  opacity: 0.6;
}

.mh-killed b,
.mh-escaped b {
  color: var(--vp-c-brand-1);
}

.mh-flicker {
  animation: mh-glitch 0.42s steps(2, end) 1;
}

@keyframes mh-glitch {
  0% { filter: none; transform: none; }
  20% { filter: hue-rotate(70deg) saturate(1.6); transform: translateX(-2px); }
  40% { filter: invert(0.08); transform: translateX(3px); }
  60% { filter: hue-rotate(-40deg); transform: translateX(-1px); }
  100% { filter: none; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .mh-flicker,
  .mh-tag svg,
  .mh-tag-dying svg {
    animation: none;
  }
}

/* Hover diff */
.mh-tip {
  position: fixed;
  z-index: 102;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: min(360px, 80vw);
  padding: 8px 10px;
  border-radius: 8px;
  background-color: #1b1b1f;
  box-shadow: var(--vp-shadow-3);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  pointer-events: none;
  transform: translate(-50%, -100%);
}

.mh-tip-below {
  transform: translate(-50%, 0);
}

.mh-tip-mutator {
  color: #8e8e93;
  font-weight: 700;
}

.mh-tip-del { color: #f66f81; }
.mh-tip-add { color: #42b983; }

/* HUD */
.mh-hud {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 100;
  width: 268px;
  padding: 14px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background-color: var(--vp-c-bg-elv);
  box-shadow: var(--vp-shadow-3);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  cursor: default;
}

.mh-hud-top {
  display: flex;
  justify-content: space-between;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.mh-hud-clock {
  color: var(--vp-c-text-3);
}

.mh-bar {
  height: 4px;
  margin: 10px 0;
  border-radius: 2px;
  background-color: var(--vp-c-default-soft);
  overflow: hidden;
}

.mh-bar i {
  display: block;
  height: 100%;
  background-color: var(--vp-c-brand-1);
  transition: width 0.3s ease-out;
}

.mh-hud-log {
  margin: 0;
  min-height: 2.4em;
  color: var(--vp-c-text-2);
  line-height: 1.4;
}

.mh-hud-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.mh-hud-actions button,
.mh-report-actions button {
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: transparent;
  color: var(--vp-c-text-1);
  padding: 4px 10px;
}

.mh-hud-actions button:hover,
.mh-report-actions button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.mh-ghost {
  border-color: transparent !important;
  color: var(--vp-c-text-3) !important;
}

.mh-ghost:hover {
  color: var(--vp-c-brand-1) !important;
}

/* Report */
.mh-overlay {
  position: fixed;
  inset: 0;
  z-index: 101;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background-color: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
}

.mh-report {
  width: min(560px, 100%);
  max-height: 86vh;
  overflow-y: auto;
  padding: 24px;
  border-radius: 14px;
  border: 1px solid var(--vp-c-divider);
  background-color: var(--vp-c-bg-elv);
  box-shadow: var(--vp-shadow-5);
}

.mh-cli {
  margin: 0;
  padding: 16px;
  border-radius: 8px;
  background-color: #1b1b1f;
  color: #d7d7db;
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-x: auto;
}

.mh-ok { color: #42b983; }
.mh-bad { color: #f66f81; }
.mh-dim { color: #8e8e93; }

.mh-verdict {
  margin: 16px 0 0;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  font-weight: 700;
}

.mh-note {
  margin: 12px 0 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

.mh-best {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.mh-report-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 20px;
}

.mh-report-actions .mh-primary {
  border-color: transparent;
  background-color: var(--vp-button-brand-bg);
  color: var(--vp-button-brand-text);
  font-weight: 600;
}

.mh-report-actions .mh-primary:hover {
  background-color: var(--vp-button-brand-hover-bg);
  color: var(--vp-button-brand-text);
}

.mh-link {
  font-size: 12px;
  color: var(--vp-c-brand-1);
  text-decoration: underline;
  text-underline-offset: 2px;
}

@media (max-width: 640px) {
  .mh-hud {
    right: 12px;
    left: 12px;
    bottom: 12px;
    width: auto;
  }
}
</style>
