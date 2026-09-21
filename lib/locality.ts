// Ligtas gamitin sa browser at sa server (walang server-only import dito)
export type Locality = "medina" | "batangas" | "fort_mcmurray" | "other";

export const LOCALITIES: Locality[] = ["medina", "batangas", "fort_mcmurray", "other"];

export const LOCALITY_LABEL: Record<Locality, string> = {
  medina: "Medina, Magallanes, Cavite",
  batangas: "Sta. Teresita, Sto. Tomas, Batangas",
  fort_mcmurray: "Fort McMurray, Alberta",
  other: "Iba pa",
};
