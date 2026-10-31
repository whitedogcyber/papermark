// Browser-safe domain helpers (lib/domains.ts uses node:dns).
export const getSubdomain = (name?: string, apexName?: string) => {
  if (!name || !apexName || name === apexName) return null;
  return name.slice(0, name.length - apexName.length - 1);
};
