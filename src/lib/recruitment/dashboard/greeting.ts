/** "Good morning, Sowmya" and "Tuesday, 13 October", on the IST clock. */
export function greetingFor(name: string | null | undefined, now = new Date()): { title: string; date: string } {
  const hour = Number(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false })) % 24;
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = name?.trim().split(/\s+/)[0];
  return {
    title: first ? `${part}, ${first}` : part,
    date: now.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" }),
  };
}
