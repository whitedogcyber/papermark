import { sendEmail } from "@/lib/resend";

import CustomDomainSetupEmail from "@/components/emails/custom-domain-setup";
import { EMAIL_BRAND } from "@/components/emails/shared/brand";

export const sendCustomDomainSetupEmail = async (
  email: string,
  name?: string,
  currentPlan?: string,
  hasAccess?: boolean,
) => {
  const emailTemplate = CustomDomainSetupEmail({
    name: name || "there",
    currentPlan: currentPlan || "Free",
    hasAccess: hasAccess || false,
  });

  try {
    await sendEmail({
      to: email,
      subject: `Your ${EMAIL_BRAND} custom domain set up`,
      react: emailTemplate,
      test: process.env.NODE_ENV === "development",
    });
  } catch (e) {
    console.error(e);
  }
};
