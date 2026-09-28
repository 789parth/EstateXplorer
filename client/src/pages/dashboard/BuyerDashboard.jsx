import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getProperties, getUserWishlist, toggleWishlistApi, getBuyerInquiries } from '../../services/propertyService';
import { X, Heart, MessageSquare, Calendar } from 'lucide-react';
import { broadcastRealtimeSync, useRealtimeSync, SYNC_EVENTS } from '../../utils/realtimeSync';
import { formatPrice, getPublicImageUrl } from '../../utils/formatters';
import './BuyerDashboard.css';

const BuyerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const firstName = user?.name ? user.name.split(' ')[0] : 'User';
  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';

  const [savedProperties, setSavedProperties] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [upcomingVisits, setUpcomingVisits] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [recommendedProps, setRecommendedProps] = useState([]);
  const [likedIds, setLikedIds] = useState([]);

  // Load recently viewed from localStorage
  const loadRecentlyViewed = useCallback(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
      if (Array.isArray(stored)) {
        setRecentlyViewed(stored);
      }
    } catch (e) {
      console.error('Failed to parse recently viewed:', e);
    }
  }, []);

  const clearRecentlyViewed = () => {
    localStorage.removeItem('recentlyViewed');
    setRecentlyViewed([]);
    setRecommendedProps([]);
    broadcastRealtimeSync(SYNC_EVENTS.PROPERTIES, { action: 'clear_recently_viewed' });
  };
  
  const fetchBuyerData = useCallback(async () => {
    let savedIds = [];
    
    try {
      // Fetch server wishlist
      const wishRes = await getUserWishlist();
      if (wishRes.success && Array.isArray(wishRes.data)) {
        savedIds = wishRes.data.map(String);
        setLikedIds(savedIds);
      }
    } catch (e) {
      console.log('Error fetching wishlist from server');
    }

    try {
      // Fetch real inquiries & visits from DB
      const inqRes = await getBuyerInquiries();
      if (inqRes.success && Array.isArray(inqRes.data)) {
        const mappedInqs = inqRes.data.map(inq => {
          const propId = inq.property?._id || inq._id;
          const propName = inq.propertyTitle || inq.property?.title || 'Inquired Property';
          const propType = inq.propertyType || inq.property?.type || 'Property';
          const builderName = inq.builderName || inq.builder?.builderProfile?.companyName || inq.builder?.name || 'Property Builder';
          const locStr = inq.propertyLocation || (inq.property?.location ? `${inq.property.location.address || ''}, ${inq.property.location.city || ''}` : 'Location on request');
          const propImg = inq.propertyImage || (inq.property?.images?.[0] ? getPublicImageUrl(inq.property.images[0]) : 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=800&auto=format&fit=crop');

          return {
            id: propId,
            inquiryId: inq._id,
            name: propName,
            type: propType,
            builder: builderName,
            location: locStr,
            img: propImg,
            date: inq.createdAt,
            notes: inq.notes || '',
            visitRequested: Boolean(inq.visitRequested || inq.status === 'visit'),
            visitDate: inq.visitDate,
            visitTime: inq.visitTime,
            status: inq.status === 'expired'
              ? 'Expired'
              : inq.status === 'visit'
              ? 'Site Visit Scheduled'
              : inq.status === 'contacted'
              ? 'Contacted'
              : inq.status === 'closed'
              ? 'Closed'
              : 'Awaiting Reply',
            statusRaw: inq.status,
          };
        });

        // Split into standard inquiries and scheduled site visits
        const visits = mappedInqs.filter(i => i.visitRequested);
        const generalInqs = mappedInqs.filter(i => !i.visitRequested);

        setInquiries(generalInqs);
        setUpcomingVisits(visits);
      }
    } catch (e) {
      console.log('Error fetching live inquiries');
    }

    try {
      const res = await getProperties();
      if (res.success && Array.isArray(res.data)) {
        const allDbProps = res.data.map(p => ({
          id: p._id,
          price: p.price,
          bhk: p.bhk || 0,
          status: p.status,
          category: p.category || 'property',
          rera: p.rera,
          name: p.title,
          city: p.location?.city || '',
          location: typeof p.location === 'string' ? p.location : `${p.location?.address || ''}, ${p.location?.city || ''}`,
          type: p.type,
          priceDisplay: p.priceDisplay,
          priceSub: p.priceSub,
          photos: p.images?.length || 0,
          usps: p.usps || [],
          statusLabel: p.statusLabel || (p.status === 'ready' ? 'Ready To Move' : 'Under Construction'),
          statusDate: p.statusDate,
          ready: p.status === 'ready',
          img: getPublicImageUrl(p.images && p.images.length > 0 && p.images[0] ? p.images[0] : (p.image || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=800&auto=format&fit=crop')),
        }));
        
        const liked = allDbProps.filter(p => savedIds.includes(String(p.id)));
        setSavedProperties(liked);

        // Curate recommendations strictly dependent on user's explored property/project details
        const storedRecents = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
        if (!Array.isArray(storedRecents) || storedRecents.length === 0) {
          // New user who hasn't explored properties yet -> show nothing
          setRecommendedProps([]);
        } else {
          const exploredIds = new Set(storedRecents.map(r => String(r.id || r._id)));
          
          // Enrich explored details with database attributes if available
          const exploredDetails = storedRecents.map(r => {
            const dbMatch = allDbProps.find(p => String(p.id) === String(r.id || r._id));
            return dbMatch || r;
          });

          const exploredCities = exploredDetails
            .map(e => (e.city || e.location || '').toLowerCase())
            .filter(Boolean);
          const exploredCategories = new Set(exploredDetails.map(e => e.category).filter(Boolean));
          const exploredTypes = new Set(exploredDetails.map(e => (e.type || '').toLowerCase()).filter(Boolean));
          const exploredBhks = new Set(exploredDetails.map(e => Number(e.bhk)).filter(b => b > 0));
          const exploredPrices = exploredDetails.map(e => Number(e.price)).filter(p => !isNaN(p) && p > 0);
          const avgPrice = exploredPrices.length > 0 ? exploredPrices.reduce((a, b) => a + b, 0) / exploredPrices.length : 0;

          // Rank un-explored properties based on affinity to explored property/project details
          const scoredCandidates = allDbProps
            .filter(cand => !exploredIds.has(String(cand.id)))
            .map(cand => {
              let score = 0;
              const candCity = (cand.city || cand.location || '').toLowerCase();
              const candType = (cand.type || '').toLowerCase();
              const candPrice = Number(cand.price) || 0;

              // City / locality match (high affinity)
              if (candCity && exploredCities.some(ec => ec.includes(candCity) || candCity.includes(ec))) {
                score += 50;
              }

              // Category match (Project vs Property)
              if (exploredCategories.has(cand.category)) {
                score += 30;
              }

              // Property Type match (Apartment, Villa, Plot, etc.)
              if (candType && exploredTypes.has(candType)) {
                score += 25;
              }

              // BHK configuration match
              if (cand.bhk && exploredBhks.has(Number(cand.bhk))) {
                score += 20;
              }

              // Budget / Price proximity (within 40% of average explored price)
              if (avgPrice > 0 && candPrice > 0) {
                const ratio = candPrice / avgPrice;
                if (ratio >= 0.7 && ratio <= 1.3) {
                  score += 35;
                } else if (ratio >= 0.5 && ratio <= 1.6) {
                  score += 15;
                }
              }

              return { ...cand, matchScore: score };
            })
            .filter(c => c.matchScore > 0)
            .sort((a, b) => b.matchScore - a.matchScore);

          setRecommendedProps(scoredCandidates.slice(0, 4));
        }
      }
    } catch (err) {
      console.error('Failed to load properties for dashboard:', err);
    }
  }, []);

  useEffect(() => {
    loadRecentlyViewed();
    fetchBuyerData();
  }, [loadRecentlyViewed, fetchBuyerData]);

  // Real-time synchronization for inquiries, wishlists, and inventory
  useRealtimeSync(
    [SYNC_EVENTS.WISHLIST, SYNC_EVENTS.INQUIRIES, SYNC_EVENTS.PROPERTIES],
    () => {
      loadRecentlyViewed();
      fetchBuyerData();
    },
    { revalidateOnFocus: true, intervalMs: 10000 }
  );

  const removeWishlist = async (id) => {
    const updated = likedIds.filter(x => x !== id);
    setLikedIds(updated);
    setSavedProperties(prev => prev.filter(p => p.id !== id));
    localStorage.setItem('wishlist', JSON.stringify(updated));

    broadcastRealtimeSync(SYNC_EVENTS.WISHLIST, { action: 'removed', id });

    try {
      await toggleWishlistApi(id);
    } catch (err) {
      console.error('Failed to sync remove wishlist:', err);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Just now';
    const date = new Date(dateStr);
    const diff = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return `${diff} days ago`;
  };

  return (
    <div className="dashboard-wrapper">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <div>
            <div className="brand-text"><Link to={"/"}> Estate<span>Xplorer</span></Link></div>
            <div className="role">{user?.role ? `${user.role.charAt(0).toUpperCase() + user.role.slice(1)} Account` : 'Buyer Account'}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-label">Main</div>
            <Link className="nav-item active" to="/dashboard">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
              Dashboard
            </Link>
          </div>

          <div className="nav-section">
            <div className="nav-section-label">Saved &amp; Inquiries</div>
            <a className="nav-item" href="#saved-properties">
              <Heart size={16} />
              Saved Properties
              {savedProperties.length > 0 && <span className="badge">{savedProperties.length}</span>}
            </a>
            <a className="nav-item" href="#open-enquiries">
              <MessageSquare size={16} />
              My Enquiries
              {inquiries.length > 0 && <span className="badge">{inquiries.length}</span>}
            </a>
            <a className="nav-item" href="#site-visits">
              <Calendar size={16} />
              Site Visits
              {upcomingVisits.length > 0 && <span className="badge warning">{upcomingVisits.length}</span>}
            </a>
          </div>

          <div className="nav-section">
            <div className="nav-section-label">Account</div>
            <Link className="nav-item" to="/dashboard/profile">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Profile
            </Link>
          </div>

          <div className="nav-section">
            <div className="nav-section-label">Explore</div>
            <Link className="nav-item" to="/">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1"/></svg>
              Homepage
            </Link>
            <Link className="nav-item" to="/listings">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              Search Properties
            </Link>
            <button
              className="nav-item w-full text-left bg-transparent border-0 cursor-pointer"
              onClick={logout}
            >
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sign Out
            </button>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div className="user-name">{user?.name || 'User Name'}</div>
              <div className="user-email">{user?.email || 'user@email.com'}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main">
        <header className="topbar">
          <h1 className="page-title">My Dashboard</h1>
          <div className="topbar-right">
            {/* <div className="search-box">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input type="text" placeholder="Search saved properties..." />
            </div>
            <button className="icon-btn" title="Notifications">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
              <span className="dot"></span>
            </button> */}
          </div>
        </header>

        <div className="content">
          <div className="welcome">
            <p>Welcome back, <strong>{firstName}</strong> · You have <strong>{savedProperties.length} saved properties</strong> and <strong>{inquiries.length} open enquiries</strong>.</p>
          </div>

          {/* Quick links */}
          

          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon gold">
                  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                </div>
              </div>
              <div className="stat-value">{savedProperties.length}</div>
              <div className="stat-label">Saved Properties</div>
            </div>
            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon blue">
                  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                </div>
              </div>
              <div className="stat-value">{inquiries.length}</div>
              <div className="stat-label">Open Enquiries</div>
            </div>
            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon orange">
                  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                </div>
              </div>
              <div className="stat-value">{upcomingVisits.length}</div>
              <div className="stat-label">Upcoming Visits</div>
            </div>
            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon green">
                  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                </div>
              </div>
              <div className="stat-value">{recentlyViewed.length}</div>
              <div className="stat-label">Recently Viewed</div>
            </div>
          </div>

          {/* Saved Properties */}
          <div className="card" id="saved-properties" style={{ marginBottom: '28px' }}>
            <div className="card-header">
              <h2 className="card-title">Saved Properties</h2>
              {savedProperties.length > 0 && (
                <span className="text-xs text-muted font-medium">{savedProperties.length} short-listed</span>
              )}
            </div>
            {savedProperties.length === 0 ? (
              <div style={{ padding: '24px 20px', color: 'var(--text-muted)', fontSize: '0.875rem', width: '100%' }}>
                You have no saved properties yet. Browse properties and tap save to add them here.
              </div>
            ) : (
              <div className="props-grid">
                {savedProperties.map(prop => (
                  <div className="prop-card" key={prop.id}>
                    <div className="prop-img">
                      <img
                        src={prop.img || prop.image || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=800&auto=format&fit=crop'}
                        alt={prop.name}
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=800&auto=format&fit=crop';
                        }}
                      />
                      {prop.rera && <span className="prop-badge">RERA</span>}
                      {!prop.rera && prop.ready && <span className="prop-badge">Ready</span>}
                      <button className="prop-fav" aria-label="Remove from Wishlist" onClick={() => removeWishlist(prop.id)}>
                        <X size={14} strokeWidth={2.2} />
                      </button>
                    </div>
                    <div className="prop-body">
                      <div className="prop-type">{prop.type}</div>
                      <div className="prop-name">{prop.name}</div>
                      <div className="prop-loc">{prop.location}</div>
                      <div className="prop-price">{formatPrice(prop.price, prop.priceDisplay)}</div>
                      <div className="prop-price-sub">{prop.priceSub}</div>
                      <div className="prop-actions">
                        <Link to={`/property/${prop.id}`} className="btn-sm primary">View</Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Enquiries + Visits */}
          <div className="dashboard-grid">
            {/* My Enquiries */}
            <div className="card" id="open-enquiries">
              <div className="card-header">
                <h2 className="card-title">My Enquiries</h2>
                <Link className="card-action" to="/listings">New Enquiry →</Link>
              </div>
              <div className="card-scroll-body">
                {inquiries.length === 0 ? (
                  <div style={{ padding: '20px', color: 'var(--text-muted)' }}>No recent inquiries.</div>
                ) : (
                  inquiries.map((inq, idx) => (
                    <div className="enquiry-item" key={idx}>
                      <img className="enquiry-thumb" src={inq.img} alt={inq.name} />
                      <div className="enquiry-info">
                        <div className="enquiry-name">{inq.name} · {inq.type}</div>
                        <div className="enquiry-meta">{inq.builder} · {inq.location.split(',')[0]}</div>
                        {inq.notes && (
                          <div style={{ fontSize: '0.72rem', color: '#047857', marginTop: '3px', background: '#ecfdf5', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                            Representative: &quot;{inq.notes}&quot;
                          </div>
                        )}
                      </div>
                      <div className="enquiry-right">
                        <div className="enquiry-time">{formatDate(inq.date)}</div>
                        <span className={`status-pill ${inq.statusRaw === 'closed' ? 'closed' : inq.statusRaw === 'expired' ? 'expired' : inq.statusRaw === 'contacted' ? 'responded' : 'pending'}`}>{inq.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Upcoming Visits */}
            <div className="card" id="site-visits">
              <div className="card-header">
                <h2 className="card-title">Upcoming Site Visits</h2>
                <Link className="card-action" to="/listings">Schedule Visit →</Link>
              </div>
              <div className="card-scroll-body">
                {upcomingVisits.length === 0 ? (
                  <div style={{ padding: '20px', color: 'var(--text-muted)' }}>
                    No site visits scheduled yet. Click &quot;Book a visit&quot; on any property or project.
                  </div>
                ) : (
                  upcomingVisits.map((visit, idx) => {
                    // Extract day and month for date box
                    const d = visit.visitDate ? new Date(visit.visitDate) : new Date(visit.date);
                    const day = !isNaN(d.getDate()) ? String(d.getDate()).padStart(2, '0') : '01';
                    const month = !isNaN(d.getMonth()) ? d.toLocaleString('en-US', { month: 'short' }) : 'VISIT';
                    
                    return (
                      <div className="visit-item" key={idx}>
                        <div className="visit-date-box">
                          <div className="visit-day">{day}</div>
                          <div className="visit-month">{month}</div>
                        </div>
                        <div className="visit-info">
                          <div className="visit-project">{visit.name}</div>
                          <div className="visit-detail">{visit.type} · {visit.location}</div>
                          <div className="visit-time">
                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                            {visit.visitTime || 'Scheduled slot'} · {visit.builder}
                          </div>
                          {visit.notes && (
                            <div style={{ fontSize: '0.72rem', color: '#047857', marginTop: '3px', background: '#ecfdf5', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                              Representative: &quot;{visit.notes}&quot;
                            </div>
                          )}
                        </div>
                        <div className="visit-actions" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                          <span className={`status-pill ${visit.statusRaw === 'closed' ? 'closed' : 'responded'}`}>
                            {visit.statusRaw === 'closed' ? 'Completed' : 'Scheduled'}
                          </span>
                          <Link to={`/property/${visit.id}`} className="btn-sm primary">View Details</Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Recently Viewed */}
          <div className="card" style={{ marginBottom: '28px' }}>
            <div className="card-header">
              <h2 className="card-title">Recently Viewed</h2>
              {recentlyViewed.length > 0 && (
                <button
                  type="button"
                  className="card-action bg-transparent border-none p-0 cursor-pointer"
                  onClick={clearRecentlyViewed}
                >
                  Clear history
                </button>
              )}
            </div>
            {recentlyViewed.length === 0 ? (
              <div style={{ padding: '20px', color: 'var(--text-muted)' }}>
                No recently viewed properties. Browse our listings to see your browsing history here.
              </div>
            ) : (
              <div className="recent-scroll">
                {recentlyViewed.map(item => (
                  <Link className="recent-card" to={`/property/${item.id}`} key={item.id}>
                    <img
                      src={item.img || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=300&auto=format&fit=crop'}
                      alt={item.name}
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=300&auto=format&fit=crop';
                      }}
                    />
                    <div className="recent-body">
                      <div className="recent-name">{item.name}</div>
                      <div className="recent-price">{formatPrice(item.price, item.priceDisplay)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recommended for you (strictly rendered only if user has explored properties and personalized matches exist) */}
          {recommendedProps.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Recommended for You</h2>
              </div>
              <div className="reco-grid">
                {recommendedProps.map(prop => (
                  <Link className="reco-card" to={`/property/${prop.id}`} key={prop.id}>
                    <img
                      src={prop.img || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop'}
                      alt={prop.name}
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop';
                      }}
                    />
                    <div className="reco-body">
                      <div className="reco-name">{prop.name}</div>
                      <div className="reco-loc">{prop.location}</div>
                      <div className="reco-price">{formatPrice(prop.price, prop.priceDisplay)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default BuyerDashboard;
