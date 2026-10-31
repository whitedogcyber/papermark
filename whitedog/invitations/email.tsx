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

export default function DataroomInvitationEmail({
  dataroomName = "Project Atlas",
  senderEmail = "someone@example.com",
  url = "https://example.com/view/abc",
  message,
  recipientEmail = "viewer@example.com",
}: {
  dataroomName: string;
  senderEmail: string;
  url: string;
  message?: string | null;
  recipientEmail: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{`You're invited to ${dataroomName}`}</Preview>
      <Tailwind>
        <Body className="mx-auto my-auto bg-white font-sans">
          <Container className="mx-auto my-10 w-[465px] p-5">
            <Text className="mx-0 mb-8 mt-4 p-0 text-center text-2xl font-normal">
              <span className="font-bold tracking-tighter">{EMAIL_BRAND}</span>
            </Text>
            <Text className="text-sm leading-6 text-black">
              <strong>{senderEmail}</strong> invited you to the data room{" "}
              <strong>{dataroomName}</strong>.
            </Text>
            {message ? (
              <Text className="whitespace-pre-wrap rounded bg-gray-100 p-3 text-sm leading-6 text-black">
                {message}
              </Text>
            ) : null}
            <Section className="my-8 text-center">
              <Button
                className="rounded bg-black text-center text-xs font-semibold text-white no-underline"
                href={url}
                style={{ padding: "12px 20px" }}
              >
                Open the data room
              </Button>
            </Section>
            <Text className="break-all text-xs leading-6 text-gray-500">
              Or paste this link into your browser: {url}
            </Text>
            <Footer
              footerText={
                <>
                  This invitation was sent to{" "}
                  <span className="text-black">{recipientEmail}</span>. If you
                  weren&apos;t expecting it, you can ignore this email.
                </>
              }
            />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
