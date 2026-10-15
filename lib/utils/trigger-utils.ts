import { BasePlan } from "../swr/use-billing";

/**
 * Returns the conversion queue name for a plan.
 * Queues are predefined in lib/trigger/queues.ts (Trigger.dev v4).
 */
export const conversionQueueName = (plan: string): string => {
  const planName = plan.split("+")[0] as BasePlan;
  return `conversion-${planName}`;
};
