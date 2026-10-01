import { createFileRoute } from "@tanstack/react-router";
import { UnifiedInkWorkspace } from "@/components/unified-ink-workspace";

export const Route = createFileRoute("/")({
  component: UnifiedInkWorkspace,
});
