# $SAMBOT token

sambot is open-source and free to self-host. always will be.

but running the hosted version at [wlessin.com](https://wlessin.com) has real infrastructure costs, and I want to experiment with a model where power users get more out of the platform without it just being a subscription.

the plan: a $SAMBOT SPL token on Solana. holders get:

| tier | balance | perks |
|------|---------|-------|
| basic | 0 | standard inference, all local tools |
| holder | ≥ 1,000 $SAMBOT | extended context window, priority queue, private plugin registry |
| whale | ≥ 100,000 $SAMBOT | everything above + early feature access, direct API access |

## status

- [x] token gate contract written (`src/crypto/TokenGate.ts`)
- [x] tier system designed
- [ ] mint deployed (contract address TBD)
- [ ] UI wallet connect
- [ ] wlessin.com gating live

mint address will be published here when it's ready. no presale, no VC allocation.
supply details TBD — keeping it simple.

---

*if you want to be notified when it launches, watch the repo*
