import { useState } from "react";

import { ClockIcon, CrownIcon, UsersIcon } from "lucide-react";

import { EDITIONS, editionById, planRank } from "@/lib/editions";
import { usePlan } from "@/lib/swr/use-billing";
import useLimits from "@/lib/swr/use-limits";
import { timeAgo } from "@/lib/utils";

import { AddSeatModal } from "@/components/billing/add-seat-modal";
import { UpgradePlanModal } from "@/components/billing/upgrade-plan-modal";
import {
  EditionCard,
  useOpenUpgradeRequests,
} from "@/components/editions/request-upgrade";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Settings > Edition: current edition, open requests, all editions. */
export default function UpgradePlanContainer() {
  const { plan, planName, edition, isPending } = usePlan();
  const { limits } = useLimits();
  const { requests } = useOpenUpgradeRequests();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [seatsOpen, setSeatsOpen] = useState(false);
  const rank = planRank(plan);
  const canUpgrade = rank < EDITIONS.length - 1;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CrownIcon className="h-5 w-5" /> {planName}
          </CardTitle>
          <CardDescription>
            {isPending
              ? "This workspace is waiting for an edition. Request one below."
              : (edition?.summary ??
                "Your team is on a legacy plan. It keeps working as before.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {limits?.users != null ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <UsersIcon className="h-4 w-4" />
              {limits.usage?.users ?? 0} of {limits.users} team members used
            </p>
          ) : null}

          {requests.length > 0 ? (
            <div className="space-y-2">
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                >
                  <ClockIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Requested{" "}
                    {r.kind === "seats"
                      ? `${r.requestedSeats} team members`
                      : editionById(r.requestedEdition)?.name}{" "}
                    {timeAgo(r.createdAt)}. Waiting for review.
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {canUpgrade ? (
              <Button onClick={() => setUpgradeOpen(true)}>
                Request an upgrade
              </Button>
            ) : null}
            {!isPending ? (
              <Button variant="outline" onClick={() => setSeatsOpen(true)}>
                Request more team members
              </Button>
            ) : null}
            {!canUpgrade ? (
              <Button variant="outline" onClick={() => setUpgradeOpen(true)}>
                Contact us about your edition
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-3 text-lg font-semibold">Editions</h3>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {EDITIONS.map((e) => (
            <EditionCard
              key={e.id}
              edition={e}
              current={e.plan === edition?.plan}
            />
          ))}
        </div>
      </div>

      <UpgradePlanModal
        clickedPlan={
          EDITIONS[Math.min(Math.floor(rank) + 1, EDITIONS.length - 1)].plan
        }
        trigger="settings_edition"
        open={upgradeOpen}
        setOpen={setUpgradeOpen}
      />
      <AddSeatModal open={seatsOpen} setOpen={setSeatsOpen} />
    </div>
  );
}
