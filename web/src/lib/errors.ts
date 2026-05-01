// Error codes surfaced by the API, mapped to the messages we want to show
// end-users. Pages can still branch on `err.code` via `ApiError` for tailored
// copy or redirects; this is the fallback.
//
// Adding a new code: put the shortest human sentence the user needs to take
// the right action. Avoid jargon ("request"), verbs on the user's side
// ("try again"), or implementation terms ("DDB", "Cognito", "Stripe").

const FRIENDLY_CODES: Record<string, string> = {
  // Auth & session
  unauthorized: "You need to be signed in to do that.",
  invalid_token: "Your session has expired. Please sign in again.",
  banned: "Your account has been suspended. Check your email for details.",
  forbidden: "You don't have permission to do that.",

  // Generic role gates
  only_teachers: "Only teachers can do that.",
  only_teachers_or_admins: "Only teachers can create or manage this.",
  only_teachers_can_sell: "Only teachers can sell on the marketplace.",
  not_a_teacher: "The person you selected isn't registered as a teacher.",
  not_available_for_role: "This isn't available for your account type.",
  admin_cannot_remove_admin: "One admin cannot remove another.",
  cannot_remove_owner: "The organization owner can't be removed.",
  cannot_ban_self: "You can't ban your own account.",
  cannot_ban_admin: "Admins can't ban each other.",
  cannot_view_self: "This page shows your students, not yourself.",

  // Not found
  not_found: "We couldn't find what you were looking for.",
  user_not_found: "No user with that email.",
  recipient_not_found: "No user with that email.",
  teacher_not_found: "That teacher no longer exists.",
  classroom_not_found: "That classroom no longer exists.",
  booking_not_found: "That booking no longer exists.",
  session_not_found: "That session no longer exists.",
  no_relation: "You haven't taught this student yet.",
  no_avatar: "No profile picture set.",
  no_file: "This material has no file attached.",

  // Booking / payment
  booking_not_paid: "The booking needs to be paid before scheduling.",
  not_your_booking: "That booking belongs to another teacher.",
  not_your_classroom: "That classroom belongs to another teacher.",
  already_purchased: "You already own this.",
  already_attempted: "You've already taken this exam.",
  already_member: "That person is already in this classroom.",
  already_pending: "Your profile is already under review.",
  already_verified: "Your profile is already verified.",
  already_banned: "This user is already suspended.",
  not_banned: "This user isn't currently suspended.",
  already_rejected: "This profile has already been rejected.",
  cannot_buy_own: "You can't buy your own listing.",
  cannot_add_self: "You can't add yourself — you're already the teacher.",
  out_of_stock: "This item is out of stock.",
  not_available: "This listing is no longer available.",
  classroom_full: "This classroom is at capacity.",
  cannot_remove_teacher: "The classroom teacher can't be removed.",
  not_a_member: "That person isn't a member of this classroom.",
  teacher_cannot_attempt_own_exam: "You can't take your own exam as the author.",
  profile_required: "Fill in your teacher profile before submitting.",
  below_minimum_wage: "Your hourly rate is below the platform minimum.",

  // Organizations
  org_not_found: "That organization no longer exists.",
  not_an_org_member: "You're not a member of that organization.",
  not_org_admin: "Only the owner or admins can do that.",
  not_a_commercial_org: "Only commercial organizations can sell on the marketplace.",

  // Validation / misc
  no_fields_to_update: "Nothing was changed.",
  no_file_to_upload: "Please pick a file first.",
  already_claimed: "This referral code has already been used.",
  unknown_code: "That referral code isn't valid.",
  cognito_disable_failed: "We couldn't complete that action. Try again in a moment.",
  cognito_enable_failed: "We couldn't complete that action. Try again in a moment.",
};

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly bodyText: string;
  constructor(status: number, code: string | undefined, message: string, bodyText: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.bodyText = bodyText;
  }
}

// Map a (status, code) pair to a user-facing sentence. Fall back to a
// status-appropriate generic when the code isn't in our table.
export function friendlyMessage(status: number, code: string | undefined): string {
  if (code && FRIENDLY_CODES[code]) return FRIENDLY_CODES[code];
  if (status === 400) return "That request wasn't quite right — check the form and try again.";
  if (status === 401) return "You need to be signed in to do that.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "We couldn't find what you were looking for.";
  if (status === 409) return "That clashes with existing data — refresh and try again.";
  if (status === 413) return "That file is too large.";
  if (status === 429) return "You're doing that too fast. Wait a moment and try again.";
  if (status >= 500) return "Something went wrong on our side. Please try again in a moment.";
  return "Something went wrong. Please try again.";
}

// Convenience for pages that catch a generic unknown error (network error,
// already-shaped Error, etc.) and want a safe display string.
export function humanizeError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof TypeError && /fetch/i.test(err.message)) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  if (err instanceof Error) {
    // Legacy callers may still throw raw "api 403: {json}" strings before we
    // finish migrating every page. Strip the noise so users don't see JSON.
    const raw = err.message;
    const match = raw.match(/^api (\d+): (.+)$/);
    if (match) {
      const status = Number(match[1]);
      let code: string | undefined;
      try {
        const j = JSON.parse(match[2]);
        if (typeof j?.error === "string") code = j.error;
      } catch {
        /* body wasn't JSON */
      }
      return friendlyMessage(status, code);
    }
    return raw;
  }
  return "Something went wrong. Please try again.";
}
