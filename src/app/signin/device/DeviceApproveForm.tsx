"use client";

import { useActionState, useEffect } from "react";
import { approveDevice, denyDevice, type DeviceResult } from "./actions";

const empty: DeviceResult = {};

export function DeviceApproveForm({
  code,
  device,
}: {
  code: string;
  device: string;
}) {
  const [approveState, approveAction, approvePending] = useActionState(approveDevice, empty);
  const [denyState, denyAction, denyPending] = useActionState(denyDevice, empty);

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
              Otwórz aplikację
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {result.error ? <p className="error">{result.error}</p> : null}

      <form action={approveAction} style={{ marginTop: 8 }}>
        <input type="hidden" name="code" value={code} />
        <button type="submit" className="primary" style={{ width: "100%" }} disabled={approvePending || denyPending}>
          {approvePending ? "Łączę..." : `Zatwierdź „${device}"`}
        </button>
      </form>

      <form action={denyAction} style={{ marginTop: 10 }}>
        <input type="hidden" name="code" value={code} />
        <button type="submit" style={{ width: "100%" }} disabled={approvePending || denyPending}>
          {denyPending ? "Odrzucam..." : "To nie ja — odrzuć"}
        </button>
      </form>

      <p className="small" style={{ marginTop: 14 }}>
        Po zatwierdzeniu aplikacja odbierze token sama. Możesz też wrócić do Kajetu
        przyciskiem „Otwórz aplikację”, gdy się pojawi.
      </p>
    </div>
  );
}
