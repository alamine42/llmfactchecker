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

// Verification schemas
export const VerificationStatusSchema = z.enum([
  'pending',
  'verified',
  'disputed',
  'unverified',
  'error',
])

export const VerificationSourceSchema = z.object({
  name: z.string(),
  url: z.string(), // Allow empty strings - UI will handle rendering
  verdict: z.string(),
  publishedDate: z.string().nullable().optional(),
})

export const VerificationResultSchema = z.object({
  status: VerificationStatusSchema,
  sources: z.array(VerificationSourceSchema),
  confidence: z.number().min(0).max(1),
  verifiedAt: z.string(),
})

export const VerifyClaimRequestSchema = z.object({
  claimId: z.string().min(1),
  claimText: z.string().min(1).max(2000),
  claimType: ClaimTypeSchema,
})

export const VerifyClaimResponseSchema = z.object({
  claimId: z.string(),
  verification: VerificationResultSchema,
})

export type VerificationStatus = z.infer<typeof VerificationStatusSchema>
export type VerificationSource = z.infer<typeof VerificationSourceSchema>
export type VerificationResult = z.infer<typeof VerificationResultSchema>
export type VerifyClaimRequest = z.infer<typeof VerifyClaimRequestSchema>
export type VerifyClaimResponse = z.infer<typeof VerifyClaimResponseSchema>
