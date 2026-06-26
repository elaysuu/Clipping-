// Channel profiles — the per-page content strategy (niche + topics + research),
// independent of the OAuth connection so the operator can plan all 5 channels'
// topics BEFORE connecting them, then bind each to a connected account.
//
// channels {id, name, niche, topics[], notes, accountId|null, createdAt, updatedAt}
import { read, upsert, write } from '../core/store.js';

const norm = (s) => String(s || '').trim();
const parseTopics = (t) => (Array.isArray(t) ? t : String(t || '').split(/[,\n]/)).map((x) => x.trim().toLowerCase()).filter(Boolean);

export function createChannel({ name, niche = 'general', topics = [], notes = '', accountId = null }) {
  if (!norm(name)) throw new Error('channels: name required');
  return upsert('channels', {
    name: norm(name), niche: norm(niche) || 'general', topics: parseTopics(topics),
    notes: norm(notes), accountId: accountId || null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
}

export function updateChannel(id, patch) {
  const p = { id, updatedAt: new Date().toISOString() };
  if (patch.name != null) p.name = norm(patch.name);
  if (patch.niche != null) p.niche = norm(patch.niche) || 'general';
  if (patch.topics != null) p.topics = parseTopics(patch.topics);
  if (patch.notes != null) p.notes = norm(patch.notes);
  if (patch.accountId !== undefined) p.accountId = patch.accountId || null;
  return upsert('channels', p);
}

export function deleteChannel(id) {
  write('channels', read('channels').filter((c) => c.id !== id));
}

export const listChannels = () => read('channels');
export const getChannel = (id) => read('channels').find((c) => c.id === id) || null;

// Common niches → the campaign genre they map to (the radar tags genre).
export const NICHE_PRESETS = ['streamers', 'gaming', 'sports', 'podcasts', 'finance', 'brand', 'general'];
