import "server-only";

/**
 * Optional AI Design Assistant — integration point only.
 *
 * NOTHING in the storefront generates artwork today. The "Help me create a design" flow is a
 * request that the owner fulfils by hand. To add AI concepts later:
 *   1. Implement `generateConcept` with a real image-generation API (server-side, key in env).
 *   2. Set AI_DESIGN_PROVIDER in the environment so `aiConceptsEnabled()` returns true.
 *   3. Save the generated image as an Upload (purpose INSPIRATION) and store its id on
 *      DesignRequest.aiConceptUploadId, labelled "AI concept — not a print proof".
 *   4. Keep the owner proof + customer approval step: AI concepts must be reviewed for print
 *      suitability and approved before production.
 */

export type ConceptInput = { description: string; style?: string; colors?: string; garment: string };
export type ConceptResult = { imageBytes: Buffer; contentType: "image/png"; provider: string; disclaimer: string };

export function aiConceptsEnabled() {
  return Boolean(process.env.AI_DESIGN_PROVIDER);
}

export async function generateConcept(_input: ConceptInput): Promise<ConceptResult> {
  throw new Error("No AI image-generation provider is connected. See src/lib/ai/design-concepts.ts.");
}
