import React from "react";

import {
  Body,
  Head,
  Html,
  Link,
  Preview,
  Tailwind,
  Text,
} from "@react-email/components";

import { EMAIL_BRAND } from "@/components/emails/shared/brand";

interface ThousandViewsCongratsEmailProps {
  name: string | null | undefined;
}

const ThousandViewsCongratsEmail = ({
  name,
}: ThousandViewsCongratsEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>{`1000 views on ${EMAIL_BRAND}.`}</Preview>
      <Tailwind>
        <Body className="font-sans text-sm">
          <Text>Hi{name && ` ${name}`},</Text>
          <Text>
            {`I'm Marc, founder of ${EMAIL_BRAND}. Congrats on 1000 views on your documents.`}
          </Text>
          <Text>How is your experience so far?</Text>

          <Text>
            Thanks so much,
            <br />
            Marc
          </Text>
          <Text>
            <Link
              href={`${process.env.NEXT_PUBLIC_BASE_URL}`}
              target="_blank"
              className="text-blue-500 underline"
              rel="noopener noreferrer"
            >
              Leave us a G2 review
            </Link>
          </Text>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default ThousandViewsCongratsEmail;
