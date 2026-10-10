import { useState, useEffect } from 'react';

export interface ChecklistItem {
  id: string;
  label: string;
  tip?: string;
}

export const DEFAULT_CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'silence_phone',
    label: 'Set phone to Do Not Disturb or silent mode',
    tip: 'Prevents banner popups from interrupting mathematical problem-solving flow.',
  },
  {
    id: 'open_focus_mode',
    label: "Enable phone's Focus Mode or App Limits",
    tip: 'Temporarily freezes social media and gaming apps via Android Digital Wellbeing or iOS Focus.',
  },
  {
    id: 'prep_materials',
    label: 'Keep rough notebook, pens & formula sheet ready',
    tip: 'Avoids getting up mid-session for scratch paper or reference tables.',
  },
  {
    id: 'water_hydrated',
    label: 'Water bottle & distraction-free desk space',
    tip: 'Stay hydrated to maintain cognitive stamina across multi-hour blocks.',
  },
  {
    id: 'select_objective',
    label: 'Selected specific syllabus chapter or target task',
    tip: 'Clear, singular focus yields 2-3x higher retention than wandering across topics.',
  },
];

const STORAGE_KEY = 'preppilot_study_checklist_v1';

export function useStudySpaceChecklist() {
  const [completedIds, setCompletedIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completedIds));
    } catch (err) {
      console.warn('Could not persist study space checklist:', err);
    }
  }, [completedIds]);

  const toggleItem = (id: string) => {
    setCompletedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const resetChecklist = () => {
    setCompletedIds([]);
  };

  return {
    items: DEFAULT_CHECKLIST_ITEMS,
    completedIds,
    toggleItem,
    resetChecklist,
    isCompleted: (id: string) => completedIds.includes(id),
    completedCount: completedIds.length,
    totalCount: DEFAULT_CHECKLIST_ITEMS.length,
  };
}
