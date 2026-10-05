const BaseEmailRiskProvider = require('./BaseEmailRiskProvider');
const disposableDomainsArray = require('disposable-email-domains');

// Convert 121,500+ maintained disposable domains array into an ultra-fast O(1) Set
const disposableDomainsSet = new Set(
  disposableDomainsArray.map((d) => d.toLowerCase().trim())
);

// Supplementary curated list of known disposable / temporary email domains
const supplementaryDisposableDomains = [
  'kolsea.com',
  '10minutemail.com',
  '10minutemail.net',
  '10minmail.com',
  'guerrillamail.com',
  'guerrillamailblock.com',
  'sharklasers.com',
  'grr.la',
  'guerrillamail.net',
  'guerrillamail.org',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'cool.fr.nf',
  'jetable.fr.nf',
  'nospam.ze.tc',
  'nomail.xl.cx',
  'mega.zik.dj',
  'speed.1s.fr',
  'courriel.fr.nf',
  'moncourrier.fr.nf',
  'monemail.fr.nf',
  'monmail.fr.nf',
  'mailinator.com',
  'mailinator2.com',
  'mailinator.net',
  'mailf5.com',
  'trashmail.com',
  'trashmail.net',
  'trashmail.me',
  'dispostable.com',
  'emailondeck.com',
  'emailondeck.net',
  'mohmal.com',
  'mohmal.in',
  'throwawaymail.com',
  'maildrop.cc',
  'getnada.com',
  'nada.ltd',
  'inboxkitten.com',
  'generator.email',
  'fakemailgenerator.com',
  'temp-mail.org',
  'temp-mail.io',
  'tempmailo.com',
  'tempmail.ninja',
  'tmpmail.org',
  'mytemp.email',
  'burnermail.io',
  'crazymailing.com',
  'dropmail.me',
  'mintemail.com',
  'spambox.us',
  'fakeinbox.com',
  'armyspy.com',
  'cuvox.de',
  'dayrep.com',
  'fleckens.hu',
  'gustr.com',
  'jourrapide.com',
  'rhyta.com',
  'superrito.com',
  'teleworm.us',
  'einrot.com',
  'olipii.com',
  'findize.com',
];

for (const domain of supplementaryDisposableDomains) {
  disposableDomainsSet.add(domain.toLowerCase().trim());
}

class LocalDatasetProvider extends BaseEmailRiskProvider {
  constructor() {
    super('local_dataset', 1);
  }

  /**
   * Checks if domain is in the maintained dataset of 121,500+ disposable domains.
   */
  async evaluate({ domain }) {
    const isDisposable = disposableDomainsSet.has(domain);

    return {
      isDisposable,
      isTemporary: isDisposable,
      isFreeProvider: false,
      isRoleAccount: false,
      isAcceptAll: false,
      isDomainRisky: isDisposable,
      domainReputation: isDisposable ? 0 : 70,
      confidence: isDisposable ? 100 : 80,
      provider: this.name,
      reason: isDisposable ? 'known_disposable_domain' : 'not_in_disposable_dataset',
      checkedAt: new Date(),
      ttl: 86400,
    };
  }

  /**
   * Allows adding dynamic domains to memory set.
   */
  addDomain(domain) {
    if (domain) disposableDomainsSet.add(domain.toLowerCase().trim());
  }

  /**
   * Allows removing dynamic domains from memory set.
   */
  removeDomain(domain) {
    if (domain) disposableDomainsSet.delete(domain.toLowerCase().trim());
  }

  /**
   * Returns total count of indexed disposable domains.
   */
  getSize() {
    return disposableDomainsSet.size;
  }
}

module.exports = LocalDatasetProvider;
