import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  UploadCloud,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Building,
  Briefcase,
  ExternalLink,
} from 'lucide-react';
import Button from '../common/Button';
import Input from '../common/Input';
import { submitKycDocumentsApi } from '../../services/authService';
import { uploadMultipleImages } from '../../services/propertyService';
import { getPublicImageUrl } from '../../utils/formatters';

const KycVerificationModal = ({
  isOpen,
  onClose,
  user,
  onVerificationSubmitted,
  showToast,
}) => {
  const role = user?.role || 'builder';
  const roleTitle = role.charAt(0).toUpperCase() + role.slice(1);

  const existingKyc = user?.kycVerification || {};
  const currentStatus = existingKyc.status || 'unverified';

  const [aadharNumber, setAadharNumber] = useState(existingKyc.aadharCard?.number || '');
  const [aadharUrl, setAadharUrl] = useState(existingKyc.aadharCard?.url || '');
  const [panNumber, setPanNumber] = useState(existingKyc.panCard?.number || '');
  const [panUrl, setPanUrl] = useState(existingKyc.panCard?.url || '');

  // Builder company doc
  const [companyDocNumber, setCompanyDocNumber] = useState(existingKyc.companyDoc?.number || '');
  const [companyDocUrl, setCompanyDocUrl] = useState(existingKyc.companyDoc?.url || '');

  // Agent agency doc
  const [agencyDocNumber, setAgencyDocNumber] = useState(existingKyc.agencyDoc?.number || '');
  const [agencyDocUrl, setAgencyDocUrl] = useState(existingKyc.agencyDoc?.url || '');

  const [uploadingField, setUploadingField] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFileUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setUploadingField(field);
    try {
      const res = await uploadMultipleImages([file]);
      const rawUrl = res.urls?.[0] || (Array.isArray(res.data) ? res.data[0]?.url : res.data?.url);
      if (rawUrl) {
        const resolvedUrl = getPublicImageUrl(rawUrl);
        if (field === 'aadhar') setAadharUrl(resolvedUrl);
        if (field === 'pan') setPanUrl(resolvedUrl);
        if (field === 'company') setCompanyDocUrl(resolvedUrl);
        if (field === 'agency') setAgencyDocUrl(resolvedUrl);
        if (showToast) showToast('Document uploaded successfully!', 'success');
      } else {
        throw new Error('Upload returned no URL');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to upload document file.';
      setError(msg);
      if (showToast) showToast(msg, 'error');
    } finally {
      setUploadingField(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!aadharUrl) {
      setError('Aadhar Card document upload is mandatory.');
      return;
    }
    if (!panUrl) {
      setError('PAN Card document upload is mandatory.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        aadharCard: {
          number: aadharNumber.trim(),
          url: aadharUrl.trim(),
          name: 'Aadhar Card',
        },
        panCard: {
          number: panNumber.trim().toUpperCase(),
          url: panUrl.trim(),
          name: 'PAN Card',
        },
        companyDoc: {
          number: companyDocNumber.trim(),
          url: companyDocUrl.trim(),
          name: 'Company Verification Document',
        },
        agencyDoc: {
          number: agencyDocNumber.trim(),
          url: agencyDocUrl.trim(),
          name: 'Agency Verification Document',
        },
      };

      const res = await submitKycDocumentsApi(payload);
      if (res.success) {
        if (showToast) {
          showToast('Verification documents submitted! Administrator will review shortly.', 'success');
        }
        if (onVerificationSubmitted) {
          onVerificationSubmitted(res.data?.kycVerification);
        }
        onClose();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to submit verification documents.';
      setError(msg);
      if (showToast) showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 text-left">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">
                Mandatory {roleTitle} Document Verification
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Admin verification is required before publishing properties or projects
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Existing Status Banner */}
        {currentStatus === 'pending' && (
          <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
            <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Verification Under Admin Review</span>
              Your submitted documents are currently being verified by the EstateXplorer administration team. You will be able to post properties as soon as verified.
            </div>
          </div>
        )}

        {currentStatus === 'rejected' && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
            <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Verification Rejected</span>
              {existingKyc.rejectionReason || 'Uploaded documents did not meet criteria.'} Please re-upload clear and authentic documents below.
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Aadhar Card (Mandatory) */}
          <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FileText size={14} className="text-blue-600" />
                1. Aadhar Card <span className="text-rose-600">*</span>
              </label>
              {aadharUrl && (
                <span className="inline-flex items-center gap-1 text-[0.7rem] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 size={11} /> Uploaded
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                placeholder="Aadhar Number (Optional)"
                value={aadharNumber}
                onChange={(e) => setAadharNumber(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:border-blue-600 bg-white"
              />

              <div className="relative">
                <input
                  type="file"
                  id="aadhar-upload"
                  accept="image/*,application/pdf"
                  onChange={(e) => handleFileUpload(e, 'aadhar')}
                  className="hidden"
                />
                <label
                  htmlFor="aadhar-upload"
                  className="flex items-center justify-center gap-2 w-full text-xs px-3 py-2 border border-dashed border-slate-300 rounded-lg bg-white hover:bg-slate-50 cursor-pointer font-medium text-slate-700 transition-colors"
                >
                  {uploadingField === 'aadhar' ? (
                    <>
                      <Loader2 size={13} className="animate-spin text-blue-600" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={14} className="text-slate-500" />
                      <span>{aadharUrl ? 'Replace File' : 'Upload Aadhar File'}</span>
                    </>
                  )}
                </label>
              </div>
            </div>

            {aadharUrl && (
              <div className="flex items-center gap-2 text-[0.72rem] text-blue-600 break-all pt-1">
                <ExternalLink size={12} className="shrink-0" />
                <a href={aadharUrl} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                  {aadharUrl}
                </a>
              </div>
            )}
          </div>

          {/* 2. PAN Card (Mandatory) */}
          <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FileText size={14} className="text-blue-600" />
                2. PAN Card <span className="text-rose-600">*</span>
              </label>
              {panUrl && (
                <span className="inline-flex items-center gap-1 text-[0.7rem] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 size={11} /> Uploaded
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                placeholder="PAN Number (Optional, e.g. ABCDE1234F)"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:border-blue-600 bg-white uppercase"
              />

              <div className="relative">
                <input
                  type="file"
                  id="pan-upload"
                  accept="image/*,application/pdf"
                  onChange={(e) => handleFileUpload(e, 'pan')}
                  className="hidden"
                />
                <label
                  htmlFor="pan-upload"
                  className="flex items-center justify-center gap-2 w-full text-xs px-3 py-2 border border-dashed border-slate-300 rounded-lg bg-white hover:bg-slate-50 cursor-pointer font-medium text-slate-700 transition-colors"
                >
                  {uploadingField === 'pan' ? (
                    <>
                      <Loader2 size={13} className="animate-spin text-blue-600" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={14} className="text-slate-500" />
                      <span>{panUrl ? 'Replace File' : 'Upload PAN File'}</span>
                    </>
                  )}
                </label>
              </div>
            </div>

            {panUrl && (
              <div className="flex items-center gap-2 text-[0.72rem] text-blue-600 break-all pt-1">
                <ExternalLink size={12} className="shrink-0" />
                <a href={panUrl} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                  {panUrl}
                </a>
              </div>
            )}
          </div>

          {/* 3. Role-specific: Company Verification (Builder) */}
          {role === 'builder' && (
            <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Building size={14} className="text-blue-600" />
                  3. Company Verification Document <span className="text-slate-400 font-normal">(if applicable)</span>
                </label>
                {companyDocUrl && (
                  <span className="inline-flex items-center gap-1 text-[0.7rem] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 size={11} /> Uploaded
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  placeholder="CIN / GST / RERA Number (Optional)"
                  value={companyDocNumber}
                  onChange={(e) => setCompanyDocNumber(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:border-blue-600 bg-white"
                />

                <div className="relative">
                  <input
                    type="file"
                    id="company-upload"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleFileUpload(e, 'company')}
                    className="hidden"
                  />
                  <label
                    htmlFor="company-upload"
                    className="flex items-center justify-center gap-2 w-full text-xs px-3 py-2 border border-dashed border-slate-300 rounded-lg bg-white hover:bg-slate-50 cursor-pointer font-medium text-slate-700 transition-colors"
                  >
                    {uploadingField === 'company' ? (
                      <>
                        <Loader2 size={13} className="animate-spin text-blue-600" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud size={14} className="text-slate-500" />
                        <span>{companyDocUrl ? 'Replace File' : 'Upload Company Doc'}</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {companyDocUrl && (
                <div className="flex items-center gap-2 text-[0.72rem] text-blue-600 break-all pt-1">
                  <ExternalLink size={12} className="shrink-0" />
                  <a href={companyDocUrl} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                    {companyDocUrl}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* 3. Role-specific: Agency Verification (Agent) */}
          {role === 'agent' && (
            <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Briefcase size={14} className="text-blue-600" />
                  3. Agency Verification Document <span className="text-slate-400 font-normal">(if applicable)</span>
                </label>
                {agencyDocUrl && (
                  <span className="inline-flex items-center gap-1 text-[0.7rem] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 size={11} /> Uploaded
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  placeholder="RERA Agent License / Registration ID (Optional)"
                  value={agencyDocNumber}
                  onChange={(e) => setAgencyDocNumber(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:border-blue-600 bg-white"
                />

                <div className="relative">
                  <input
                    type="file"
                    id="agency-upload"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleFileUpload(e, 'agency')}
                    className="hidden"
                  />
                  <label
                    htmlFor="agency-upload"
                    className="flex items-center justify-center gap-2 w-full text-xs px-3 py-2 border border-dashed border-slate-300 rounded-lg bg-white hover:bg-slate-50 cursor-pointer font-medium text-slate-700 transition-colors"
                  >
                    {uploadingField === 'agency' ? (
                      <>
                        <Loader2 size={13} className="animate-spin text-blue-600" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud size={14} className="text-slate-500" />
                        <span>{agencyDocUrl ? 'Replace File' : 'Upload Agency Doc'}</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {agencyDocUrl && (
                <div className="flex items-center gap-2 text-[0.72rem] text-blue-600 break-all pt-1">
                  <ExternalLink size={12} className="shrink-0" />
                  <a href={agencyDocUrl} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                    {agencyDocUrl}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="text-xs px-4 py-2"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={submitting}
              disabled={submitting || !aadharUrl || !panUrl}
              className="text-xs px-5 py-2 font-semibold bg-blue-600 hover:bg-blue-700 text-white"
            >
              Submit Documents for Admin Verification
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default KycVerificationModal;
