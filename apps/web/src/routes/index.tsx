import { createFileRoute } from "@tanstack/react-router";

import { EmptyLog } from "#/features/shell/empty-log";

export const Route = createFileRoute("/")({
  component: EmptyLog,
});
