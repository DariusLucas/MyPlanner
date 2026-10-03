const internalBase = "https://myplanner.invalid";

export function safeNextPath(value: string | null | undefined) {
  if (!value) return "/";
  try {
    const parsed = new URL(value, internalBase);
    if (parsed.origin !== internalBase) return "/";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}
