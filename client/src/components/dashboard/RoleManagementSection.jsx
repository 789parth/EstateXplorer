import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useRealtimeSync, SYNC_EVENTS } from '../../utils/realtimeSync';
import {
  Shield,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Building2,
  Briefcase,
  UserCheck,
  ArrowRightLeft,
  ChevronRight,
  Check,
} from 'lucide-react';

const ROLE_METADATA = {
  buyer: {
    title: 'Buyer',
    desc: 'Browse, save properties, book visits, and send inquiries.',
    icon: UserCheck,
    color: '#2563eb',
  },
  builder: {
    title: 'Builder',
    desc: 'List developments, manage CP agents, and track leads.',
    icon: Building2,
    color: '#059669',
  },
  agent: {
    title: 'Agent',
    desc: 'CP selling rights, manage client leads, and earn commissions.',
    icon: Briefcase,
    color: '#7c3aed',
  },
  owner: {
    title: 'Owner',
    desc: 'List properties directly for sale/rent with zero brokerage.',
    icon: Building2,
    color: '#0d9488',
  },
  admin: {
    title: 'Admin',
    desc: 'System oversight, user management, and role approvals.',
    icon: ShieldCheck,
    color: '#d97706',
  },
};

const RoleManagementSection = () => {
  const { user, switchRole, requestRole, getMyRoleRequests, refreshUser } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [submittingRole, setSubmittingRole] = useState(null);
  const [switchingRole, setSwitchingRole] = useState(null);

  const loadRequests = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoadingRequests(true);
      }
      const [reqRes] = await Promise.all([
        getMyRoleRequests(),
        refreshUser ? refreshUser() : Promise.resolve(null),
      ]);
      if (reqRes.success && Array.isArray(reqRes.data)) {
        setRequests(reqRes.data);
      }
    } catch (err) {
      console.error('Failed to load role requests:', err);
    } finally {
      if (!isBackground) {
        setLoadingRequests(false);
      }
    }
  }, [getMyRoleRequests, refreshUser]);

  useRealtimeSync(
    [SYNC_EVENTS.ROLES, SYNC_EVENTS.AUTH],
    () => {
      loadRequests(true);
    },
    { revalidateOnFocus: true, intervalMs: 15000 }
  );

  useEffect(() => {
    loadRequests(false);
  }, [loadRequests]);

  const isActualAdmin = user?.role === 'admin' || (Array.isArray(user?.roles) && user.roles.includes('admin'));

  const rolesToDisplay = isActualAdmin
    ? ['buyer', 'owner', 'builder', 'agent', 'admin']
    : ['buyer', 'owner', 'builder', 'agent'];

  const pendingRoles = requests
    .filter((r) => r.status === 'PENDING')
    .map((r) => r.requestedRole);

  const rawRoles = user?.roles && Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : ['buyer'];
  const approvedRoles = rawRoles.filter((r) => (!pendingRoles.includes(r) || r === 'buyer') && (isActualAdmin || r !== 'admin'));
  const activeRole = approvedRoles.includes(user?.role) ? user?.role : 'buyer';

  const handleSwitch = async (targetRole) => {
    if (targetRole === activeRole) return;
    setSwitchingRole(targetRole);
    await switchRole(targetRole);
    setSwitchingRole(null);
  };

  const handleRequest = async (targetRole) => {
    setSubmittingRole(targetRole);
    const res = await requestRole(targetRole);
    if (res?.success) {
      await loadRequests(true);
    }
    setSubmittingRole(null);
  };

  return (
    <div className="section-card border border-slate-200 rounded-2xl bg-white p-4 sm:p-5 shadow-2xs text-left mb-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 mb-4">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900 !mb-0">Role Management &amp; Access</h3>
        </div>
        <span className="text-[0.68rem] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
          Active: {activeRole.charAt(0).toUpperCase() + activeRole.slice(1)}
        </span>
      </div>

      <div className="space-y-4">

        {/* Minimal Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {rolesToDisplay.map((roleKey) => {
            const meta = ROLE_METADATA[roleKey] || { title: roleKey, desc: '' };
            const Icon = meta.icon || Shield;

            const pendingReq = requests.find(
              (r) => r.requestedRole === roleKey && r.status === 'PENDING'
            );
            const rejectedReq = requests.find(
              (r) => r.requestedRole === roleKey && r.status === 'REJECTED'
            );

            const isApproved = approvedRoles.includes(roleKey) && !pendingReq;
            const isActive = roleKey === activeRole && isApproved;

            return (
              <div
                key={roleKey}
                className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                  isActive
                    ? 'bg-blue-50/50 border-blue-300 shadow-2xs'
                    : isApproved
                    ? 'bg-emerald-50/20 border-emerald-200'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border"
                        style={{
                          backgroundColor: `${meta.color}15`,
                          borderColor: `${meta.color}30`,
                          color: meta.color,
                        }}
                      >
                        <Icon size={14} />
                      </div>
                      <span className="text-xs font-bold text-slate-900 truncate">{meta.title}</span>
                    </div>

                    {/* Compact Badge */}
                    {pendingReq ? (
                      <span className="px-1.5 py-0.5 rounded text-[0.65rem] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1 shrink-0">
                        <Clock size={10} /> Pending
                      </span>
                    ) : isActive ? (
                      <span className="px-1.5 py-0.5 rounded text-[0.65rem] font-bold bg-blue-600 text-white shrink-0">
                        Active
                      </span>
                    ) : isApproved ? (
                      <span className="px-1.5 py-0.5 rounded text-[0.65rem] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 shrink-0">
                        <CheckCircle2 size={10} /> Approved
                      </span>
                    ) : rejectedReq ? (
                      <span className="px-1.5 py-0.5 rounded text-[0.65rem] font-bold bg-red-100 text-red-800 border border-red-200 flex items-center gap-1 shrink-0">
                        <XCircle size={10} /> Declined
                      </span>
                    ) : (
                      <span className="text-[0.62rem] text-slate-400 font-medium shrink-0">
                        {roleKey === 'buyer' ? 'Standard' : 'Approval req.'}
                      </span>
                    )}
                  </div>

                  <p className="text-[0.72rem] text-slate-500 leading-snug mb-2 line-clamp-1">
                    {meta.desc}
                  </p>
                </div>

                {/* Compact Action Footer */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                  {pendingReq ? (
                    <span className="text-[0.68rem] text-amber-700 font-medium italic flex items-center gap-1">
                      <Clock size={11} /> Reviewing
                    </span>
                  ) : isActive ? (
                    <span className="text-[0.68rem] text-blue-600 font-semibold">Current Interface</span>
                  ) : isApproved ? (
                    <button
                      type="button"
                      onClick={() => handleSwitch(roleKey)}
                      disabled={switchingRole === roleKey}
                      className="px-2.5 py-1 rounded-md text-[0.72rem] font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <ArrowRightLeft size={11} />
                      {switchingRole === roleKey ? '...' : 'Switch'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRequest(roleKey)}
                      disabled={submittingRole === roleKey}
                      className="px-2.5 py-1 rounded-md text-[0.72rem] font-semibold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {submittingRole === roleKey ? 'Submitting...' : 'Request Access'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RoleManagementSection;
