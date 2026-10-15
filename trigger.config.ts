import { ffmpeg } from "@trigger.dev/build/extensions/core";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";
import { defineConfig, timeout } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_uytxulrjajpkcjuqutul",
  dirs: ["./lib/trigger"],
  maxDuration: timeout.None, // no max duration
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  build: {
    extensions: [
      prismaExtension({
        mode: "legacy",
        // Point at the file inside prisma/schema/ so the extension copies the
        // whole folder and Prisma 6.5 (prismaSchemaFolder) finds every model.
        schema: "prisma/schema/schema.prisma",
      }),
      ffmpeg(),
    ],
  },
});
// npx trigger.dev@latest init -p proj_uytxulrjajpkcjuqutul -a https://trigger.wdsvc.io