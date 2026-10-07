import { v5 as uuidv5 } from 'uuid';

const TAG_NAMESPACE = '0f68ba52-42f8-4f61-9f26-e8cd4557643f';

export const TAG_ICONS = [
  { icon: 'fa-money-bill-1', label: 'Food' },
  { icon: 'fa-coins', label: 'Home' },
  { icon: 'fa-dollar-sign', label: 'Electricity' },
  { icon: 'fa-hand-holding-dollar', label: 'Car' },
  { icon: 'fa-user-secret', label: 'Secret' },
  { icon: 'fa-money-bill-1-wave', label: 'Money' },
  { icon: 'fa-wand-magic-sparkles', label: 'Other' }
] as const;

export type TagIcon = string;

export function normalizeTagIcon(value: string): TagIcon | null {
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  const iconToken = tokens.at(-1);
  if (!iconToken) return null;
  const icon = iconToken.startsWith('fa-') ? iconToken : `fa-${iconToken}`;
  if (!/^fa-[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(icon)) return null;
  return icon;
}

export const DEFAULT_TAGS: { text: string; icon: TagIcon }[] = [
  { text: 'Mat', icon: 'fa-utensils' },
  { text: 'Hyra', icon: 'fa-house' },
  { text: 'El', icon: 'fa-bolt' }
];

export function tagIdFor(groupId: string, text: string): string {
  return uuidv5(`${groupId}:${text.trim().toLocaleLowerCase('sv-SE')}`, TAG_NAMESPACE);
}

export function iconForTag(text: string): TagIcon {
  const normalized = text.trim().toLocaleLowerCase('sv-SE');
  if (/mat|food|restaurant|lunch|middag/.test(normalized)) return 'fa-utensils';
  if (/hyra|rent|hem|home|bostad/.test(normalized)) return 'fa-house';
  if (/el|electric/.test(normalized)) return 'fa-bolt';
  return 'fa-tag';
}
