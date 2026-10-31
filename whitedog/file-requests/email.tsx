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

export default function VisitorUploadEmail({
  uploaderEmail = "someone@example.com",
  fileName = "Report.pdf",
  dataroomName = "Project Atlas",
  folderName,
  reviewUrl = "https://example.com",
}: {
  uploaderEmail: string;
  fileName: string;
  dataroomName: string;
  folderName?: string | null;
  reviewUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{`${uploaderEmail} uploaded ${fileName}`}</Preview>
      <Tailwind>
        <Body className="mx-auto my-auto bg-white font-sans">
          <Container className="mx-auto my-10 w-[465px] p-5">
            <Text className="mx-0 mb-8 mt-4 p-0 text-center text-2xl font-normal">
              <span className="font-bold tracking-tighter">{EMAIL_BRAND}</span>
            </Text>
            <Text className="text-sm leading-6 text-black">
              <strong>{uploaderEmail}</strong> uploaded{" "}
              <strong>{fileName}</strong> to <strong>{dataroomName}</strong>
              {folderName ? (
                <>
                  {" "}
                  (folder <strong>{folderName}</strong>)
                </>
              ) : null}
              .
            </Text>
            <Text className="text-sm leading-6 text-black">
              It is in Documents &gt; Visitor uploads and is not visible in the
              data room until you add it there.
            </Text>
            <Section className="my-8 text-center">
              <Button
                className="rounded bg-black text-center text-xs font-semibold text-white no-underline"
                href={reviewUrl}
                style={{ padding: "12px 20px" }}
              >
                Review upload
              </Button>
            </Section>
            <Footer footerText="You get this because you manage this team in WhiteDog Share." />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
