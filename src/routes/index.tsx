import { createFileRoute } from "@tanstack/react-router";
import { InkwellDesk } from "@/components/inkwell-desk";

export const Route = createFileRoute("/")({
  component: InkwellDesk,
});
