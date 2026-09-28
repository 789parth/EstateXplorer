import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Edit2,
  Trash2,
  Home,
  Users,
  Eye,
  Building2,
  Calendar,
  Clock,
  Check,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  ChevronDown,
  ExternalLink,
  MessageSquare,
  Download,
  Search,
  Filter,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  getMyProperties,
  deleteProperty,
  getMyInquiries,
  updateInquiryStatus,
  deleteInquiryApi,
  bulkDeleteInquiriesApi,
  replyToInquiryApi,
} from '../../services/propertyService';
import { formatPhoneNumber } from '../../utils/formatters';
import { broadcastRealtimeSync, useRealtimeSync, SYNC_EVENTS } from '../../utils/realtimeSync';
import AddPropertyModal from '../../components/dashboard/AddPropertyModal';
import './BuilderDashboard.css';

const OwnerDashboard = () => {
  const { user, showToast, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const validTabs = ['overview', 'listings', 'leads', 'visits'];
  const [activeTab, setActiveTab] = useState(validTabs.includes(tabFromUrl) ? tabFromUrl : 'overview');

  useEffect(() => {
    if (tabFromUrl && validTabs.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchParams({ tab: newTab });
  };

  const [enquiryTab, setEnquiryTab] = useState('all');

  // Properties state
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [propertySearch, setPropertySearch] = useState('');
  const [propertyStatusFilter, setPropertyStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editProperty, setEditProperty] = useState(null);

  // Inquiries & Visits state
  const [inquiries, setInquiries] = useState([]);
  const [inqLoading, setInqLoading] = useState(true);
  const [leadSearch, setLeadSearch] = useState('');
  const [expandedInquiryId, setExpandedInquiryId] = useState(null);
  const [selectedInquiryIds, setSelectedInquiryIds] = useState([]);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Reschedule Modal state
  const [rescheduleItem, setRescheduleItem] = useState(null);
  const [newVisitDate, setNewVisitDate] = useState('');
  const [newVisitTime, setNewVisitTime] = useState('');

  // Reply to Inquiry Modal state
  const [replyModalItem, setReplyModalItem] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const fetchProperties = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const res = await getMyProperties();
      if (res.success) setProperties(res.data);
    } catch (error) {
      console.error('Failed to fetch owner listings:', error);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, []);

  const fetchInquiries = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setInqLoading(true);
      const res = await getMyInquiries();
      if (res.success) setInquiries(res.data);
    } catch (error) {
      console.error('Failed to fetch owner inquiries:', error);
    } finally {
      if (!isBackground) setInqLoading(false);
    }
  }, []);

  // Real-time synchronization for inquiries and property listings (silent background updates)
  useRealtimeSync(
    [SYNC_EVENTS.INQUIRIES, SYNC_EVENTS.PROPERTIES],
    () => {
      fetchProperties(true);
      fetchInquiries(true);
    },
    { revalidateOnFocus: true, intervalMs: 15000 }
  );

  useEffect(() => {
    fetchProperties(false);
    fetchInquiries(false);
  }, [fetchProperties, fetchInquiries]);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this property listing?')) {
      try {
        const res = await deleteProperty(id);
        if (res.success) {
          broadcastRealtimeSync(SYNC_EVENTS.PROPERTIES, { action: 'deleted', id });
          showToast('Property deleted successfully', 'success');
          fetchProperties();
        }
      } catch (error) {
        showToast('Failed to delete property', 'error');
      }
    }
  };

  const handleToggleSelectInquiry = (id) => {
    setSelectedInquiryIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllInquiries = (currentTabIds) => {
    const allSelected = currentTabIds.length > 0 && currentTabIds.every((id) => selectedInquiryIds.includes(id));
    if (allSelected) {
      setSelectedInquiryIds((prev) => prev.filter((id) => !currentTabIds.includes(id)));
    } else {
      setSelectedInquiryIds((prev) => Array.from(new Set([...prev, ...currentTabIds])));
    }
  };

  const handleDeleteSingleInquiry = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this inquiry?')) return;
    try {
      const res = await deleteInquiryApi(id);
      if (res.success) {
        showToast('Inquiry deleted successfully', 'success');
        setInquiries((prev) => prev.filter((inq) => inq._id !== id));
        setSelectedInquiryIds((prev) => prev.filter((i) => i !== id));
        if (expandedInquiryId === id) setExpandedInquiryId(null);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete inquiry', 'error');
    }
  };

  const handleBulkDeleteInquiries = async () => {
    if (selectedInquiryIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedInquiryIds.length} selected inquiries?`)) return;
    try {
      const res = await bulkDeleteInquiriesApi(selectedInquiryIds);
      if (res.success) {
        showToast(`Successfully deleted ${res.deletedCount || selectedInquiryIds.length} inquiries`, 'success');
        setInquiries((prev) => prev.filter((inq) => !selectedInquiryIds.includes(inq._id)));
        setSelectedInquiryIds([]);
        if (selectedInquiryIds.includes(expandedInquiryId)) setExpandedInquiryId(null);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete inquiries', 'error');
    }
  };

  const handleStatusChange = async (inquiryId, newStatus, extraData = {}) => {
    setActionLoadingId(inquiryId);
    try {
      const res = await updateInquiryStatus(inquiryId, newStatus, {
        notes: extraData.notes,
        visitDate: extraData.visitDate,
        visitTime: extraData.visitTime,
      });
      if (res.success) {
        broadcastRealtimeSync(SYNC_EVENTS.INQUIRIES, { action: 'status_updated', id: inquiryId, status: newStatus });
        setInquiries((prev) =>
          prev.map((inq) =>
            inq._id === inquiryId
              ? {
                  ...inq,
                  ...(res.data || {}),
                  property:
                    res.data?.property && typeof res.data.property === 'object'
                      ? res.data.property
                      : inq.property,
                  status: newStatus,
                  ...extraData,
                }
              : inq
          )
        );
        showToast(
          newStatus === 'closed'
            ? 'Site tour confirmed and marked completed!'
            : newStatus === 'visit'
            ? 'Site visit updated and scheduled!'
            : `Inquiry status updated to ${newStatus}`,
          'success'
        );
      }
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to update inquiry status', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenReschedule = (visit) => {
    setRescheduleItem(visit);
    setNewVisitDate(visit.visitDate || '');
    setNewVisitTime(visit.visitTime || '');
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!rescheduleItem || !newVisitDate || !newVisitTime) {
      showToast('Please select date and time for rescheduling', 'error');
      return;
    }
    await handleStatusChange(rescheduleItem._id, 'visit', {
      visitDate: newVisitDate,
      visitTime: newVisitTime,
    });
    setRescheduleItem(null);
    setNewVisitDate('');
    setNewVisitTime('');
  };

  // Send Email Response to Buyer Inquiry and auto-delete inquiry from portal & DB
  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyModalItem || !replyMessage.trim()) {
      showToast('Please enter your reply message', 'error');
      return;
    }

    setSendingReply(true);
    try {
      const res = await replyToInquiryApi(replyModalItem._id, replyMessage.trim());
      if (res.success) {
        setInquiries((prev) => prev.filter((i) => i._id !== replyModalItem._id));
        setSelectedInquiryIds((prev) => prev.filter((id) => id !== replyModalItem._id));
        showToast('Reply emailed to buyer and inquiry closed!', 'success');
        setReplyModalItem(null);
        setReplyMessage('');
        broadcastRealtimeSync(SYNC_EVENTS.INQUIRIES);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to send reply email', 'error');
    } finally {
      setSendingReply(false);
    }
  };

  // CSV Inquiry Export
  const exportInquiriesCsv = () => {
    if (filteredInquiries.length === 0) {
      showToast('No inquiries available to export', 'info');
      return;
    }

    const headers = ['Buyer Name', 'Email', 'Property Title', 'Message', 'Date Received'];
    const rows = filteredInquiries.map((lead) => [
      `"${lead.name || ''}"`,
      `"${lead.email || ''}"`,
      `"${lead.property?.title || lead.propertyTitle || ''}"`,
      `"${(lead.message || '').replace(/"/g, '""')}"`,
      `"${new Date(lead.createdAt).toLocaleDateString()}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Property_Inquiries_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Inquiries CSV exported successfully!', 'success');
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return 'Recent';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (mins < 2) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    if (hrs < 24) return `${hrs} hrs ago`;
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  const getInitials = (name) => {
    if (!name) return 'OW';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  // Separate Property Inquiries from Site Visit Bookings
  const propertyInquiries = inquiries.filter((e) => !e.visitRequested && e.status !== 'visit');
  const siteVisitsList = inquiries.filter((e) => e.visitRequested || e.status === 'visit');

  // Filtered inquiries strictly for Property Inquiries Tab (no site visits, no phone search)
  const filteredInquiries = propertyInquiries.filter((e) => {
    if (!leadSearch) return true;
    const q = leadSearch.toLowerCase();
    return (
      (e.name && e.name.toLowerCase().includes(q)) ||
      (e.email && e.email.toLowerCase().includes(q)) ||
      (e.property?.title && e.property.title.toLowerCase().includes(q)) ||
      (e.propertyTitle && e.propertyTitle.toLowerCase().includes(q)) ||
      (e.message && e.message.toLowerCase().includes(q))
    );
  });

  // Filtered properties
  const filteredProperties = properties
    .filter((p) => {
      if (propertyStatusFilter === 'all') return true;
      return p.status === propertyStatusFilter;
    })
    .filter((p) => {
      if (!propertySearch) return true;
      const q = propertySearch.toLowerCase();
      return (
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.location?.city && p.location.city.toLowerCase().includes(q)) ||
        (p.location?.address && p.location.address.toLowerCase().includes(q))
      );
    });

  const newCount = inquiries.filter((e) => e.status === 'new').length;
  const visitCount = siteVisitsList.length;
  const contactedCount = inquiries.filter((e) => e.status === 'contacted').length;
  const closedCount = inquiries.filter((e) => e.status === 'closed').length;

  const totalViews = properties.reduce((acc, curr) => acc + (curr.visits || 0), 0);
  const initials = getInitials(user?.name);

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
            <button
              className={`nav-item w-full text-left bg-transparent border-0 ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => handleTabChange('overview')}
            >
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
              Dashboard
            </button>
          </div>

          <div className="nav-section">
            <div className="nav-section-label">My Real Estate</div>
            <button
              className={`nav-item w-full text-left bg-transparent border-0 ${activeTab === 'listings' ? 'active' : ''}`}
              onClick={() => handleTabChange('listings')}
            >
              <Home size={18} />
              My Properties
              <span className="badge">{properties.length}</span>
            </button>
            <button
              className={`nav-item w-full text-left bg-transparent border-0 ${activeTab === 'leads' ? 'active' : ''}`}
              onClick={() => handleTabChange('leads')}
            >
              <Users size={18} />
              Property Inquiries
              <span className="badge">{propertyInquiries.length}</span>
            </button>
            <button
              className={`nav-item w-full text-left bg-transparent border-0 ${activeTab === 'visits' ? 'active' : ''}`}
              onClick={() => handleTabChange('visits')}
            >
              <Calendar size={18} />
              Site Visits
              {siteVisitsList.length > 0 && <span className="badge warning">{siteVisitsList.length}</span>}
            </button>
          </div>

          <div className="nav-section">
            <div className="nav-section-label">Account</div>
            <Link className="nav-item" to="/dashboard/profile">
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
            <h1 className="page-title">
              {activeTab === 'overview' && 'Owner Dashboard'}
              {activeTab === 'listings' && 'My Listed Properties'}
              {activeTab === 'leads' && 'Property Inquiries'}
              {activeTab === 'visits' && 'Site Visit Appointments'}
            </h1>
          </div>
          <div className="topbar-right flex items-center gap-2">
            {activeTab === 'leads' && (
              <button
                className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3"
                onClick={exportInquiriesCsv}
                title="Export Inquiries to CSV"
              >
                <Download size={14} /> Export CSV
              </button>
            )}
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => { setEditProperty(null); setIsModalOpen(true); }}
            >
              <Plus size={16} /> Post New Property
            </button>
          </div>
        </header>

        <div className="content">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <>
              {/* Welcome Message */}
              <div style={{ marginBottom: '20px' }}>
                <p style={{ fontSize: '.92rem', color: 'var(--text-muted)' }}>
                  Welcome back, <strong style={{ color: 'var(--text)' }}>{user?.name}</strong> · Manage your direct resale and rental listings and respond to interested buyers.
                </p>
              </div>

              {/* 4 STATS CARDS */}
              <div className="stats-grid mb-6">
                <div className="stat-card cursor-pointer" onClick={() => handleTabChange('listings')}>
                  <div className="stat-header">
                    <div className="stat-icon blue">
                      <Home size={20} />
                    </div>
                    <span className="stat-trend up">Active</span>
                  </div>
                  <div className="stat-value">{loading ? '...' : properties.length}</div>
                  <div className="stat-label">Listed Properties</div>
                </div>

                <div className="stat-card cursor-pointer" onClick={() => handleTabChange('leads')}>
                  <div className="stat-header">
                    <div className="stat-icon emerald">
                      <Users size={20} />
                    </div>
                    <span className="stat-trend up">Active</span>
                  </div>
                  <div className="stat-value">{inqLoading ? '...' : propertyInquiries.length}</div>
                  <div className="stat-label">Property Inquiries</div>
                </div>

                <div className="stat-card cursor-pointer" onClick={() => handleTabChange('visits')}>
                  <div className="stat-header">
                    <div className="stat-icon orange">
                      <Calendar size={20} />
                    </div>
                    <span className="stat-trend up">{siteVisitsList.length} Tours</span>
                  </div>
                  <div className="stat-value">{inqLoading ? '...' : siteVisitsList.length}</div>
                  <div className="stat-label">Site Visits Requested</div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <div className="stat-icon navy">
                      <Eye size={20} />
                    </div>
                    <span className="stat-trend up">Live</span>
                  </div>
                  <div className="stat-value">{totalViews}</div>
                  <div className="stat-label">Total Buyer Views</div>
                </div>
              </div>

              {/* RECENT INQUIRIES (COMPACT SNAPSHOT) */}
              <div className="card mb-6">
                <div className="card-header flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="card-title text-base font-bold text-slate-900">Recent Inquiries</h2>
                    <span className="text-xs text-muted">Latest prospective buyers asking about your properties</span>
                  </div>
                  <button
                    onClick={() => handleTabChange('leads')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    View All ({propertyInquiries.length}) →
                  </button>
                </div>

                <div className="card-body p-3">
                  {inqLoading ? (
                    <div className="text-center py-6 text-xs text-slate-500">Loading inquiries...</div>
                  ) : propertyInquiries.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500">
                      No property inquiries yet. Direct questions from buyers will show up here.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {propertyInquiries.slice(0, 5).map((lead) => {
                        const isExpanded = expandedInquiryId === lead._id;
                        const isSelected = selectedInquiryIds.includes(lead._id);
                        const propTitle = lead.property?.title || lead.propertyTitle || 'Listing';

                        return (
                          <div
                            key={lead._id}
                            className={`py-2 px-2 rounded-lg transition-colors ${
                              isSelected ? 'bg-blue-50/50' : isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50/70'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              {/* Left: Checkbox + Avatar + Buyer & Listing Info */}
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectInquiry(lead._id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                                />

                                <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-700 font-bold text-[0.7rem] flex items-center justify-center shrink-0 border border-blue-100">
                                  {getInitials(lead.name)}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                                    <span>{lead.name}</span>
                                    <span className="text-slate-300 font-normal">·</span>
                                    {lead.property?._id ? (
                                      <Link
                                        to={`/property/${lead.property._id}`}
                                        className="text-blue-600 hover:underline font-normal truncate max-w-[200px]"
                                        title={propTitle}
                                      >
                                        {propTitle}
                                      </Link>
                                    ) : (
                                      <span className="text-slate-600 font-normal truncate max-w-[200px]" title={propTitle}>
                                        {propTitle}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[0.7rem] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                                    <Mail size={11} className="text-slate-400 shrink-0" />
                                    <span className="truncate">{lead.email}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Right: Time + Reply + View + Delete */}
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[0.68rem] text-slate-400 hidden sm:inline">
                                  {formatTime(lead.createdAt)}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyModalItem(lead);
                                    setReplyMessage('');
                                  }}
                                  className="px-2.5 py-1 rounded-md text-[0.68rem] font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 transition-colors cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                                  title="Reply via Email"
                                >
                                  <Mail size={11} className="shrink-0" />
                                  <span className="whitespace-nowrap">Reply</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setExpandedInquiryId(isExpanded ? null : lead._id)}
                                  className="px-2 py-1 rounded text-[0.68rem] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                                >
                                  <Eye size={11} />
                                  <span>{isExpanded ? 'Hide' : 'View'}</span>
                                </button>

                                <button
                                  type="button"
                                  title="Delete Inquiry"
                                  onClick={(e) => handleDeleteSingleInquiry(lead._id, e)}
                                  className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            {/* Collapsible Row Details */}
                            {isExpanded && (
                              <div className="mt-2 pt-2 border-t border-slate-100 bg-slate-50/80 p-3 rounded text-xs space-y-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[0.75rem]">
                                  <div>
                                    <span className="text-slate-500 font-medium">Buyer:</span>{' '}
                                    <span className="font-semibold text-slate-900">{lead.name}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 font-medium">Property:</span>{' '}
                                    <span className="font-semibold text-slate-900">{propTitle}</span>
                                  </div>
                                  {lead.message && (
                                    <div className="col-span-full bg-white p-2 rounded border border-slate-200 text-slate-700 italic">
                                      "{lead.message}"
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplyModalItem(lead);
                                      setReplyMessage('');
                                    }}
                                    className="px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-[0.7rem] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <Mail size={10} /> Reply via Email
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* MY PROPERTIES SNAPSHOT */}
              <div className="card">
                <div className="card-header flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="card-title text-base font-bold text-slate-900">Featured Properties ({properties.length})</h2>
                    <span className="text-xs text-muted">Quick preview of your direct listings</span>
                  </div>
                  <button
                    onClick={() => handleTabChange('listings')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    View All Properties →
                  </button>
                </div>

                <div className="card-body p-4">
                  {loading ? (
                    <p className="text-muted text-xs p-4">Loading properties...</p>
                  ) : properties.length === 0 ? (
                    <div className="text-center py-8">
                      <Home size={36} className="mx-auto text-slate-400 mb-2" />
                      <h4 className="font-bold text-navy text-sm mb-1">No properties listed yet</h4>
                      <p className="text-muted text-xs max-w-sm mx-auto mb-3">
                        Post your flat, villa, or plot to receive direct inquiries from verified buyers.
                      </p>
                      <button
                        className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1"
                        onClick={() => { setEditProperty(null); setIsModalOpen(true); }}
                      >
                        <Plus size={14} /> Post Property
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {properties.slice(0, 3).map((property) => (
                        <div key={property._id} className="border border-slate-200 rounded-xl overflow-hidden hover:shadow-xs transition-all bg-white flex flex-col justify-between">
                          <div>
                            <div className="h-32 bg-slate-100 relative overflow-hidden">
                              <img
                                src={property.images?.[0] || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=600&auto=format&fit=crop'}
                                alt={property.title}
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute top-2 right-2 bg-white/90 backdrop-blur-xs text-[0.65rem] font-bold px-2 py-0.5 rounded shadow-xs text-slate-800">
                                {property.statusLabel || (property.status === 'ready' ? 'Ready' : 'Under Const.')}
                              </span>
                            </div>
                            <div className="p-3">
                              <h4 className="font-bold text-xs text-slate-900 truncate mb-1" title={property.title}>{property.title}</h4>
                              <p className="text-[0.72rem] text-slate-500 truncate mb-1">
                                <MapPin size={10} className="inline mr-1" />
                                {property.location?.city || property.location?.address || 'India'}
                              </p>
                              <div className="text-xs font-bold text-blue-700">
                                {property.priceDisplay || `₹ ${(property.price || 0).toLocaleString('en-IN')}`}
                              </div>
                            </div>
                          </div>

                          <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs">
                            <Link to={`/property/${property._id}`} className="text-blue-600 hover:underline text-[0.72rem] font-semibold">
                              View Live →
                            </Link>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setEditProperty(property);
                                  setIsModalOpen(true);
                                }}
                                className="p-1 text-slate-500 hover:text-blue-600 rounded"
                                title="Edit"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(property._id)}
                                className="p-1 text-slate-500 hover:text-red-600 rounded"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* TAB 2: MY PROPERTIES */}
          {activeTab === 'listings' && (
            <div className="card">
              <div className="card-header flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="card-title text-base font-bold text-slate-900">
                    My Properties for Sale / Rent ({filteredProperties.length})
                  </h2>
                  <span className="text-xs text-muted">All active property listings published directly by you</span>
                </div>

                {/* Filter and Search Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search title or city..."
                      value={propertySearch}
                      onChange={(e) => setPropertySearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs w-48 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <select
                    value={propertyStatusFilter}
                    onChange={(e) => setPropertyStatusFilter(e.target.value)}
                    className="py-1.5 px-2.5 rounded-lg border border-slate-200 text-xs font-medium cursor-pointer"
                  >
                    <option value="all">All Status</option>
                    <option value="ready">Ready to Move</option>
                    <option value="uc">Under Construction</option>
                    <option value="upcoming">New Launch</option>
                  </select>

                  <button
                    className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                    onClick={() => { setEditProperty(null); setIsModalOpen(true); }}
                  >
                    <Plus size={14} /> Post Property
                  </button>
                </div>
              </div>

              <div className="card-body p-4">
                {loading ? (
                  <p className="text-muted text-xs p-6">Loading properties...</p>
                ) : filteredProperties.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <Home size={36} className="mx-auto text-slate-400 mb-2" />
                    <h4 className="font-bold text-navy text-sm mb-1">No matching properties found</h4>
                    <p className="text-muted text-xs max-w-sm mx-auto mb-4">
                      {propertySearch || propertyStatusFilter !== 'all'
                        ? 'Try adjusting your search query or status filter.'
                        : 'Post your direct listings to start receiving inquiries and tour requests.'}
                    </p>
                    <button
                      className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                      onClick={() => { setEditProperty(null); setIsModalOpen(true); }}
                    >
                      <Plus size={14} /> Post New Property
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProperties.map((property) => (
                      <div className="border border-slate-200 rounded-xl overflow-hidden hover:shadow-xs transition-all bg-white flex flex-col justify-between" key={property._id}>
                        <div>
                          <div className="h-40 bg-slate-100 relative overflow-hidden">
                            <img
                              src={property.images?.[0] || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=600&auto=format&fit=crop'}
                              alt={property.title}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute top-2 right-2 bg-white/90 backdrop-blur-xs text-[0.68rem] font-bold px-2 py-0.5 rounded shadow-xs text-slate-800">
                              {property.statusLabel || (property.status === 'ready' ? 'Ready' : 'Under Const.')}
                            </span>
                          </div>

                          <div className="p-3.5">
                            <h4 className="font-bold text-sm text-slate-900 truncate mb-1" title={property.title}>{property.title}</h4>
                            <p className="text-xs text-slate-500 truncate mb-2">
                              <MapPin size={11} className="inline mr-1 text-slate-400" />
                              {property.location?.address}, {property.location?.city}
                            </p>

                            <div className="font-bold text-blue-700 text-sm mb-2.5">
                              {property.priceDisplay || `₹ ${(property.price || 0).toLocaleString('en-IN')}`}
                            </div>

                            <div className="grid grid-cols-3 gap-1 py-2 px-2 bg-slate-50 rounded-lg text-center text-[0.68rem] text-slate-600 border border-slate-100">
                              <div>
                                <span className="block font-bold text-slate-800">{property.bhk ? `${property.bhk} BHK` : property.type || 'Property'}</span>
                                <span className="text-[0.62rem] text-slate-400">Type</span>
                              </div>
                              <div>
                                <span className="block font-bold text-slate-800">{property.area ? `${property.area} sqft` : '—'}</span>
                                <span className="text-[0.62rem] text-slate-400">Area</span>
                              </div>
                              <div>
                                <span className="block font-bold text-slate-800">{property.visits || 0}</span>
                                <span className="text-[0.62rem] text-slate-400">Views</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="px-3.5 py-2.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs">
                          <Link
                            to={`/property/${property._id}`}
                            className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                          >
                            View Live <ExternalLink size={11} />
                          </Link>

                          <div className="flex items-center gap-1.5">
                            <button
                              className="p-1.5 text-blue-600 hover:bg-blue-50 border border-slate-200 rounded transition-colors"
                              title="Edit Property"
                              onClick={() => {
                                setEditProperty(property);
                                setIsModalOpen(true);
                              }}
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              className="p-1.5 text-red-500 hover:bg-red-50 border border-slate-200 rounded transition-colors"
                              title="Delete Property"
                              onClick={() => handleDelete(property._id)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PROPERTY INQUIRIES */}
          {activeTab === 'leads' && (
            <div className="card">
              <div className="card-header flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <MessageSquare size={18} className="text-blue-600" />
                  <h2 className="card-title text-base font-bold text-slate-900 !mb-0">
                    Property Inquiries ({filteredInquiries.length})
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search buyer name, email, property..."
                      value={leadSearch}
                      onChange={(e) => setLeadSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs w-56 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={exportInquiriesCsv}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Download size={13} /> Export CSV
                  </button>
                </div>
              </div>

              <div className="card-body p-4">
                {inqLoading ? (
                  <div className="text-center py-8 text-xs text-slate-500">Loading property inquiries...</div>
                ) : filteredInquiries.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <MessageSquare size={36} className="text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700">No property inquiries found</p>
                    <span className="text-xs text-slate-400 mt-1 block">
                      When prospective buyers message you about your properties, they will show up here.
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {/* Bulk Selection Bar */}
                    {selectedInquiryIds.length > 0 && (
                      <div className="flex items-center justify-between px-3.5 py-2 bg-blue-50/70 border border-blue-200 rounded-xl text-xs">
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={
                                filteredInquiries.length > 0 &&
                                filteredInquiries.every((i) => selectedInquiryIds.includes(i._id))
                              }
                              onChange={() => handleSelectAllInquiries(filteredInquiries.map((i) => i._id))}
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <span>Select All ({filteredInquiries.length})</span>
                          </label>
                          <span className="font-bold text-blue-700 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full text-[0.68rem]">
                            {selectedInquiryIds.length} Selected
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={handleBulkDeleteInquiries}
                          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Trash2 size={13} />
                          <span>Delete Selected ({selectedInquiryIds.length})</span>
                        </button>
                      </div>
                    )}

                    {/* Inquiry Table */}
                    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 uppercase text-[0.68rem] tracking-wider bg-slate-50">
                            <th className="py-3 px-3 w-8">
                              <input
                                type="checkbox"
                                checked={
                                  filteredInquiries.length > 0 &&
                                  filteredInquiries.every((i) => selectedInquiryIds.includes(i._id))
                                }
                                onChange={() => handleSelectAllInquiries(filteredInquiries.map((i) => i._id))}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                            </th>
                            <th className="py-3 px-3 whitespace-nowrap">Buyer Contact</th>
                            <th className="py-3 px-3 whitespace-nowrap">Inquired Property</th>
                            <th className="py-3 px-3 min-w-[200px]">Inquiry Message</th>
                            <th className="py-3 px-3 whitespace-nowrap">Received</th>
                            <th className="py-3 px-3 text-right whitespace-nowrap">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredInquiries.map((lead) => {
                            const isSelected = selectedInquiryIds.includes(lead._id);
                            return (
                              <tr
                                key={lead._id}
                                className={`transition-colors ${
                                  isSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/70'
                                }`}
                              >
                                <td className="py-3 px-3">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleSelectInquiry(lead._id)}
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap">
                                  <div className="font-bold text-slate-900">{lead.name}</div>
                                  <div className="text-[0.72rem] text-slate-500 flex items-center gap-1 mt-0.5">
                                    <Mail size={11} className="text-slate-400 shrink-0" />
                                    <a href={`mailto:${lead.email}`} className="hover:text-blue-600 hover:underline">{lead.email}</a>
                                  </div>
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5 font-semibold text-slate-800 whitespace-nowrap">
                                    <span>{lead.property?.title || lead.propertyTitle || 'Listing'}</span>
                                    {lead.property?.location?.city && (
                                      <span className="text-[0.72rem] text-slate-400 font-normal">
                                        · {lead.property.location.city}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-slate-700 min-w-[200px] max-w-md">
                                  <div className="text-xs leading-relaxed">
                                    {lead.message || '—'}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                                  {new Date(lead.createdAt).toLocaleDateString()}
                                </td>
                                <td className="py-3 px-3 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReplyModalItem(lead);
                                        setReplyMessage('');
                                      }}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer whitespace-nowrap shrink-0"
                                      title="Reply to buyer via Email"
                                    >
                                      <Mail size={12} className="shrink-0" />
                                      <span className="whitespace-nowrap">Reply via Email</span>
                                    </button>
                                    <button
                                      type="button"
                                      title="Delete Inquiry"
                                      onClick={(e) => handleDeleteSingleInquiry(lead._id, e)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SITE VISITS */}
          {activeTab === 'visits' && (
            <div className="card">
              <div className="card-header pb-3 border-b border-slate-100 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-amber-600" />
                  <h2 className="card-title text-base font-bold text-slate-900">
                    Site Visit Appointments ({siteVisitsList.length})
                  </h2>
                </div>
                <span className="text-xs text-muted">Manage buyer property tour schedules</span>
              </div>

              <div className="card-body p-4">
                {siteVisitsList.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <Calendar size={36} className="text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700">No scheduled site visits</p>
                    <p className="text-xs text-slate-500 mt-1">
                      When prospective buyers request tours on your listed properties, they will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {siteVisitsList.map((visit) => {
                      const isClosed = visit.status === 'closed';
                      const propTitle = visit.property?.title || visit.propertyTitle || 'Property Listing';
                      return (
                        <div
                          key={visit._id}
                          className={`p-4 bg-white border rounded-xl shadow-xs transition-all flex flex-col justify-between ${
                            isClosed ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-200 hover:border-amber-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[0.68rem] font-bold flex items-center gap-1 ${
                                  isClosed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                <Clock size={11} /> {visit.visitDate || 'Date Requested'} · {visit.visitTime || 'Slot TBD'}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {isClosed && (
                                  <span className="px-1.5 py-0.2 rounded text-[0.62rem] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Done
                                  </span>
                                )}
                                <span className="text-[0.68rem] text-slate-400">
                                  {new Date(visit.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>

                            <h4 className="font-bold text-sm text-slate-900 mb-1">{visit.name}</h4>
                            <div className="text-xs text-slate-600 font-medium mb-1.5 flex items-center gap-1">
                              <span className="text-slate-400">Property:</span>
                              {visit.property?._id ? (
                                <Link
                                  to={`/property/${visit.property._id}`}
                                  className="text-blue-600 hover:underline font-semibold inline-flex items-center gap-1 truncate"
                                >
                                  {propTitle}
                                  <ExternalLink size={10} />
                                </Link>
                              ) : (
                                <span className="font-semibold text-slate-800 truncate">{propTitle}</span>
                              )}
                            </div>

                            <div className="text-[0.72rem] text-slate-500 space-y-1 mb-3">
                              {visit.phone && (
                                <div>
                                  <a href={`tel:${visit.phone.replace(/\s+/g, '')}`} className="hover:text-emerald-700 hover:underline inline-flex items-center gap-1.5 text-slate-600">
                                    <Phone size={12} className="text-slate-400 shrink-0" /> {formatPhoneNumber(visit.phone)}
                                  </a>
                                </div>
                              )}
                              {visit.email && (
                                <div>
                                  <a href={`mailto:${visit.email}`} className="hover:text-blue-700 hover:underline inline-flex items-center gap-1.5 text-slate-600 truncate max-w-full">
                                    <Mail size={12} className="text-slate-400 shrink-0" /> {visit.email}
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                            {isClosed ? (
                              <>
                                <div className="flex-1 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center justify-center gap-1">
                                  <Check size={12} className="text-emerald-600" /> Completed
                                </div>
                                <button
                                  onClick={() => handleOpenReschedule(visit)}
                                  disabled={actionLoadingId === visit._id}
                                  className="py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                                >
                                  Reschedule
                                </button>
                                <button
                                  onClick={() => handleStatusChange(visit._id, 'visit')}
                                  disabled={actionLoadingId === visit._id}
                                  className="py-1.5 px-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-500 text-xs font-medium transition-colors cursor-pointer"
                                  title="Revert to upcoming"
                                >
                                  Revert
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleStatusChange(visit._id, 'closed')}
                                  disabled={actionLoadingId === visit._id}
                                  className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <Check size={12} /> {actionLoadingId === visit._id ? 'Updating...' : 'Confirm & Done'}
                                </button>
                                <button
                                  onClick={() => handleOpenReschedule(visit)}
                                  disabled={actionLoadingId === visit._id}
                                  className="py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                                >
                                  Reschedule
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reschedule Visit Modal */}
      {rescheduleItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Calendar size={18} className="text-amber-600" /> Reschedule Site Visit
              </h4>
              <button
                onClick={() => setRescheduleItem(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              Update the site visit appointment for <strong>{rescheduleItem.name}</strong> for{' '}
              <strong>{rescheduleItem.property?.title || rescheduleItem.propertyTitle}</strong>.
            </p>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select New Date
                </label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  value={newVisitDate}
                  onChange={(e) => setNewVisitDate(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Time Slot
                </label>
                <select
                  required
                  value={newVisitTime}
                  onChange={(e) => setNewVisitTime(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                >
                  <option value="">-- Choose preferred time slot --</option>
                  <option value="10:00 AM - 12:00 PM">10:00 AM - 12:00 PM (Morning)</option>
                  <option value="12:00 PM - 02:00 PM">12:00 PM - 02:00 PM (Afternoon)</option>
                  <option value="02:00 PM - 04:00 PM">02:00 PM - 04:00 PM (Late Afternoon)</option>
                  <option value="04:00 PM - 06:00 PM">04:00 PM - 06:00 PM (Evening)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRescheduleItem(null)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoadingId === rescheduleItem._id}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs disabled:opacity-50"
                >
                  {actionLoadingId === rescheduleItem._id ? 'Saving...' : 'Confirm Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reply to Buyer Inquiry Modal */}
      {replyModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 text-left animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Mail size={18} className="text-blue-600" /> Reply to Buyer Inquiry
              </h4>
              <button
                type="button"
                onClick={() => {
                  setReplyModalItem(null);
                  setReplyMessage('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Buyer & Property Context Card */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 mb-4 space-y-1.5 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <div>
                  <span className="text-slate-500">Buyer:</span>{' '}
                  <strong className="text-slate-900">{replyModalItem.name}</strong>{' '}
                  <span className="text-slate-500">&lt;{replyModalItem.email}&gt;</span>
                </div>
              </div>
              <div>
                <span className="text-slate-500">Property:</span>{' '}
                <strong className="text-blue-700">
                  {replyModalItem.property?.title || replyModalItem.propertyTitle || 'Property Listing'}
                </strong>
                {replyModalItem.property?.location?.city && (
                  <span className="text-slate-500"> · {replyModalItem.property.location.city}</span>
                )}
              </div>
              {replyModalItem.message && (
                <div className="pt-1.5 border-t border-slate-200/60 text-[0.75rem] text-slate-700">
                  <span className="text-slate-500 font-medium">Inquiry Message:</span>
                  <div className="italic bg-white p-2 rounded-lg border border-slate-200 mt-1">
                    &ldquo;{replyModalItem.message}&rdquo;
                  </div>
                </div>
              )}
            </div>

            {/* Reply Form */}
            <form onSubmit={handleSendReply} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Your Email Response <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder={`Write your answer or pricing/property details here... It will be emailed directly to ${replyModalItem.email}.`}
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 placeholder:text-slate-400 resize-y"
                  disabled={sendingReply}
                  autoFocus
                />
              </div>

              <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-100 flex items-start gap-2 text-[0.72rem] text-blue-900">
                <CheckCircle2 size={14} className="text-blue-600 shrink-0 mt-0.5" />
                <span>
                  Once sent, this answer will be emailed to <strong>{replyModalItem.email}</strong> and this inquiry will automatically be marked resolved and deleted from your portal.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setReplyModalItem(null);
                    setReplyMessage('');
                  }}
                  disabled={sendingReply}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingReply || !replyMessage.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {sendingReply ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sending Email...</span>
                    </>
                  ) : (
                    <>
                      <Mail size={13} />
                      <span>Send Email Response</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Property Modal */}
      <AddPropertyModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditProperty(null);
        }}
        onSuccess={() => {
          setIsModalOpen(false);
          setEditProperty(null);
          broadcastRealtimeSync(SYNC_EVENTS.PROPERTIES, { action: 'saved' });
          fetchProperties();
        }}
        initialData={editProperty}
      />

    </div>
  );
};

export default OwnerDashboard;
