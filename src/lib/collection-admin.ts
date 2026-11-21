/** Reuse the existing password verification endpoint without creating a player. */
export async function verifyCollectionAdmin(password: string): Promise<boolean> {
  const response = await fetch("/api/players/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ password, names: ["__verify__"] }),
  });
  if (response.status === 401) return false;
  if (!response.ok) throw new Error("無法驗證管理登入，請稍後重試");
  return true;
}
