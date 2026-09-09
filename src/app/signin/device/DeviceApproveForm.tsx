"use client";

import { useActionState, useEffect } from "react";
import { approveDevice, denyDevice, type DeviceResult } from "./actions";
import { useWords } from "@/components/LanguageProvider";
import { safeAction } from "@/components/safe-action";
import { approveButtonLabel } from "@/lib/i18n";

const empty: DeviceResult = {};

export function DeviceApproveForm({
  code,
  device,
}: {
  code: string;
  device: string;
}) {
  const words = useWords();
  // safeAction: wywołanie, które nie doszło do serwera (stara strona po
  // wdrożeniu, zerwane łącze), wraca jako zwykły błąd zamiast zabierać ze sobą
  // całą stronę.
  const lost: DeviceResult = { error: words.requestLost };
  const outdated: DeviceResult = { error: words.requestOutdated };
  const [approveState, approveAction, approvePending] = useActionState(
    safeAction(approveDevice, lost, outdated),
    empty,
  );
  const [denyState, denyAction, denyPending] = useActionState(
    safeAction(denyDevice, lost, outdated),
    empty,
  );

  const result = approveState.success || approveState.error ? approveState : denyState;

  useEffect(() => {
    if (approveState.deepLink) {
      // Custom Tabs / in-app browser: try to bounce back to the app.
      window.location.href = approveState.deepLink;
    }
  }, [approveState.deepLink]);

  if (result.success) {
    return (
      <div>
        <p className="success" style={{ whiteSpace: "pre-wrap" }}>
          {result.success}
        </p>
        {approveState.deepLink ? (
          <p style={{ marginTop: 16 }}>
            <a className="button primary" href={approveState.deepLink}>
              {words.openTheApp}
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <form action={approveAction} style={{ marginTop: 8 }}>
        <input type="hidden" name="code" value={code} />
        <button type="submit" className="primary" style={{ width: "100%" }} disabled={approvePending || denyPending}>
          {approvePending ? words.connecting : approveButtonLabel(words, device)}
        </button>
      </form>

      <form action={denyAction} style={{ marginTop: 10 }}>
        <input type="hidden" name="code" value={code} />
        <button type="submit" style={{ width: "100%" }} disabled={approvePending || denyPending}>
          {denyPending ? words.denying : words.notMeDeny}
        </button>
      </form>

      {/* Odpowiedź pod przyciskami - nad nimi spychała je w dół w chwili
          stuknięcia. */}
      {result.error ? (
        <p className="error" style={{ margin: "12px 0 0 0" }}>
          {result.error}
        </p>
      ) : null}

      <p className="small" style={{ marginTop: 14 }}>
        {words.afterApprovalAbout}
      </p>
    </div>
  );
}
