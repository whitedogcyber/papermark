import React from "react";

import { RequestUpgradeForm } from "@/components/editions/request-upgrade";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

/** WhiteDog: request more team members instead of buying seats. */
export function AddSeatModal({
  open,
  setOpen,
  children,
}: {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  children?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <RequestUpgradeForm
            kind="seats"
            trigger="add_seat"
            onDone={() => setOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
