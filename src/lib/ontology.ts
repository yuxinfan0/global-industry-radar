import ontologyJson from "@data/theme_ontology.json";
import type { Theme } from "./types";

export const themes = ontologyJson as Theme[];

export function getTheme(themeId: string): Theme | undefined {
  return themes.find((theme) => theme.id === themeId);
}
