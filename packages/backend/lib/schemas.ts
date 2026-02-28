import { z } from 'zod'

export const ClaimTypeSchema = z.enum([
  'factual',
  'statistical',
  'attribution',
  'temporal',
  'comparative',
])

export const ClaimSchema = z.object({
  id: z.string(),
  text: z.string(),
  type: ClaimTypeSchema,
  confidence: z.number().min(0).max(1),
  sourceOffset: z
    .object({
      start: z.number(),
      end: z.number(),
    })
    .optional(),
})

export const ExtractClaimsRequestSchema = z.object({
  // Max 50KB of text to prevent DoS via CPU-intensive regex processing
  text: z.string().min(1).max(50000),
  source: z.enum(['chatgpt', 'claude']),
  responseId: z.string().optional(),
})

export const ExtractClaimsResponseSchema = z.object({
  claims: z.array(ClaimSchema),
  processingTime: z.number().optional(),
})

export type ClaimType = z.infer<typeof ClaimTypeSchema>
export type Claim = z.infer<typeof ClaimSchema>
export type ExtractClaimsRequest = z.infer<typeof ExtractClaimsRequestSchema>
export type ExtractClaimsResponse = z.infer<typeof ExtractClaimsResponseSchema>
