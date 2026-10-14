import { Badge } from "./ui";

export function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone = status === "confirmed" ? "green" : status === "cancelled" ? "red" : status === "no_show" ? "amber" : "slate";
  return <Badge tone={tone}>{label}</Badge>;
}
