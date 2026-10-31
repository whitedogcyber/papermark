import React, { useState } from "react";

import { PlanEnum } from "@/ee/stripe/constants";

import { editionForRequirement } from "@/lib/editions";

import { RequestUpgradeForm } from "@/components/editions/request-upgrade";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

/**
 * WhiteDog: every "upgrade" entry point opens a request instead of checkout.
 * Same props as upstream so all existing call sites keep working.
 * `clickedPlan` picks the edition that is preselected.
 */
export function UpgradePlanModal({
  clickedPlan,
  trigger,
  open,
  setOpen,
  children,
}: {
  clickedPlan: PlanEnum | string;
  trigger?: string;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  highlightItem?: string[];
  children?: React.ReactNode;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const isOpen = open ?? innerOpen;
  const onOpenChange = (value: boolean) => {
    setInnerOpen(value);
    setOpen?.(value);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {isOpen ? (
          <RequestUpgradeForm
            suggested={editionForRequirement(String(clickedPlan)).id}
            trigger={trigger}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
