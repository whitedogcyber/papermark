import { useRouter } from "next/router";

import { useState } from "react";

import { useTeam } from "@/context/team-context";
import { motion } from "motion/react";
import { toast } from "sonner";

import { STAGGER_CHILD_VARIANTS } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";

import { DATAROOM_TEMPLATES } from "./catalog";

/** Onboarding step: add a template's folders to the new data room. */
export default function DataroomTemplates({
  dataroomId,
}: {
  dataroomId: string;
}) {
  const router = useRouter();
  const teamId = useTeam()?.currentTeam?.id;
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const apply = async () => {
    if (!selected || !teamId) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/teams/${teamId}/datarooms/${dataroomId}/apply-template`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId: selected }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Could not apply the template");
      }
      router.push(`/datarooms/${dataroomId}/documents`);
    } catch (e) {
      toast.error((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <motion.div
      className="z-10 mx-5 flex flex-col items-center space-y-8 text-center sm:mx-auto"
      variants={{
        hidden: { opacity: 0, scale: 0.95 },
        show: { opacity: 1, scale: 1, transition: { staggerChildren: 0.2 } },
      }}
      initial="hidden"
      animate="show"
      exit="hidden"
      transition={{ duration: 0.3, type: "spring" }}
    >
      <motion.h1
        variants={STAGGER_CHILD_VARIANTS}
        className="font-display text-3xl font-semibold sm:text-4xl"
      >
        Choose a template
      </motion.h1>
      <motion.div
        variants={STAGGER_CHILD_VARIANTS}
        className="grid w-full max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {DATAROOM_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelected(t.id)}
            className={cn(
              "rounded-lg border bg-background p-4 text-left transition-colors hover:border-foreground/60",
              selected === t.id && "border-foreground ring-1 ring-foreground",
            )}
          >
            <p className="font-medium">{t.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.description}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t.folders.map((f) => f.name).join(" · ")}
            </p>
          </button>
        ))}
      </motion.div>
      <motion.div variants={STAGGER_CHILD_VARIANTS}>
        <Button onClick={apply} disabled={!selected || saving} loading={saving}>
          Use this template
        </Button>
      </motion.div>
    </motion.div>
  );
}
