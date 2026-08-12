#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Replace vulnerable nested copies of security-sensitive packages under a
 * node_modules tree. Yarn resolutions alone do not always eliminate deeply
 * nested duplicates that Trivy finds in the final image (see TRIVY_FIXES.md).
 *
 * Usage: node force-patched-deps.js [node_modules_path]
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TARGET_ROOT = path.resolve(process.argv[2] || 'node_modules');

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
];

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

function gte(a, b) {
  return cmp(a, b) >= 0;
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
      if (version.startsWith('10.')) return lt(version, '10.5.0');
      if (version.startsWith('7.')) return true; // prefer leaving; not in current image list
      return false;
    case 'minimatch': {
      const floors = {
        3: '3.1.4',
        4: '4.2.5',
        5: '5.1.8',
        6: '6.2.2',
        7: '7.4.8',
        8: '8.0.6',
        9: '9.0.7',
        10: '10.2.3',
      };
      const major = parseVer(version)[0];
      const floor = floors[major];
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
      return version.startsWith('10.') ? '10.5.0' : '10.5.0';
    case 'minimatch': {
      const floors = {
        3: '3.1.4',
        4: '4.2.5',
        5: '5.1.8',
        6: '6.2.2',
        7: '7.4.8',
        8: '8.0.6',
        9: '9.0.7',
        10: '10.2.3',
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
    default:
      return version;
  }
}

function walkPackageJson(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (ent.name === '.bin' || ent.name === '.cache') continue;
    const full = path.join(dir, ent.name);
    if (ent.name.startsWith('@')) {
      walkPackageJson(full, out);
      continue;
    }
    const pj = path.join(full, 'package.json');
    if (fs.existsSync(pj)) {
      out.push(pj);
      const nested = path.join(full, 'node_modules');
      if (fs.existsSync(nested)) walkPackageJson(nested, out);
    }
  }
  return out;
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function extractPackage(name, version, destDir) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-patch-'));
  try {
    const spec = `${ name }@${ version }`;
    execFileSync('npm', [ 'pack', spec, '--pack-destination', tmp ], {
      stdio: 'pipe',
      env: { ...process.env, npm_config_update_notifier: 'false' },
    });
    const tgz = fs.readdirSync(tmp).find((f) => f.endsWith('.tgz'));
    if (!tgz) throw new Error(`npm pack produced no tarball for ${ spec }`);
    const extractDir = path.join(tmp, 'extract');
    fs.mkdirSync(extractDir);
    execFileSync('tar', [ '-xzf', path.join(tmp, tgz), '-C', extractDir ], { stdio: 'pipe' });
    const pkgDir = path.join(extractDir, 'package');
    rmrf(destDir);
    fs.mkdirSync(path.dirname(destDir), { recursive: true });
    fs.cpSync(pkgDir, destDir, { recursive: true });
  } finally {
    rmrf(tmp);
  }
}

function main() {
  if (!fs.existsSync(TARGET_ROOT)) {
    console.log(`[force-patched-deps] skip: ${ TARGET_ROOT } does not exist`);
    return;
  }

  console.log(`[force-patched-deps] scanning ${ TARGET_ROOT }`);
  const files = walkPackageJson(TARGET_ROOT);
  const cache = new Map(); // name@version -> extracted path reused via re-pack each time is fine
  let replaced = 0;

  for (const pj of files) {
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(pj, 'utf8'));
    } catch {
      continue;
    }
    const name = pkg.name;
    const version = pkg.version;
    if (!PACKAGES.includes(name) || !isVulnerable(name, version)) continue;

    // Skip Next.js vendored bundles (no real version / webpack bundle)
    if (pj.includes(`${ path.sep }next${ path.sep }dist${ path.sep }compiled${ path.sep }`)) {
      continue;
    }

    const nextVer = patchedVersion(name, version);
    if (gte(version, nextVer)) continue;

    const destDir = path.dirname(pj);
    const key = `${ name }@${ nextVer }`;
    console.log(`[force-patched-deps] ${ destDir }: ${ name }@${ version } -> ${ nextVer }`);
    try {
      extractPackage(name, nextVer, destDir);
      replaced++;
      cache.set(key, true);
    } catch (err) {
      console.error(`[force-patched-deps] FAILED ${ key } at ${ destDir }:`, err.message || err);
      process.exitCode = 1;
    }
  }

  console.log(`[force-patched-deps] done: replaced ${ replaced } package tree(s)`);
}

main();
