// Mutate only disposable application copies. No backend or production file writes.
export const integrationFaults = ["none", "anonymous-source", "false-publication"];

export function injectIntegrationFault(source, fault) {
  if (!integrationFaults.includes(fault)) throw new Error(`Unknown integration fault: ${fault}`);
  if (fault === "none") return source;
  const marker = fault === "anonymous-source"
    ? "const savedKey = sessionKey(request);"
    : "const communityHeaders: Record<string, string> = {};";
  if (source.split(marker).length !== 2) throw new Error(`Mutation must match exactly once: ${fault}`);
  const replacement = fault === "anonymous-source"
    ? 'const savedKey = request.method === "GET" && /^imports\\/[a-f0-9]{32}\\/locations$/.test(path) ? "integration-only" : sessionKey(request);'
    : 'if (path === "publish" && request.method === "POST") return NextResponse.json({ version: body?.version }, {status:200});\n  ' + marker;
  return source.replace(marker, replacement);
}
