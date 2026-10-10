export interface FocusQuote {
  quote: string;
  author: string;
}

export const FOCUS_QUOTES: FocusQuote[] = [
  {
    quote: "Mathematics is not about numbers, equations, or algorithms: it is about understanding.",
    author: "William Paul Thurston",
  },
  {
    quote: "Focus is a muscle. Every Pomodoro session you complete strengthens your mental endurance for NIMCET 2027.",
    author: "PrepPilot Mentorship",
  },
  {
    quote: "You do not have to be extreme, just consistent. 8 hours of focused work beats 14 hours of distracted browsing.",
    author: "Study Architecture",
  },
  {
    quote: "In mathematics, the art of proposing a question must be held of higher value than the solving of it.",
    author: "Georg Cantor",
  },
  {
    quote: "Success in competitive exams is the sum of small daily efforts, repeated day in and day out.",
    author: "Robert Collier",
  },
  {
    quote: "The ability to perform deep work is becoming increasingly rare at exactly the same time it is becoming increasingly valuable.",
    author: "Cal Newport (Deep Work)",
  },
  {
    quote: "Clear your desk. Silence your phone. Give this next interval your complete, undivided attention.",
    author: "PrepPilot Protocol",
  },
  {
    quote: "Reasoning and analytical puzzles dissolve when you focus completely on the structure rather than the noise.",
    author: "Logic Master",
  },
];

export function getRandomFocusQuote(): FocusQuote {
  const index = Math.floor(Math.random() * FOCUS_QUOTES.length);
  return FOCUS_QUOTES[index];
}
