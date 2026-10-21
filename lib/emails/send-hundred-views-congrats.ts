import { sendEmail } from "@/lib/resend";

import HundredViewsCongratsEmail from "@/components/emails/hundred-views-congrats";
import { EMAIL_BRAND } from "@/components/emails/shared/brand";

import { CreateUserEmailProps } from "../types";

export const sendHundredViewsCongratsEmail = async (
  params: CreateUserEmailProps,
) => {
  const { name, email } = params.user;
  const emailTemplate = HundredViewsCongratsEmail({ name });
  try {
    await sendEmail({
      to: email as string,
      subject: `100 views on ${EMAIL_BRAND}. Awesome, ${name}`,
      react: emailTemplate,
      test: process.env.NODE_ENV === "development",
    });
  } catch (e) {
    console.error(e);
  }
};
