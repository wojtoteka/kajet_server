import { tokenAccess } from "@/lib/sharing";
import { serveAttachment } from "@/lib/serve-attachment";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const url = new URL(request.url);
  // Notatka z udostępnionego folderu przychodzi z numerem w `note`.
  const access = await tokenAccess(token, url.searchParams.get("note"));
  if (!access.ok) return new Response(access.reason, { status: 403 });

  const name = url.searchParams.get("name");
  return serveAttachment(access.access.note.id, name);
}
