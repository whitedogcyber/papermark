import { MARKETING_EMAILS_ENABLED } from "@/lib/emails/marketing";
import { sendEmail } from "@/lib/resend";

import DataroomTrialEnd from "@/components/emails/dataroom-trial-end";

export const sendDataroomTrialEndEmail = async (params: {
  email: string;
  name: string;
}) => {
  if (!MARKETING_EMAILS_ENABLED) return;
  const { email, name } = params;

  let emailTemplate;
  let subject;

  emailTemplate = DataroomTrialEnd({ name });
  subject = "Your Data Room plan trial has ended";

  try {
    await sendEmail({
      to: email as string,
      subject,
      react: emailTemplate,
      test: process.env.NODE_ENV === "development",
    });
  } catch (e) {
    console.error(e);
  }
};
