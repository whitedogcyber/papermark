import { MARKETING_EMAILS_ENABLED } from "@/lib/emails/marketing";
import { sendEmail } from "@/lib/resend";

import { EMAIL_BRAND } from "@/components/emails/shared/brand";
import WelcomeEmail from "@/components/emails/welcome";

import { CreateUserEmailProps } from "../types";

export const sendWelcomeEmail = async (params: CreateUserEmailProps) => {
  if (!MARKETING_EMAILS_ENABLED) return;
  const { name, email } = params.user;
  const emailTemplate = WelcomeEmail({ name });
  try {
    await sendEmail({
      to: email as string,
      subject: `Welcome to ${EMAIL_BRAND}!`,
      react: emailTemplate,
      test: process.env.NODE_ENV === "development",
    });
  } catch (e) {
    console.error(e);
  }
};
