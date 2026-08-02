import { authServer } from "@/lib/auth-server";

function unavailable() {
  return Response.json(
    { error: "Authentication is not configured" },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  if (!authServer) return unavailable();
  return authServer.handler.GET(request);
}

export async function POST(request: Request) {
  if (!authServer) return unavailable();
  return authServer.handler.POST(request);
}

