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

/** Sent to the requester when their request is approved or declined. */
export default function UpgradeRequestResolvedEmail({
  teamName = "Acme",
  requested = "Premium",
  approved = true,
  note,
  appUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`,
}: {
  teamName: string;
  requested: string;
  approved: boolean;
  note?: string | null;
  appUrl: string;
}) {
  const headline = approved
    ? `${teamName} is now on ${requested}`
    : `Your request for ${requested} was not approved`;
  return (
    <Html>
      <Head />
      <Preview>{headline}</Preview>
      <Tailwind>
        <Body className="mx-auto my-auto bg-white font-sans">
          <Container className="mx-auto my-10 w-[465px] p-5">
            <Text className="mx-0 mb-8 mt-4 p-0 text-center text-2xl font-normal">
              <span className="font-bold tracking-tighter">{EMAIL_BRAND}</span>
            </Text>
            <Text className="text-sm leading-6 text-black">{headline}.</Text>
            {note ? (
              <Text className="whitespace-pre-wrap rounded bg-gray-100 p-3 text-sm leading-6 text-black">
                {note}
              </Text>
            ) : null}
            {approved ? (
              <Section className="my-8 text-center">
                <Button
                  className="rounded bg-black text-center text-xs font-semibold text-white no-underline"
                  href={appUrl}
                  style={{ padding: "12px 20px" }}
                >
                  {`Open ${EMAIL_BRAND}`}
                </Button>
              </Section>
            ) : null}
            <Footer footerText="If you have questions, reply to this email." />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
