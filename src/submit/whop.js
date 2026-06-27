// src/submit/whop.js
// Universal Whop / Content-Rewards adapter. Pure packet-building + rejection
// detection are unit-tested; CSS/text selectors live in config so a Whop UI change
// is a config edit, not a code rewrite. Live form-driving is gated + I/O-only.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getRules } from '../campaigns/compliance.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SELECTORS = join(HERE, '../../config/whop-selectors.json');

export const SELECTOR_KEYS = ['submitButton', 'titleInput', 'linkInput', 'imageInput',
  'submitConfirm', 'supportInput', 'supportSend'];

export function buildPacket({ submission, clip, campaign }) {
  const rules = getRules(campaign);
  const required = rules.overlays?.requiredCaptionText || '';
  const base = clip.title || clip.hook || 'Clip';
  const caption = required && !base.toLowerCase().includes(required.toLowerCase())
    ? `${base} — ${required}` : base;
  return {
    title: clip.title || clip.hook || 'Clip',
    link: submission.postUrl,
    demographicsImage: submission.analyticsScreenshotPath,
    caption,
  };
}

export function loadSelectors(path = DEFAULT_SELECTORS) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function isAnalyticsRejection(text) {
  return /\b(send|provide|share).{0,40}\b(analytics|demographics)\b/i.test(String(text));
}
