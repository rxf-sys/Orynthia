export type HabitFrequency = 'DAILY' | 'WEEKLY';

export interface Habit {
  id: string;
  title: string;
  notes?: string | null;
  frequency: HabitFrequency;
  targetPerPeriod: number;
  color?: string | null;
  icon?: string | null;
  isArchived: boolean;
  doneToday: boolean;
  streak: number;
  /** Tage (YYYY-MM-DD) mit Eintrag innerhalb der letzten 30 Tage. */
  last30Days: string[];
  completedThisPeriod: number;
}

export interface HabitSummary {
  total: number;
  doneToday: number;
  bestStreak: number;
}

export interface CreateHabitData {
  title: string;
  notes?: string;
  frequency?: HabitFrequency;
  targetPerPeriod?: number;
  color?: string;
  icon?: string;
}

export const HABIT_COLORS = [
  '#1f8a5b',
  '#5b8def',
  '#fda481',
  '#b97aff',
  '#e76b8d',
  '#3aa3a5',
  '#d99a2b',
];

export const FREQUENCY_LABEL: Record<HabitFrequency, string> = {
  DAILY: 'Täglich',
  WEEKLY: 'Wöchentlich',
};

/** Streak-Einheit passend zur Frequenz – „5 Tage" vs. „5 Wochen". */
export function streakLabel(habit: Habit): string {
  const unit = habit.frequency === 'WEEKLY' ? 'Woche' : 'Tag';
  const plural = habit.frequency === 'WEEKLY' ? 'Wochen' : 'Tage';
  return `${habit.streak} ${habit.streak === 1 ? unit : plural}`;
}
