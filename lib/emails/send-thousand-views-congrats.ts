import { sendEmail } from "@/lib/resend";

import { EMAIL_BRAND } from "@/components/emails/shared/brand";
import ThousandViewsCongratsEmail from "@/components/emails/thousand-views-congrats";

import { CreateUserEmailProps } from "../types";

export const sendThousandViewsCongratsEmail = async (
  params: CreateUserEmailProps,
) => {
  const { name, email } = params.user;
  const emailTemplate = ThousandViewsCongratsEmail({ name });
  try {
    await sendEmail({
      to: email as string,
      subject: `1000 views on ${EMAIL_BRAND}. Awesome, ${name}`,
      react: emailTemplate,
      test: process.env.NODE_ENV === "development",
    });
  } catch (e) {
    console.error(e);
  }
};
