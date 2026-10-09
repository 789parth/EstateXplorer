import React, { useState } from 'react';
import { X, Building2, Plus, CheckCircle2, Layers } from 'lucide-react';
import { createProjectUnits } from '../../services/bookingService';
import { broadcastRealtimeSync, SYNC_EVENTS } from '../../utils/realtimeSync';
import { formatPrice } from '../../utils/formatters';

const AddProjectUnitsModal = ({ isOpen, onClose, project, onSuccess, showToast }) => {
  const [tower, setTower] = useState('Tower A');
  const [startFloor, setStartFloor] = useState(1);
  const [endFloor, setEndFloor] = useState(5);
  const [unitsPerFloor, setUnitsPerFloor] = useState(4);
  const [bhk, setBhk] = useState(2);
  const [carpetArea, setCarpetArea] = useState(850);
  const [price, setPrice] = useState(project?.price || 5000000);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !project) return null;

  // Compute preview count
  const totalFloors = Math.max(1, Number(endFloor) - Number(startFloor) + 1);
  const totalUnits = totalFloors * Number(unitsPerFloor);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (totalUnits <= 0) {
      setError('Please configure at least 1 floor and 1 unit per floor.');
      return;
    }

    setSubmitting(true);
    setError('');

    // Generate batch units
    const generatedUnits = [];
    const sFloor = Number(startFloor);
    const eFloor = Number(endFloor);
    const uCount = Number(unitsPerFloor);

    for (let f = sFloor; f <= eFloor; f++) {
      for (let u = 1; u <= uCount; u++) {
        const unitNumber = `${f}${String(u).padStart(2, '0')}`; // e.g. 101, 102, 103, 104...
        generatedUnits.push({
          unitNumber,
          tower: tower.trim(),
          floor: f,
          bhk: Number(bhk),
          carpetArea: Number(carpetArea),
          price: Number(price),
        });
      }
    }

    try {
      const res = await createProjectUnits(project._id, generatedUnits);
      if (res.success) {
        broadcastRealtimeSync(SYNC_EVENTS.PROPERTIES, { action: 'units_added', projectId: project._id });
        if (showToast) showToast(`Successfully added ${res.count} units to ${tower}!`, 'success');
        onSuccess(res.data);
        onClose();
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to create units.';
      setError(msg);
      if (showToast) showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 text-left max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-4 border-b border-slate-100 shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Layers size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Generate Project Units</h3>
              <p className="text-xs text-slate-500">Batch generate residential inventory units for {project.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 modal-scroll space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              {error}
            </div>
          )}

          <form id="add-units-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tower / Wing Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={tower}
              onChange={(e) => setTower(e.target.value)}
              placeholder="e.g. Tower A, Wing 1, Aspen Heights"
              className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-800"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Start Floor
              </label>
              <input
                type="number"
                min="1"
                required
                value={startFloor}
                onChange={(e) => setStartFloor(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                End Floor
              </label>
              <input
                type="number"
                min={startFloor}
                required
                value={endFloor}
                onChange={(e) => setEndFloor(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Units Per Floor
              </label>
              <input
                type="number"
                min="1"
                max="20"
                required
                value={unitsPerFloor}
                onChange={(e) => setUnitsPerFloor(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Configuration (BHK)
              </label>
              <select
                value={bhk}
                onChange={(e) => setBhk(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-800 cursor-pointer"
              >
                <option value="1">1 BHK</option>
                <option value="2">2 BHK</option>
                <option value="3">3 BHK</option>
                <option value="4">4 BHK</option>
                <option value="5">5+ BHK</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Carpet Area (sq.ft)
              </label>
              <input
                type="number"
                min="100"
                required
                value={carpetArea}
                onChange={(e) => setCarpetArea(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Price per Unit (₹)
              </label>
              <input
                type="number"
                min="100000"
                step="10000"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-800"
              />
            </div>
          </div>

          {/* Generator Preview Summary */}
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-1">
            <div className="font-bold text-blue-900 flex items-center justify-between">
              <span>Batch Generation Preview</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white font-bold">
                {totalUnits} Units Total
              </span>
            </div>
            <p className="text-blue-800 text-[0.72rem]">
              Will create {totalUnits} inventory units in <strong>{tower}</strong> across {totalFloors} floors (Floor {startFloor} to {endFloor}) with flat numbers {startFloor}01 to {endFloor}{String(unitsPerFloor).padStart(2, '0')}.
              Unit price: <strong>{formatPrice(price)}</strong> each.
            </p>
          </div>
        </form>
      </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 px-5 sm:px-6 py-3.5 border-t border-slate-100 bg-white shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-units-form"
            disabled={submitting || totalUnits <= 0}
            className="px-5 py-2.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>{submitting ? 'Generating Units...' : `Batch Create ${totalUnits} Units`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddProjectUnitsModal;
