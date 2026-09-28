const BaseEmailRiskProvider = require('./BaseEmailRiskProvider');

class ExternalSecondaryProvider extends BaseEmailRiskProvider {
  constructor() {
    super('external_secondary', 3);
  }

  async evaluate({ normalizedEmail, domain }) {
    const fallbackUrl = process.env.DISPOSABLE_EMAIL_SECONDARY_API_URL;
    if (!fallbackUrl) {
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
        reason: 'secondary_provider_not_configured',
        checkedAt: new Date(),
        ttl: 3600,
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    try {
      const apiKey = process.env.DISPOSABLE_EMAIL_SECONDARY_API_KEY;
      const requestUrl = new URL(fallbackUrl);
      requestUrl.searchParams.set('email', normalizedEmail);
      requestUrl.searchParams.set('domain', domain);

      const headers = { 'User-Agent': 'EstateXplorer-Security-Engine/2.0' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const res = await fetch(requestUrl.toString(), {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const isDisposable = Boolean(data.disposable || data.is_disposable || data.block);
      return {
        isDisposable,
        isTemporary: isDisposable,
        isFreeProvider: Boolean(data.free),
        isRoleAccount: Boolean(data.role),
        isAcceptAll: Boolean(data.accept_all),
        isDomainRisky: isDisposable,
        domainReputation: isDisposable ? 0 : 75,
        confidence: 85,
        provider: this.name,
        reason: isDisposable ? 'secondary_provider_disposable' : 'secondary_provider_valid',
        checkedAt: new Date(),
        ttl: 3600,
      };
    } catch (e) {
      clearTimeout(timeoutId);
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
        reason: `secondary_provider_error_${e.message}`,
        checkedAt: new Date(),
        ttl: 60,
      };
    }
  }
}

module.exports = ExternalSecondaryProvider;
