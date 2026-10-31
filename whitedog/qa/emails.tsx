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

function Layout({
  preview,
  children,
  buttonText,
  url,
  footer,
}: {
  preview: string;
  children: React.ReactNode;
  buttonText: string;
  url: string;
  footer: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="mx-auto my-auto bg-white font-sans">
          <Container className="mx-auto my-10 w-[465px] p-5">
            <Text className="mx-0 mb-8 mt-4 p-0 text-center text-2xl font-normal">
              <span className="font-bold tracking-tighter">{EMAIL_BRAND}</span>
            </Text>
            {children}
            <Section className="my-8 text-center">
              <Button
                className="rounded bg-black text-center text-xs font-semibold text-white no-underline"
                href={url}
                style={{ padding: "12px 20px" }}
              >
                {buttonText}
              </Button>
            </Section>
            <Footer footerText={footer} />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

/** To the data room team: a visitor asked or replied. */
export function TeamQuestionEmail({
  viewerEmail = "visitor@example.com",
  dataroomName = "Project Atlas",
  content = "Where is the latest financial model?",
  isNew = true,
  url = "https://example.com",
}: {
  viewerEmail: string;
  dataroomName: string;
  content: string;
  isNew: boolean;
  url: string;
}) {
  return (
    <Layout
      preview={`${viewerEmail} ${isNew ? "asked a question" : "replied"} in ${dataroomName}`}
      buttonText="Answer"
      url={url}
      footer="You get this because you manage this team in WhiteDog Share."
    >
      <Text className="text-sm leading-6 text-black">
        <strong>{viewerEmail}</strong> {isNew ? "asked a question" : "replied"}{" "}
        in <strong>{dataroomName}</strong>:
      </Text>
      <Text className="whitespace-pre-wrap rounded bg-gray-100 p-3 text-sm leading-6 text-black">
        {content}
      </Text>
    </Layout>
  );
}

/** To the visitor: the team answered. */
export function ViewerReplyEmail({
  dataroomName = "Project Atlas",
  content = "It's in Financials > Projections.",
  url = "https://example.com",
  recipientEmail = "visitor@example.com",
}: {
  dataroomName: string;
  content: string;
  url: string;
  recipientEmail: string;
}) {
  return (
    <Layout
      preview={`New answer in ${dataroomName}`}
      buttonText="Open the data room"
      url={url}
      footer={`Sent to ${recipientEmail} because you asked a question in ${dataroomName}.`}
    >
      <Text className="text-sm leading-6 text-black">
        The <strong>{dataroomName}</strong> team answered your question:
      </Text>
      <Text className="whitespace-pre-wrap rounded bg-gray-100 p-3 text-sm leading-6 text-black">
        {content}
      </Text>
    </Layout>
  );
}
