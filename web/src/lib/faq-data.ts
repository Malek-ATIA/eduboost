export type FAQ = { q: string; a: string };

export const FAQ_GENERAL: FAQ[] = [
  { q: "What is EduBoost?", a: "EduBoost is a trusted platform that connects students and parents with qualified tutors for 1-on-1 and group sessions, delivered online with built-in video classrooms, recordings, and chat." },
  { q: "How do payments work?", a: "All payments go through EduBoost upfront. When you book, your card is charged; the teacher is paid after the session is completed. A 15% platform fee covers payment processing, the classroom infrastructure, and platform operations." },
  { q: "Can I try a session before committing?", a: 'Many teachers offer a free or discounted trial session. Look for the "Trial" badge on the teacher browse page.' },
  { q: "What if a session doesn't meet my expectations?", a: "File a dispute via Support & disputes on your dashboard. Link the booking to the ticket and describe the issue. Our team will review within 2 business days." },
];

export const FAQ_STUDENTS: FAQ[] = [
  { q: "Do I need to install anything for the classroom?", a: "No. The classroom runs in your browser. Make sure you allow camera and microphone access when prompted." },
  { q: "Will my sessions be recorded?", a: 'Recordings are optional and started by the teacher. When recording is on, you will see a red "Stop recording" indicator. Recordings are stored securely and retained per our Terms.' },
  { q: "Can I message my teacher between sessions?", a: "Yes. Use Direct messages from the teacher's profile or the classroom chat for class-wide messages." },
];

export const FAQ_TEACHERS: FAQ[] = [
  { q: "How do I get paid?", a: "After a session is completed, funds are released to your payout account. Go to Edit your profile to set your hourly rate." },
  { q: "Can I teach groups?", a: 'Yes. Enable "Offer group sessions" in your profile. Students will then be able to book group formats with you.' },
  { q: "What happens if a student is abusive?", a: "File an abuse report via Support & disputes. Our team can warn, suspend, or ban repeat offenders." },
];

export const FAQ_REFUNDS: FAQ[] = [
  { q: "Can I cancel a booking and get a refund?", a: "Yes. Cancel from My bookings. If the session is more than 24 hours away (or no session has been scheduled yet), the refund is issued automatically to your original payment method. Closer than 24h we open a support ticket so a human can review the circumstances." },
  { q: "What about marketplace purchases?", a: "You can request a refund from My orders. Refunds are automatic if you ask within 1 hour of purchase AND haven't downloaded the file yet. After either of those, we open a support ticket and an admin will work with the seller on a case-by-case basis." },
  { q: "How long do refunds take to land in my bank?", a: "Stripe typically returns funds to the original card within 5-10 business days. You can track the refund status on the linked payment in Payment history." },
];
