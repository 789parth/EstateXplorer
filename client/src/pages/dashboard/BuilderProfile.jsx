import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { INDIAN_STATES } from '../../utils/indianStates';
import RoleManagementSection from '../../components/dashboard/RoleManagementSection';
import SecuritySettingsSection from '../../components/dashboard/SecuritySettingsSection';
import { formatPhoneNumber, formatTitleCase, formatCode, sanitizeInput, isValidIndianMobile } from '../../utils/formatters';
import { uploadImage, getMyProperties, getMyInquiries } from '../../services/propertyService';
import { getBuilderPartnerships } from '../../services/partnershipService';
import {
  Upload,
  FileText,
  Trash2,
  Eye,
  Plus,
  CheckCircle2,
  Clock,
  X,
  LayoutDashboard,
  UserCheck,
  TrendingUp,
  Building2,
  MessageSquare,
  Calendar,
  ShieldCheck,
  Users,
} from 'lucide-react';
import './BuilderDashboard.css';
import './BuilderProfile.css';

const BuilderProfile = () => {
  const { user, deleteAccount, updateProfile, showToast, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('company');
  const [saving, setSaving] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInputRef = useRef(null);
  const [replaceTargetIndex, setReplaceTargetIndex] = useState(null);

  const [documents, setDocuments] = useState(() => {
    if (user?.builderProfile?.documents && user.builderProfile.documents.length > 0) {
      return user.builderProfile.documents;
    }
    return [];
  });

  // Sidebar badge counts
  const [projectCount, setProjectCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [visitCount, setVisitCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

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
            setProjectCount(propsRes.value.data.length);
          }
          if (inqsRes.status === 'fulfilled' && inqsRes.value?.success && Array.isArray(inqsRes.value.data)) {
            const inqs = inqsRes.value.data;
            setNewCount(inqs.filter((e) => e.status === 'new').length);
            setVisitCount(inqs.filter((e) => e.status === 'visit').length);
          }
          if (partRes.status === 'fulfilled' && partRes.value?.success && Array.isArray(partRes.value.data)) {
            const pending = partRes.value.data.filter(p => p.status === 'pending');
            setPendingRequestsCount(pending.length > 0 ? pending.length : partRes.value.data.length);
          }
        }
      } catch (err) {
        console.error('Error fetching builder counts in profile:', err);
      }
    };
    fetchCounts();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (user?.builderProfile?.documents && user.builderProfile.documents.length > 0) {
      setDocuments(user.builderProfile.documents);
    }
  }, [user]);

  const [formData, setFormData] = useState({
    companyName: user?.builderProfile?.companyName || user?.name || '',
    displayName: user?.builderProfile?.displayName || '',
    yearEstablished: user?.builderProfile?.yearEstablished || '',
    tagline: user?.builderProfile?.tagline || '',
    about: user?.about || '',
    city: user?.city || '',
    state: user?.builderProfile?.state || 'Haryana',
    address: user?.builderProfile?.address || '',
    website: user?.builderProfile?.website || '',
    cin: user?.builderProfile?.cin || '',
    reraId: user?.builderProfile?.reraId || '',
    reraState: user?.builderProfile?.reraState || 'Haryana',
    gst: user?.builderProfile?.gst || '',
    pan: user?.builderProfile?.pan || '',
    contactPerson: user?.builderProfile?.contactPerson || '',
    designation: user?.builderProfile?.designation || '',
    email: user?.email || '',
    phone: user?.phone || '',
    alternatePhone: user?.builderProfile?.alternatePhone || '',
    whatsapp: user?.builderProfile?.whatsapp || '',
    headOffice: user?.builderProfile?.headOffice || '',
    salesOfficeDelhi: user?.builderProfile?.salesOfficeDelhi || '',
    salesOfficeMumbai: user?.builderProfile?.salesOfficeMumbai || '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (formData.phone && formData.phone.trim() && !isValidIndianMobile(formData.phone)) {
      showToast('Please enter a valid 10-digit primary phone number starting with 6, 7, 8, or 9', 'error');
      return;
    }
    if (formData.alternatePhone && formData.alternatePhone.trim() && !isValidIndianMobile(formData.alternatePhone)) {
      showToast('Please enter a valid 10-digit alternate phone number starting with 6, 7, 8, or 9', 'error');
      return;
    }
    if (formData.whatsapp && formData.whatsapp.trim() && !isValidIndianMobile(formData.whatsapp)) {
      showToast('Please enter a valid 10-digit WhatsApp phone number starting with 6, 7, 8, or 9', 'error');
      return;
    }

    setSaving(true);
    const cleanCompany = sanitizeInput(formData.companyName);
    const cleanDisplay = sanitizeInput(formData.displayName);
    const cleanCity = formatTitleCase(formData.city);
    const cleanState = formatTitleCase(formData.state);
    const cleanPhone = formatPhoneNumber(formData.phone);
    const cleanAltPhone = formatPhoneNumber(formData.alternatePhone);
    const cleanWhatsapp = formatPhoneNumber(formData.whatsapp);
    const cleanRera = formatCode(formData.reraId);
    const cleanPan = formatCode(formData.pan);
    const cleanGst = formatCode(formData.gst);
    const cleanCin = formatCode(formData.cin);

    const profileData = {
      name: cleanCompany || user?.name,
      phone: cleanPhone,
      city: cleanCity,
      about: formData.about ? formData.about.trim() : '',
      builderProfile: {
        companyName: cleanCompany,
        displayName: cleanDisplay,
        yearEstablished: sanitizeInput(formData.yearEstablished),
        tagline: sanitizeInput(formData.tagline),
        state: cleanState,
        address: sanitizeInput(formData.address),
        website: formData.website ? formData.website.trim() : '',
        cin: cleanCin,
        reraId: cleanRera,
        reraState: cleanState,
        gst: cleanGst,
        pan: cleanPan,
        contactPerson: formatTitleCase(formData.contactPerson),
        designation: sanitizeInput(formData.designation),
        alternatePhone: cleanAltPhone,
        whatsapp: cleanWhatsapp,
        headOffice: sanitizeInput(formData.headOffice),
        salesOfficeDelhi: sanitizeInput(formData.salesOfficeDelhi),
        salesOfficeMumbai: sanitizeInput(formData.salesOfficeMumbai),
        documents: documents,
      }
    };
    const res = await updateProfile(profileData);
    setSaving(false);
    if (res?.success) {
      showToast('Profile & settings saved successfully!', 'success');
    }
  };

  // Upload or replace verification document
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('File size exceeds maximum 5 MB limit.', 'error');
      return;
    }

    try {
      setUploadingDoc(true);
      const res = await uploadImage(file);
      const fileUrl = res?.data?.url || res?.url;
      const fileName = file.name.replace(/\.[^/.]+$/, "");
      const fileSize = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
      const fileExt = file.name.split('.').pop().toUpperCase();

      let updatedDocs = [...documents];

      if (replaceTargetIndex !== null && replaceTargetIndex >= 0) {
        updatedDocs[replaceTargetIndex] = {
          ...updatedDocs[replaceTargetIndex],
          url: fileUrl,
          size: fileSize,
          type: fileExt,
          uploadedAt: new Date().toISOString(),
          status: 'verified',
        };
        setReplaceTargetIndex(null);
        showToast('Document replaced successfully!', 'success');
      } else {
        updatedDocs.push({
          name: fileName,
          url: fileUrl,
          size: fileSize,
          type: fileExt,
          uploadedAt: new Date().toISOString(),
          status: 'verified',
        });
        showToast('Document uploaded successfully!', 'success');
      }

      setDocuments(updatedDocs);

      // Persist to user profile immediately
      await updateProfile({
        builderProfile: {
          ...user?.builderProfile,
          documents: updatedDocs,
        }
      });
    } catch (err) {
      console.error('Document upload error:', err);
      showToast('Failed to upload document. Please try again.', 'error');
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTriggerUpload = (index = null) => {
    setReplaceTargetIndex(index);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleDeleteDocument = async (index) => {
    if (window.confirm('Are you sure you want to remove this verification document?')) {
      const updatedDocs = documents.filter((_, i) => i !== index);
      setDocuments(updatedDocs);
      await updateProfile({
        builderProfile: {
          ...user?.builderProfile,
          documents: updatedDocs,
        }
      });
      showToast('Document removed.', 'info');
    }
  };


  const handleDeleteAccount = async () => {
    if (window.confirm('Are you sure you want to permanently delete your builder account and all associated projects? This action cannot be undone.')) {
      await deleteAccount();
      window.location.replace('/');
    }
  };

  const [toggles, setToggles] = useState({
    twoFactor: false,
    emailAlerts: true,
    smsAlerts: true,
  });

  const handleToggle = (key) => {
    setToggles(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const companyName = formData.companyName || user?.name || 'Your Company';
  const initials = companyName.substring(0, 2).toUpperCase();

  return (
    <div className="builder-wrapper">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div>
            <div className="brand-text">Estate<span>Xplorer</span></div>
            <div className="role">Builder Portal</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-label">Management</div>
            <Link
              to="/dashboard?tab=overview"
              className="nav-item w-full text-left flex items-center gap-2"
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </Link>

            <Link
              to="/dashboard?tab=projects"
              className="nav-item w-full text-left flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <Building2 size={18} />
                <span>Projects & Listings</span>
              </span>
              {projectCount > 0 && <span className="nav-badge nav-badge-neutral">{projectCount}</span>}
            </Link>

            <Link
              to="/dashboard?tab=leads"
              className="nav-item w-full text-left flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <MessageSquare size={18} />
                <span>Property Inquiries</span>
              </span>
              {newCount > 0 && (
                <span className="nav-badge nav-badge-blue">{newCount}</span>
              )}
            </Link>

            <Link
              to="/dashboard?tab=visits"
              className="nav-item w-full text-left flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <Calendar size={18} />
                <span>Site Visit Bookings</span>
              </span>
              {visitCount > 0 && (
                <span className="nav-badge nav-badge-amber">{visitCount}</span>
              )}
            </Link>

            <Link
              to="/dashboard?tab=requests"
              className="nav-item w-full text-left flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <Users size={18} />
                <span>Agent Requests</span>
              </span>
              {pendingRequestsCount > 0 && (
                <span className="nav-badge nav-badge-amber">{pendingRequestsCount}</span>
              )}
            </Link>
          </div>

          <div className="nav-section">
            <div className="nav-section-label">Account & System</div>
            <Link className="nav-item active flex items-center gap-2" to="/dashboard/profile">
              <ShieldCheck size={18} />
              <span>Profile</span>
            </Link>
            <Link className="nav-item" to="/">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" /></svg>
              Homepage
            </Link>
            <Link className="nav-item" to="/listings">
              <Eye size={18} />
              Browse Market
            </Link>
            <button
              className="nav-item w-full text-left bg-transparent border-0 cursor-pointer flex items-center gap-2"
              onClick={logout}
            >
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              <span>Sign Out</span>
            </button>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="builder-profile">
            <div className="builder-avatar">{initials}</div>
            <div className="builder-info">
              <div className="builder-name">{companyName}</div>
              <div className="builder-company">Builder Account</div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main">
        <div className="topbar">
          <div className="topbar-left">
            <h1 className="page-title">My Profile</h1>
          </div>
          <div className="topbar-actions" style={{ display: 'flex', gap: '10px' }}>
            {/* <button className="btn btn-outline" style={{ padding: '9px 18px', borderRadius: '8px', border: '1.5px solid var(--border-strong)', background: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>View Public Profile</button> */}
            <button
              className="btn btn-primary"
              onClick={handleSave}
              style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: saving ? '#1a7a4c' : 'var(--navy)', color: '#fff', fontSize: '0.85rem', fontWeight: 600, transition: 'background 0.2s' }}
            >
              {saving ? 'Saved' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div className="content">
          {/* Hero */}
          <div className="profile-hero">
            <div className="logo-wrap">
              <div className="company-logo">{initials}</div>
              <button className="logo-edit" title="Change logo">
                <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
              </button>
            </div>
            <div className="hero-info">
              <div className="hero-name">{companyName}</div>
              <div className="hero-meta">{user?.email || 'admin@dlf.in'} · Gurugram, Haryana</div>
              <div className="hero-badges">
                <span className="badge badge-success">Verified Builder</span>
                <span className="badge badge-info">RERA Registered</span>
                <span className="badge badge-muted">Member since 2019</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button className={`tab ${activeTab === 'company' ? 'active' : ''}`} onClick={() => setActiveTab('company')}>Company Details</button>
            <button className={`tab ${activeTab === 'contact' ? 'active' : ''}`} onClick={() => setActiveTab('contact')}>Contact & Offices</button>
            <button className={`tab ${activeTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveTab('documents')}>Documents</button>
            <button className={`tab ${activeTab === 'roles' ? 'active' : ''}`} onClick={() => setActiveTab('roles')}>Roles & Access</button>
            <button className={`tab ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>Security</button>
          </div>

          {/* ========== ROLES & ACCESS ========== */}
          {activeTab === 'roles' && (
            <div className="tab-panel active">
              <RoleManagementSection />
            </div>
          )}

          {/* ========== COMPANY DETAILS ========== */}
          {activeTab === 'company' && (
            <div className="tab-panel active">
              <div className="form-card">
                <div className="form-card-title">Basic Information</div>
                <div className="form-card-desc">This information appears on your public builder profile.</div>
                <div className="form-grid">
                  <div className="form-group span-2">
                    <label>Company Name <span className="req">*</span></label>
                    <input type="text" name="companyName" value={formData.companyName} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>Display Name</label>
                    <input type="text" name="displayName" value={formData.displayName} onChange={handleChange} />
                    <div className="form-hint">Short name shown on listings</div>
                  </div>
                  <div className="form-group">
                    <label>Year Established</label>
                    <input type="text" name="yearEstablished" value={formData.yearEstablished} onChange={handleChange} />
                  </div>
                  <div className="form-group span-2">
                    <label>Tagline</label>
                    <input type="text" name="tagline" value={formData.tagline} onChange={handleChange} />
                  </div>
                  <div className="form-group span-2">
                    <label>About Company</label>
                    <textarea name="about" value={formData.about} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>Headquarters City</label>
                    <input type="text" name="city" value={formData.city} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>State</label>
                    <select name="state" value={formData.state} onChange={handleChange}>
                      <option value="">Select State</option>
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group span-2">
                    <label>Full Address</label>
                    <input type="text" name="address" value={formData.address} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>Website</label>
                    <input type="url" name="website" value={formData.website} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>CIN / Company Registration</label>
                    <input type="text" name="cin" value={formData.cin} onChange={handleChange} />
                  </div>
                </div>
              </div>

              <div className="form-card">
                <div className="form-card-title">RERA & Compliance</div>
                <div className="form-card-desc">Official registration details for buyer trust.</div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>RERA Registration Number</label>
                    <input type="text" name="reraId" value={formData.reraId} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>RERA State</label>
                    <select name="reraState" value={formData.reraState} onChange={handleChange}>
                      <option value="">Select RERA State</option>
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>GST Number</label>
                    <input type="text" name="gst" value={formData.gst} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>PAN</label>
                    <input type="text" name="pan" value={formData.pan} onChange={handleChange} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========== CONTACT ========== */}
          {activeTab === 'contact' && (
            <div className="tab-panel active">
              <div className="form-card">
                <div className="form-card-title">Primary Contact</div>
                <div className="form-card-desc">Used for platform communication and shown to buyers when appropriate.</div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Contact Person Name <span className="req">*</span></label>
                    <input type="text" name="contactPerson" value={formData.contactPerson} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>Designation</label>
                    <input type="text" name="designation" value={formData.designation} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>Email <span className="req">*</span></label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>Phone <span className="req">*</span></label>
                    <input type="tel" name="phone" placeholder="+91 7600973093" value={formData.phone} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>Alternate Phone</label>
                    <input type="tel" name="alternatePhone" placeholder="+91 7600973093" value={formData.alternatePhone} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>WhatsApp Number</label>
                    <input type="tel" name="whatsapp" placeholder="+91 7600973093" value={formData.whatsapp} onChange={handleChange} />
                  </div>
                </div>
              </div>

              <div className="form-card">
                <div className="form-card-title">Office Locations</div>
                <div className="form-card-desc">Add regional offices where buyers can visit.</div>
                <div className="form-grid">
                  <div className="form-group span-2">
                    <label>Head Office</label>
                    <input type="text" name="headOffice" value={formData.headOffice} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>Sales Office – Delhi NCR</label>
                    <input type="text" name="salesOfficeDelhi" value={formData.salesOfficeDelhi} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>Sales Office – Mumbai</label>
                    <input type="text" name="salesOfficeMumbai" value={formData.salesOfficeMumbai} onChange={handleChange} placeholder="Add address" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========== DOCUMENTS ========== */}
          {activeTab === 'documents' && (
            <div className="tab-panel active">
              <div className="form-card">
                <div className="form-card-title">Verification Documents</div>
                <div className="form-card-desc">Upload documents for account verification. Verified builders get a trust badge on listings.</div>

                {/* Hidden file input for uploading or replacing */}
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                />

                {documents.length > 0 && (
                  <div className="doc-list" style={{ marginBottom: '16px' }}>
                    {documents.map((doc, idx) => (
                      <div className="doc-item" key={idx}>
                        <div className="doc-icon">
                          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                        </div>
                        <div className="doc-info">
                          <div className="doc-name">{doc.name}</div>
                          <div className="doc-meta">
                            {doc.type || 'PDF'} · {doc.size || '1.0 MB'} · {doc.uploadedAt ? `Uploaded ${new Date(doc.uploadedAt).toLocaleDateString()}` : 'Uploaded'}
                          </div>
                        </div>
                        <span className={`doc-status ${doc.status === 'verified' ? 'verified' : 'pending'}`}>
                          {doc.status === 'verified' ? 'Verified' : 'Under Review'}
                        </span>
                        <div className="doc-actions">
                          {doc.url ? (
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="doc-btn"
                              style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
                            >
                              View
                            </a>
                          ) : (
                            <button
                              type="button"
                              className="doc-btn"
                              onClick={() => showToast('Document preview is available after upload', 'info')}
                            >
                              View
                            </button>
                          )}
                          <button
                            type="button"
                            className="doc-btn"
                            onClick={() => handleTriggerUpload(idx)}
                            disabled={uploadingDoc}
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            className="doc-btn"
                            style={{ color: 'var(--danger)' }}
                            onClick={() => handleDeleteDocument(idx)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div
                  className="upload-zone"
                  onClick={() => !uploadingDoc && handleTriggerUpload(null)}
                  style={{ cursor: uploadingDoc ? 'wait' : 'pointer' }}
                >
                  {uploadingDoc ? (
                    <div>
                      <strong>Uploading document to MongoDB Atlas...</strong><br />
                      <span style={{ fontSize: '.78rem' }}>Please wait a moment...</span>
                    </div>
                  ) : (
                    <div>
                      <strong>Click to upload</strong> or drag and drop<br />
                      <span style={{ fontSize: '.78rem' }}>PDF, JPG or PNG · Max 5 MB</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========== SECURITY ========== */}
          {activeTab === 'security' && (
            <div className="tab-panel active">
              <SecuritySettingsSection />

              <div className="form-card" style={{ marginTop: '20px' }}>
                <div className="security-row" style={{ borderBottom: 'none' }}>
                  <div className="security-info">
                    <strong style={{ color: 'var(--danger)' }}>Delete Account</strong>
                    <span>Permanently delete your account and all associated projects from the database.</span>
                  </div>
                  <button onClick={handleDeleteAccount} className="btn btn-outline" style={{ padding: '7px 14px', borderRadius: '8px', borderColor: 'var(--danger)', color: 'var(--danger)' }}>Delete Account</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BuilderProfile;
