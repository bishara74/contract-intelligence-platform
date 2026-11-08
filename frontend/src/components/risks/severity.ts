import type { Severity } from "@/types";

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

export const SEVERITY: Record<Severity, { label: string; text: string; bar: string; rule: string }> = {
  critical: { label: "Critical", text: "text-severity-critical", bar: "bg-severity-critical", rule: "border-l-severity-critical" },
  high: { label: "High", text: "text-severity-high", bar: "bg-severity-high", rule: "border-l-severity-high" },
  medium: { label: "Medium", text: "text-severity-medium", bar: "bg-highlight", rule: "border-l-highlight" },
  low: { label: "Low", text: "text-severity-low", bar: "bg-severity-low", rule: "border-l-severity-low" },
};
