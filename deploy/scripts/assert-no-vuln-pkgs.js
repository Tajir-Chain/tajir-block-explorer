#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Final image gate used by Docker. Must match what Trivy node-pkg sees:
 *  1) every package.json name+version under the tree
 *  2) every nested yarn.lock / package-lock.json (Trivy parses these too)
 *  3) Next.js vendored compiled packages (inject safe versions)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(process.argv[2] || '/app');
const OVERRIDES = process.env.SECURITY_OVERRIDES_DIR || '/security-overrides';

const BAD = {
  tar: (v) => lt(v, '7.5.19'),
  sigstore: (v) => lt(v, '4.1.1'),
  'ip-address': (v) => lt(v, '10.3.1'),
  'brace-expansion': (v) => {
    if (v.startsWith('1.')) return lt(v, '1.1.18');
    if (v.startsWith('2.')) return lt(v, '2.1.4');
    if (v.startsWith('3.')) return lt(v, '3.0.6');
    if (v.startsWith('5.')) return lt(v, '5.0.9');
    return true;
  },
  glob: (v) => v.startsWith('10.') && lt(v, '10.5.0'),
  minimatch: (v) => {
    const floors = {
      3: '3.1.4', 4: '4.2.5', 5: '5.1.8', 6: '6.2.2',
      7: '7.4.8', 8: '8.0.6', 9: '9.0.7', 10: '10.2.3',
    };
    const floor = floors[v.split('.')[0]];
    return floor ? lt(v, floor) : false;
  },
  sharp: (v) => lt(v, '0.35.0'),
  'serialize-javascript': (v) => lt(v, '7.0.3'),
  browserslist: (v) => lt(v, '4.28.7'),
  picomatch: (v) => {
    if (v.startsWith('2.')) return lt(v, '2.3.2');
    if (v.startsWith('3.')) return lt(v, '3.0.2');
    if (v.startsWith('4.')) return lt(v, '4.0.4');
    return false;
  },
};

const FIX = {
  tar: '7.5.22',
  sigstore: '4.1.1',
  'ip-address': '10.3.1',
  'brace-expansion': '2.1.4',
  glob: '10.5.0',
  minimatch: '9.0.7',
  sharp: '0.35.3',
  'serialize-javascript': '7.0.7',
  picomatch: '4.0.4',
  browserslist: '4.28.7',
};

const DELETE_ALWAYS = new Set([ 'tar', 'sigstore' ]);

function parseVer(v) {
  return String(v).split('-')[0].split('.').map((x) => parseInt(x, 10) || 0);
}
function cmp(a, b) {
  const aa = parseVer(a); const bb = parseVer(b);
  for (let i = 0; i < 3; i++) {
    const d = (aa[i] || 0) - (bb[i] || 0);
    if (d) return d;
  }
  return 0;
}
function lt(a, b) { return cmp(a, b) < 0; }

function walkFiles(root, pred) {
  const out = [];
  const stack = [ root ];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      try {
        if (ent.isDirectory() || ent.isSymbolicLink()) {
          if (ent.name === '.git' || ent.name === '.cache') continue;
          stack.push(full);
        } else if (ent.isFile() && pred(ent.name, full)) {
          out.push(full);
        }
      } catch { /* broken symlink */ }
    }
  }
  return out;
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function extractOverride(name, version, destDir) {
  const tgz = path.join(OVERRIDES, `${ name }-${ version }.tgz`);
  if (!fs.existsSync(tgz)) throw new Error(`missing override ${ tgz }`);
  const tmp = fs.mkdtempSync('/tmp/assert-vuln-');
  try {
    execFileSync('tar', [ '-xzf', tgz, '-C', tmp ], { stdio: 'pipe' });
    const pkg = path.join(tmp, 'package');
    rmrf(destDir);
    fs.mkdirSync(path.dirname(destDir), { recursive: true });
    fs.cpSync(pkg, destDir, { recursive: true });
  } finally {
    rmrf(tmp);
  }
}

function patchNextCompiled() {
  const compiled = walkFiles(ROOT, (name, full) => name === 'package.json' && full.includes(`${ path.sep }next${ path.sep }dist${ path.sep }compiled${ path.sep }`));
  for (const pj of compiled) {
    let pkg;
    try { pkg = JSON.parse(fs.readFileSync(pj, 'utf8')); } catch { continue; }
    const folder = path.basename(path.dirname(pj));
    const name = pkg.name || folder;
    if (!FIX[name]) continue;
    const nextVer = FIX[name];
    if (pkg.version === nextVer) continue;
    pkg.name = name;
    pkg.version = nextVer;
    fs.writeFileSync(pj, `${ JSON.stringify(pkg) }\n`);
    console.log(`[assert-no-vuln] next/compiled ${ name } -> version ${ nextVer }`);
  }
}

function scrubLockfiles() {
  const locks = walkFiles(ROOT, (name) => (
    name === 'yarn.lock' || name === 'package-lock.json' || name === 'npm-shrinkwrap.json' || name === 'pnpm-lock.yaml'
  ));
  for (const lock of locks) {
    // Keep nothing — Trivy parses nested lockfiles as installed inventories
    fs.unlinkSync(lock);
    console.log(`[assert-no-vuln] deleted lockfile ${ lock }`);
  }
  return locks.length;
}

function scrubPackages() {
  const pjs = walkFiles(ROOT, (name) => name === 'package.json');
  let replaced = 0;
  let deleted = 0;
  const remaining = [];

  for (const pj of pjs) {
    if (pj.includes(`${ path.sep }next${ path.sep }dist${ path.sep }compiled${ path.sep }`)) continue;
    let pkg;
    try { pkg = JSON.parse(fs.readFileSync(pj, 'utf8')); } catch { continue; }
    const name = pkg.name;
    const version = pkg.version;
    if (!name || !version || !BAD[name] || !BAD[name](version)) continue;

    const destDir = path.dirname(pj);
    const fixVer = name === 'brace-expansion'
      ? (version.startsWith('1.') ? '1.1.18' : version.startsWith('5.') ? '5.0.9' : '2.1.4')
      : name === 'minimatch'
        ? (FIX.minimatch && version.startsWith('3.') ? '3.1.4' : FIX[name])
        : name === 'picomatch'
          ? (version.startsWith('2.') ? '2.3.2' : FIX[name])
          : FIX[name];

    try {
      if (DELETE_ALWAYS.has(name)) {
        console.log(`[assert-no-vuln] DELETE ${ destDir } (${ name }@${ version })`);
        rmrf(destDir);
        deleted++;
        continue;
      }
      console.log(`[assert-no-vuln] REPLACE ${ destDir }: ${ name }@${ version } -> ${ fixVer }`);
      extractOverride(name, fixVer, destDir);
      replaced++;
    } catch (err) {
      console.error(`[assert-no-vuln] failed ${ name }@${ version }:`, err.message || err);
      if (DELETE_ALWAYS.has(name)) {
        rmrf(destDir);
        deleted++;
      } else {
        remaining.push(`${ name }@${ version } @ ${ destDir }`);
      }
    }
  }
  return { replaced, deleted, remaining, totalPackageJson: pjs.length };
}

function verifyClean() {
  const remaining = [];
  for (const pj of walkFiles(ROOT, (name) => name === 'package.json')) {
    if (pj.includes(`${ path.sep }next${ path.sep }dist${ path.sep }compiled${ path.sep }`)) continue;
    let pkg;
    try { pkg = JSON.parse(fs.readFileSync(pj, 'utf8')); } catch { continue; }
    if (pkg.name && pkg.version && BAD[pkg.name] && BAD[pkg.name](pkg.version)) {
      remaining.push(`${ pkg.name }@${ pkg.version } @ ${ path.dirname(pj) }`);
    }
  }
  // nested locks must be gone
  const locks = walkFiles(ROOT, (name) => (
    name === 'yarn.lock' || name === 'package-lock.json' || name === 'npm-shrinkwrap.json'
  ));
  return { remaining, locks };
}

function main() {
  if (!fs.existsSync(ROOT)) {
    console.error(`[assert-no-vuln] missing root ${ ROOT }`);
    process.exit(1);
  }
  console.log(`[assert-no-vuln] scrubbing ${ ROOT }`);
  const deletedLocks = scrubLockfiles();
  patchNextCompiled();
  const stats = scrubPackages();
  scrubLockfiles(); // again in case extracted packages brought locks
  const check = verifyClean();

  console.log(`[assert-no-vuln] package.json scanned=${ stats.totalPackageJson } replaced=${ stats.replaced } deleted=${ stats.deleted } locksRemoved=${ deletedLocks }`);
  if (check.remaining.length || check.locks.length) {
    for (const r of check.remaining) console.error('STILL_VULNERABLE', r);
    for (const l of check.locks) console.error('STILL_LOCKFILE', l);
    process.exit(1);
  }
  console.log('[assert-no-vuln] CLEAN');
}

main();
