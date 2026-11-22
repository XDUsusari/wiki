/** Mirrors public.level_for_xp(): level = floor(sqrt(xp / 50)) + 1 */
export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
}

/** Minimum XP required to reach a level. */
export function xpForLevel(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return 50 * (l - 1) ** 2;
}

export interface LevelProgress {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  /** 0..1 progress inside the current level. */
  ratio: number;
  remaining: number;
}

export function levelProgress(xp: number): LevelProgress {
  const safe = Math.max(0, Math.floor(xp));
  const level = levelForXp(safe);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const span = nextLevelXp - currentLevelXp;
  return {
    level,
    currentLevelXp,
    nextLevelXp,
    ratio: span === 0 ? 0 : (safe - currentLevelXp) / span,
    remaining: nextLevelXp - safe,
  };
}

/** XP per action and daily caps (mirrors public.award_xp()). */
export const XP_RULES = {
  post: { xp: 10, dailyCap: 3 },
  comment: { xp: 2, dailyCap: 10 },
  forum_topic: { xp: 8, dailyCap: 3 },
  forum_reply: { xp: 3, dailyCap: 10 },
  wait_report: { xp: 3, dailyCap: 10 },
  review: { xp: 5, dailyCap: 5 },
  visit_item: { xp: 2, dailyCap: 30 },
} as const;
