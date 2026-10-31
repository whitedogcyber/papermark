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
import { Footer } from "@/components/emails/shared/footer";

const REASONS: Record<string, string> = {
  global: "the email is on your team's block list",
  allow: "the email is not on the link's allow list",
  deny: "the email is on the link's block list",
};

export default function BlockedAccessEmail({
  viewerEmail = "someone@example.com",
  linkName = "Investor link",
  targetName = "Project Atlas",
  reason = "allow",
  manageUrl = "https://example.com",
}: {
  viewerEmail: string;
  linkName: string;
  targetName: string;
  reason: string;
  manageUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{`${viewerEmail} was blocked from ${targetName}`}</Preview>
      <Tailwind>
        <Body className="mx-auto my-auto bg-white font-sans">
          <Container className="mx-auto my-10 w-[465px] p-5">
            <Text className="mx-0 mb-8 mt-4 p-0 text-center text-2xl font-normal">
              <span className="font-bold tracking-tighter">{EMAIL_BRAND}</span>
            </Text>
            <Text className="text-sm leading-6 text-black">
              <strong>{viewerEmail}</strong> tried to open{" "}
              <strong>{targetName}</strong> through the link{" "}
              <strong>{linkName}</strong> and was blocked because{" "}
              {REASONS[reason] ?? "of the link's access rules"}.
            </Text>
            <Text className="text-sm leading-6 text-black">
              If they should have access, update the link&apos;s access
              settings.
            </Text>
            <Section className="my-8 text-center">
              <Button
                className="rounded bg-black text-center text-xs font-semibold text-white no-underline"
                href={manageUrl}
                style={{ padding: "12px 20px" }}
              >
                Review the link
              </Button>
            </Section>
            <Footer footerText="You get this because you manage this team in WhiteDog Share." />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
