import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  Plus,
  X,
  Search,
  Check,
  Building2,
  MapPin,
  Bed,
  Maximize2,
  Calendar,
  ShieldCheck,
  Tag,
  Calculator,
  ExternalLink,
  Sparkles,
  Eye,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react';
import { getProperties } from '../../services/propertyService';
import { formatPrice, getPublicImageUrl } from '../../utils/formatters';
import './PropertyCompare.css';

const PropertyCompare = ({ currentProperty }) => {
  const navigate = useNavigate();
  const [allCandidates, setAllCandidates] = useState([]);
  const [comparedList, setComparedList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [targetSlot, setTargetSlot] = useState(null); // index (0 or 1) in comparedList to replace/fill
  const [pickerSearch, setPickerSearch] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const tableWrapRef = React.useRef(null);

  // Check scroll position to display horizontal scroll button if overflowing
  const checkScroll = React.useCallback(() => {
    if (tableWrapRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tableWrapRef.current;
      setCanScrollLeft(scrollLeft > 15);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 15);
    }
  }, []);

  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, comparedList]);

  const handleScrollMore = () => {
    if (tableWrapRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tableWrapRef.current;
      if (scrollLeft + clientWidth < scrollWidth - 15) {
        tableWrapRef.current.scrollBy({ left: 320, behavior: 'smooth' });
      } else {
        tableWrapRef.current.scrollTo({ left: 0, behavior: 'smooth' });
      }
    }
  };

  const handleToggleExpand = () => {
    if (isExpanded) {
      // Smoothly scroll back to compare container top when collapsing
      const el = document.getElementById('property-compare');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    setIsExpanded((prev) => !prev);
  };

  const isProject = currentProperty?.category === 'project';
  const categoryLabel = isProject ? 'Project' : 'Property';
  const pluralCategoryLabel = isProject ? 'Projects' : 'Properties';

  // Compute similarity score between a candidate and current property
  const getScore = (candidate, current) => {
    if (!candidate || !current) return 0;
    let score = 0;
    if (candidate.category === current.category) score += 100;
    if (candidate.purpose === current.purpose) score += 30;

    const candCity = candidate.location?.city?.toLowerCase() || '';
    const currCity = current.location?.city?.toLowerCase() || '';
    if (candCity && currCity && (candCity.includes(currCity) || currCity.includes(candCity))) {
      score += 50;
    }

    if (candidate.bhk && current.bhk && candidate.bhk === current.bhk) {
      score += 40;
    } else if (candidate.bhk && current.bhk && Math.abs(candidate.bhk - current.bhk) === 1) {
      score += 20;
    }

    if (candidate.price && current.price && Number(current.price) > 0) {
      const ratio = Number(candidate.price) / Number(current.price);
      if (ratio >= 0.75 && ratio <= 1.25) score += 35;
      else if (ratio >= 0.5 && ratio <= 1.5) score += 15;
    }

    if (candidate.type && current.type && candidate.type.toLowerCase() === current.type.toLowerCase()) {
      score += 25;
    }

    return score;
  };

  // Fetch properties from database and pre-select smartest match
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    getProperties()
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        const filtered = list.filter((p) => String(p._id) !== String(currentProperty?._id));

        // Sort candidates by similarity
        const sorted = filtered.sort((a, b) => getScore(b, currentProperty) - getScore(a, currentProperty));
        setAllCandidates(sorted);

        // Auto pre-populate 1 top candidate of same category if available
        if (sorted.length > 0) {
          const sameCategoryMatch = sorted.find((p) => p.category === currentProperty?.category) || sorted[0];
          setComparedList([sameCategoryMatch]);
        }
      })
      .catch((err) => {
        console.error('Failed to load comparison properties:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentProperty?._id]);

  // Calculate monthly EMI (80% LTV, 8.5% rate, 20 years)
  const calculateEmi = (price) => {
    if (!price || price <= 0) return null;
    const loan = price * 0.8;
    const monthlyRate = 8.5 / 12 / 100;
    const months = 20 * 12;
    const emi = Math.round((loan * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1));
    return emi;
  };

  // Format Indian Currency for deltas
  const formatDeltaPrice = (delta) => {
    const abs = Math.abs(delta);
    if (abs >= 10000000) return `₹ ${(abs / 10000000).toFixed(2)} Cr`;
    if (abs >= 100000) return `₹ ${(abs / 100000).toFixed(2)} L`;
    return `₹ ${abs.toLocaleString('en-IN')}`;
  };

  // Compile full set of comparison columns: [currentProperty, ...comparedList (up to 2)]
  const columns = useMemo(() => {
    return [currentProperty, ...comparedList.slice(0, 2)];
  }, [currentProperty, comparedList]);

  // Union of all amenities across all compared listings
  const allAmenities = useMemo(() => {
    const set = new Set();
    columns.forEach((col) => {
      if (col && Array.isArray(col.amenities)) {
        col.amenities.forEach((a) => {
          if (a && typeof a === 'string' && a.trim()) {
            set.add(a.trim());
          }
        });
      }
    });
    return Array.from(set);
  }, [columns]);

  // Handlers for managing comparison slots
  const handleRemoveSlot = (index) => {
    // index in comparedList is index - 1 because col 0 is currentProperty
    const compIdx = index - 1;
    setComparedList((prev) => prev.filter((_, i) => i !== compIdx));
  };

  const handleOpenPicker = (slotIdx) => {
    setTargetSlot(slotIdx);
    setPickerSearch('');
    setPickerOpen(true);
  };

  const handleSelectProperty = (prop) => {
    if (!prop) return;
    setComparedList((prev) => {
      const next = [...prev];
      if (targetSlot !== null && targetSlot < next.length) {
        next[targetSlot] = prop;
      } else {
        next.push(prop);
      }
      return next.slice(0, 2);
    });
    setPickerOpen(false);
  };

  // Filtered candidates for the picker modal
  const filteredCandidates = useMemo(() => {
    const selectedIds = new Set(columns.filter(Boolean).map((c) => String(c._id)));
    let list = allCandidates.filter((p) => !selectedIds.has(String(p._id)));

    if (pickerSearch.trim()) {
      const q = pickerSearch.toLowerCase().trim();
      list = list.filter((p) => {
        const title = (p.title || p.name || '').toLowerCase();
        const city = (p.location?.city || '').toLowerCase();
        const addr = (p.location?.address || '').toLowerCase();
        const type = (p.type || '').toLowerCase();
        return title.includes(q) || city.includes(q) || addr.includes(q) || type.includes(q);
      });
    }
    return list;
  }, [allCandidates, columns, pickerSearch]);

  // Top 3 quick recommendation chips for fast switching
  const quickRecs = useMemo(() => {
    const selectedIds = new Set(columns.filter(Boolean).map((c) => String(c._id)));
    return allCandidates
      .filter((p) => !selectedIds.has(String(p._id)) && p.category === currentProperty?.category)
      .slice(0, 3);
  }, [allCandidates, columns, currentProperty]);

  if (!currentProperty) return null;

  return (
    <div id="property-compare" className="prop-compare-container">
      {/* Header */}
      <div className="prop-compare-header">
        <div className="prop-compare-title-wrap">
          <h2>
            <ArrowLeftRight size={20} className="text-blue-600" />
            <span>
              {isProject ? 'Compare with Similar Projects' : 'Compare with Similar Properties'}
            </span>
          </h2>
          <p className="prop-compare-subtitle">
            Side-by-side specification, pricing, area &amp; EMI comparison matrix
          </p>
        </div>

        <div className="prop-compare-actions">
          {(canScrollRight || canScrollLeft) && (
            <button
              type="button"
              onClick={handleScrollMore}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 transition-colors cursor-pointer"
              title="Scroll comparison table horizontally"
            >
              <span>{canScrollRight ? 'View More' : 'Scroll to Start'}</span>
              <ArrowRight size={14} className={canScrollRight ? '' : 'rotate-180 transition-transform'} />
            </button>
          )}
          {comparedList.length < 2 && (
            <button
              type="button"
              className="prop-compare-add-btn"
              onClick={() => handleOpenPicker(comparedList.length)}
            >
              <Plus size={16} />
              <span>Add {categoryLabel} to Compare</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Recommendation Chips */}
      {quickRecs.length > 0 && (
        <div className="prop-compare-quick-recs">
          <span className="prop-compare-quick-label">
            <Sparkles size={13} className="inline mr-1 text-amber-500" />
            Quick Compare:
          </span>
          {quickRecs.map((rec) => (
            <button
              key={rec._id}
              type="button"
              className="prop-compare-rec-chip"
              onClick={() => {
                if (comparedList.length < 2) {
                  setComparedList((prev) => [...prev, rec]);
                } else {
                  setComparedList((prev) => [prev[0], rec]);
                }
              }}
              title={`Compare with ${rec.title}`}
            >
              <span>+ {rec.title}</span>
              <span className="text-blue-600 font-bold">
                {formatPrice(rec.price, rec.priceDisplay, rec.purpose)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Comparison Matrix Table */}
      <div className="relative">
        <div 
          ref={tableWrapRef} 
          className={`prop-compare-table-wrap ${!isExpanded ? 'prop-compare-table-wrap-collapsed' : ''}`}
        >
          <table className="prop-compare-table">
            <thead>
              <tr>
                <th className="prop-compare-th th-label">Parameter</th>

              {/* Column 0: Current Property */}
              <th className="prop-compare-th th-current">
                <div className="prop-compare-card-top">
                  <div className="prop-compare-badge-row">
                    <span className="prop-badge-curr">Current {categoryLabel}</span>
                    <span className="prop-badge-type">
                      {currentProperty.purpose === 'rent' ? 'For Rent' : 'For Sale'}
                    </span>
                  </div>
                  <img
                    src={getPublicImageUrl(currentProperty.images?.[0] || currentProperty.image || '')}
                    alt={currentProperty.title}
                    className="prop-compare-thumb"
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=600&auto=format&fit=crop';
                    }}
                  />
                  <h3 className="prop-compare-card-title">{currentProperty.title || currentProperty.name}</h3>
                  <div className="prop-compare-card-price">
                    {formatPrice(currentProperty.price, currentProperty.priceDisplay, currentProperty.purpose)}
                  </div>
                  <div className="prop-compare-card-rate">
                    {currentProperty.priceSub || (currentProperty.price && currentProperty.area ? `₹ ${Math.round(currentProperty.price / currentProperty.area).toLocaleString('en-IN')} / Sq.Ft` : '')}
                  </div>
                </div>
              </th>

              {/* Column 1 & 2: Compared Properties */}
              {[0, 1].map((slotIdx) => {
                const comp = comparedList[slotIdx];
                if (comp) {
                  return (
                    <th key={comp._id || slotIdx} className="prop-compare-th th-comp">
                      <div className="prop-compare-card-top">
                        <div className="prop-compare-badge-row">
                          <span className="prop-badge-type">{comp.category === 'project' ? 'Project' : 'Property'}</span>
                          <span className="prop-badge-type">{comp.purpose === 'rent' ? 'Rent' : 'Sale'}</span>
                        </div>
                        <img
                          src={getPublicImageUrl(comp.images?.[0] || comp.image || '')}
                          alt={comp.title}
                          className="prop-compare-thumb"
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=600&auto=format&fit=crop';
                          }}
                        />
                        <h3 className="prop-compare-card-title">{comp.title || comp.name}</h3>
                        <div className="prop-compare-card-price">
                          {formatPrice(comp.price, comp.priceDisplay, comp.purpose)}
                        </div>
                        <div className="prop-compare-card-rate">
                          {comp.priceSub || (comp.price && comp.area ? `₹ ${Math.round(comp.price / comp.area).toLocaleString('en-IN')} / Sq.Ft` : '')}
                        </div>
                        <div className="prop-compare-slot-actions">
                          <button
                            type="button"
                            className="prop-slot-change-btn"
                            onClick={() => handleOpenPicker(slotIdx)}
                          >
                            Change
                          </button>
                          <button
                            type="button"
                            className="prop-slot-remove-btn"
                            onClick={() => handleRemoveSlot(slotIdx + 1)}
                            title="Remove from comparison"
                          >
                            <X size={12} className="inline mr-0.5" /> Remove
                          </button>
                        </div>
                      </div>
                    </th>
                  );
                }

                // Empty Slot
                return (
                  <th key={`empty-${slotIdx}`} className="prop-compare-th th-empty">
                    <div className="prop-empty-slot">
                      <div className="prop-empty-icon">
                        <Building2 size={22} />
                      </div>
                      <p className="text-xs text-slate-500 font-medium mb-3">Add another {categoryLabel.toLowerCase()} to compare</p>
                      <button
                        type="button"
                        className="prop-empty-btn"
                        onClick={() => handleOpenPicker(slotIdx)}
                      >
                        <Plus size={14} />
                        <span>Select {categoryLabel}</span>
                      </button>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {/* ── Group: Pricing & Financials ── */}
            <tr className="prop-compare-section-row">
              <td colSpan={1 + Math.max(1, comparedList.length + (comparedList.length < 2 ? 1 : 0))}>
                Pricing &amp; Affordability
              </td>
            </tr>

            {/* Price Difference vs Current */}
            <tr className="prop-compare-row">
              <td className="td-label">Price Difference</td>
              {columns.map((col, idx) => {
                if (!col) return <td key={idx}>—</td>;
                if (idx === 0) {
                  return (
                    <td key={idx} className="td-current">
                      <span className="prop-diff-badge equal">Baseline Listing</span>
                    </td>
                  );
                }
                const delta = (col.price || 0) - (currentProperty.price || 0);
                const percent = currentProperty.price ? Math.round((Math.abs(delta) / currentProperty.price) * 100) : 0;
                if (delta < 0) {
                  return (
                    <td key={idx}>
                      <span className="prop-diff-badge cheaper">
                        {formatDeltaPrice(delta)} Cheaper (-{percent}%)
                      </span>
                    </td>
                  );
                }
                if (delta > 0) {
                  return (
                    <td key={idx}>
                      <span className="prop-diff-badge expensive">
                        +{formatDeltaPrice(delta)} Higher (+{percent}%)
                      </span>
                    </td>
                  );
                }
                return (
                  <td key={idx}>
                    <span className="prop-diff-badge equal">Same Price</span>
                  </td>
                );
              })}
              {comparedList.length < 2 && <td>—</td>}
            </tr>

            {/* Price per Sq.Ft */}
            <tr className="prop-compare-row">
              <td className="td-label">Rate / Sq.Ft</td>
              {columns.map((col, idx) => {
                if (!col) return <td key={idx}>—</td>;
                const rate = col.price && col.area ? Math.round(col.price / col.area) : null;
                return (
                  <td key={idx} className={idx === 0 ? 'td-current' : ''}>
                    {rate ? (
                      <span className="prop-val-highlight">₹ {rate.toLocaleString('en-IN')} / sq.ft</span>
                    ) : (
                      'N/A'
                    )}
                  </td>
                );
              })}
              {comparedList.length < 2 && <td>—</td>}
            </tr>

            {/* Estimated Monthly EMI */}
            <tr className="prop-compare-row">
              <td className="td-label">
                <div className="flex items-center gap-1">
                  <Calculator size={14} className="text-amber-500" />
                  <span>Est. Monthly EMI</span>
                </div>
              </td>
              {columns.map((col, idx) => {
                if (!col) return <td key={idx}>—</td>;
                if (col.purpose === 'rent') {
                  return (
                    <td key={idx} className={idx === 0 ? 'td-current' : ''}>
                      <span className="prop-val-highlight">₹ {(col.price || 0).toLocaleString('en-IN')} / mo</span>
                      <span className="prop-val-sub">Monthly Lease Rent</span>
                    </td>
                  );
                }
                const emi = calculateEmi(col.price);
                return (
                  <td key={idx} className={idx === 0 ? 'td-current' : ''}>
                    {emi ? (
                      <div>
                        <span className="prop-val-highlight text-emerald-700">₹ {emi.toLocaleString('en-IN')} / mo</span>
                        <span className="prop-val-sub">@ 8.5% p.a., 20 Yrs (80% Loan)</span>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                );
              })}
              {comparedList.length < 2 && <td>—</td>}
            </tr>

            {/* ── Group: Space & Configuration ── */}
            <tr className="prop-compare-section-row">
              <td colSpan={1 + Math.max(1, comparedList.length + (comparedList.length < 2 ? 1 : 0))}>
                Space &amp; Specifications
              </td>
            </tr>

            {/* BHK */}
            <tr className="prop-compare-row">
              <td className="td-label">Bedrooms / BHK</td>
              {columns.map((col, idx) => (
                <td key={idx} className={idx === 0 ? 'td-current' : ''}>
                  {col?.bhk ? (
                    <span className="font-bold text-slate-800">{col.bhk} BHK</span>
                  ) : (
                    'Not specified'
                  )}
                </td>
              ))}
              {comparedList.length < 2 && <td>—</td>}
            </tr>

            {/* Carpet Area */}
            <tr className="prop-compare-row">
              <td className="td-label">Carpet Area</td>
              {columns.map((col, idx) => {
                if (!col) return <td key={idx}>—</td>;
                const area = col.area ? Number(col.area) : 0;
                const baseArea = currentProperty.area ? Number(currentProperty.area) : 0;
                const areaDelta = area - baseArea;

                return (
                  <td key={idx} className={idx === 0 ? 'td-current' : ''}>
                    {area > 0 ? (
                      <div>
                        <span className="font-bold text-slate-900">{area.toLocaleString()} sq.ft</span>
                        {idx > 0 && baseArea > 0 && areaDelta !== 0 && (
                          <div>
                            <span className={`prop-diff-badge ${areaDelta > 0 ? 'larger' : 'smaller'}`}>
                              {areaDelta > 0 ? `+${areaDelta.toLocaleString()} sq.ft larger` : `${areaDelta.toLocaleString()} sq.ft smaller`}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </td>
                );
              })}
              {comparedList.length < 2 && <td>—</td>}
            </tr>

            {/* Property Type */}
            <tr className="prop-compare-row">
              <td className="td-label">Property Type</td>
              {columns.map((col, idx) => (
                <td key={idx} className={idx === 0 ? 'td-current' : ''}>
                  <span className="font-medium text-slate-800">{col?.type || 'Residential'}</span>
                </td>
              ))}
              {comparedList.length < 2 && <td>—</td>}
            </tr>

            {/* ── Group: Location & Verification ── */}
            <tr className="prop-compare-section-row">
              <td colSpan={1 + Math.max(1, comparedList.length + (comparedList.length < 2 ? 1 : 0))}>
                Location &amp; Compliance
              </td>
            </tr>

            {/* City & Address */}
            <tr className="prop-compare-row">
              <td className="td-label">City &amp; Location</td>
              {columns.map((col, idx) => {
                if (!col) return <td key={idx}>—</td>;
                const city = col.location?.city || '';
                const addr = col.location?.address || '';
                return (
                  <td key={idx} className={idx === 0 ? 'td-current' : ''}>
                    <div className="font-semibold text-slate-900 flex items-center gap-1">
                      <MapPin size={13} className="text-slate-400 shrink-0" />
                      <span>{city || 'India'}</span>
                    </div>
                    {addr && <div className="text-xs text-slate-500 mt-1 line-clamp-2">{addr}</div>}
                  </td>
                );
              })}
              {comparedList.length < 2 && <td>—</td>}
            </tr>

            {/* Possession Status */}
            <tr className="prop-compare-row">
              <td className="td-label">Possession</td>
              {columns.map((col, idx) => {
                if (!col) return <td key={idx}>—</td>;
                const isReady = col.status === 'ready' || col.ready;
                return (
                  <td key={idx} className={idx === 0 ? 'td-current' : ''}>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                        isReady
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {col.statusLabel || (isReady ? 'Ready to Move' : 'Under Construction')}
                    </span>
                    {col.statusDate && (
                      <div className="text-xs text-slate-500 mt-1">{col.statusDate}</div>
                    )}
                  </td>
                );
              })}
              {comparedList.length < 2 && <td>—</td>}
            </tr>

            {/* RERA Status */}
            <tr className="prop-compare-row">
              <td className="td-label">RERA Verification</td>
              {columns.map((col, idx) => {
                if (!col) return <td key={idx}>—</td>;
                return (
                  <td key={idx} className={idx === 0 ? 'td-current' : ''}>
                    {col.rera ? (
                      <div className="flex items-center gap-1 text-xs font-bold text-emerald-700">
                        <ShieldCheck size={14} className="text-emerald-600" />
                        <span>RERA Verified</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 font-medium">Self Verified</span>
                    )}
                  </td>
                );
              })}
              {comparedList.length < 2 && <td>—</td>}
            </tr>

            {/* Builder / Developer */}
            <tr className="prop-compare-row">
              <td className="td-label">Listed By</td>
              {columns.map((col, idx) => {
                if (!col) return <td key={idx}>—</td>;
                const builderObj = col.builder;
                const bName = typeof builderObj === 'object' ? (builderObj.name || builderObj.builderProfile?.companyName || 'Developer') : 'Builder / Agent';
                return (
                  <td key={idx} className={idx === 0 ? 'td-current' : ''}>
                    <span className="font-semibold text-slate-800">{bName}</span>
                  </td>
                );
              })}
              {comparedList.length < 2 && <td>—</td>}
            </tr>

            {/* ── Group: Amenities Matrix ── */}
            {allAmenities.length > 0 && (
              <>
                <tr className="prop-compare-section-row">
                  <td colSpan={1 + Math.max(1, comparedList.length + (comparedList.length < 2 ? 1 : 0))}>
                    Amenities Comparison ({allAmenities.length} Tracked)
                  </td>
                </tr>

                {allAmenities.map((amenity) => (
                  <tr key={amenity} className="prop-compare-row">
                    <td className="td-label">{amenity}</td>
                    {columns.map((col, idx) => {
                      if (!col) return <td key={idx}>—</td>;
                      const hasAmenity = Array.isArray(col.amenities) && col.amenities.some(
                        (a) => a && a.toLowerCase().trim() === amenity.toLowerCase().trim()
                      );
                      return (
                        <td key={idx} className={idx === 0 ? 'td-current' : ''}>
                          {hasAmenity ? (
                            <span className="amenity-status available">
                              <Check size={15} strokeWidth={2.5} className="text-emerald-600" />
                              <span>Available</span>
                            </span>
                          ) : (
                            <span className="amenity-status missing">
                              <span className="text-slate-300 font-bold">—</span>
                              <span className="text-slate-400">Not listed</span>
                            </span>
                          )}
                        </td>
                      );
                    })}
                    {comparedList.length < 2 && <td>—</td>}
                  </tr>
                ))}
              </>
            )}

            {/* ── Group: Actions ── */}
            <tr className="prop-compare-row">
              <td className="td-label">Action</td>
              {columns.map((col, idx) => {
                if (!col) return <td key={idx}>—</td>;
                if (idx === 0) {
                  return (
                    <td key={idx} className="prop-action-cell td-current">
                      <button type="button" className="prop-view-btn current-btn" disabled>
                        Currently Viewing
                      </button>
                    </td>
                  );
                }
                return (
                  <td key={idx} className="prop-action-cell">
                    <button
                      type="button"
                      className="prop-view-btn"
                      onClick={() => navigate(`/property/${col._id}`)}
                    >
                      <span>View Details</span>
                      <ExternalLink size={13} />
                    </button>
                  </td>
                );
              })}
              {comparedList.length < 2 && <td>—</td>}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Gradient fade overlay when collapsed */}
      {!isExpanded && (
        <div className="prop-compare-fade-overlay pointer-events-none" />
      )}

      {/* Floating Horizontal "View More" Scroll Indicator Button */}
      {canScrollRight && (
        <div className="absolute right-2 top-1/3 -translate-y-1/2 z-20 flex">
          <button
            type="button"
            onClick={handleScrollMore}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/90 hover:bg-slate-900 active:scale-95 text-white text-xs font-bold rounded-full shadow-lg border border-white/20 transition-all cursor-pointer backdrop-blur-sm"
            title="Scroll horizontally to view more compared listings"
          >
            <span>View More</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>

    {/* ── View More Button for the entire Compare Properties Section scroll / expand ── */}
    <div className="flex flex-col items-center justify-center pt-5">
      <button
        type="button"
        onClick={handleToggleExpand}
        className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer"
      >
        {isExpanded ? (
          <>
            <ChevronUp size={16} />
            <span>View Less (Show Summary)</span>
          </>
        ) : (
          <>
            <ChevronDown size={16} />
            <span>View More Details &amp; Full Specifications</span>
          </>
        )}
      </button>
    </div>

      {/* ── Selection Modal / Popover ── */}
      {pickerOpen && (
        <div
          className="prop-picker-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPickerOpen(false);
          }}
        >
          <div className="prop-picker-modal">
            <div className="prop-picker-header">
              <h3 className="prop-picker-title">
                Select a {categoryLabel} to Compare
              </h3>
              <button
                type="button"
                className="prop-picker-close"
                onClick={() => setPickerOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="prop-picker-search-bar">
              <Search size={16} className="text-slate-400" />
              <input
                type="text"
                placeholder={`Search by title, city, locality, or type...`}
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className="prop-picker-search-input"
                autoFocus
              />
            </div>

            <div className="prop-picker-list">
              {filteredCandidates.length === 0 ? (
                <div className="text-center py-10 text-sm text-slate-500">
                  No matching {pluralCategoryLabel.toLowerCase()} found. Try a different search term.
                </div>
              ) : (
                filteredCandidates.map((cand) => (
                  <button
                    key={cand._id}
                    type="button"
                    className="prop-picker-item"
                    onClick={() => handleSelectProperty(cand)}
                  >
                    <img
                      src={getPublicImageUrl(cand.images?.[0] || cand.image || '')}
                      alt={cand.title}
                      className="prop-picker-thumb"
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=600&auto=format&fit=crop';
                      }}
                    />
                    <div className="prop-picker-info">
                      <div className="prop-picker-info-title">{cand.title || cand.name}</div>
                      <div className="prop-picker-info-meta">
                        <span>{cand.location?.city || 'India'}</span>
                        {cand.bhk && <span>· {cand.bhk} BHK</span>}
                        {cand.area && <span>· {Number(cand.area).toLocaleString()} sq.ft</span>}
                        <span>· {cand.type || 'Residential'}</span>
                      </div>
                    </div>
                    <div className="prop-picker-info-price">
                      {formatPrice(cand.price, cand.priceDisplay, cand.purpose)}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(PropertyCompare);

