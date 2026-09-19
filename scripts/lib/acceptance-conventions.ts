// The acceptance-test rules in CLAUDE.md that a pattern can check. tests/unit/acceptance-conventions.test.ts holds every
// acceptance test to them, so a test that breaks one fails `npm run verify`; the skill evaluations hold the tests an agent
// writes to them too (scripts/lib/eval-checks.ts).

// A string or template literal: the text a locator is written with.
const LITERAL = String.raw`(?:'[^']*'|"[^"]*"|` + '`[^`]*`)'

// Anything inside an options object up to its closing brace, stepping over template literals, whose ${…} holds braces.
const BODY = String.raw`(?:[^{}` + '`' + String.raw`]|` + '`[^`]*`' + String.raw`)*`

// An options object with a literal `name` and no `exact: true`, as in getByRole('button', { name: 'Delete list' }).
const INEXACT_NAME = new RegExp(String.raw`\{(?!` + BODY + String.raw`\bexact:\s*true)` + BODY + String.raw`\bname:\s*` + LITERAL + BODY + String.raw`\}`)

// getByText or getByLabel with a literal and either no options or options without `exact: true`.
const INEXACT_TEXT = new RegExp(String.raw`\bgetBy(?:Text|Label)\(\s*` + LITERAL + String.raw`\s*(?:\)|,\s*\{(?!` + BODY + String.raw`\bexact:\s*true)` + BODY + String.raw`\}\s*\))`)

export const ACCEPTANCE_RULES: readonly { pattern: RegExp; message: string }[] = [
  { pattern: /\bwaitForTimeout\s*\(/, message: 'uses waitForTimeout; wait for a visible outcome with a web-first assertion' },
  { pattern: /\.only\s*\(/, message: 'contains .only' },
  { pattern: /from\s+['"](?:\.\.\/)+(?:src|scripts)\//, message: 'imports app or script code; drive the UI instead' },
  { pattern: /from\s+['"]firebase(?:-admin)?(?:\/[^'"]*)?['"]/, message: 'imports Firebase; tests must not touch the database' },
  // Playwright matches a name, text or label as a case-insensitive substring unless exact: true is passed, so a literal
  // also matches every longer name that contains it, and the tests share one database where other tests create lists
  // and tasks named after the fixture's ("Groceries run", #86) or after UI wording ("List A" against "Delete list", #102).
  {
    pattern: INEXACT_NAME,
    message: 'locates by a literal name without exact: true; a name also matches longer names, which other tests\' data can produce',
  },
  {
    pattern: INEXACT_TEXT,
    message: 'locates by a literal text or label without exact: true; it also matches longer texts, which other tests\' data can produce',
  },
]

/** What an acceptance test's source breaks of those rules, one message per rule. */
export function conventionViolations(source: string): string[] {
  return ACCEPTANCE_RULES.filter((rule) => rule.pattern.test(source)).map((rule) => rule.message)
}
