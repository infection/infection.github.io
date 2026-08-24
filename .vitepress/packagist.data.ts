/**
 * Adoption numbers for the landing page, pulled from Packagist at build time.
 *
 * A VitePress data loader, so the fetch happens once per build and the result
 * is inlined into the page -- no client-side request, nothing to fail in the
 * reader's browser. `FALLBACK` is the last known-good snapshot: if Packagist
 * is unreachable (offline build, CI without egress) the build still succeeds
 * with slightly stale numbers rather than dying, and the loader says so on
 * stderr. Refresh FALLBACK when it drifts noticeably from reality.
 */

export interface PackagistStats {
  /** All-time `composer require infection/infection` installs. */
  installsTotal: number
  installsMonthly: number
  installsDaily: number
  /** Packages on Packagist that require Infection. */
  dependents: number
  githubStars: number
  /** ISO date the numbers were captured, for the "as of" line. */
  fetchedAt: string
  /** False when FALLBACK was used, i.e. the network fetch did not happen. */
  live: boolean
}

const FALLBACK: PackagistStats = {
  installsTotal: 31_063_019,
  installsMonthly: 1_283_122,
  installsDaily: 56_518,
  dependents: 2_329,
  githubStars: 2_233,
  fetchedAt: '2026-08-24',
  live: false
}

const ENDPOINT = 'https://packagist.org/packages/infection/infection.json'

declare const data: PackagistStats
export { data }

export default {
  async load(): Promise<PackagistStats> {
    try {
      const res = await fetch(ENDPOINT, {
        headers: { 'user-agent': 'infection.github.io build (+https://infection.github.io)' },
        signal: AbortSignal.timeout(10_000)
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const { package: pkg } = (await res.json()) as {
        package: {
          downloads: { total: number; monthly: number; daily: number }
          dependents: number
          github_stars: number
        }
      }

      return {
        installsTotal: pkg.downloads.total,
        installsMonthly: pkg.downloads.monthly,
        installsDaily: pkg.downloads.daily,
        dependents: pkg.dependents,
        githubStars: pkg.github_stars,
        fetchedAt: new Date().toISOString().slice(0, 10),
        live: true
      }
    } catch (e) {
      console.warn(
        `[packagist.data] could not reach Packagist (${(e as Error).message}); ` +
          `using the ${FALLBACK.fetchedAt} snapshot.`
      )
      return FALLBACK
    }
  }
}
