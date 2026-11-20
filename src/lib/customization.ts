// Customization payload schema — shared by the client customizer and server validation.
import { z } from "zod";

export const placementSchema = z.object({
  locationId: z.string().min(1).max(40),
  uploadId: z.string().min(1).max(40).optional(),
  x: z.number().min(0).max(1).default(0.5),
  y: z.number().min(0).max(1).default(0.5),
  scale: z.number().min(0.05).max(1).default(0.8),
  text: z.string().trim().max(60).optional(),
  textFont: z.enum(["script", "sans"]).optional(),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const designRequestSchema = z.object({
  description: z.string().trim().min(10, "Please describe your idea in a few words (at least 10 characters).").max(3000),
  textToInclude: z.string().trim().max(300).optional(),
  preferredColors: z.string().trim().max(200).optional(),
  style: z.string().trim().max(60).optional(),
  placementLocationId: z.string().max(40).optional(),
  occasion: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1500).optional(),
  inspirationUploadIds: z.array(z.string().max(40)).max(5).default([]),
});

export const customizationSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("NONE") }),
  z.object({
    method: z.literal("UPLOAD"),
    placements: z
      .array(placementSchema)
      .min(1)
      .max(6)
      .refine((p) => p.every((x) => x.uploadId || x.text), "Each placement needs artwork or text."),
    instructions: z.string().trim().max(1500).optional(),
  }),
  z.object({ method: z.literal("DESIGN_REQUEST"), request: designRequestSchema }),
]);

export type Placement = z.infer<typeof placementSchema>;
export type DesignRequestInput = z.infer<typeof designRequestSchema>;
export type Customization = z.infer<typeof customizationSchema>;

/** Snapshot stored on OrderItem — human-readable so it survives product edits. */
export type CustomizationSnapshot =
  | { method: "NONE" }
  | {
      method: "UPLOAD";
      instructions?: string;
      placements: Array<{
        locationName: string;
        uploadId?: string;
        filename?: string;
        x: number;
        y: number;
        scale: number;
        text?: string;
        textFont?: string;
        textColor?: string;
      }>;
    }
  | { method: "DESIGN_REQUEST"; request: DesignRequestInput & { placementName?: string } };
