import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

import { EMAIL_BRAND } from "@/components/emails/shared/brand";

import { Footer } from "./shared/footer";

/** Sent to whoever handles upgrade requests. */
export default function UpgradeRequestEmail({
  teamName = "Acme",
  requesterEmail = "person@example.com",
  currentEdition = "Essentials",
  requested = "Premium",
  message,
  reviewUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/admin`,
}: {
  teamName: string;
  requesterEmail: string;
  currentEdition: string;
  requested: string;
  message?: string | null;
  reviewUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{`${teamName} requested ${requested}`}</Preview>
      <Tailwind>
        <Body className="mx-auto my-auto bg-white font-sans">
          <Container className="mx-auto my-10 w-[465px] p-5">
            <Text className="mx-0 mb-8 mt-4 p-0 text-center text-2xl font-normal">
              <span className="font-bold tracking-tighter">{EMAIL_BRAND}</span>
            </Text>
            <Text className="text-sm leading-6 text-black">
              <strong>{requesterEmail}</strong> requested{" "}
              <strong>{requested}</strong> for the team{" "}
              <strong>{teamName}</strong>.
            </Text>
            <Text className="text-sm leading-6 text-black">
              Current edition: {currentEdition}
            </Text>
            {message ? (
              <Text className="whitespace-pre-wrap rounded bg-gray-100 p-3 text-sm leading-6 text-black">
                {message}
              </Text>
            ) : null}
            <Section className="my-8 text-center">
              <Button
                className="rounded bg-black text-center text-xs font-semibold text-white no-underline"
                href={reviewUrl}
                style={{ padding: "12px 20px" }}
              >
                Review request
              </Button>
            </Section>
            <Footer footerText="If you have questions, reply to this email." />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
