/**
 * Base Email Risk Provider Abstract Interface
 */
class BaseEmailRiskProvider {
  constructor(name, priority = 10) {
    this.name = name;
    this.priority = priority;
    this.isEnabled = true;
  }

  /**
   * Evaluates an email and returns a standardized EmailRiskResult.
   *
   * @param {{ normalizedEmail: string, domain: string, localPart: string }} emailData
   * @returns {Promise<{
   *   isDisposable: boolean,
   *   isTemporary: boolean,
   *   isFreeProvider: boolean,
   *   isRoleAccount: boolean,
   *   isAcceptAll: boolean,
   *   isDomainRisky: boolean,
   *   domainReputation: number, // 0 (terrible) to 100 (excellent)
   *   confidence: number,       // 0 to 100
   *   provider: string,
   *   reason: string,
   *   checkedAt: Date,
   *   ttl: number
   * }>}
   */
  async evaluate(emailData) {
    throw new Error(`Provider ${this.name} must implement evaluate() method`);
  }
}

module.exports = BaseEmailRiskProvider;
