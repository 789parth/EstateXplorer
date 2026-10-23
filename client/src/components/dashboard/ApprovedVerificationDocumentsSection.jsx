import React, { useState } from 'react';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Building2,
  Briefcase,
  Home,
  UserCheck,
  UploadCloud,
} from 'lucide-react';
import KycVerificationModal from './KycVerificationModal';

const ROLE_CONFIGS = [
  { key: 'builder', label: 'Builder', icon: Building2, desc: 'Project & property listings verification documents' },
  { key: 'agent', label: 'Agent', icon: Briefcase, desc: 'Selling rights & network inventory verification documents' },
  { key: 'owner', label: 'Owner', icon: Home, desc: 'Direct owner property listings verification documents' },
];

/**
 * ApprovedVerificationDocumentsSection
 * Displays verified/approved documents (PAN, Aadhar, Company/Agency doc)
 * required for list property/project access across all user profile pages.
 */
const ApprovedVerificationDocumentsSection = ({
  user,
  showToast,
  onKycUpdated,
  defaultRole = null,
}) => {
  const [activeKycModalRole, setActiveKycModalRole] = useState(null);

  const activeRole = defaultRole || user?.role || 'builder';
  const rolesArray = Array.isArray(user?.roles) && user.roles.length > 0
    ? user.roles
    : [activeRole];

  // Relevant roles for property listing: builder, agent, owner
  const availableListingRoles = ROLE_CONFIGS.filter(
    (cfg) => rolesArray.includes(cfg.key) || cfg.key === activeRole || cfg.key === defaultRole
  );

  const getRoleKycData = (roleKey) => {
    const roleKyc = user?.roleKycVerification?.[roleKey];
    if (roleKyc && roleKyc.status && roleKyc.status !== 'unverified') {
      return roleKyc;
    }
    // Fallback to legacy kycVerification
    if (
      user?.kycVerification?.status &&
      user?.kycVerification?.status !== 'unverified' &&
      (user.kycVerification?.roleAtSubmission === roleKey || (!user.kycVerification?.roleAtSubmission && user.role === roleKey))
    ) {
      return user.kycVerification;
    }
    return roleKyc || { status: 'unverified' };
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={13} className="text-emerald-600" /> Approved by Admin
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={13} className="text-amber-600" /> Pending Admin Review
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle size={13} className="text-rose-600" /> Rejected by Admin
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
            Not Submitted
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs mb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              Listing Access Documents (PAN, Aadhar &amp; Regulatory Verification)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Official identity and compliance documents reviewed and approved by platform administrators for listing projects and properties.
            </p>
          </div>
        </div>
      </div>

      {/* Role-Specific Document Sections */}
      <div className="space-y-6 mt-5">
        {availableListingRoles.map((roleCfg) => {
          const kyc = getRoleKycData(roleCfg.key);
          const isVerified = kyc.status === 'verified';
          const isPending = kyc.status === 'pending';
          const isRejected = kyc.status === 'rejected';

          const hasAadhar = Boolean(kyc.aadharCard?.url || kyc.aadharCard?.number);
          const hasPan = Boolean(kyc.panCard?.url || kyc.panCard?.number);
          const hasCompanyDoc = roleCfg.key === 'builder' && Boolean(kyc.companyDoc?.url || kyc.companyDoc?.number);
          const hasAgencyDoc = roleCfg.key === 'agent' && Boolean(kyc.agencyDoc?.url || kyc.agencyDoc?.number);

          return (
            <div
              key={roleCfg.key}
              className="border border-slate-200 rounded-xl p-4 sm:p-5 bg-slate-50/50 hover:bg-slate-50/80 transition-colors"
            >
              {/* Role Header Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shadow-2xs">
                    <roleCfg.icon size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{roleCfg.label} Listing Access</span>
                      {getStatusBadge(kyc.status)}
                    </div>
                    <span className="text-[11px] text-slate-500">{roleCfg.desc}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {(!isVerified || isRejected) ? (
                    <button
                      type="button"
                      onClick={() => setActiveKycModalRole(roleCfg.key)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shadow-2xs"
                    >
                      <UploadCloud size={14} />
                      {isRejected ? 'Re-upload Documents' : isPending ? 'Update Documents' : 'Upload Documents'}
                    </button>
                  ) : ((roleCfg.key === 'builder' && !hasCompanyDoc) || (roleCfg.key === 'agent' && !hasAgencyDoc)) ? (
                    <button
                      type="button"
                      onClick={() => setActiveKycModalRole(roleCfg.key)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors cursor-pointer shadow-2xs"
                    >
                      <UploadCloud size={14} />
                      Upload Optional Document
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Rejection Notice */}
              {isRejected && kyc.rejectionReason && (
                <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Admin Rejection Feedback:</span> {kyc.rejectionReason}
                  </div>
                </div>
              )}

              {/* Verified Approval Notice */}
              {isVerified && (
                <div className="mt-3 p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>
                    Your {roleCfg.label} documents have been approved by Admin. You have active authorization to create and manage {roleCfg.key === 'builder' ? 'projects and properties' : 'properties'}.
                  </span>
                </div>
              )}

              {/* Documents Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-3.5">
                {/* 1. PAN Card */}
                <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        1. PAN Card
                      </span>
                      {kyc.panCard?.status === 'verified' || (isVerified && hasPan) ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Approved
                        </span>
                      ) : hasPan ? (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          Attached
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400">Not Uploaded</span>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-slate-900 mb-1">
                      {kyc.panCard?.number ? (
                        <span className="font-mono tracking-wider">{kyc.panCard.number}</span>
                      ) : (
                        <span className="text-slate-400 font-normal italic">No PAN number entered</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between mt-2">
                    <span className="text-[11px] text-slate-500">Document File</span>
                    {kyc.panCard?.url ? (
                      <a
                        href={kyc.panCard.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        <ExternalLink size={12} /> View File
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">—</span>
                    )}
                  </div>
                </div>

                {/* 2. Aadhar Card */}
                <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        2. Aadhar Card
                      </span>
                      {kyc.aadharCard?.status === 'verified' || (isVerified && hasAadhar) ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Approved
                        </span>
                      ) : hasAadhar ? (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          Attached
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400">Not Uploaded</span>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-slate-900 mb-1">
                      {kyc.aadharCard?.number ? (
                        <span className="font-mono tracking-wider">{kyc.aadharCard.number}</span>
                      ) : (
                        <span className="text-slate-400 font-normal italic">No Aadhar number entered</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between mt-2">
                    <span className="text-[11px] text-slate-500">Document File</span>
                    {kyc.aadharCard?.url ? (
                      <a
                        href={kyc.aadharCard.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        <ExternalLink size={12} /> View File
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">—</span>
                    )}
                  </div>
                </div>

                {/* 3. Company Document (Builder) */}
                {roleCfg.key === 'builder' && (
                  <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          3. Company Certificate
                        </span>
                        {kyc.companyDoc?.status === 'verified' || (isVerified && hasCompanyDoc) ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Approved
                          </span>
                        ) : hasCompanyDoc ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            Attached
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400">Optional / Pending</span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-slate-900 mb-1">
                        {kyc.companyDoc?.number ? (
                          <span className="font-mono tracking-wider">{kyc.companyDoc.number}</span>
                        ) : (
                          <span className="text-slate-400 font-normal italic">CIN / Registration No</span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between mt-2">
                      <span className="text-[11px] text-slate-500">Document File</span>
                      {kyc.companyDoc?.url ? (
                        <a
                          href={kyc.companyDoc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <ExternalLink size={12} /> View File
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">—</span>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Agency Document (Agent) */}
                {roleCfg.key === 'agent' && (
                  <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          3. Agency / RERA Certificate
                        </span>
                        {kyc.agencyDoc?.status === 'verified' || (isVerified && hasAgencyDoc) ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Approved
                          </span>
                        ) : hasAgencyDoc ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            Attached
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400">Optional / Pending</span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-slate-900 mb-1">
                        {kyc.agencyDoc?.number ? (
                          <span className="font-mono tracking-wider">{kyc.agencyDoc.number}</span>
                        ) : (
                          <span className="text-slate-400 font-normal italic">RERA Agency Reg No</span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between mt-2">
                      <span className="text-[11px] text-slate-500">Document File</span>
                      {kyc.agencyDoc?.url ? (
                        <a
                          href={kyc.agencyDoc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <ExternalLink size={12} /> View File
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">—</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* KYC Upload Modal */}
      {activeKycModalRole && (
        <KycVerificationModal
          isOpen={Boolean(activeKycModalRole)}
          onClose={() => setActiveKycModalRole(null)}
          user={user}
          targetRole={activeKycModalRole}
          showToast={showToast}
          onVerificationSubmitted={(kycData, submittedRole) => {
            if (user) {
              if (!user.roleKycVerification) user.roleKycVerification = {};
              user.roleKycVerification[submittedRole] = kycData;
              user.kycVerification = kycData;
            }
            if (onKycUpdated) onKycUpdated(kycData, submittedRole);
          }}
        />
      )}
    </div>
  );
};

export default ApprovedVerificationDocumentsSection;
