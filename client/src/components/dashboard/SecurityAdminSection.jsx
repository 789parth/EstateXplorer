import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Shield,
  AlertTriangle,
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Plus,
  Trash2,
  Lock,
  Activity,
  Globe,
  Sliders,
  Clock,
} from 'lucide-react';
import {
  getSecurityStatsApi,
  getAuditLogsApi,
  getSecurityListsApi,
  addSecurityListEntryApi,
  removeSecurityListEntryApi,
  getSecurityPolicyApi,
  updateSecurityPolicyApi,
  checkEmailRiskApi,
} from '../../services/securityService';
import { useAuth } from '../../hooks/useAuth';

const SecurityAdminSection = () => {
  const { showToast } = useAuth();

  // Metrics State
  const [stats, setStats] = useState({
    totalEvaluations: 0,
    allowedCount: 0,
    blockedCount: 0,
    disposableBlockedCount: 0,
    challengeCount: 0,
    topBlockedDomains: [],
    avgRiskScore: 0,
    avgLatencyMs: 0,
    activeMode: 'NORMAL',
  });
  const [loadingStats, setLoadingStats] = useState(false);

  // Policy Mode State
  const [policyMode, setPolicyMode] = useState('NORMAL');
  const [updatingPolicy, setUpdatingPolicy] = useState(false);

  // Live Inspector State
  const [inspectEmail, setInspectEmail] = useState('');
  const [inspecting, setInspecting] = useState(false);
  const [inspectResult, setInspectResult] = useState(null);

  // Audit Logs State
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState(''); // '' | 'BLOCK' | 'ALLOW' | 'STEP_UP_CHALLENGE'
  const [domainSearch, setDomainSearch] = useState('');

  // Lists State (Allowlist / Blocklist)
  const [lists, setLists] = useState([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [newEntry, setNewEntry] = useState({
    type: 'BLOCKLIST',
    targetType: 'domain',
    value: '',
    reason: '',
  });
  const [addingEntry, setAddingEntry] = useState(false);

  // Load stats
  const fetchStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const res = await getSecurityStatsApi(24);
      if (res.success && res.data) {
        setStats(res.data);
        if (res.data.activeMode) setPolicyMode(res.data.activeMode);
      }
    } catch (err) {
      console.error('Failed to load security stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Load audit logs
  const fetchLogs = useCallback(async () => {
    try {
      setLoadingLogs(true);
      const params = { limit: 50 };
      if (logFilter) params.decision = logFilter;
      if (domainSearch) params.emailDomain = domainSearch;
      const res = await getAuditLogsApi(params);
      if (res.success && Array.isArray(res.data)) {
        setLogs(res.data);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, [logFilter, domainSearch]);

  // Load security lists
  const fetchLists = useCallback(async () => {
    try {
      setLoadingLists(true);
      const res = await getSecurityListsApi();
      if (res.success && Array.isArray(res.data)) {
        setLists(res.data);
      }
    } catch (err) {
      console.error('Failed to load lists:', err);
    } finally {
      setLoadingLists(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchLogs();
    fetchLists();
  }, [fetchStats, fetchLogs, fetchLists]);

  // Update Security Policy Mode
  const handleModeChange = async (mode) => {
    try {
      setUpdatingPolicy(true);
      const res = await updateSecurityPolicyApi({ mode });
      if (res.success) {
        setPolicyMode(mode);
        showToast(`Security policy updated to ${mode} mode`, 'success');
        fetchStats();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update policy mode', 'error');
    } finally {
      setUpdatingPolicy(false);
    }
  };

  // Inspect Email Risk in Real-Time
  const handleInspectEmail = async (e) => {
    e.preventDefault();
    if (!inspectEmail.trim()) return;

    try {
      setInspecting(true);
      setInspectResult(null);
      const res = await checkEmailRiskApi(inspectEmail.trim());
      if (res.success && res.data) {
        setInspectResult(res.data);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Email analysis failed', 'error');
    } finally {
      setInspecting(false);
    }
  };

  // Add List Entry
  const handleAddListEntry = async (e) => {
    e.preventDefault();
    if (!newEntry.value.trim() || !newEntry.reason.trim()) {
      showToast('Please enter both domain/value and a reason', 'error');
      return;
    }

    try {
      setAddingEntry(true);
      const res = await addSecurityListEntryApi(newEntry);
      if (res.success) {
        showToast(res.message || 'Rule added successfully', 'success');
        setNewEntry({ type: 'BLOCKLIST', targetType: 'domain', value: '', reason: '' });
        fetchLists();
        fetchStats();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add rule', 'error');
    } finally {
      setAddingEntry(false);
    }
  };

  // Remove List Entry
  const handleRemoveListEntry = async (id) => {
    try {
      const res = await removeSecurityListEntryApi(id);
      if (res.success) {
        showToast('Rule removed successfully', 'info');
        setLists((prev) => prev.filter((r) => r._id !== id));
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete rule', 'error');
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* SECTION 1: HEADER & SYSTEM POLICY MODE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 mb-1">
              <ShieldAlert size={16} /> Enterprise Anti-Abuse Subsystem
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              Disposable Email Defense &amp; Threat Intelligence Console
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Multi-layer trust engine analyzing 121,500+ domains, DNS MX verification, sliding-window velocity, and bot detection.
            </p>
          </div>

          {/* Mode Selector Buttons */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl self-start md:self-auto">
            <span className="text-[0.72rem] font-bold text-slate-500 uppercase px-2">Mode:</span>
            {[
              { id: 'NORMAL', label: 'Normal', color: 'bg-emerald-600 text-white' },
              { id: 'STRICT', label: 'Strict', color: 'bg-amber-600 text-white' },
              { id: 'LOCKDOWN', label: 'Lockdown', color: 'bg-red-600 text-white' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={updatingPolicy}
                onClick={() => handleModeChange(m.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  policyMode === m.id
                    ? `${m.color} shadow-xs`
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* STATS TILES */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <div className="text-[0.68rem] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Total Checked
            </div>
            <div className="text-xl font-bold text-slate-900">{stats.totalEvaluations}</div>
            <div className="text-[0.68rem] text-slate-400 mt-0.5">Last 24 hours</div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
            <div className="text-[0.68rem] font-bold text-emerald-700 uppercase tracking-wider mb-1">
              Allowed
            </div>
            <div className="text-xl font-bold text-emerald-700">{stats.allowedCount}</div>
            <div className="text-[0.68rem] text-emerald-600 mt-0.5">Verified clean</div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-3.5">
            <div className="text-[0.68rem] font-bold text-red-700 uppercase tracking-wider mb-1">
              Blocked Total
            </div>
            <div className="text-xl font-bold text-red-700">{stats.blockedCount}</div>
            <div className="text-[0.68rem] text-red-600 mt-0.5">Risk &gt;= 80 or disposable</div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
            <div className="text-[0.68rem] font-bold text-amber-700 uppercase tracking-wider mb-1">
              Disposable Caught
            </div>
            <div className="text-xl font-bold text-amber-700">{stats.disposableBlockedCount}</div>
            <div className="text-[0.68rem] text-amber-600 mt-0.5">Burner &amp; temp mail</div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5">
            <div className="text-[0.68rem] font-bold text-blue-700 uppercase tracking-wider mb-1">
              Avg Risk Score
            </div>
            <div className="text-xl font-bold text-blue-700">{stats.avgRiskScore} / 100</div>
            <div className="text-[0.68rem] text-blue-600 mt-0.5">Fleet-wide score</div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3.5">
            <div className="text-[0.68rem] font-bold text-purple-700 uppercase tracking-wider mb-1">
              Avg Latency
            </div>
            <div className="text-xl font-bold text-purple-700">{stats.avgLatencyMs} ms</div>
            <div className="text-[0.68rem] text-purple-600 mt-0.5">Near-instant lookup</div>
          </div>
        </div>
      </div>

      {/* SECTION 2: INTERACTIVE REAL-TIME EMAIL RISK INSPECTOR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Search size={18} className="text-blue-600" />
            <span>Interactive Email Risk &amp; Threat Inspector</span>
          </div>
          <span className="text-xs text-slate-500">Simulate server-side policy evaluation in real-time</span>
        </div>

        <form onSubmit={handleInspectEmail} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={inspectEmail}
            onChange={(e) => setInspectEmail(e.target.value)}
            placeholder="Enter test email e.g. attacker@temp-mail.org or john.doe@gmail.com"
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:outline-none focus:border-blue-600"
          />
          <button
            type="submit"
            disabled={inspecting}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {inspecting ? <RefreshCw size={14} className="animate-spin" /> : <Activity size={14} />}
            Analyze Email
          </button>
        </form>

        {/* Inspector Result Card */}
        {inspectResult && (
          <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">{inspectResult.normalizedEmail}</span>
                <span className="text-slate-400">({inspectResult.domain})</span>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
                    inspectResult.decision === 'BLOCK'
                      ? 'bg-red-100 text-red-700'
                      : inspectResult.decision === 'STEP_UP_CHALLENGE'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {inspectResult.decision}
                </span>

                <span
                  className={`px-2 py-0.5 rounded text-[0.7rem] font-bold ${
                    inspectResult.riskTier === 'CRITICAL' || inspectResult.riskTier === 'HIGH'
                      ? 'bg-red-600 text-white'
                      : inspectResult.riskTier === 'ELEVATED'
                      ? 'bg-amber-500 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  Score: {inspectResult.riskScore} ({inspectResult.riskTier})
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div>
                <span className="text-slate-400 block text-[0.68rem] uppercase font-semibold">Disposable?</span>
                <span className={`font-bold ${inspectResult.isDisposable ? 'text-red-600' : 'text-emerald-600'}`}>
                  {inspectResult.isDisposable ? 'YES (Burner Mail)' : 'NO (Legitimate)'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[0.68rem] uppercase font-semibold">Role Account?</span>
                <span className="font-bold text-slate-800">
                  {inspectResult.isRoleAccount ? 'YES (e.g. admin/support)' : 'NO'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[0.68rem] uppercase font-semibold">Reason Code</span>
                <span className="font-bold text-slate-800 font-mono text-[0.7rem]">
                  {inspectResult.reasonCode}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[0.68rem] uppercase font-semibold">Analysis Latency</span>
                <span className="font-bold text-slate-800">{inspectResult.latencyMs} ms</span>
              </div>
            </div>

            {inspectResult.publicMessage && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[0.75rem] font-medium">
                <strong>Public Error Message:</strong> "{inspectResult.publicMessage}"
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 3: ALLOWLIST & BLOCKLIST MANAGEMENT */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Sliders size={18} className="text-amber-600" />
            <span>Dynamic Rules Management (Allowlist / Blocklist)</span>
          </div>
          <button
            type="button"
            onClick={fetchLists}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw size={12} className={loadingLists ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Add Entry Form */}
        <form onSubmit={handleAddListEntry} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 mb-5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          <div>
            <label className="block text-slate-500 font-bold mb-1">List Type</label>
            <select
              value={newEntry.type}
              onChange={(e) => setNewEntry({ ...newEntry, type: e.target.value })}
              className="w-full p-2 rounded-lg border border-slate-300 bg-white font-semibold"
            >
              <option value="BLOCKLIST">BLOCKLIST (Deny)</option>
              <option value="ALLOWLIST">ALLOWLIST (Pass)</option>
              <option value="WATCHLIST">WATCHLIST (Monitor)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-500 font-bold mb-1">Target Type</label>
            <select
              value={newEntry.targetType}
              onChange={(e) => setNewEntry({ ...newEntry, targetType: e.target.value })}
              className="w-full p-2 rounded-lg border border-slate-300 bg-white font-semibold"
            >
              <option value="domain">Domain Name (e.g. badsite.com)</option>
              <option value="ip">IP / Subnet (e.g. 192.0.2.1)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-500 font-bold mb-1">Target Value</label>
            <input
              type="text"
              placeholder="e.g. spam-domain.xyz"
              value={newEntry.value}
              onChange={(e) => setNewEntry({ ...newEntry, value: e.target.value })}
              className="w-full p-2 rounded-lg border border-slate-300 bg-white font-medium"
            />
          </div>

          <div>
            <label className="block text-slate-500 font-bold mb-1">Reason &amp; Submit</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Fraudulent registration spike"
                value={newEntry.reason}
                onChange={(e) => setNewEntry({ ...newEntry, reason: e.target.value })}
                className="flex-1 p-2 rounded-lg border border-slate-300 bg-white font-medium"
              />
              <button
                type="submit"
                disabled={addingEntry}
                className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Plus size={14} /> Add
              </button>
            </div>
          </div>
        </form>

        {/* Active Rules Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
              <tr>
                <th className="p-3">Type</th>
                <th className="p-3">Target</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Added</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lists.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400">
                    No custom dynamic rules configured. Built-in dataset (121,500+ domains) and enterprise allowlists are actively enforced.
                  </td>
                </tr>
              ) : (
                lists.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[0.7rem] ${
                          item.type === 'BLOCKLIST'
                            ? 'bg-red-100 text-red-700'
                            : item.type === 'ALLOWLIST'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {item.type}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-900">{item.value}</td>
                    <td className="p-3 text-slate-600">{item.reason}</td>
                    <td className="p-3 text-slate-400">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveListEntry(item._id)}
                        className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                        title="Delete rule"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 4: SECURITY AUDIT TELEMETRY & EVENT LOGS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Clock size={18} className="text-purple-600" />
            <span>Immutable Security Telemetry &amp; Audit Logs</span>
          </div>

          {/* Log Filters */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
              {['', 'BLOCK', 'ALLOW', 'STEP_UP_CHALLENGE'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setLogFilter(f)}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    logFilter === f
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {f === '' ? 'All Decisions' : f}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={fetchLogs}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 cursor-pointer"
              title="Refresh logs"
            >
              <RefreshCw size={14} className={loadingLogs ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Event</th>
                <th className="p-3">Domain</th>
                <th className="p-3">Decision</th>
                <th className="p-3">Risk Score</th>
                <th className="p-3">Reason Code</th>
                <th className="p-3">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    No security events recorded yet in the current timeframe.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-400 font-mono text-[0.7rem] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="p-3 font-semibold text-slate-700 text-[0.72rem]">
                      {log.eventType}
                    </td>
                    <td className="p-3 font-mono font-medium text-slate-900">{log.emailDomain}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[0.68rem] ${
                          log.decision === 'BLOCK'
                            ? 'bg-red-100 text-red-700'
                            : log.decision === 'STEP_UP_CHALLENGE'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {log.decision}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-slate-800">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[0.68rem] ${
                          log.riskScore >= 80
                            ? 'bg-red-100 text-red-800'
                            : log.riskScore >= 40
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {log.riskScore}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[0.68rem] text-slate-600">
                      {log.reasonCode}
                    </td>
                    <td className="p-3 text-slate-400 text-[0.7rem]">{log.latencyMs} ms</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SecurityAdminSection;
