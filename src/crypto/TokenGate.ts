import { Connection, PublicKey } from '@solana/web3.js';
import { logger } from '../utils/logger';

/*
 * $SAMBOT token gate
 *
 * Certain sambot features (extended context window, private plugins,
 * priority inference on wlessin.com) are gated behind holding a minimum
 * balance of $SAMBOT SPL token.
 *
 * Contract: see SAMBOT_MINT in config / .env
 *           announced when token launches — tracking progress in docs/token.md
 */

export interface TokenGateConfig {
  rpcEndpoint:     string;
  mintAddress:     string;
  minimumBalance:  number;  // in token units (not lamports)
}

export interface WalletTier {
  wallet:          string;
  balance:         number;
  tier:            'none' | 'holder' | 'whale';
  features:        string[];
}

const TIER_THRESHOLDS = {
  holder: 1_000,
  whale:  100_000,
};

const TIER_FEATURES: Record<WalletTier['tier'], string[]> = {
  none:   ['basic_inference', 'local_tools'],
  holder: ['basic_inference', 'local_tools', 'extended_context', 'priority_queue', 'private_plugins'],
  whale:  ['basic_inference', 'local_tools', 'extended_context', 'priority_queue', 'private_plugins', 'early_access', 'api_access'],
};

export class TokenGate {
  private conn:   Connection;
  private config: TokenGateConfig;

  constructor(config: TokenGateConfig) {
    this.config = config;
    this.conn   = new Connection(config.rpcEndpoint, 'confirmed');
  }

  async checkWallet(walletAddress: string): Promise<WalletTier> {
    try {
      const mint   = new PublicKey(this.config.mintAddress);
      const wallet = new PublicKey(walletAddress);

      const accounts = await this.conn.getParsedTokenAccountsByOwner(wallet, { mint });
      let balance = 0;

      for (const { account } of accounts.value) {
        const parsed = account.data.parsed?.info?.tokenAmount?.uiAmount;
        if (typeof parsed === 'number') balance += parsed;
      }

      const tier = balance >= TIER_THRESHOLDS.whale
        ? 'whale'
        : balance >= TIER_THRESHOLDS.holder
        ? 'holder'
        : 'none';

      return {
        wallet:   walletAddress,
        balance,
        tier,
        features: TIER_FEATURES[tier],
      };
    } catch (err) {
      logger.warn(`token gate check failed for ${walletAddress}: ${(err as Error).message}`);
      return {
        wallet:   walletAddress,
        balance:  0,
        tier:     'none',
        features: TIER_FEATURES.none,
      };
    }
  }

  hasFeature(tier: WalletTier, feature: string): boolean {
    return tier.features.includes(feature);
  }
}

export function createTokenGate(): TokenGate | null {
  const mint = process.env.SAMBOT_MINT;
  const rpc  = process.env.SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com';

  if (!mint) {
    logger.debug('SAMBOT_MINT not set — token gate disabled');
    return null;
  }

  return new TokenGate({
    rpcEndpoint:    rpc,
    mintAddress:    mint,
    minimumBalance: parseInt(process.env.SAMBOT_MIN_BALANCE ?? '1000', 10),
  });
}
