import React, { useState } from 'react';
import { X, Building2, Send, ShieldCheck, Award } from 'lucide-react';
import { requestPartnership } from '../../services/partnershipService';
import { broadcastRealtimeSync, SYNC_EVENTS } from '../../utils/realtimeSync';

const RequestSellingRightsModal = ({ isOpen, onClose, project, onSuccess, showToast }) => {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !project) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await requestPartnership(project._id, message.trim());
      if (res.success) {
        broadcastRealtimeSync(SYNC_EVENTS.PARTNERSHIPS, { action: 'requested', projectId: project._id });
        if (showToast) showToast('Selling rights application submitted to seller!', 'success');
        onSuccess(res.data);
        onClose();
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit application.';
      setError(msg);
      if (showToast) showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 text-left">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Request Authorized Selling Rights</h3>
              <p className="text-xs text-slate-500">Apply to represent this {project.category === 'project' ? 'development project' : 'property'} &amp; unlock tracking URL</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}

        {/* Project Card Preview */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-4 text-xs space-y-1.5">
          <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
            <Building2 size={14} className="text-blue-600" />
            <span>{project.title}</span>
          </div>
          <div className="text-slate-600">
            <strong>{project.category === 'project' ? 'Developer' : 'Seller / Owner'}:</strong> {project.builder?.companyName || project.builder?.name || project.user?.name || (project.category === 'project' ? 'Verified Developer' : 'Direct Owner')}
          </div>
          <div className="text-slate-600">
            <strong>Location:</strong> {typeof project.location === 'string' ? project.location : `${project.location?.address || ''}, ${project.location?.city || ''}`}
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-slate-200 text-emerald-800 font-bold">
            <Award size={14} />
            <span>Offered Commission: {project.defaultCommissionRate || 2.5}% of Agreement Value</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Proposal Message / Client Base Pitch (Optional)
            </label>
            <textarea
              rows="3"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g., We have an active portfolio of 25+ verified buyers actively searching for units in this micro-market."
              className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-[0.72rem] text-blue-900 space-y-1">
            <strong>Enterprise CP Protection Notice:</strong>
            <p>
              Upon approval, you will receive a unique tracking code (<code>CP-XXXXXX</code>) and dedicated affiliate link.
              All buyer traffic referred through your link is protected by a 30-day First-Touch Attribution window with guaranteed 2-way data privacy.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-all cursor-pointer"
            >
              <Send size={14} />
              <span>{submitting ? 'Submitting Application...' : 'Submit Selling Rights Application'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RequestSellingRightsModal;
