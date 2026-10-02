/**
 * Placeholder icon set (Lucide) behind stable keys, so Jonny's custom
 * artwork can replace these later without touching content.
 */
import Footprints from '@lucide/svelte/icons/footprints';
import MessageCircle from '@lucide/svelte/icons/message-circle';
import Eye from '@lucide/svelte/icons/eye';
import Heart from '@lucide/svelte/icons/heart';
import Brain from '@lucide/svelte/icons/brain';
import Utensils from '@lucide/svelte/icons/utensils';
import Sparkles from '@lucide/svelte/icons/sparkles';
export type IconComponent = typeof Sparkles;

export const BRANCH_ICONS: Record<string, IconComponent> = {
  body: Footprints,
  voice: MessageCircle,
  senses: Eye,
  heart: Heart,
  mind: Brain,
  independence: Utensils,
  star: Sparkles,
};

export const iconFor = (key: string) => BRANCH_ICONS[key] ?? Sparkles;
