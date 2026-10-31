import { motion } from "motion/react";

import { STAGGER_CHILD_VARIANTS } from "@/lib/constants";

import { RequestUpgradeForm } from "@/components/editions/request-upgrade";

/** WhiteDog: no trials. Onboarding asks for data room access instead. */
export default function DataroomTrial() {
  return (
    <motion.div
      className="z-10 mx-5 flex flex-col items-center space-y-10 text-center sm:mx-auto"
      variants={{
        hidden: { opacity: 0, scale: 0.95 },
        show: {
          opacity: 1,
          scale: 1,
          transition: { staggerChildren: 0.2 },
        },
      }}
      initial="hidden"
      animate="show"
      exit="hidden"
      transition={{ duration: 0.3, type: "spring" }}
    >
      <motion.div
        variants={STAGGER_CHILD_VARIANTS}
        className="w-full max-w-3xl rounded-lg border bg-background p-6 text-left"
      >
        <RequestUpgradeForm
          inDialog={false}
          suggested="premium"
          trigger="welcome_datarooms"
        />
      </motion.div>
    </motion.div>
  );
}
