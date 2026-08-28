#!/usr/bin/env node
/**
 * dsh-model-auto-hot-switch — package smoke test.
 *
 * Verifies the installable shape the DSH plugin stores validate:
 *   1. package.json declares dsh.bundle.patch and the patch file exists
 *   2. lib/index.js (host) and lib/client.js (browser) exist and parse
 *   3. the bundle patch references a plugin row whose name resolves
 *
 * Run: npm test
 */
const { readFileSync, existsSync } = require('node:fs')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')

const root = join(__dirname, '..')
let failures = 0

function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ok  ${label}`)
  } else {
    failures += 1
    console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

console.log('dsh-model-auto-hot-switch smoke test')

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
check('package.json: dsh.bundle.patch declared', pkg.dsh && pkg.dsh.bundle && typeof pkg.dsh.bundle.patch === 'string', JSON.stringify(pkg.dsh))
check('package.json: main points at lib/index.js', pkg.main === 'lib/index.js', pkg.main)

const patch = pkg.dsh && pkg.dsh.bundle && pkg.dsh.bundle.patch
check('cordis.patch.yml exists next to package.json', patch !== undefined && existsSync(join(root, patch)), patch)

for (const file of ['lib/index.js', 'lib/client.js', 'README.md', 'README.zh.md', 'LICENSE']) {
  check(`${file} exists`, existsSync(join(root, file)))
}

for (const file of ['lib/index.js', 'lib/client.js']) {
  const checkRun = spawnSync(process.execPath, ['--check', join(root, file)], { encoding: 'utf8' })
  check(`${file} parses (node --check)`, checkRun.status === 0, checkRun.stderr.trim().split('\n')[0])
}

const patchText = readFileSync(join(root, patch), 'utf8')
check('cordis.patch.yml references the package name', patchText.includes('dsh-model-auto-hot-switch'))

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')
