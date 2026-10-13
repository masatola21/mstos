import { AvatarColor } from '../types';

export interface ColorScheme {
  bgGradient: string;
  badgeBg: string;
  badgeText: string;
  border: string;
  glow: string;
  accent: string;
}

export const AVATAR_COLOR_MAP: Record<AvatarColor, ColorScheme> = {
  indigo: {
    bgGradient: 'from-indigo-600 to-blue-700',
    badgeBg: 'bg-indigo-500/15',
    badgeText: 'text-indigo-300',
    border: 'border-indigo-500/30',
    glow: 'shadow-indigo-500/20',
    accent: 'text-indigo-400',
  },
  emerald: {
    bgGradient: 'from-emerald-600 to-teal-700',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-300',
    border: 'border-emerald-500/30',
    glow: 'shadow-emerald-500/20',
    accent: 'text-emerald-400',
  },
  amber: {
    bgGradient: 'from-amber-600 to-orange-700',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-300',
    border: 'border-amber-500/30',
    glow: 'shadow-amber-500/20',
    accent: 'text-amber-400',
  },
  rose: {
    bgGradient: 'from-rose-600 to-pink-700',
    badgeBg: 'bg-rose-500/15',
    badgeText: 'text-rose-300',
    border: 'border-rose-500/30',
    glow: 'shadow-rose-500/20',
    accent: 'text-rose-400',
  },
  violet: {
    bgGradient: 'from-violet-600 to-purple-800',
    badgeBg: 'bg-violet-500/15',
    badgeText: 'text-violet-300',
    border: 'border-violet-500/30',
    glow: 'shadow-violet-500/20',
    accent: 'text-violet-400',
  },
  cyan: {
    bgGradient: 'from-cyan-600 to-blue-700',
    badgeBg: 'bg-cyan-500/15',
    badgeText: 'text-cyan-300',
    border: 'border-cyan-500/30',
    glow: 'shadow-cyan-500/20',
    accent: 'text-cyan-400',
  },
  fuchsia: {
    bgGradient: 'from-fuchsia-600 to-pink-700',
    badgeBg: 'bg-fuchsia-500/15',
    badgeText: 'text-fuchsia-300',
    border: 'border-fuchsia-500/30',
    glow: 'shadow-fuchsia-500/20',
    accent: 'text-fuchsia-400',
  },
  sky: {
    bgGradient: 'from-sky-600 to-indigo-700',
    badgeBg: 'bg-sky-500/15',
    badgeText: 'text-sky-300',
    border: 'border-sky-500/30',
    glow: 'shadow-sky-500/20',
    accent: 'text-sky-400',
  },
};

export function getColorScheme(color?: string): ColorScheme {
  const c = (color as AvatarColor) || 'indigo';
  return AVATAR_COLOR_MAP[c] || AVATAR_COLOR_MAP.indigo;
}
