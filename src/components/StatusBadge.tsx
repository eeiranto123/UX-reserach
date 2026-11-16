const TONE: Record<string, string> = {
  completed: "ok",
  success: "ok",
  running: "info",
  synthesizing: "info",
  queued: "",
  partial: "warn",
  gave_up: "warn",
  unclear: "warn",
  interrupted: "warn",
  failed: "bad",
  failure: "bad",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <span className={`badge ${TONE[status] ?? ""}`}>{label ?? status.replace("_", " ")}</span>;
}
