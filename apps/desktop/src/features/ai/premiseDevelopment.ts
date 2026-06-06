import { z } from "zod";
import type { ConceptFieldKey } from "./promptPackage";
import { conceptFieldConfigs } from "./promptPackage";
import { extractJsonCandidate } from "./titleSuggestions";

export type PremiseDevelopmentField = {
  field: Extract<
    ConceptFieldKey,
    | "premise"
    | "expandedPremise"
    | "logline"
    | "centralConflict"
    | "stakes"
    | "themesJson"
  >;
  label: string;
  value: string;
};

const premiseDevelopmentResponseSchema = z.object({
  version: z.literal(1),
  kind: z.literal("premise_development"),
  summary: z.string().trim().min(1),
  logline: z.string().trim().min(1),
  expandedPremise: z.string().trim().min(1),
  centralConflict: z.string().trim().min(1),
  stakes: z.string().trim().min(1),
  themes: z.array(z.string().trim().min(1)).default([]),
  risks: z.array(z.string().trim().min(1)).default([]),
  questionsForAuthor: z.array(z.string().trim().min(1)).default([])
});

export type PremiseDevelopmentResponse = z.infer<
  typeof premiseDevelopmentResponseSchema
>;

export type NormalizedPremiseDevelopment = PremiseDevelopmentResponse & {
  textValue: string;
  fieldValues: PremiseDevelopmentField[];
  warnings: string[];
};

export function parsePremiseDevelopment(
  rawOutput: string
): NormalizedPremiseDevelopment {
  const candidate = extractJsonCandidate(rawOutput);
  if (!candidate) {
    throw new Error("Nie znaleziono obiektu JSON w odpowiedzi Codex CLI.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (error) {
    throw new Error(`Niepoprawny JSON w odpowiedzi premise: ${String(error)}`);
  }

  const response = premiseDevelopmentResponseSchema.parse(parsed);
  const candidates: PremiseDevelopmentField[] = [
    {
      field: "premise",
      label: conceptFieldConfigs.premise.label,
      value: response.summary
    },
    {
      field: "logline",
      label: conceptFieldConfigs.logline.label,
      value: response.logline
    },
    {
      field: "expandedPremise",
      label: conceptFieldConfigs.expandedPremise.label,
      value: response.expandedPremise
    },
    {
      field: "centralConflict",
      label: conceptFieldConfigs.centralConflict.label,
      value: response.centralConflict
    },
    {
      field: "stakes",
      label: conceptFieldConfigs.stakes.label,
      value: response.stakes
    },
    {
      field: "themesJson",
      label: conceptFieldConfigs.themesJson.label,
      value: response.themes.join(", ")
    }
  ];
  const fieldValues = candidates.filter((item) => item.value.trim().length > 0);

  if (fieldValues.length === 0) {
    throw new Error("Odpowiedź AI nie zawiera pól premise do akceptacji.");
  }

  return {
    ...response,
    textValue: fieldValues.map((item) => `${item.label}: ${item.value}`).join("\n\n"),
    fieldValues,
    warnings: response.risks
  };
}
