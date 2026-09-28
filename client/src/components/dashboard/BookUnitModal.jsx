import React, { useState, useEffect } from 'react';
import { X, Building2, CheckCircle2, AlertCircle, ShieldCheck, DollarSign, KeyRound } from 'lucide-react';
import { getProjectUnits, bookUnit } from '../../services/bookingService';
import { broadcastRealtimeSync, SYNC_EVENTS } from '../../utils/realtimeSync';
import { formatPrice } from '../../utils/formatters';

const BookUnitModal = ({ isOpen, onClose, lead, onSuccess, showToast }) => {
  const [units, setUnits] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [agreementValue, setAgreementValue] = useState('');
  const [tokenAmount, setTokenAmount] = useState('50000');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [paymentRef, setPaymentRef] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const projectId = lead?.property?._id || lead?.property;

  useEffect(() => {
    if (!isOpen || !projectId) {
      setUnits([]);
      setSelectedUnitId('');
      setAgreementValue('');
      setError('');
      return;
    }

    const fetchUnits = async () => {
      setLoadingUnits(true);
      setError('');
      try {
        const res = await getProjectUnits(projectId, { status: 'available' });
        if (res.success) {
          setUnits(res.data || []);
          if (res.data && res.data.length > 0) {
            setSelectedUnitId(res.data[0]._id);
            setAgreementValue(String(res.data[0].price || lead?.property?.price || 5000000));
          }
        }
      } catch (err) {
        setError('Failed to load project inventory units.');
      } finally {
        setLoadingUnits(false);
      }
    };

    fetchUnits();
  }, [isOpen, projectId]);

  if (!isOpen || !lead) return null;

  const selectedUnit = units.find((u) => u._id === selectedUnitId);

  const handleUnitChange = (unitId) => {
    setSelectedUnitId(unitId);
    const u = units.find((x) => x._id === unitId);
    if (u && u.price) {
      setAgreementValue(String(u.price));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUnitId) {
      setError('Please select an available unit from inventory.');
      return;
    }
    if (!agreementValue || Number(agreementValue) <= 0) {
      setError('Please enter a valid agreement value.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        unitId: selectedUnitId,
        leadId: lead._id,
        agreementValue: Number(agreementValue),
        tokenAmount: Number(tokenAmount || 0),
        paymentMethod,
        paymentRef: paymentRef.trim(),
        notes: notes.trim(),
      };

      const res = await bookUnit(payload);
      if (res.success) {
        broadcastRealtimeSync(SYNC_EVENTS.BOOKINGS, { action: 'created', unitId: selectedUnitId });
        broadcastRealtimeSync(SYNC_EVENTS.INQUIRIES, { action: 'unit_booked', leadId: lead._id });
        broadcastRealtimeSync(SYNC_EVENTS.PROPERTIES, { action: 'unit_booked' });
        if (showToast) showToast('Unit locked and booked successfully! Commission liability created.', 'success');
        onSuccess(res.data);
        onClose();
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Booking conflict: unit may have already been reserved.';
      setError(msg);
      if (showToast) showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 text-left max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
              <KeyRound size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Book Inventory Unit</h3>
              <p className="text-xs text-slate-500">Atomic concurrency-safe unit locking & commission settlement</p>
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
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Lead Summary */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-4 text-xs space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Buyer Name:</span>
            <span className="font-bold text-slate-900">{lead.name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Buyer Contact:</span>
            <span className="font-semibold text-slate-800">{lead.phone || lead.email}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Project:</span>
            <span className="font-semibold text-blue-700">{lead.property?.title || lead.propertyTitle}</span>
          </div>
          {lead.isAttributed && (
            <div className="flex justify-between items-center pt-1 border-t border-slate-200">
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <ShieldCheck size={13} /> Attributed Partner:
              </span>
              <span className="font-bold text-slate-900">
                {lead.agent?.agencyName || lead.agent?.name || lead.agentCode || 'Authorized CP'}
              </span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Unit Inventory Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Select Available Project Unit <span className="text-red-500">*</span>
            </label>
            {loadingUnits ? (
              <div className="p-2.5 text-xs text-slate-500 bg-slate-100 rounded-lg">Loading inventory units...</div>
            ) : units.length === 0 ? (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                No units currently available for this project. Please create units in Project Units Inventory.
              </div>
            ) : (
              <select
                value={selectedUnitId}
                onChange={(e) => handleUnitChange(e.target.value)}
                required
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                {units.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.tower} - Flat {u.unitNumber} (Floor {u.floor}) · {u.bhk} BHK · {u.carpetArea} sq.ft · {formatPrice(u.price)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedUnit && (
            <div className="grid grid-cols-3 gap-2 p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-lg text-[0.72rem] text-slate-700">
              <div>
                <span className="text-slate-500 block">Configuration:</span>
                <strong>{selectedUnit.bhk} BHK</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Carpet Area:</span>
                <strong>{selectedUnit.carpetArea} sq.ft</strong>
              </div>
              <div>
                <span className="text-slate-500 block">List Price:</span>
                <strong className="text-emerald-800">{formatPrice(selectedUnit.price)}</strong>
              </div>
            </div>
          )}

          {/* Pricing & Token */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Final Agreement Value (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="100000"
                step="10000"
                value={agreementValue}
                onChange={(e) => setAgreementValue(e.target.value)}
                placeholder="e.g. 7500000"
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Token Amount Paid (₹)
              </label>
              <input
                type="number"
                min="0"
                step="5000"
                value={tokenAmount}
                onChange={(e) => setTokenAmount(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Payment Method & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-800 cursor-pointer"
              >
                <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                <option value="Cheque">Bank Cheque</option>
                <option value="UPI">UPI / Online Gateway</option>
                <option value="Demand Draft">Demand Draft (DD)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Transaction / Cheque Ref
              </label>
              <input
                type="text"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="e.g. CHQ-928192 or UTR-98218"
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-800"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Booking Notes & Terms
            </label>
            <textarea
              rows="2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Token received via cheque, 15 days window for agreement registration."
              className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-800"
            />
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
              disabled={submitting || units.length === 0}
              className="px-5 py-2.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-all cursor-pointer"
            >
              <CheckCircle2 size={14} />
              <span>{submitting ? 'Locking & Booking...' : 'Confirm Concurrency-Safe Booking'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookUnitModal;
