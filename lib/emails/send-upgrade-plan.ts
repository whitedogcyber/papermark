import { MARKETING_EMAILS_ENABLED } from "@/lib/emails/marketing";
import { sendEmail } from "@/lib/resend";
import { CreateUserEmailProps } from "@/lib/types";

import { EMAIL_BRAND } from "@/components/emails/shared/brand";
import UpgradePlanEmail from "@/components/emails/upgrade-plan";

const PLAN_TYPE_MAP = {
  pro: "Pro",
  business: "Business",
  datarooms: "Data Rooms",
  "datarooms-plus": "Data Rooms Plus",
};

export const sendUpgradePlanEmail = async (
  params: CreateUserEmailProps & { planType: string },
) => {
  if (!MARKETING_EMAILS_ENABLED) return;
  const { name, email } = params.user;
  const { planType } = params;
  const emailTemplate = UpgradePlanEmail({ name, planType });

  const planTypeText = PLAN_TYPE_MAP[planType as keyof typeof PLAN_TYPE_MAP];

  try {
    await sendEmail({
      to: email as string,
      subject: `Thank you for upgrading to ${EMAIL_BRAND} ${planTypeText}!`,
      react: emailTemplate,
      test: process.env.NODE_ENV === "development",
    });
  } catch (e) {
    console.error(e);
  }
};
