/*
 * $SAMBOT SPL token — mint configuration
 *
 * Offchain mint details. Contract address set at launch.
 * Token gate features activate automatically once SAMBOT_MINT is set in .env
 */

export const SAMBOT_TOKEN = {
  symbol:       '$SAMBOT',
  name:         'sambot',
  decimals:     6,
  network:      'mainnet-beta' as const,

  mint:         process.env.SAMBOT_MINT ?? 'EgBvRUFV3o36EwnfLhUh49qNMKbHokQ7AvtW5yTfpump',

  supply: {
    total:      1_000_000_000,
    circulating: null as number | null,  // updated post-launch
  },

  tiers: {
    holder: 1_000,
    whale:  100_000,
  },

  links: {
    site:    'https://wlessin.com',
    repo:    'https://github.com/lessins/sambot',
    docs:    'https://github.com/lessins/sambot/blob/main/docs/token.md',
  },
};

export function isMintConfigured(): boolean {
  return !!SAMBOT_TOKEN.mint && SAMBOT_TOKEN.mint.length > 0;
}
