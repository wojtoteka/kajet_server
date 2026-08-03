import { tokenAccess } from "@/lib/sharing";
import { serveAttachment } from "@/lib/serve-attachment";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const access = await tokenAccess(token);
  if (!access.ok) return new Response(access.reason, { status: 403 });

  const name = new URL(request.url).searchParams.get("name");
  return serveAttachment(access.access.note.id, name);
}
