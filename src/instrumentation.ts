/*
  Co Next robi raz, przy podnoszeniu procesu serwera.

  Tu odpalamy sprzątanie kosza i kont, z których nikt nie korzysta. Dzięki temu
  nie trzeba niczego wpisywać do crona na serwerze: proces i tak chodzi pod pm2
  przez całą dobę, a sprzątanie wisi na jego zegarze.
*/

export async function register() {
  // Middleware i brzeg dostają ten sam plik, a tam nie ma ani bazy, ani dysku.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startTrashSweeper } = await import("@/lib/trash");
  startTrashSweeper();

  const { startInactiveSweeper } = await import("@/lib/inactive");
  startInactiveSweeper();
}
