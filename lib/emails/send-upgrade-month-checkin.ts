import { MARKETING_EMAILS_ENABLED } from "@/lib/emails/marketing";
import { sendEmail } from "@/lib/resend";

import { EMAIL_BRAND } from "@/components/emails/shared/brand";
import UpgradeOneMonthCheckinEmail from "@/components/emails/upgrade-one-month-checkin";

import { CreateUserEmailProps } from "../types";

export const sendUpgradeOneMonthCheckinEmail = async (
  params: CreateUserEmailProps,
) => {
  if (!MARKETING_EMAILS_ENABLED) return;
  const { name, email } = params.user;

  // Get the first name from the full name
  const firstName = name ? name.split(" ")[0] : null;

  const emailTemplate = UpgradeOneMonthCheckinEmail({
    name: firstName,
  });
  try {
    await sendEmail({
      to: email as string,
      subject: `Check-in from ${EMAIL_BRAND}`,
      react: emailTemplate,
      test: process.env.NODE_ENV === "development",
    });
  } catch (e) {
    console.error(e);
  }
};
