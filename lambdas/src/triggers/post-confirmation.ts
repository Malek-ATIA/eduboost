import type { PostConfirmationTriggerEvent, PostConfirmationTriggerHandler } from "aws-lambda";
import { UserEntity } from "@eduboost/db";
import { sendEmail, emailTemplates } from "../lib/resend.js";

export const handler: PostConfirmationTriggerHandler = async (event: PostConfirmationTriggerEvent) => {
  if (event.triggerSource !== "PostConfirmation_ConfirmSignUp") return event;

  const attrs = event.request.userAttributes;
  const sub = attrs.sub;
  const email = attrs.email;
  if (!sub || !email) {
    console.warn("post-confirmation: missing sub or email", { sub, email });
    return event;
  }

  const displayName = attrs.given_name
    ? `${attrs.given_name} ${attrs.family_name ?? ""}`.trim()
    : email.split("@")[0] ?? email;

  const role = (attrs["custom:role"] as "parent" | "student" | "teacher" | "org_admin" | "admin" | undefined) ?? "student";

  try {
    await UserEntity.upsert({
      userId: sub,
      cognitoSub: sub,
      email,
      role,
      displayName,
    }).go();
  } catch (err) {
    console.error("post-confirmation: failed to upsert user", err);
    throw err;
  }

  try {
    const tpl = emailTemplates.welcome(displayName);
    await sendEmail({ to: email, subject: tpl.subject, html: tpl.html });
  } catch (err) {
    console.error("post-confirmation: welcome email failed (non-fatal)", err);
  }

  return event;
};
