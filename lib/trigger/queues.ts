import { queue } from "@trigger.dev/sdk";

// Task queues (previously declared inline on each task)
export const convertFilesToPdfQueue = queue({
  name: "convert-files-to-pdf",
  concurrencyLimit: 10,
});

export const convertCadToPdfQueue = queue({
  name: "convert-cad-to-pdf",
  concurrencyLimit: 2,
});

export const convertKeynoteToPdfQueue = queue({
  name: "convert-keynote-to-pdf",
  concurrencyLimit: 2,
});

// Plan-based conversion queues, selected by name at trigger time
// (see conversionQueueName in lib/utils/trigger-utils.ts)
export const conversionFreeQueue = queue({
  name: "conversion-free",
  concurrencyLimit: 1,
});
export const conversionStarterQueue = queue({
  name: "conversion-starter",
  concurrencyLimit: 1,
});
export const conversionProQueue = queue({
  name: "conversion-pro",
  concurrencyLimit: 2,
});
export const conversionBusinessQueue = queue({
  name: "conversion-business",
  concurrencyLimit: 10,
});
export const conversionDataroomsQueue = queue({
  name: "conversion-datarooms",
  concurrencyLimit: 10,
});
export const conversionDataroomsPlusQueue = queue({
  name: "conversion-datarooms-plus",
  concurrencyLimit: 10,
});
export const conversionDataroomsPremiumQueue = queue({
  name: "conversion-datarooms-premium",
  concurrencyLimit: 10,
});
export const conversionDataroomsUnlimitedQueue = queue({
  name: "conversion-datarooms-unlimited",
  concurrencyLimit: 10,
});
