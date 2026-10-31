import React from "react";

import { PlanEnum } from "@/whitedog/plans";

import { UpgradePlanModal } from "@/components/billing/upgrade-plan-modal";

/** WhiteDog: no trials. Data room access is requested like any upgrade. */
export function DataroomTrialModal({
  children,
  openModal,
  setOpenModal,
}: {
  children?: React.ReactNode;
  openModal?: boolean;
  setOpenModal?: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  return (
    <UpgradePlanModal
      clickedPlan={PlanEnum.DataRoomsPlus}
      trigger="dataroom_access"
      open={openModal}
      setOpen={setOpenModal}
    >
      {children}
    </UpgradePlanModal>
  );
}
