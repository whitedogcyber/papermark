import { Hr, Section, Text } from "@react-email/components";

import {
  EMAIL_COMPANY,
  EMAIL_COMPANY_ADDRESS,
  EMAIL_SHOW_ADDRESS,
} from "./brand";

export const Footer = ({
  withAddress = false,
  footerText = "If you have any feedback or questions about this email, simply reply to it. I'd love to hear from you!",
}: {
  withAddress?: boolean;
  footerText?: string | React.ReactNode;
}) => {
  return (
    <>
      <Hr />
      <Section className="text-gray-400">
        <Text className="text-xs">
          © {new Date().getFullYear()} {EMAIL_COMPANY} All rights reserved.{" "}
          {(withAddress || EMAIL_SHOW_ADDRESS) && EMAIL_COMPANY_ADDRESS && (
            <>
              <br />
              {EMAIL_COMPANY_ADDRESS}
            </>
          )}
        </Text>
        <Text className="text-xs">{footerText}</Text>
      </Section>
    </>
  );
};
