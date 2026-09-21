// Ang login ay username. Sa likod ng eksena, ang Supabase ay email ang hinihingi,
// kaya ang username ay ginagawang panloob na email (hindi ito totoong mailbox).
export const MEMBER_EMAIL_DOMAIN = "members.idbcj.org";

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${MEMBER_EMAIL_DOMAIN}`;
}

// Kung may "@" ang inilagay, email ito (para sa mga lumang account). Kung wala, username.
export function loginToEmail(input: string): string {
  const v = input.trim();
  return v.includes("@") ? v : usernameToEmail(v);
}

export function isInternalEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith("@" + MEMBER_EMAIL_DOMAIN);
}

// Ang totoong email lang ang ipapakita; ang panloob na email ay itinatago
export function shownEmail(email: string | null | undefined): string | null {
  return email && !isInternalEmail(email) ? email : null;
}

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

// "Jeileth Villaverde" -> "jeileth.villaverde" (unang pangalan + apelyido)
export function baseUsername(fullName: string): string {
  let parts = fullName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .split(/\s+/)
    .map((p) => p.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean)
    .filter((p) => !SUFFIXES.has(p));
  // "Ma." (Maria) ay hindi ang unang pangalan kung may iba pang salita
  if (parts.length > 2 && parts[0] === "ma") parts = parts.slice(1);
  if (parts.length === 0) return "";
  return parts.length === 1 ? parts[0] : `${parts[0]}.${parts[parts.length - 1]}`;
}
