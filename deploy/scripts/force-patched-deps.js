#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Replace (or remove) vulnerable nested copies of security-sensitive packages.
 * Prefers vendored tarballs in deploy/security-overrides (offline, deterministic).
 *
 * Usage:
 *   node force-patched-deps.js <node_modules_or_app_root> [--fail] [--delete-unused]
 *
 * --fail           exit 1 if any vulnerable package remains
 * --delete-unused  delete tar/sigstore trees entirely if still present (not needed at runtime)
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const FLAGS = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));
const TARGET = path.resolve(args[0] || 'node_modules');
const FAIL = FLAGS.has('--fail');
const DELETE_UNUSED = FLAGS.has('--delete-unused');

const OVERRIDE_DIRS = [
  process.env.SECURITY_OVERRIDES_DIR,
  '/security-overrides',
  path.resolve(__dirname, '../security-overrides'),
  path.resolve(process.cwd(), 'deploy/security-overrides'),
].filter(Boolean);

const PACKAGES = [
  'tar',
  'sigstore',
  'ip-address',
  'brace-expansion',
  'glob',
  'minimatch',
  'serialize-javascript',
  'sharp',
  'picomatch',
  'ws',
  'postcss',
  'js-yaml',
  'immutable',
];

// Runtime-unnecessary in the shipped explorer image — safe to delete if patching fails.
const DELETABLE = new Set([ 'tar', 'sigstore' ]);

function parseVer(v) {
  return String(v).split('-')[0].split('.').map((x) => parseInt(x, 10) || 0);
}

function cmp(a, b) {
  const aa = parseVer(a);
  const bb = parseVer(b);
  for (let i = 0; i < Math.max(aa.length, bb.length); i++) {
    const d = (aa[i] || 0) - (bb[i] || 0);
    if (d) return d;
  }
  return 0;
}

function lt(a, b) {
  return cmp(a, b) < 0;
}

function isVulnerable(name, version) {
  if (!version) return false;
  switch (name) {
    case 'tar':
      return lt(version, '7.5.19');
    case 'sigstore':
      return lt(version, '4.1.1');
    case 'ip-address':
      return lt(version, '10.3.1');
    case 'brace-expansion':
      if (version.startsWith('1.')) return lt(version, '1.1.18');
      if (version.startsWith('2.')) return lt(version, '2.1.4');
      if (version.startsWith('3.')) return lt(version, '3.0.6');
      if (version.startsWith('5.')) return lt(version, '5.0.9');
      return true;
    case 'glob':
      return version.startsWith('10.') && lt(version, '10.5.0');
    case 'minimatch': {
      const floors = {
        3: '3.1.4', 4: '4.2.5', 5: '5.1.8', 6: '6.2.2',
        7: '7.4.8', 8: '8.0.6', 9: '9.0.7', 10: '10.2.3',
      };
      const floor = floors[parseVer(version)[0]];
      return floor ? lt(version, floor) : false;
    }
    case 'serialize-javascript':
      return lt(version, '7.0.3');
    case 'sharp':
      return lt(version, '0.35.0');
    case 'picomatch':
      if (version.startsWith('2.')) return lt(version, '2.3.2');
      if (version.startsWith('3.')) return lt(version, '3.0.2');
      if (version.startsWith('4.')) return lt(version, '4.0.4');
      return false;
    case 'ws':
      return lt(version, '8.21.0');
    case 'postcss':
      return lt(version, '8.5.18');
    case 'js-yaml':
      if (version.startsWith('3.')) return lt(version, '3.15.1');
      if (version.startsWith('4.')) return lt(version, '4.3.1');
      return false;
    case 'immutable':
      if (version.startsWith('3.')) return true;
      if (version.startsWith('4.')) return lt(version, '4.3.9');
      if (version.startsWith('5.')) return lt(version, '5.1.8');
      return false;
    default:
      return false;
  }
}

function patchedVersion(name, version) {
  switch (name) {
    case 'tar':
      return '7.5.22';
    case 'sigstore':
      return '4.1.1';
    case 'ip-address':
      return '10.3.1';
    case 'brace-expansion':
      if (version.startsWith('1.')) return '1.1.18';
      if (version.startsWith('5.')) return '5.0.9';
      if (version.startsWith('3.')) return '3.0.6';
      return '2.1.4';
    case 'glob':
      return '10.5.0';
    case 'minimatch': {
      const floors = {
        3: '3.1.4', 4: '4.2.5', 5: '5.1.8', 6: '6.2.2',
        7: '7.4.8', 8: '8.0.6', 9: '9.0.7', 10: '10.2.3',
      };
      return floors[parseVer(version)[0]] || '9.0.7';
    }
    case 'serialize-javascript':
      return '7.0.7';
    case 'sharp':
      return '0.35.3';
    case 'picomatch':
      if (version.startsWith('2.')) return '2.3.2';
      if (version.startsWith('3.')) return '3.0.2';
      return '4.0.4';
    case 'ws':
      return '8.21.3';
    case 'postcss':
      return '8.5.18';
    case 'js-yaml':
      return version.startsWith('3.') ? '3.15.1' : '4.3.1';
    case 'immutable':
      // 3.x has no patched line — jump to last 4.x security release
      if (version.startsWith('5.')) return '5.1.8';
      return '4.3.9';
    default:
      return version;
  }
}

function findOverrideDir() {
  for (const d of OVERRIDE_DIRS) {
    if (d && fs.existsSync(d)) return d;
  }
  return null;
}

function findTarball(overrideDir, name, version) {
  if (!overrideDir) return null;
  const exact = path.join(overrideDir, `${ name }-${ version }.tgz`);
  if (fs.existsSync(exact)) return exact;
  // npm pack sometimes uses scoped naming; also try unscoped pattern matches
  const entries = fs.readdirSync(overrideDir);
  const match = entries.find((f) => f === `${ name }-${ version }.tgz` || f.endsWith(`-${ name }-${ version }.tgz`));
  return match ? path.join(overrideDir, match) : null;
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function extractTarball(tgz, destDir) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-patch-'));
  try {
    const extractDir = path.join(tmp, 'extract');
    fs.mkdirSync(extractDir);
    execFileSync('tar', [ '-xzf', tgz, '-C', extractDir ], { stdio: 'pipe' });
    const pkgDir = path.join(extractDir, 'package');
    if (!fs.existsSync(pkgDir)) throw new Error(`no package/ in ${ tgz }`);
    rmrf(destDir);
    fs.mkdirSync(path.dirname(destDir), { recursive: true });
    fs.cpSync(pkgDir, destDir, { recursive: true });
  } finally {
    rmrf(tmp);
  }
}

function extractViaNpm(name, version, destDir) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-npm-'));
  try {
    execFileSync('npm', [ 'pack', `${ name }@${ version }`, '--pack-destination', tmp ], {
      stdio: 'pipe',
      env: { ...process.env, npm_config_update_notifier: 'false' },
    });
    const tgz = fs.readdirSync(tmp).find((f) => f.endsWith('.tgz'));
    if (!tgz) throw new Error(`npm pack produced nothing for ${ name }@${ version }`);
    extractTarball(path.join(tmp, tgz), destDir);
  } finally {
    rmrf(tmp);
  }
}

/** Find every package.json under root (including deeply nested node_modules). */
function findAllPackageJson(root) {
  const out = [];
  const stack = [ root ];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (!ent.isDirectory() && !(ent.isSymbolicLink && ent.isSymbolicLink())) continue;
      if (ent.name === '.bin' || ent.name === '.cache' || ent.name === '.git') continue;
      const full = path.join(dir, ent.name);
      // follow into all directories; collect package.json when present
      const pj = path.join(full, 'package.json');
      if (fs.existsSync(pj)) out.push(pj);
      stack.push(full);
    }
  }
  return out;
}

function isNextCompiled(pj) {
  return pj.includes(`${ path.sep }next${ path.sep }dist${ path.sep }compiled${ path.sep }`);
}

function main() {
  const scanRoot = fs.existsSync(TARGET) ? TARGET : path.dirname(TARGET);
  if (!fs.existsSync(scanRoot)) {
    console.log(`[force-patched-deps] skip: ${ scanRoot } missing`);
    return;
  }

  // If given an app root, prefer its node_modules but also scan the root itself.
  const roots = [];
  if (path.basename(scanRoot) === 'node_modules') {
    roots.push(scanRoot);
  } else {
    const nm = path.join(scanRoot, 'node_modules');
    if (fs.existsSync(nm)) roots.push(nm);
    roots.push(scanRoot);
  }

  const overrideDir = findOverrideDir();
  console.log(`[force-patched-deps] overrides=${ overrideDir || '(none — will npm pack)' }`);

  let replaced = 0;
  let deleted = 0;
  const remaining = [];

  for (const root of roots) {
    console.log(`[force-patched-deps] scanning ${ root }`);
    for (const pj of findAllPackageJson(root)) {
      let pkg;
      try {
        pkg = JSON.parse(fs.readFileSync(pj, 'utf8'));
      } catch {
        continue;
      }
      const name = pkg.name;
      const version = pkg.version;
      if (!PACKAGES.includes(name)) continue;
      if (isNextCompiled(pj)) continue;
      if (!isVulnerable(name, version)) continue;

      const destDir = path.dirname(pj);
      const nextVer = patchedVersion(name, version);
      const tgz = findTarball(overrideDir, name, nextVer);

      try {
        if (tgz) {
          console.log(`[force-patched-deps] REPLACE ${ destDir }: ${ name }@${ version } -> ${ nextVer } (vendored)`);
          extractTarball(tgz, destDir);
        } else {
          console.log(`[force-patched-deps] REPLACE ${ destDir }: ${ name }@${ version } -> ${ nextVer } (npm pack)`);
          extractViaNpm(name, nextVer, destDir);
        }
        replaced++;
      } catch (err) {
        console.error(`[force-patched-deps] patch failed for ${ name }@${ version }:`, err.message || err);
        if (DELETE_UNUSED && DELETABLE.has(name)) {
          console.log(`[force-patched-deps] DELETE ${ destDir } (${ name } not required at runtime)`);
          rmrf(destDir);
          deleted++;
        } else {
          remaining.push(`${ name }@${ version } @ ${ destDir }`);
        }
      }
    }
  }

  // Second pass: verify
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const pj of findAllPackageJson(root)) {
      if (isNextCompiled(pj)) continue;
      let pkg;
      try {
        pkg = JSON.parse(fs.readFileSync(pj, 'utf8'));
      } catch {
        continue;
      }
      if (PACKAGES.includes(pkg.name) && isVulnerable(pkg.name, pkg.version)) {
        if (DELETE_UNUSED && DELETABLE.has(pkg.name)) {
          console.log(`[force-patched-deps] DELETE remaining ${ path.dirname(pj) }`);
          rmrf(path.dirname(pj));
          deleted++;
        } else {
          remaining.push(`${ pkg.name }@${ pkg.version } @ ${ path.dirname(pj) }`);
        }
      }
    }
  }

  // Drop lockfiles Trivy may parse inside shipped tool dirs
  for (const root of roots) {
    const base = path.basename(root) === 'node_modules' ? path.dirname(root) : root;
    for (const lock of [ 'yarn.lock', 'package-lock.json', 'pnpm-lock.yaml' ]) {
      const p = path.join(base, lock);
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
        console.log(`[force-patched-deps] removed ${ p }`);
      }
    }
  }

  console.log(`[force-patched-deps] done: replaced=${ replaced } deleted=${ deleted } remaining=${ remaining.length }`);
  if (remaining.length) {
    for (const r of remaining) console.error('  STILL_VULNERABLE', r);
    if (FAIL) process.exit(1);
  }
}

main();
