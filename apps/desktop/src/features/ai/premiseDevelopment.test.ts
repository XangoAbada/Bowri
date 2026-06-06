import { describe, expect, it } from "vitest";
import { parsePremiseDevelopment } from "./premiseDevelopment";

const validOutput = {
  version: 1,
  kind: "premise_development",
  summary: "Archiwistka odkrywa falszowanie pamieci miasta.",
  logline: "Archiwistka musi zatrzymac druk falszywych wspomnien.",
  expandedPremise:
    "W miescie kontrolowanym przez drukowane sny archiwistka szuka siostry i odkrywa system manipulacji.",
  centralConflict: "Prawda kontra spokoj oparty na klamstwie.",
  stakes: "Miasto moze utracic wlasna historie.",
  themes: ["pamiec", "tozsamosc"],
  risks: ["Ustalic koszt magii druku."],
  questionsForAuthor: ["Kto pierwszy korzysta na manipulacji?"]
};

describe("parsePremiseDevelopment", () => {
  it("maps structured premise output into editable fields", () => {
    const parsed = parsePremiseDevelopment(JSON.stringify(validOutput));

    expect(parsed.kind).toBe("premise_development");
    expect(parsed.fieldValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "premise",
          value: validOutput.summary
        }),
        expect.objectContaining({
          field: "themesJson",
          value: "pamiec, tozsamosc"
        })
      ])
    );
    expect(parsed.warnings).toEqual(validOutput.risks);
  });

  it("extracts JSON from fenced output", () => {
    const parsed = parsePremiseDevelopment(
      `Komentarz\n\`\`\`json\n${JSON.stringify(validOutput)}\n\`\`\``
    );

    expect(parsed.logline).toBe(validOutput.logline);
  });

  it("rejects invalid kind", () => {
    expect(() =>
      parsePremiseDevelopment(
        JSON.stringify({ ...validOutput, kind: "concept_field_suggestion" })
      )
    ).toThrow();
  });
});
