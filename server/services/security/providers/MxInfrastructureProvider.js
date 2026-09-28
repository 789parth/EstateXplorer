const dns = require('dns').promises;
const BaseEmailRiskProvider = require('./BaseEmailRiskProvider');

// Signatures of known disposable mail exchanger domains, hostnames, and relay nodes
const KNOWN_DISPOSABLE_MX_SIGNATURES = [
  'mailinator.com',
  'mailinator2.com',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'guerrillamail.com',
  'guerrillamailblock.com',
  'sharklasers.com',
  'grr.la',
  '10minutemail.com',
  '10minmail.com',
  'trashmail.com',
  'trashmail.net',
  'dispostable.com',
  'emailondeck.com',
  'mohmal.com',
  'throwawaymail.com',
  'maildrop.cc',
  'getnada.com',
  'nada.ltd',
  'temp-mail.org',
  'temp-mail.io',
  'tempmail.ninja',
  'tmpmail.org',
  'burnermail.io',
  'dropmail.me',
  'inboxkitten.com',
  'fakemailgenerator.com',
  'generator.email',
  'armyspy.com',
  'cuvox.de',
  'dayrep.com',
  'einrot.com',
  'fleckens.hu',
  'gustr.com',
  'jourrapide.com',
  'rhyta.com',
  'superrito.com',
  'teleworm.us',
  'olipii.com',
];

// Patterns matched against reverse-DNS PTR hostnames and MX exchanges
const DISPOSABLE_PTR_PATTERNS = [
  /temp-mail/i,
  /tempmail/i,
  /dispostable/i,
  /disposable/i,
  /throwaway/i,
  /burnermail/i,
  /burner/i,
  /mailinator/i,
  /guerrillamail/i,
  /sharklasers/i,
  /trashmail/i,
  /dropmail/i,
  /fake.*mail/i,
  /10minute/i,
  /mohmal/i,
  /yopmail/i,
];

class MxInfrastructureProvider extends BaseEmailRiskProvider {
  constructor() {
    super('mx_infrastructure', 5);
  }

  /**
   * Analyzes MX exchange hostnames and reverse-DNS (PTR) records of exchanger IPs
   * to detect disposable mail routing infrastructure dynamically.
   *
   * @param {{
   *   domain: string,
   *   mxRecords?: Array<{ exchange: string, priority: number }>
   * }} context
   */
  async evaluate({ domain, mxRecords = [] }) {
    if (!domain) {
      return {
        isDisposable: false,
        isTemporary: false,
        isFreeProvider: false,
        isRoleAccount: false,
        isAcceptAll: false,
        isDomainRisky: false,
        domainReputation: 50,
        confidence: 0,
        provider: this.name,
        reason: 'no_domain_provided',
        checkedAt: new Date(),
        ttl: 3600,
      };
    }

    const hostnames = mxRecords.map((r) => (r.exchange || '').toLowerCase().trim()).filter(Boolean);
    let isDisposable = false;
    let matchedExchanger = '';

    // 1. Direct MX exchange string and keyword pattern inspection
    for (const host of hostnames) {
      for (const sig of KNOWN_DISPOSABLE_MX_SIGNATURES) {
        if (host === sig || host.endsWith(`.${sig}`) || host.includes(sig)) {
          isDisposable = true;
          matchedExchanger = host;
          break;
        }
      }
      if (isDisposable) break;

      for (const pattern of DISPOSABLE_PTR_PATTERNS) {
        if (pattern.test(host)) {
          isDisposable = true;
          matchedExchanger = host;
          break;
        }
      }
      if (isDisposable) break;
    }

    // 2. Reverse DNS (PTR) inspection of MX IP addresses
    // This dynamically intercepts custom disposable domains (e.g. mail.olipii.com pointing to forward3.mail.temp-mail.io)
    // without needing their front-end domain to be in any static blacklist.
    if (!isDisposable && hostnames.length > 0) {
      const withTimeout = (promise, ms = 800) =>
        Promise.race([
          promise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('dns_timeout')), ms)),
        ]);

      for (const host of hostnames.slice(0, 3)) {
        try {
          const ips = await withTimeout(dns.resolve4(host), 800);
          for (const ip of (ips || []).slice(0, 2)) {
            try {
              const ptrs = await withTimeout(dns.reverse(ip), 800);
              for (const ptr of (ptrs || [])) {
                const ptrLower = (ptr || '').toLowerCase().trim();
                for (const sig of KNOWN_DISPOSABLE_MX_SIGNATURES) {
                  if (ptrLower === sig || ptrLower.endsWith(`.${sig}`) || ptrLower.includes(sig)) {
                    isDisposable = true;
                    matchedExchanger = `ptr_${ptrLower}`;
                    break;
                  }
                }
                if (isDisposable) break;

                for (const pattern of DISPOSABLE_PTR_PATTERNS) {
                  if (pattern.test(ptrLower)) {
                    isDisposable = true;
                    matchedExchanger = `ptr_${ptrLower}`;
                    break;
                  }
                }
                if (isDisposable) break;
              }
            } catch {
              // Ignore reverse DNS lookup failures / timeouts
            }
            if (isDisposable) break;
          }
        } catch {
          // Ignore IP resolve failures / timeouts
        }
        if (isDisposable) break;
      }
    }

    return {
      isDisposable,
      isTemporary: isDisposable,
      isFreeProvider: false,
      isRoleAccount: false,
      isAcceptAll: false,
      isDomainRisky: isDisposable,
      domainReputation: isDisposable ? 0 : 75,
      confidence: isDisposable ? 95 : 50,
      provider: this.name,
      reason: isDisposable ? `disposable_mx_infrastructure_${matchedExchanger}` : 'clean_mx_infrastructure',
      mxHostnames: hostnames,
      checkedAt: new Date(),
      ttl: 86400,
    };
  }
}

module.exports = MxInfrastructureProvider;
