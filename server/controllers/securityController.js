const securityAuditService = require('../services/security/securityAuditService');
const securityListService = require('../services/security/securityListService');
const {
  evaluateRegistrationRisk,
  getSecurityConfig,
  updateSecurityConfig,
} = require('../services/security/registrationSecurityService');
const AppError = require('../utils/AppError');

// @desc    Get real-time security telemetry & metrics
// @route   GET /api/security/stats
// @access  Private (Admin only)
exports.getSecurityStats = async (req, res, next) => {
  try {
    const hours = parseInt(req.query.hours, 10) || 24;
    const metrics = await securityAuditService.getMetrics(hours);
    const config = getSecurityConfig();

    res.status(200).json({
      success: true,
      data: {
        ...metrics,
        activeMode: config.mode,
        policyVersion: 'registration-security-v2',
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get paginated security audit logs
// @route   GET /api/security/audit-logs
// @access  Private (Admin only)
exports.getAuditLogs = async (req, res, next) => {
  try {
    const { decision, reasonCode, emailDomain, correlationId, limit, skip } = req.query;
    const result = await securityAuditService.searchLogs({
      decision,
      reasonCode,
      emailDomain,
      correlationId,
      limit: parseInt(limit, 10) || 50,
      skip: parseInt(skip, 10) || 0,
    });

    res.status(200).json({
      success: true,
      data: result.logs,
      total: result.total,
      limit: result.limit,
      skip: result.skip,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get Allowlist / Blocklist / Watchlist entries
// @route   GET /api/security/lists
// @access  Private (Admin only)
exports.getSecurityLists = async (req, res, next) => {
  try {
    const { type } = req.query;
    const filter = type ? { type } : {};
    const entries = await securityListService.getAllEntries(filter);

    res.status(200).json({
      success: true,
      data: entries,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add entry to Allowlist / Blocklist / Watchlist
// @route   POST /api/security/lists
// @access  Private (Admin only)
exports.addSecurityListEntry = async (req, res, next) => {
  try {
    const { type, targetType, value, reason, expiresAt } = req.body;
    if (!type || !targetType || !value || !reason) {
      return next(new AppError('type, targetType, value, and reason are required', 400));
    }

    const entry = await securityListService.addEntry({
      type,
      targetType,
      value,
      reason,
      addedBy: req.user._id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    // Record audit event
    securityAuditService.logEvent({
      eventType: 'ADMIN_OVERRIDE',
      emailHash: 'admin_action',
      emailDomain: targetType === 'domain' ? value : 'admin_domain',
      ip: req.ip || '',
      decision: 'ALLOW',
      reasonCode: `LIST_ADDED_${type}`,
      metadata: { addedEntry: entry },
    });

    res.status(201).json({
      success: true,
      data: entry,
      message: `Successfully added ${value} to ${type}`,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Remove entry from Security List
// @route   DELETE /api/security/lists/:id
// @access  Private (Admin only)
exports.removeSecurityListEntry = async (req, res, next) => {
  try {
    const entry = await securityListService.removeEntry(req.params.id);
    if (!entry) {
      return next(new AppError('List entry not found', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Successfully removed entry from security list',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get runtime security configuration and mode
// @route   GET /api/security/policy
// @access  Private (Admin only)
exports.getSecurityPolicy = async (req, res, next) => {
  try {
    const config = getSecurityConfig();
    res.status(200).json({
      success: true,
      data: config,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update runtime security mode and thresholds
// @route   PATCH /api/security/policy
// @access  Private (Admin only)
exports.updateSecurityPolicy = async (req, res, next) => {
  try {
    const { mode, riskThresholds, botProtectionEnabled, dnsValidationEnabled, externalProvidersEnabled, failMode } = req.body;
    const updated = await updateSecurityConfig(
      { mode, riskThresholds, botProtectionEnabled, dnsValidationEnabled, externalProvidersEnabled, failMode },
      req.user._id
    );

    securityAuditService.logEvent({
      eventType: 'ADMIN_OVERRIDE',
      emailHash: 'admin_policy_change',
      emailDomain: 'policy_system',
      ip: req.ip || '',
      decision: 'ALLOW',
      reasonCode: 'POLICY_MODE_CHANGED',
      metadata: { newConfig: updated, changedBy: req.user.email },
    });

    res.status(200).json({
      success: true,
      data: updated,
      message: `Security policy updated. Active mode: ${updated.mode}`,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Interactive Real-Time Email Risk Analyzer
// @route   POST /api/security/check-email
// @access  Private (Admin only)
exports.checkEmailRisk = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return next(new AppError('Please provide an email to analyze', 400));
    }

    const evaluation = await evaluateRegistrationRisk({
      email,
      ip: req.ip || '',
      userAgent: req.headers?.['user-agent'] || '',
      correlationId: `inspector_${Date.now()}`,
    });

    res.status(200).json({
      success: true,
      data: evaluation,
    });
  } catch (err) {
    next(err);
  }
};
