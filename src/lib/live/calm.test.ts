import { describe, expect, it } from "vitest";
import { CONNECT_GRACE_MS, DROP_GRACE_MS, calmLiveShown, calmRecheckIn } from "./calm";

// Te same przypadki co LiveCalmTest.kt w aplikacji.
describe("napis łącza", () => {
  it("krótkie zerwanie i ponowne łączenie zostawia „Połączono”", () => {
    let shown = calmLiveShown("none", "live", 0);
    shown = calmLiveShown(shown, "offline", 0);
    expect(shown).toBe("connected");
    shown = calmLiveShown(shown, "connecting", 1_000);
    expect(shown).toBe("connected");
    expect(calmLiveShown(shown, "live", 0)).toBe("connected");
  });

  it("dłuższy brak łącza pokazuje „Offline” mimo prób łączenia", () => {
    expect(calmLiveShown("connected", "connecting", DROP_GRACE_MS)).toBe("offline");
    expect(calmRecheckIn("connected", "offline", 2_000)).toBe(4_000);
  });

  it("„Offline” zostaje do prawdziwego połączenia", () => {
    expect(calmLiveShown("offline", "connecting", 0)).toBe("offline");
    expect(calmLiveShown("offline", "live", 0)).toBe("connected");
  });

  it("bez sieci od otwarcia od razu „Offline”", () => {
    expect(calmLiveShown("none", "offline", 0)).toBe("offline");
  });

  it("pierwsze łączenie chwilę nic nie mówi, potem „Offline”", () => {
    expect(calmLiveShown("none", "connecting", 500)).toBe("none");
    expect(calmLiveShown("none", "connecting", CONNECT_GRACE_MS)).toBe("offline");
  });
});
