// Fire-and-forget webhook to the M-WhatsApp CRM bridge.
// A failure here MUST NOT break the originating request (lead update, etc.).
//
// Endpoint and toggle are env-configurable so the URL/port can change without
// a redeploy of the app code:
//   WHATSAPP_BRIDGE_URL  default: https://wa.microgenn.com:4000/api/crm-bridge
//   WHATSAPP_BRIDGE_ENABLED  default: "true" (set to "false" to disable)

const DEFAULT_BRIDGE_URL = "https://wa.microgenn.com:4000/api/crm-bridge";

function bridgeUrl(): string {
  return (process.env.WHATSAPP_BRIDGE_URL || DEFAULT_BRIDGE_URL).replace(/\/$/, "");
}

function bridgeEnabled(): boolean {
  return (process.env.WHATSAPP_BRIDGE_ENABLED ?? "true").toLowerCase() !== "false";
}

export interface StageChangedPayload {
  leadId: string;
  leadName: string;
  phone: string | null;
  fromStage: string;
  toStage: string;
}

export function notifyStageChanged(payload: StageChangedPayload): void {
  if (!bridgeEnabled()) return;
  if (!payload.phone) return; // bridge can't message a lead without a phone

  const url = `${bridgeUrl()}/webhook/stage-changed`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: controller.signal,
  })
    .then((res) => {
      if (!res.ok) {
        console.warn(
          `[whatsapp-bridge] stage-changed POST returned ${res.status} for lead ${payload.leadId}`,
        );
      }
    })
    .catch((err) => {
      console.warn(
        `[whatsapp-bridge] stage-changed POST failed for lead ${payload.leadId}: ${err?.message ?? err}`,
      );
    })
    .finally(() => clearTimeout(timeout));
}
