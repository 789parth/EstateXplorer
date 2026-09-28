const BaseEmailRiskProvider = require('./BaseEmailRiskProvider');

// Free or high-abuse TLDs commonly seen in throwaway registration campaigns
const SUSPICIOUS_TLDS = new Set([
  'tk',
  'ml',
  'ga',
  'cf',
  'gq',
  'top',
  'buzz',
  'rest',
  'fit',
  'work',
  'icu',
  'monster',
]);

// Suspicious keywords in disposable domain names
const DISPOSABLE_KEYWORDS = [
  'temp',
  'dispos',
  'burner',
  'throwaway',
  'trash',
  'fake',
  'nada',
  'guerrilla',
  'dropmail',
  '10min',
  'inboxkitten',
  'generator',
];

class DomainReputationProvider extends BaseEmailRiskProvider {
  constructor() {
    super('domain_reputation_heuristics', 4);
  }

  async evaluate({ domain }) {
    if (!domain) {
      return {
        isDisposable: false,
        isTemporary: false,
        isFreeProvider: false,
        isRoleAccount: false,
        isAcceptAll: false,
        isDomainRisky: true,
        domainReputation: 0,
        confidence: 100,
        provider: this.name,
        reason: 'missing_domain',
        checkedAt: new Date(),
        ttl: 86400,
      };
    }

    const parts = domain.split('.');
    const tld = parts[parts.length - 1];
    let riskPoints = 0;
    let reasons = [];

    // 1. TLD risk analysis
    if (SUSPICIOUS_TLDS.has(tld)) {
      riskPoints += 45;
      reasons.push(`high_risk_tld_${tld}`);
    }

    // 2. Keyword heuristic analysis
    const domainBase = parts[0];
    for (const kw of DISPOSABLE_KEYWORDS) {
      if (domainBase.includes(kw)) {
        riskPoints += 50;
        reasons.push(`disposable_keyword_${kw}`);
        break;
      }
    }

    // 3. Domain length & entropy heuristics (e.g. extremely long randomized subdomains)
    if (domainBase.length > 25) {
      riskPoints += 15;
      reasons.push('unusually_long_subdomain');
    }

    const domainReputation = Math.max(0, 100 - riskPoints);
    const isDomainRisky = riskPoints >= 40;
    const isDisposable = riskPoints >= 85;

    return {
      isDisposable,
      isTemporary: isDisposable,
      isFreeProvider: false,
      isRoleAccount: false,
      isAcceptAll: false,
      isDomainRisky,
      domainReputation,
      confidence: 65,
      provider: this.name,
      reason: reasons.length > 0 ? reasons.join(';') : 'normal_domain_heuristics',
      checkedAt: new Date(),
      ttl: 86400,
    };
  }
}

module.exports = DomainReputationProvider;
