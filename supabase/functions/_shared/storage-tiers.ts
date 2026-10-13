const GB = 1024 * 1024 * 1024

export const STORAGE_TIERS: Record<string, { label: string; addedBytes: number; amountCents: number }> = {
  plus_50: { label: '+50 GB storage', addedBytes: 50 * GB, amountCents: 199 },
  plus_200: { label: '+200 GB storage', addedBytes: 200 * GB, amountCents: 499 },
  plus_1000: { label: '+1 TB storage', addedBytes: 1000 * GB, amountCents: 1499 },
}
