// Typo-tolerant matching for search. Yahoo's search has no spelling correction ("appel", "relaince" and
// "nvidea" all return nothing), so the API widens the net with prefix searches and ranks what comes back here.

export type Candidate = { symbol: string; name: string; exchange: string; type?: string }

// Words that say nothing about which company it is
const FILLER = new Set(["the", "inc", "corp", "corporation", "co", "company", "ltd", "limited", "plc", "sa", "ag", "nv", "se", "holdings", "group", "of", "and", "class"])

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !FILLER.has(w))

/** Edit distance where swapping two neighbouring letters counts as one edit (optimal string alignment) */
export function editDistance(a: string, b: string) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) rows[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1)
    }
  }
  return rows[a.length][b.length]
}

/** How many typos a word of this length may carry and still count as a match */
const allowance = (len: number) => (len <= 3 ? 0 : len <= 5 ? 1 : len <= 9 ? 2 : 3)

/**
 * Typos in one typed word against one word of the name: whole typos, plus a fraction that only ranks.
 * The typed word may be the start of a longer word ("tata mot" → "motors"), so it is also compared with
 * the name word's prefixes, ranked just below a whole-word match ("appel" → Apple before AppLovin).
 */
function wordTypos(typed: string, target: string) {
  if (target === typed) return 0
  if (target.startsWith(typed)) return 0.25
  let best = editDistance(typed, target)
  for (let n = Math.max(1, typed.length - 1); n <= Math.min(target.length - 1, typed.length + 1); n++) {
    best = Math.min(best, editDistance(typed, target.slice(0, n)) + 0.5)
  }
  return best
}

/**
 * How well a candidate matches what was typed: 0 is a perfect match, 1 or more means a typo was forgiven,
 * null is no match.
 * Every typed word has to land on some word of the name or on the ticker, within its typo allowance.
 */
export function matchScore(query: string, c: Candidate): number | null {
  const typed = words(query)
  if (!typed.length) return null
  const ticker = c.symbol.toLowerCase().replace(/^\^/, "").replace(/\.[a-z]{1,3}$/, "")
  // Also try the name run together, so "tatamotors" or "coalindia" typed as one word still match
  const nameWords = words(c.name)
  const targets = [...nameWords, nameWords.join(""), ticker]
  let total = 0
  for (const w of typed) {
    const best = Math.min(...targets.map((t) => wordTypos(w, t)))
    if (Math.floor(best) > allowance(w.length)) return null
    total += best
  }
  return total
}

/** The prefix searches worth asking Yahoo for when the typed text finds nothing */
export function prefixQueries(query: string) {
  const typed = words(query)
  if (!typed.length || typed.join("").length < 4) return []
  const [first, second] = typed
  const out = new Set<string>()
  if (first.length >= 3) out.add(first.slice(0, 3))
  if (first.length >= 5) out.add(first.slice(0, 4))
  // "tata moters" → "tata mo": a correct first word narrows the field, the second word's start picks the company
  if (second && second.length >= 2) out.add(`${first} ${second.slice(0, 2)}`)
  return [...out].slice(0, 3)
}

/** Keep the candidates close enough to what was typed, best first; ties keep their original (Yahoo relevance) order */
export function rankFuzzy<T extends Candidate>(query: string, candidates: T[]): T[] {
  const seen = new Set<string>()
  return candidates
    .map((c, i) => ({ c, i, score: matchScore(query, c) }))
    .filter((x): x is { c: T; i: number; score: number } => {
      if (x.score === null || seen.has(x.c.symbol)) return false
      seen.add(x.c.symbol)
      return true
    })
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .map((x) => x.c)
}
