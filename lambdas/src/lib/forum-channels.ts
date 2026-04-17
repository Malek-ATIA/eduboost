export type ForumChannel = {
  id: string;
  name: string;
  description: string;
};

// Hardcoded channels for MVP. Admin-managed channels can come later via an
// admin route that writes to a ForumChannelEntity.
export const FORUM_CHANNELS: ForumChannel[] = [
  { id: "general", name: "General", description: "Everything else." },
  { id: "mathematics", name: "Mathematics", description: "Algebra, calculus, number theory, and more." },
  { id: "sciences", name: "Sciences", description: "Physics, chemistry, biology." },
  { id: "languages", name: "Languages", description: "English, French, Arabic, and study tips." },
  { id: "test-prep", name: "Test prep", description: "Leaving Cert, SAT, IELTS, and other exams." },
  { id: "teachers-lounge", name: "Teachers' lounge", description: "For teachers to share pedagogy and tips." },
];

export function getChannel(id: string): ForumChannel | undefined {
  return FORUM_CHANNELS.find((c) => c.id === id);
}
