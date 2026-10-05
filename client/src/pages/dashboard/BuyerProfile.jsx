import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { INDIAN_STATES } from '../../utils/indianStates';
import { getProperties, getUserWishlist, toggleWishlistApi, getBuyerInquiries } from '../../services/propertyService';
import { getRoleRequestsApi, getKycRequestsApi } from '../../services/adminService';
import { getContactMessagesApi } from '../../services/contactService';
import { formatPhoneNumber, formatPrice, formatTitleCase, isValidIndianMobile } from '../../utils/formatters';
import { Heart, X, ExternalLink, Building2, MapPin, MessageSquare, Calendar, ShieldCheck, Clock, Shield, Users, UserCheck } from 'lucide-react';
import RoleManagementSection from '../../components/dashboard/RoleManagementSection';
import SecuritySettingsSection from '../../components/dashboard/SecuritySettingsSection';
import './BuyerDashboard.css'; // Shared CSS


const BuyerProfile = () => {
  const { user, updateProfile, deleteAccount, showToast, logout } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [savedProperties, setSavedProperties] = useState([]);
  const [inquiriesCount, setInquiriesCount] = useState(0);
  const [visitsCount, setVisitsCount] = useState(0);
  const [adminPendingCount, setAdminPendingCount] = useState(0);
  const [adminPendingKycCount, setAdminPendingKycCount] = useState(0);
  const [adminNewContactsCount, setAdminNewContactsCount] = useState(0);
  const [loadingWishlist, setLoadingWishlist] = useState(true);
  const [isDirty, setIsDirty] = useState(false);


  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    city: user?.city || 'Bengaluru',
    state: user?.state || 'Karnataka',
    about: user?.about || '',
  });

  // Sync initial user data once when user is available or changes
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        city: user.city || 'Bengaluru',
        state: user.state || 'Karnataka',
        about: user.about || '',
      });
      setIsDirty(false);
    }
  }, [user?._id, user?.email]);

  useEffect(() => {
    const fetchWishlist = async () => {
      try {
        setLoadingWishlist(true);
        let savedIds = [];
        try {
          const wishRes = await getUserWishlist();
          if (wishRes.success && Array.isArray(wishRes.data)) {
            savedIds = wishRes.data.map(String);
          }
        } catch (e) {}

        const res = await getProperties();
        if (res.success && Array.isArray(res.data)) {
          const dbProps = res.data.map(p => ({
            id: p._id,
            price: p.price,
            bhk: p.bhk || 0,
            status: p.status,
            name: p.title,
            location: typeof p.location === 'string' ? p.location : `${p.location?.address || ''}, ${p.location?.city || ''}`,
            type: p.type,
            priceDisplay: p.priceDisplay,
            priceSub: p.priceSub,
            statusLabel: p.statusLabel || (p.status === 'ready' ? 'Ready To Move' : 'Under Construction'),
            img: p.images && p.images.length > 0 ? p.images[0] : 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=800&auto=format&fit=crop',
          }));
          const liked = dbProps.filter(p => savedIds.includes(String(p.id)));
          setSavedProperties(liked);
        }
      } catch (err) {
        console.error('Failed to load wishlist in profile:', err);
      } finally {
        setLoadingWishlist(false);
      }
    };

    const fetchInquiries = async () => {
      try {
        const inqRes = await getBuyerInquiries();
        if (inqRes.success && Array.isArray(inqRes.data)) {
          const visits = inqRes.data.filter((i) => Boolean(i.visitRequested || i.status === 'visit'));
          const generalInqs = inqRes.data.filter((i) => !Boolean(i.visitRequested || i.status === 'visit'));
          setInquiriesCount(generalInqs.length);
          setVisitsCount(visits.length);
        }
      } catch (e) {}
    };

    fetchWishlist();
    fetchInquiries();
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      getRoleRequestsApi('PENDING')
        .then((res) => {
          if (res?.success && Array.isArray(res?.data)) {
            setAdminPendingCount(res.data.filter((r) => r.status === 'PENDING').length);
          }
        })
        .catch(() => {});

      getKycRequestsApi()
        .then((res) => {
          if (res?.success && Array.isArray(res?.data)) {
            setAdminPendingKycCount(res.data.filter((k) => k.kycVerification?.status === 'pending').length);
          }
        })
        .catch(() => {});

      getContactMessagesApi()
        .then((res) => {
          if (res?.success && Array.isArray(res?.data)) {
            setAdminNewContactsCount(res.data.filter((c) => c.status === 'new').length);
          }
        })
        .catch(() => {});
    }
  }, [user?.role]);


  const handleRemoveWishlist = async (id) => {
    const savedIds = JSON.parse(localStorage.getItem('wishlist') || '[]').filter(x => x !== id);
    localStorage.setItem('wishlist', JSON.stringify(savedIds));
    setSavedProperties(prev => prev.filter(p => p.id !== id));
    try {
      await toggleWishlistApi(id);
      if (showToast) showToast('Removed from saved wishlist', 'success');
    } catch (e) {}
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      if (showToast) showToast('Full name is required', 'error');
      return;
    }
    if (formData.phone && formData.phone.trim()) {
      if (!isValidIndianMobile(formData.phone)) {
        if (showToast) showToast('Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9', 'error');
        return;
      }
    }
    const cleanPayload = {
      name: formatTitleCase(formData.name),
      phone: formatPhoneNumber(formData.phone),
      city: formatTitleCase(formData.city),
      state: formatTitleCase(formData.state),
      about: formData.about ? formData.about.trim() : '',
    };
    setSaving(true);
    const res = await updateProfile(cleanPayload);
    setSaving(false);
    if (res?.success) {
      setFormData(cleanPayload);
      setIsDirty(false);
    }
  };

  const handleReset = () => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        city: user.city || 'Bengaluru',
        state: user.state || 'Karnataka',
        about: user.about || '',
      });
      setIsDirty(false);
    }
  };

  const handleAvatarChange = () => {
    const newAvatar = window.prompt('Enter image URL for your profile picture:', user?.avatar || '');
    if (newAvatar !== null && newAvatar.trim() !== '') {
      updateProfile({ avatar: newAvatar.trim() });
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm('Are you sure you want to permanently delete your account and all associated data? This action cannot be undone.')) {
      await deleteAccount();
      navigate('/');
    }
  };

  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';

  return (
    <div className="dashboard-wrapper">
      {/* SIDEBAR */}
      <aside className="sidebar">
        {user?.role === 'admin' ? (
          <>
            <div className="sidebar-brand">
              <div className="logo-icon bg-amber-500 text-white">
                <ShieldCheck size={20} />
              </div>
              <div>
                <div className="brand-text">
                  <Link to="/">
                    Estate<span>Xplorer</span>
                  </Link>
                </div>
                <div className="role text-amber-600 font-bold">Admin Portal</div>
              </div>
            </div>

            <nav className="sidebar-nav">
              <div className="nav-section">
                <div className="nav-section-label">Main</div>
                <Link className="nav-item flex items-center gap-3" to="/dashboard">
                  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
                  <span>Dashboard</span>
                </Link>
              </div>

              <div className="nav-section">
                <div className="nav-section-label">Management</div>
                <Link
                  to="/dashboard?tab=requests"
                  className="nav-item w-full text-left flex items-center justify-between"
                >
                  <span className="flex items-center gap-3">
                    <Clock size={18} className="shrink-0" />
                    <span>Role Requests</span>
                  </span>
                  {adminPendingCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[0.65rem] font-bold rounded-full bg-amber-500 text-white">
                      {adminPendingCount}
                    </span>
                  )}
                </Link>

                <Link
                  to="/dashboard?tab=kyc"
                  className="nav-item w-full text-left flex items-center justify-between"
                >
                  <span className="flex items-center gap-3">
                    <ShieldCheck size={18} className="shrink-0" />
                    <span>KYC Verifications</span>
                  </span>
                  {adminPendingKycCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[0.65rem] font-bold rounded-full bg-blue-600 text-white animate-pulse">
                      {adminPendingKycCount}
                    </span>
                  )}
                </Link>

                <Link
                  to="/dashboard?tab=grant"
                  className="nav-item w-full text-left flex items-center gap-3"
                >
                  <Shield size={18} className="shrink-0" />
                  <span>Role Management</span>
                </Link>

                <Link
                  to="/dashboard?tab=users"
                  className="nav-item w-full text-left flex items-center gap-3"
                >
                  <Users size={18} className="shrink-0" />
                  <span>User Management</span>
                </Link>

                <Link
                  to="/dashboard?tab=messages"
                  className="nav-item w-full text-left flex items-center justify-between"
                >
                  <span className="flex items-center gap-3">
                    <MessageSquare size={18} className="shrink-0" />
                    <span>Direct Inquiries</span>
                  </span>
                  {adminNewContactsCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[0.65rem] font-bold rounded-full bg-blue-600 text-white animate-pulse">
                      {adminNewContactsCount}
                    </span>
                  )}
                </Link>
              </div>

              <div className="nav-section">
                <div className="nav-section-label">Account</div>
                <Link className="nav-item active flex items-center gap-3" to="/dashboard/profile">
                  <UserCheck size={18} className="shrink-0" />
                  <span>Admin Profile</span>
                </Link>
              </div>

              <div className="nav-section">
                <div className="nav-section-label">Navigation</div>
                <Link className="nav-item flex items-center gap-3" to="/">
                  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1"/></svg>
                  <span>Homepage</span>
                </Link>
                <Link className="nav-item flex items-center gap-3" to="/listings">
                  <Building2 size={18} className="shrink-0" />
                  <span>Browse Properties</span>
                </Link>
                <button
                  className="nav-item w-full text-left bg-transparent border-0 cursor-pointer flex items-center gap-3"
                  onClick={logout}
                >
                  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  <span>Sign Out</span>
                </button>
              </div>
            </nav>

            <div className="sidebar-footer">
              <Link to="/dashboard/profile" className="user-profile">
                <div className="user-avatar bg-amber-600">{initials}</div>
                <div className="user-info">
                  <div className="user-name">{user?.name || 'Administrator'}</div>
                  <div className="user-email">{user?.email || 'admin@estatexplorer.in'}</div>
                </div>
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="sidebar-brand">
              <div className="logo-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </div>
              <div>
                <div className="brand-text"><Link to="/">Estate<span>Xplorer</span></Link></div>
                <div className="role">{user?.role ? `${user.role.charAt(0).toUpperCase() + user.role.slice(1)} Account` : 'Buyer Account'}</div>
              </div>
            </div>

            <nav className="sidebar-nav">
              <div className="nav-section">
                <div className="nav-section-label">Main</div>
                <Link className="nav-item" to="/dashboard">
                  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
                  Dashboard
                </Link>
              </div>

              <div className="nav-section">
                <div className="nav-section-label">Saved &amp; Inquiries</div>
                <Link className="nav-item" to="/dashboard#saved-properties">
                  <Heart size={16} />
                  Saved Properties
                  {savedProperties.length > 0 && <span className="badge">{savedProperties.length}</span>}
                </Link>
                <Link className="nav-item" to="/dashboard#open-enquiries">
                  <MessageSquare size={16} />
                  My Enquiries
                  {inquiriesCount > 0 && <span className="badge">{inquiriesCount}</span>}
                </Link>
                <Link className="nav-item" to="/dashboard#site-visits">
                  <Calendar size={16} />
                  Site Visits
                  {visitsCount > 0 && <span className="badge warning">{visitsCount}</span>}
                </Link>
              </div>

              <div className="nav-section">
                <div className="nav-section-label">Account</div>
                <Link className="nav-item active" to="/dashboard/profile">
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
              <Link to="/dashboard/profile" className="user-profile">
                <div className="user-avatar" style={{ overflow: 'hidden' }}>
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : initials}
                </div>
                <div className="user-info">
                  <div className="user-name">{user?.name || 'User Name'}</div>
                  <div className="user-email">{user?.email || 'user@email.com'}</div>
                </div>
              </Link>
            </div>
          </>
        )}
      </aside>

      {/* MAIN */}
      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="page-title" style={{ margin: 0, paddingLeft: '8px' }}>
              {user?.role === 'admin' ? 'Administrator Profile' : 'My Profile'}
            </h1>
          </div>
        </header>

        <div className="content">
          {/* Profile hero */}
          <div className="profile-hero">
            <div className="profile-avatar-wrap">
              <div className="profile-avatar" style={{ overflow: 'hidden' }}>
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : initials}
              </div>
              <button className="avatar-edit" title="Change photo" onClick={handleAvatarChange}>
                <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </button>
            </div>
            <div className="profile-hero-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 className="profile-name" style={{ margin: 0 }}>{user?.name || 'User Name'}</h2>
                {user?.role === 'admin' ? (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                    Platform Administrator
                  </span>
                ) : (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #dbeafe' }}>
                    Buyer Account
                  </span>
                )}
              </div>
              <p className="profile-email">{user?.email || 'user@email.com'}</p>
              <div className="profile-meta">
                <span>
                  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
                  {user?.phone ? formatPhoneNumber(user.phone) : 'Add Phone'}
                </span>
                <span>
                  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {user?.city ? `${user.city}, India` : 'India'}
                </span>
                <span>
                  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  Joined {new Date(user?.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          {/* Role Selection & Switching */}
          <RoleManagementSection />

          {/* Security & Account Verification */}
          <div style={{ marginTop: '24px', marginBottom: '24px' }}>
            <SecuritySettingsSection />
          </div>

          {/* Personal Information */}
          <div className="section-card" id="personal">
            <div className="section-header">
              <h3 className="section-title">Personal Information</h3>
              {isDirty && (
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--amber)', background: 'rgba(217, 119, 6, 0.1)', padding: '3px 8px', borderRadius: '4px' }}>
                  Unsaved changes
                </span>
              )}
            </div>
            <div className="section-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    className="form-input"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    disabled={saving}
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    className="form-input"
                    type="email"
                    value={user?.email || ''}
                    disabled={true}
                  />
                  <div className="form-hint">Email address cannot be changed directly.</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    className="form-input"
                    type="tel"
                    name="phone"
                    placeholder="+91 7600973093"
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={saving}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input
                    className="form-input"
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    disabled={saving}
                    placeholder="e.g. Bengaluru"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">State / Union Territory</label>
                  <select
                    className="form-input"
                    name="state"
                    value={formData.state || ''}
                    onChange={handleChange}
                    disabled={saving}
                    style={{ background: '#fff' }}
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group full">
                  <label className="form-label">About / Notes</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    name="about"
                    value={formData.about}
                    onChange={handleChange}
                    disabled={saving}
                    placeholder="Looking for a 3 BHK near Whitefield with good schools nearby..."
                  />
                </div>
              </div>

              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                {isDirty && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={handleReset}
                    disabled={saving}
                    style={{ padding: '9px 18px', fontSize: '0.85rem' }}
                  >
                    Discard Changes
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                  style={{ padding: '9px 22px', fontSize: '0.85rem' }}
                >
                  {saving ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>


          {/* Danger zone */}
          <div className="section-card danger-zone">
            <div className="section-header">
              <h3 className="section-title">Delete your account</h3>
            </div>
            <div className="section-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>Permanently delete your account and all data. This cannot be undone.</p>
                </div>
                <button className="btn-danger" onClick={handleDeleteAccount}>Delete Account</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuyerProfile;
