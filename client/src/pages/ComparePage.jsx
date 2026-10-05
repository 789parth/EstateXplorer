import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import PropertyCompare from '../components/property/PropertyCompare';
import { getProperties } from '../services/propertyService';
import { ArrowLeftRight, Building2, Layers, Search, Sparkles } from 'lucide-react';

const ComparePage = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrimaryId, setSelectedPrimaryId] = useState('');
  const [activeCategory, setActiveCategory] = useState('property'); // 'property' | 'project'

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    getProperties()
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        setProperties(list);

        // Pre-select first property of activeCategory
        const initial = list.find((p) => (p.category || 'property') === activeCategory) || list[0];
        if (initial) {
          setSelectedPrimaryId(String(initial._id));
        }
      })
      .catch((err) => {
        console.error('Failed to load properties for compare page:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Update primary when category tab toggles
  const handleCategorySwitch = useCallback((cat) => {
    setActiveCategory(cat);
    const match = properties.find((p) => (p.category || 'property') === cat);
    if (match) {
      setSelectedPrimaryId(String(match._id));
    }
  }, [properties]);

  const primaryProperty = useMemo(
    () => properties.find((p) => String(p._id) === String(selectedPrimaryId)),
    [properties, selectedPrimaryId]
  );
  const filteredCandidates = useMemo(
    () => properties.filter((p) => (p.category || 'property') === activeCategory),
    [properties, activeCategory]
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pt-20">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Hero Header */}
        <div className="mb-8 text-center sm:text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2.5">
              <ArrowLeftRight size={14} />
              Side-by-Side Comparison Engine
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Compare Properties &amp; Projects
            </h1>
            <p className="text-sm text-slate-500 mt-1 font-normal max-w-2xl">
              Inspect real-time pricing deltas, BHK configurations, carpet area, RERA registration, amenities checklists, and monthly EMI estimates side by side.
            </p>
          </div>

          {/* Category Switcher Tabs */}
          <div className="inline-flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200 self-center sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => handleCategorySwitch('property')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeCategory === 'property'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 size={15} />
              Properties
            </button>
            <button
              type="button"
              onClick={() => handleCategorySwitch('project')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeCategory === 'project'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers size={15} />
              Builder Projects
            </button>
          </div>
        </div>

        {/* Primary Listing Selector */}
        {filteredCandidates.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 bg-slate-100/70 p-3.5 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Sparkles size={14} className="text-blue-600" />
              <span>Base {activeCategory === 'project' ? 'Project' : 'Property'}:</span>
            </div>
            <select
              value={selectedPrimaryId}
              onChange={(e) => setSelectedPrimaryId(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-xs focus:border-blue-500 focus:outline-none max-w-md w-full sm:w-auto truncate"
            >
              {filteredCandidates.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.title || p.name} — {p.location?.city || 'India'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Comparison Matrix Component */}
        {loading ? (
          <div className="bg-white rounded-3xl p-16 text-center border border-slate-200">
            <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-semibold text-slate-500">Loading comparison matrix...</p>
          </div>
        ) : primaryProperty ? (
          <PropertyCompare currentProperty={primaryProperty} />
        ) : (
          <div className="bg-white rounded-3xl p-16 text-center border border-slate-200">
            <Building2 size={36} className="mx-auto text-slate-300 mb-2" />
            <h3 className="text-sm font-bold text-slate-800">No listings found in this category</h3>
            <p className="text-xs text-slate-400 mt-1">Please select another category or check back later.</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default ComparePage;
