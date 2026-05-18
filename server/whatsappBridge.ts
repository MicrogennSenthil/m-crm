// Fire-and-forget webhook to the M-WhatsApp CRM bridge.
// A failure here MUST NOT break the originating request (lead update, etc.).
//
// Config resolution order (first non-empty wins):
//   1. Settings row in `quotation_settings` (admin-editable via UI)
//   2. Env vars WHATSAPP_BRIDGE_URL / WHATSAPP_BRIDGE_TOKEN / WHATSAPP_BRIDGE_ENABLED
//   3. Hard-coded default URL below
import { storage } from "./storage";

const DEFAULT_BRIDGE_URL = "https://wa.microgenn.com:4000/api/crm-bridge";

async function getBridgeConfig(): Promise<{ url: string; token: string; enabled: boolean }> {
  let dbUrl = "";
  let dbToken = "";
  let dbEnabled: boolean | null = null;
  try {
    const s = await storage.getQuotationSettings();
    dbUrl = (s.bridgeUrl ?? "").trim();
    dbToken = (s.bridgeToken ?? "").trim();
    dbEnabled = s.bridgeEnabled ?? null;
  } catch {
    // Settings row may not exist yet on first boot — fall back to env/defaults.
  }
  const url = (dbUrl || process.env.WHATSAPP_BRIDGE_URL || DEFAULT_BRIDGE_URL).replace(/\/$/, "");
  const token = dbToken || process.env.WHATSAPP_BRIDGE_TOKEN || "";
  let enabled: boolean;
  if (dbEnabled !== null) {
    enabled = dbEnabled;
  } else {
    enabled = (process.env.WHATSAPP_BRIDGE_ENABLED ?? "true").toLowerCase() !== "false";
  }
  return { url, token, enabled };
}

export interface StageChangedPayload {
  leadId: string;
  leadName: string;
  phone: string | null;
  fromStage: string;
  toStage: string;
}

export function notifyStageChanged(payload: StageChangedPayload): void {
  if (!payload.phone) return; // bridge can't message a lead without a phone

  // Resolve config and fire the request asynchronously so the caller is never blocked.
  void (async () => {
    let cfg: Awaited<ReturnType<typeof getBridgeConfig>>;
    try {
      cfg = await getBridgeConfig();
    } catch (err: any) {
      console.warn(`[whatsapp-bridge] config lookup failed: ${err?.message ?? err}`);
      return;
    }
    if (!cfg.enabled || !cfg.url) return;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cfg.token) headers["Authorization"] = `Bearer ${cfg.token}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${cfg.url}/webhook/stage-changed`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) {
        console.warn(
          `[whatsapp-bridge] stage-changed POST returned ${res.status} for lead ${payload.leadId}`,
        );
      }
    } catch (err: any) {
      console.warn(
        `[whatsapp-bridge] stage-changed POST failed for lead ${payload.leadId}: ${err?.message ?? err}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  })();
}
