// Runs every FLEX browser test and prints one summary line per suite.
// Needs the app served at http://localhost:8765 (see README.md in this folder).
//   - "check" suites print PASS/FAIL lines; any FAIL fails the run.
//   - "snapshot" suites print what they observe; the output must match
//     expected/<name>.txt exactly (refresh it deliberately if behaviour changes).
import { execFileSync } from 'child_process';
import fs from 'fs';

const here = new URL('.', import.meta.url).pathname;
const suites = [
  ['03-milestone4-features', 'check'],   // run first: also writes fake_yt.js
  ['01-core-flows', 'snapshot'],
  ['02-click-wheel', 'snapshot'],
  ['04-install-popup', 'check'],
  ['05-off-switch', 'check'],
  ['06-autopaste-brave', 'check'],
  ['07-auto-advance-logic', 'check'],
  ['08-background-auto-advance', 'check'],
];
let failed = 0;
for (const [name, kind] of suites) {
  let out;
  try { out = execFileSync('node', [`${name}.mjs`], { cwd: here, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000 }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  if (kind === 'check') {
    const pass = (out.match(/^PASS /gm) || []).length;
    const fail = (out.match(/^FAIL /gm) || []).length;
    const bad = fail > 0 || pass === 0;
    if (bad) failed++;
    console.log(`${bad ? '✗' : '✓'} ${name}: ${pass} passed, ${fail} failed`);
    if (bad) console.log(out.split('\n').filter(l => l.startsWith('FAIL') || /Error/.test(l)).map(l => '    ' + l).join('\n'));
  } else {
    const expected = fs.readFileSync(new URL(`expected/${name}.txt`, import.meta.url), 'utf8');
    const same = out === expected;
    if (!same) failed++;
    console.log(`${same ? '✓' : '✗'} ${name}: ${same ? 'matches snapshot' : 'output changed — compare with expected/' + name + '.txt'}`);
    if (!same) fs.writeFileSync(new URL(`${name}.actual.txt`, import.meta.url), out);
  }
}
console.log(failed ? `\n${failed} suite(s) failed` : '\nAll suites passed');
process.exitCode = failed ? 1 : 0;
