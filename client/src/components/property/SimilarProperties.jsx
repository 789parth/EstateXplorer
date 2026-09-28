import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  Bed,
  Maximize2,
  Building2,
  Home,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Tag,
  CheckCircle2,
} from 'lucide-react';
import { getProperties } from '../../services/propertyService';
import { formatPrice, getPublicImageUrl } from '../../utils/formatters';
import './SimilarProperties.css';

const SimilarProperties = ({ currentProperty }) => {
  const navigate = useNavigate();
  const [allProperties, setAllProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  const isProject = currentProperty?.category === 'project';
  const categoryLabel = isProject ? 'Projects' : 'Properties';
  const currentCity = currentProperty?.location?.city || '';

  // Fetch all active properties from database (cached via propertyService)
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    getProperties()
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        setAllProperties(list);
      })
      .catch((err) => {
        console.error('Failed to load similar properties:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentProperty?._id]);

  // Dynamic similarity scoring engine based on location and price parameters
  const similarItems = useMemo(() => {
    if (!currentProperty || allProperties.length === 0) return [];

    const currId = String(currentProperty._id || currentProperty.id || '');
    const currPrice = Number(currentProperty.price) || 0;
    const currCity = (currentProperty.location?.city || '').toLowerCase().trim();
    const currLocality = (currentProperty.location?.address || '').toLowerCase().trim();
    const currBhk = Number(currentProperty.bhk) || 0;
    const currCategory = currentProperty.category || 'property';
    const currPurpose = currentProperty.purpose || 'buy';

    // Exclude current property
    const candidates = allProperties.filter((p) => {
      const pId = String(p._id || p.id || '');
      return pId !== currId;
    });

    const scored = candidates.map((candidate) => {
      let score = 0;
      const candPrice = Number(candidate.price) || 0;
      const candCity = (candidate.location?.city || '').toLowerCase().trim();
      const candLocality = (candidate.location?.address || '').toLowerCase().trim();
      const candBhk = Number(candidate.bhk) || 0;
      const candCategory = candidate.category || 'property';
      const candPurpose = candidate.purpose || 'buy';

      // 1. LOCATION PARAMETER SCORING (Maximum weight)
      if (currCity && candCity) {
        if (candCity === currCity) {
          score += 100; // Exact city match
        } else if (candCity.includes(currCity) || currCity.includes(candCity)) {
          score += 70; // Partial city match
        }
      }

      if (currLocality && candLocality) {
        // Check for common locality keyword overlap
        const currWords = currLocality.split(/[\s,]+/).filter((w) => w.length > 3);
        const hasWordMatch = currWords.some((w) => candLocality.includes(w));
        if (hasWordMatch) {
          score += 35; // Same locality/neighborhood
        }
      }

      // 2. PRICE PARAMETER SCORING (Heavy weight)
      if (currPrice > 0 && candPrice > 0) {
        const ratioDelta = Math.abs(candPrice - currPrice) / currPrice;
        if (ratioDelta <= 0.15) {
          score += 85; // Within ±15% price range
        } else if (ratioDelta <= 0.30) {
          score += 65; // Within ±30% price range
        } else if (ratioDelta <= 0.50) {
          score += 45; // Within ±50% price range
        } else if (ratioDelta <= 1.0) {
          score += 25; // Within ±100% price range
        } else {
          score += Math.max(0, 15 - Math.round(ratioDelta * 5));
        }
      }

      // 3. RELEVANCE BOOSTERS (Category, Purpose, Configuration)
      if (candCategory === currCategory) {
        score += 40; // Same category (Project vs Property)
      }

      if (candPurpose === currPurpose) {
        score += 25; // Same purpose (Buy vs Rent)
      }

      if (currBhk > 0 && candBhk > 0) {
        if (candBhk === currBhk) {
          score += 25; // Exact BHK match
        } else if (Math.abs(candBhk - currBhk) === 1) {
          score += 12; // Adjacent BHK (e.g. 2 BHK vs 3 BHK)
        }
      }

      return {
        property: candidate,
        score,
      };
    });

    // Sort by highest score first and take top 4 matches
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 4).map((s) => s.property);
  }, [allProperties, currentProperty]);

  const handleCardClick = (id) => {
    if (!id) return;
    navigate(`/property/${id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading && allProperties.length === 0) {
    return null;
  }

  if (similarItems.length === 0) {
    return null;
  }

  return (
    <section className="similar-props-section" aria-label="Similar Properties and Projects">
      {/* Section Header */}
      <div className="similar-props-header">
        <div className="similar-props-title-group">
          <h2>
            {isProject ? (
              <Building2 size={24} className="text-blue-600" />
            ) : (
              <Home size={24} className="text-blue-600" />
            )}
            <span>
              {isProject ? 'Similar Projects' : 'Similar Properties'}
            </span>
          </h2>
          <p className="similar-props-subtitle">
            Curated based on location proximity and matching price bracket (~{formatPrice(currentProperty?.price, currentProperty?.priceDisplay, currentProperty?.purpose)})
          </p>
        </div>

        {/* Active Criteria Badges */}
        <div className="similar-props-criteria-badges">
          {currentCity && (
            <span className="similar-criteria-pill">
              <MapPin size={12} className="text-blue-600" />
              <span>{currentCity}</span>
            </span>
          )}
          {currentProperty?.price > 0 && (
            <span className="similar-criteria-pill">
              <Tag size={12} className="text-amber-600" />
              <span>{formatPrice(currentProperty.price, currentProperty.priceDisplay, currentProperty.purpose)} Bracket</span>
            </span>
          )}
          <span className="similar-criteria-pill">
            <Sparkles size={12} className="text-emerald-600" />
            <span>Smart Match</span>
          </span>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="similar-props-grid">
        {similarItems.map((item) => {
          const itemId = item._id || item.id;
          const imgSrc = getPublicImageUrl(
            (Array.isArray(item.images) && item.images[0]) || item.image || item.img || ''
          );
          const isReady = item.status === 'ready' || item.ready;
          const ratePerSqFt = item.price && item.area ? Math.round(item.price / item.area) : null;
          const itemCity = item.location?.city || '';
          const itemAddr = item.location?.address || '';

          return (
            <article
              key={itemId}
              onClick={() => handleCardClick(itemId)}
              className="similar-prop-card group"
            >
              {/* Image & Badges */}
              <div className="similar-card-img-wrap">
                <img
                  src={imgSrc}
                  alt={item.title || item.name || 'Listing'}
                  loading="lazy"
                  className="similar-card-img"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=800&auto=format&fit=crop';
                  }}
                />

                {/* Top Left Badges */}
                <div className="similar-badge-top-left">
                  <span className={`similar-badge-purpose ${item.purpose === 'rent' ? 'rent' : ''}`}>
                    {item.purpose === 'rent' ? 'For Rent' : 'For Sale'}
                  </span>
                  {item.rera && (
                    <span className="similar-badge-rera">
                      <ShieldCheck size={11} />
                      RERA
                    </span>
                  )}
                </div>

                {/* Top Right Match Tag */}
                <div className="similar-badge-top-right">
                  <span className="similar-match-score-badge">
                    <CheckCircle2 size={10} className="text-blue-600" />
                    <span>Similar Match</span>
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="similar-card-body">
                {/* Price Row */}
                <div className="similar-card-price-row">
                  <div className="similar-card-price">
                    {formatPrice(item.price, item.priceDisplay, item.purpose)}
                  </div>
                  {ratePerSqFt ? (
                    <div className="similar-card-price-sub">
                      ₹ {ratePerSqFt.toLocaleString('en-IN')} / sq.ft
                    </div>
                  ) : null}
                </div>

                {/* Title */}
                <h3 className="similar-card-title" title={item.title || item.name}>
                  {item.title || item.name}
                </h3>

                {/* Location */}
                <div className="similar-card-location" title={`${itemAddr ? itemAddr + ', ' : ''}${itemCity}`}>
                  <MapPin size={13} />
                  <span>
                    {itemAddr ? `${itemAddr.slice(0, 24)}${itemAddr.length > 24 ? '...' : ''}, ` : ''}
                    <strong>{itemCity || 'India'}</strong>
                  </span>
                </div>

                {/* Specs Row */}
                <div className="similar-card-specs">
                  {item.bhk ? (
                    <span className="similar-spec-item">
                      <Bed size={13} className="text-slate-400" />
                      <span>{item.bhk} BHK</span>
                    </span>
                  ) : null}

                  {item.bhk && item.area ? <span className="similar-spec-divider">•</span> : null}

                  {item.area ? (
                    <span className="similar-spec-item">
                      <Maximize2 size={13} className="text-slate-400" />
                      <span>{Number(item.area).toLocaleString()} sq.ft</span>
                    </span>
                  ) : null}

                  {(item.bhk || item.area) ? <span className="similar-spec-divider">•</span> : null}

                  <span className="similar-spec-item">
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full ${
                        isReady ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    <span>{item.statusLabel || (isReady ? 'Ready' : 'Under Const.')}</span>
                  </span>
                </div>
              </div>

              {/* Card Footer Button */}
              <div className="similar-card-footer">
                <button
                  type="button"
                  className="similar-card-view-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCardClick(itemId);
                  }}
                >
                  <span>View Details</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default SimilarProperties;
