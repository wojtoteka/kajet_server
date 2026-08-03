import { ownerAccess } from "@/lib/sharing";
import { serveAttachment } from "@/lib/serve-attachment";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await ownerAccess(id);
  if (!access.ok) return new Response(access.reason, { status: 403 });

  const name = new URL(request.url).searchParams.get("name");
  return serveAttachment(id, name);
}
