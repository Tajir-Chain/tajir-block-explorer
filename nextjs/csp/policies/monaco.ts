import type CspDev from 'csp-dev';

import { KEY_WORDS } from '../utils';

export function monaco(): CspDev.DirectiveDescriptor {
  return {
    // Monaco assets are self-hosted at /monaco/vs — no jsdelivr CDN needed.
    // blob: is required for Monaco Web Worker spawning (always uses blob: URLs).
    'script-src': [
      KEY_WORDS.BLOB,
      KEY_WORDS.SELF,
    ],
    'style-src': [
      KEY_WORDS.SELF,
    ],
    'font-src': [
      KEY_WORDS.SELF,
    ],
  };
}
