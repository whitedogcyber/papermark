import { JSXElementConstructor, ReactElement } from "react";

import { getStorageConfig } from "@/ee/features/storage/config";
import { SESv2, SendEmailCommandInput } from "@aws-sdk/client-sesv2";
import { render, toPlainText } from "@react-email/render";

//import { Resend } from "resend";

import { log, nanoid } from "@/lib/utils";

export const resend = null;

export const sendEmail = async ({
  to,
  subject,
  react,
  from,
  marketing,
  system,
  verify,
  test,
  cc,
  replyTo,
  scheduledAt,
  unsubscribeUrl,
}: {
  to: string;
  subject: string;
  react: ReactElement<any, string | JSXElementConstructor<any>>;
  from?: string;
  marketing?: boolean;
  system?: boolean;
  verify?: boolean;
  test?: boolean;
  cc?: string | string[];
  replyTo?: string;
  scheduledAt?: string;
  unsubscribeUrl?: string;
}) => {
  const storageConfig = getStorageConfig();

  const sesClient = new SESv2({
    region: storageConfig.region,
    credentials: {
      accessKeyId: storageConfig.accessKeyId,
      secretAccessKey: storageConfig.secretAccessKey,
    },
  });

  const html = await render(react);
  const plainText = toPlainText(html);

  // Every email goes out from one verified SES sender; per-email "from"
  // values from upstream are ignored.
  const fromAddress =
    process.env.EMAIL_FROM?.trim() ||
    "WhiteDog Share <noreply-share@whitedog.cloud>";

  try {
    if (scheduledAt) {
      console.warn("Sending Now. Scheduled Emails not supported");
    }

    const response = await sesClient.sendEmail({
      FromEmailAddress: fromAddress,
      Destination: {
        ToAddresses: [to],
        CcAddresses: typeof cc === "string" ? [cc] : cc,
      },
      Content: {
        Simple: {
          Subject: {
            Charset: "UTF-8",
            Data: subject,
          },
          Body: {
            Html: {
              Charset: "UTF-8",
              Data: html,
            },
            Text: {
              Charset: "UTF-8",
              Data: plainText,
            },
          },
        },
      },
    });

    return {
      id: response.MessageId,
    };

    // const { data, error } = await resend.emails.send({
    //   from: fromAddress,
    //   to: test ? "delivered@resend.dev" : to,
    //   cc: cc,
    //   replyTo,
    //   subject,
    //   react,
    //   scheduledAt,
    //   text: plainText,
    //   headers: {
    //     "X-Entity-Ref-ID": nanoid(),
    //     ...(unsubscribeUrl ? { "List-Unsubscribe": unsubscribeUrl } : {}),
    //   },
    // });

    // // Check if the email sending operation returned an error and throw it
    // if (error) {
    //   log({
    //     message: `Resend returned error when sending email: ${error.name} \n\n ${error.message}`,
    //     type: "error",
    //     mention: true,
    //   });
    //   throw error;
    // }

    // // If there's no error, return the data
    // return data;
  } catch (exception) {
    // Log and rethrow any caught exceptions for upstream handling
    log({
      message: `Unexpected error when sending email: ${exception}`,
      type: "error",
      mention: true,
    });
    throw exception; // Rethrow the caught exception
  }
};
