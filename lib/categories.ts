// Ligtas gamitin sa browser at sa server (walang server-only import dito)
export type Category = "adult" | "young" | "child";

export const CATEGORIES: Category[] = ["adult", "young", "child"];

export const CATEGORY_LABEL: Record<Category, string> = {
  adult: "Adult",
  young: "Young",
  child: "Child",
};
