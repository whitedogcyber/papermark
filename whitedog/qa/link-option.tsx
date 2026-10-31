import { useEffect, useState } from "react";

import type { DEFAULT_LINK_TYPE } from "@/components/links/link-sheet";
import LinkItem from "@/components/links/link-sheet/link-item";
import type { LinkUpgradeOptions } from "@/components/links/link-sheet/link-options";

/** Link setting: let visitors ask the team questions (needs verified email). */
export default function ConversationSection({
  data,
  setData,
  isAllowed,
  handleUpgradeStateChange,
}: {
  data: DEFAULT_LINK_TYPE;
  setData: React.Dispatch<React.SetStateAction<DEFAULT_LINK_TYPE>>;
  isAllowed: boolean;
  handleUpgradeStateChange: (options: LinkUpgradeOptions) => void;
}) {
  const [enabled, setEnabled] = useState<boolean>(!!data.enableConversation);

  useEffect(() => {
    setEnabled(!!data.enableConversation);
  }, [data.enableConversation]);

  const toggle = () => {
    const next = !enabled;
    setData({
      ...data,
      enableConversation: next,
      // Questions are tied to a verified email address.
      ...(next ? { emailProtected: true, emailAuthenticated: true } : {}),
    });
    setEnabled(next);
  };

  return (
    <div className="pb-5">
      <LinkItem
        title="Enable Q&A"
        tooltipContent="Visitors can ask the team questions. Turns on email verification."
        enabled={enabled}
        action={toggle}
        isAllowed={isAllowed}
        requiredPlan="data rooms plus"
        upgradeAction={() =>
          handleUpgradeStateChange({
            state: true,
            trigger: "link_sheet_qa_section",
            plan: "Data Rooms Plus",
          })
        }
      />
    </div>
  );
}
