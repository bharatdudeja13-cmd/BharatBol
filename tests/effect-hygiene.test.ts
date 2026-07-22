/**
 * Regression gate for the blank-page navigation bug.
 *
 * `useEffect(() => someCall(), deps)` returns someCall's result to React as
 * the cleanup function. When the call returns a Promise (window.scrollTo
 * does, in newer Chrome), React throws "destroy is not a function" on the
 * next dependency change — which surfaced as a blank page on the first
 * client-side navigation. Effects must use block bodies so their return
 * value is explicit.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

describe('effect hygiene', () => {
  it('no useEffect/useLayoutEffect with a concise arrow body (implicit return)', () => {
    const offenders: string[] = [];
    for (const file of walk(join(__dirname, '../src'))) {
      const src = readFileSync(file, 'utf8');
      // Concise body = first non-whitespace char after "=>" is not "{".
      // ([^\s{] instead of a lookahead: \s* backtracking against (?!{)
      // false-positives on "=> {".)
      const re = /use(Layout)?Effect\(\s*(async\s*)?\(\)\s*=>\s*[^\s{]/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        const line = src.slice(0, m.index).split('\n').length;
        offenders.push(`${file}:${line}`);
      }
      if (/use(Layout)?Effect\(\s*async/.test(src)) offenders.push(`${file} (async effect)`);
    }
    expect(offenders).toEqual([]);
  });

  it('the route tree is wrapped in an error boundary (no silent blank pages)', () => {
    const app = readFileSync(join(__dirname, '../src/App.tsx'), 'utf8');
    expect(app).toMatch(/<ErrorBoundary>[\s\S]*<Routes>[\s\S]*<\/Routes>[\s\S]*<\/ErrorBoundary>/);
  });
});
