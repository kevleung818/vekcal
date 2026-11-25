import { DISCLAIMER } from "./compliance";
import type { Role } from "./types";

export function Disclaimer() {
  return <p className="disclaimer">{DISCLAIMER}</p>;
}

export function LayerBanner({
  kicker,
  text,
  tone = "content",
}: {
  kicker: string;
  text: string;
  tone?: "content" | "commercial" | "directory";
}) {
  return (
    <p className={`layer-banner tone-${tone}`}>
      <span>{kicker}</span>
      {text}
    </p>
  );
}

export function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-HK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Hong_Kong",
  }).format(new Date(iso));
}

export const roleLabel: Record<Role, string> = {
  guest: "Visitor",
  member: "Member",
  professional: "Licensed professional",
  reviewer: "Content reviewer",
  brand: "Brand",
};
