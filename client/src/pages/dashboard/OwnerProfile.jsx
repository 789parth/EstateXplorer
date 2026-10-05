import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, Users, Eye, Trash2, Calendar, Handshake } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getMyProperties, getMyInquiries } from '../../services/propertyService';
import { getBuilderPartnerships } from '../../services/partnershipService';
import { INDIAN_STATES } from '../../utils/indianStates';
import { formatPhoneNumber, formatTitleCase, sanitizeInput, isValidIndianMobile } from '../../utils/formatters';
import RoleManagementSection from '../../components/dashboard/RoleManagementSection';
import SecuritySettingsSection from '../../components/dashboard/SecuritySettingsSection';
import './BuilderDashboard.css';

const OwnerProfile = () => {
  const { user, updateProfile, deleteAccount, logout, showToast } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    city: user?.city || '',
    state: user?.state || user?.ownerProfile?.state || 'Gujarat',
    about: user?.about || '',
    ownerProfile: {
      address: user?.ownerProfile?.address || '',
      city: user?.ownerProfile?.city || '',
      state: user?.state || user?.ownerProfile?.state || 'Gujarat',
      preferredContactTime: user?.ownerProfile?.preferredContactTime || 'Anytime',
    },
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        city: user.city || '',
        state: user.state || user.ownerProfile?.state || 'Gujarat',
        about: user.about || '',
        ownerProfile: {
          address: user.ownerProfile?.address || '',
          city: user.ownerProfile?.city || '',
          state: user.state || user.ownerProfile?.state || 'Gujarat',
          preferredContactTime: user.ownerProfile?.preferredContactTime || 'Anytime',
        },
      });
    }
  }, [user]);

  // Sidebar badge counts
  const [propertiesCount, setPropertiesCount] = useState(0);
  const [inquiriesCount, setInquiriesCount] = useState(0);
  const [visitCount, setVisitCount] = useState(0);
  const [agentPartnersCount, setAgentPartnersCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchCounts = async () => {
      try {
        const [propsRes, inqsRes, partRes] = await Promise.allSettled([
          getMyProperties(),
          getMyInquiries(),
          getBuilderPartnerships(),
        ]);

        if (isMounted) {
          if (propsRes.status === 'fulfilled' && propsRes.value?.success && Array.isArray(propsRes.value.data)) {
            setPropertiesCount(propsRes.value.data.length);
          }
          if (inqsRes.status === 'fulfilled' && inqsRes.value?.success && Array.isArray(inqsRes.value.data)) {
            const inqs = inqsRes.value.data;
            setInquiriesCount(inqs.length);
            setVisitCount(inqs.filter((e) => e.status === 'visit').length);
          }
          if (partRes.status === 'fulfilled' && partRes.value?.success && Array.isArray(partRes.value.data)) {
            const parts = partRes.value.data;
            const pending = parts.filter((p) => p.status === 'pending');
            const approved = parts.filter((p) => p.status === 'approved' || p.status === 'accepted');
            setAgentPartnersCount(pending.length > 0 ? pending.length : approved.length);
          }
        }
      } catch (err) {
        console.error('Error fetching owner counts in profile:', err);
      }
    };
    fetchCounts();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('ownerProfile.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        ownerProfile: { ...prev.ownerProfile, [field]: value },
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    if (formData.phone && formData.phone.trim() && !isValidIndianMobile(formData.phone)) {
      showToast('Please enter a valid 10-digit phone number starting with 6, 7, 8, or 9', 'error');
      return;
    }

    setSaving(true);
    const cleanName = formatTitleCase(formData.name);
    const cleanCity = formatTitleCase(formData.city);
    const cleanState = formatTitleCase(formData.state);
    const cleanPhone = formatPhoneNumber(formData.phone);

    const cleanPayload = {
      name: cleanName,
      phone: cleanPhone,
      city: cleanCity,
      state: cleanState,
      about: formData.about ? formData.about.trim() : '',
      ownerProfile: {
        address: sanitizeInput(formData.ownerProfile?.address),
        city: cleanCity,
        state: cleanState,
        preferredContactTime: sanitizeInput(formData.ownerProfile?.preferredContactTime),
      }
    };
    const res = await updateProfile(cleanPayload);
    setSaving(false);
    if (res?.success) {
      setFormData(cleanPayload);
      setEditing(false);
      showToast('Owner profile updated successfully', 'success');
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm('Are you sure you want to permanently delete your account and all associated listings? This action cannot be undone.')) {
      await deleteAccount();
      navigate('/');
    }
  };

  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'OW';

  return (
    <div className="builder-wrapper">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div>
            <div className="brand-text"><Link to="/">Estate<span>Xplorer</span></Link></div>
            <div className="role">Owner Portal</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-label">Main</div>
            <Link className="nav-item" to="/dashboard?tab=overview">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
              Dashboard
            </Link>
          </div>

          <div className="nav-section">
            <div className="nav-section-label">My Real Estate</div>
            <Link className="nav-item" to="/dashboard?tab=listings">
              <Home size={18} />
              My Properties
              {propertiesCount > 0 && <span className="badge">{propertiesCount}</span>}
            </Link>
            <Link className="nav-item" to="/dashboard?tab=leads">
              <Users size={18} />
              Property Inquiries
              {inquiriesCount > 0 && <span className="badge">{inquiriesCount}</span>}
            </Link>
            <Link className="nav-item" to="/dashboard?tab=visits">
              <Calendar size={18} />
              Site Visits
              {visitCount > 0 && <span className="badge warning">{visitCount}</span>}
            </Link>
          </div>

          <div className="nav-section">
            <div className="nav-section-label">Broker &amp; Agent Network</div>
            <Link className="nav-item flex items-center justify-between" to="/dashboard?tab=agents">
              <span className="flex items-center gap-2">
                <Handshake size={18} />
                <span>Agent Partners</span>
              </span>
              {agentPartnersCount > 0 && (
                <span className="badge success">{agentPartnersCount}</span>
              )}
            </Link>
          </div>

          <div className="nav-section">
            <div className="nav-section-label">Account</div>
            <Link className="nav-item active" to="/dashboard/profile">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Owner Profile
            </Link>
            <Link className="nav-item" to="/">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1"/></svg>
              Homepage
            </Link>
            <Link className="nav-item" to="/listings">
              <Eye size={18} />
              Browse Market
            </Link>
            <button
              className="nav-item w-full text-left bg-transparent border-0"
              onClick={logout}
            >
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sign Out
            </button>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="builder-profile" onClick={() => navigate('/dashboard/profile')}>
            <div className="builder-avatar">{initials}</div>
            <div className="builder-info">
              <div className="builder-name">{user?.name}</div>
              <div className="builder-company">Property Owner</div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="main">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="page-title">Owner Profile Settings</h1>
          </div>
          <div className="topbar-right">
            {editing ? (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-secondary" onClick={() => setEditing(false)} disabled={saving}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            ) : (
              <button className="btn-primary" onClick={() => setEditing(true)}>
                Edit Profile
              </button>
            )}
          </div>
        </header>

        <div className="content">
          {/* Role Access & Switching */}
          <div style={{ marginBottom: '24px' }}>
            <RoleManagementSection />
          </div>

          {/* Security & Account Verification */}
          <div style={{ marginBottom: '24px' }}>
            <SecuritySettingsSection />
          </div>

          {/* Context Note */}
          <div style={{ marginBottom: '24px' }}>
            <p style={{ fontSize: '.95rem', color: 'var(--text-muted)' }}>
              Manage your homeowner contact information, preferred communication schedules, and account details.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            {/* 1. PERSONAL INFO CARD */}
            <div className="card" style={{ padding: '28px' }}>
              <div className="card-header" style={{ padding: '0 0 16px 0', borderBottom: '1px solid var(--border)' }}>
                <h3 className="card-title font-bold text-navy text-base">Personal Contact Details</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Full Name
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                    />
                  ) : (
                    <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.95rem' }}>{user?.name || '—'}</div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Email Address
                  </label>
                  <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.95rem' }}>{user?.email || '—'}</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Used for login and instant buyer inquiry notifications</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Phone / Mobile Number
                  </label>
                  {editing ? (
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+91 7600973093"
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                    />
                  ) : (
                    <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.95rem' }}>{user?.phone ? formatPhoneNumber(user.phone) : 'Not provided'}</div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Location / City
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="e.g. Anand, Vadodara"
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                    />
                  ) : (
                    <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.95rem' }}>{user?.city || 'Not specified'}</div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    State / Union Territory
                  </label>
                  {editing ? (
                    <select
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem', background: '#fff' }}
                    >
                      <option value="">Select State</option>
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.95rem' }}>{formData.state || user?.state || 'Not specified'}</div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. OWNER CONTACT PREFERENCES */}
            <div className="card" style={{ padding: '28px' }}>
              <div className="card-header" style={{ padding: '0 0 16px 0', borderBottom: '1px solid var(--border)' }}>
                <h3 className="card-title font-bold text-navy text-base">Communication Preferences</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Residential Address
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      name="ownerProfile.address"
                      value={formData.ownerProfile.address}
                      onChange={handleChange}
                      placeholder="e.g. 102 Green Acres, Nana Bazaar"
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                    />
                  ) : (
                    <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.95rem' }}>{user?.ownerProfile?.address || 'Not provided'}</div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Preferred Contact Hours
                  </label>
                  {editing ? (
                    <select
                      name="ownerProfile.preferredContactTime"
                      value={formData.ownerProfile.preferredContactTime}
                      onChange={handleChange}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                    >
                      <option value="Anytime">Anytime</option>
                      <option value="Morning (9 AM - 12 PM)">Morning (9 AM - 12 PM)</option>
                      <option value="Afternoon (12 PM - 5 PM)">Afternoon (12 PM - 5 PM)</option>
                      <option value="Evening (5 PM - 9 PM)">Evening (5 PM - 9 PM)</option>
                      <option value="Weekends Only">Weekends Only</option>
                    </select>
                  ) : (
                    <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.95rem' }}>{user?.ownerProfile?.preferredContactTime || 'Anytime'}</div>
                  )}
                </div>

                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                  <button
                    onClick={handleDeleteAccount}
                    style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, display: 'flex', itemsCenter: 'center', gap: '6px' }}
                  >
                    <Trash2 size={15} /> Delete Owner Account &amp; Listings
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerProfile;
