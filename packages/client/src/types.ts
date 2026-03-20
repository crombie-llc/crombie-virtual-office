import { z } from 'zod'

// ── Runtime schemas (Zod) ──

export const DeveloperStateSchema = z.object({
  name:        z.string(),
  color:       z.string(),
  online:      z.boolean(),
  activeAgent: z.string().nullable(),
  thinking:    z.boolean(),
  celebrating: z.boolean(),
  lastSeen:    z.number(),
})

export const OfficeStateSchema = z.record(z.string(), DeveloperStateSchema)

export const WsMessageSchema = z.union([
  z.object({
    type:  z.literal('full_state'),
    state: OfficeStateSchema,
  }),
  z.array(z.object({
    dev:   z.string(),
    patch: DeveloperStateSchema.partial(),
  })),
])

// ── Inferred TypeScript types ──

export type DeveloperState = z.infer<typeof DeveloperStateSchema>
export type OfficeState    = z.infer<typeof OfficeStateSchema>
export type WsMessage      = z.infer<typeof WsMessageSchema>

export interface MascotConfig {
  color: number
  accentColor: number
  label: string
  bounceHeight: number
}
