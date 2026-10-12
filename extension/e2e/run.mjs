// Packs the extension with scripts/pack.sh, unzips the Chrome and Firefox packages and runs
// every *.test.mjs suite against each browser. Usage: node e2e/run.mjs [chrome|firefox]
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const only = process.argv[2];

execFileSync('bash', [join(root, 'scripts', 'pack.sh')], { cwd: root, stdio: 'ignore' });
const work = mkdtempSync(join(tmpdir(), 'tabflow-e2e-'));
const dirs = { chrome: join(work, 'chrome'), firefox: join(work, 'firefox') };
for (const [kind, dir] of Object.entries(dirs)) {
    mkdirSync(dir);
    execFileSync('unzip', ['-q', join(root, `tabflow-${kind}.zip`), '-d', dir]);
}

const browsers = [];
if (only !== 'firefox' && process.env.CHROME_BIN) browsers.push('chrome');
if (only !== 'chrome' && process.env.FF_BIN) browsers.push('firefox');
if (!browsers.length) {
    console.error('Set CHROME_BIN and/or FF_BIN to browser executables (see e2e/README.md).');
    process.exit(2);
}

const shots = join(work, 'screenshots');
mkdirSync(shots);
let failed = 0;
for (const kind of browsers) {
    for (const suite of readdirSync(here).filter(f => f.endsWith('.test.mjs')).sort()) {
        console.log(`\n=== ${kind}: ${suite}`);
        const res = spawnSync('node', [join(here, suite), kind, dirs[kind]], { stdio: 'inherit', env: { ...process.env, SHOTS: shots } });
        if (res.status !== 0) failed++;
    }
}
console.log(`\nScreenshots: ${shots}`);
console.log(failed ? `${failed} suite(s) failed` : 'All suites passed');
process.exit(failed ? 1 : 0);
