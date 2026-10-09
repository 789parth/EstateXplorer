import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Edit2,
  Trash2,
  Briefcase,
  Users,
  Eye,
  Award,
  Calendar,
  Clock,
  Check,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Home,
  ChevronDown,
  ExternalLink,
  MessageSquare,
  Download,
  Search,
  Filter,
  X,
  TrendingUp,
  Send,
  Compass,
  ShieldCheck,
  Copy,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useSocket, SOCKET_EVENTS } from '../../hooks/useSocket';
import {
  getMyProperties,
  deleteProperty,
  getMyInquiries,
  updateInquiryStatus,
  deleteInquiryApi,
  bulkDeleteInquiriesApi,
  replyToInquiryApi,
} from '../../services/propertyService';
import {
  discoverProjects,
  getMyPartnerships,
  requestPartnership,
} from '../../services/partnershipService';
import { formatPhoneNumber, formatPrice } from '../../utils/formatters';
import { broadcastRealtimeSync, useRealtimeSync, SYNC_EVENTS } from '../../utils/realtimeSync';
import './BuilderDashboard.css';

// Lazy-loaded heavy dashboard modals — keeps dashboard initial chunk lean and fast
const AddPropertyModal = lazy(() => import('../../components/dashboard/AddPropertyModal'));
const RequestSellingRightsModal = lazy(() => import('../../components/dashboard/RequestSellingRightsModal'));
const BookUnitModal = lazy(() => import('../../components/dashboard/BookUnitModal'));
const BookingInvoiceModal = lazy(() => import('../../components/dashboard/BookingInvoiceModal'));
const KycVerificationModal = lazy(() => import('../../components/dashboard/KycVerificationModal'));

const AgentDashboard = () => {
  const { user, accessToken, showToast, logout } = useAuth();
  const { on, off } = useSocket(accessToken);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const validTabs = ['overview', 'listings', 'leads', 'visits', 'find-projects', 'affiliations'];
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
  const [showKycModal, setShowKycModal] = useState(false);

  const handleOpenAddProperty = useCallback((propToEdit = null) => {
    if (propToEdit) {
      setEditProperty(propToEdit);
      setIsModalOpen(true);
      return;
    }

    // MANDATORY KYC CHECK: Agent must be verified by Admin specifically for the Agent role
    const agentKycObj = user?.roleKycVerification?.agent;
    const fallbackKyc = user?.kycVerification?.roleAtSubmission === 'agent' ? user?.kycVerification : null;
    const kycStatus = agentKycObj?.status || fallbackKyc?.status || 'unverified';

    if (kycStatus !== 'verified') {
      if (kycStatus === 'pending') {
        showToast('Your agent verification documents are under review by the Administrator.', 'info');
      } else if (kycStatus === 'rejected') {
        showToast(
          `Agent document verification rejected: ${agentKycObj?.rejectionReason || fallbackKyc?.rejectionReason || 'Please re-upload clear documents.'}`,
          'error'
        );
      } else {
        showToast('Mandatory Agent document verification required before managing or adding properties. Please upload your documents.', 'warning');
      }
      setShowKycModal(true);
      return;
    }

    setEditProperty(null);
    setIsModalOpen(true);
  }, [user, showToast]);

  // Inquiries & Visits state
  const [inquiries, setInquiries] = useState([]);
  const [inqLoading, setInqLoading] = useState(true);
  const [leadSearch, setLeadSearch] = useState('');
  const [expandedInquiryId, setExpandedInquiryId] = useState(null);
  const [selectedInquiryIds, setSelectedInquiryIds] = useState([]);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [bookingLead, setBookingLead] = useState(null);
  const [invoiceBookingId, setInvoiceBookingId] = useState(null);

  // Reschedule Modal state
  const [rescheduleItem, setRescheduleItem] = useState(null);
  const [newVisitDate, setNewVisitDate] = useState('');
  const [newVisitTime, setNewVisitTime] = useState('');

  // Reply to Inquiry Modal state
  const [replyModalItem, setReplyModalItem] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Agent Acquisition Workflow State (Spec §2, §6, §7, §9)
  const [discoverProjectsList, setDiscoverProjectsList] = useState([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverPage, setDiscoverPage] = useState(1);
  const [discoverTotalPages, setDiscoverTotalPages] = useState(1);
  const [discoverLoadingMore, setDiscoverLoadingMore] = useState(false);
  const [discoverSearch, setDiscoverSearch] = useState('');
  const [discoverCityFilter, setDiscoverCityFilter] = useState('all');
  const [discoverTypeFilter, setDiscoverTypeFilter] = useState('all');

  const [myPartnerships, setMyPartnerships] = useState([]);
  const [partnershipsLoading, setPartnershipsLoading] = useState(false);
  const [affiliationFilter, setAffiliationFilter] = useState('all'); // all, approved, pending, rejected
  const [affiliationSearch, setAffiliationSearch] = useState('');

  // Modals & Real-time pop-up notifications
  const [requestModalProject, setRequestModalProject] = useState(null);
  const [statusNotificationModal, setStatusNotificationModal] = useState(null);
  const [copiedLinkMap, setCopiedLinkMap] = useState({});

  const fetchProperties = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const res = await getMyProperties();
      if (res.success) setProperties(res.data);
    } catch (error) {
      console.error('Failed to fetch agent listings:', error);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, []);

  const fetchInquiries = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setInqLoading(true);
      const res = await getMyInquiries({ role: 'agent' });
      if (res.success) setInquiries(res.data);
    } catch (error) {
      console.error('Failed to fetch agent inquiries:', error);
    } finally {
      if (!isBackground) setInqLoading(false);
    }
  }, []);

  const fetchDiscoverProjects = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setDiscoverLoading(true);
      const res = await discoverProjects({ page: 1, limit: 50 });
      if (res.success && Array.isArray(res.data)) {
        setDiscoverProjectsList(res.data);
        setDiscoverPage(res.page || 1);
        setDiscoverTotalPages(res.totalPages || 1);
      }
    } catch (error) {
      console.error('Failed to fetch discoverable projects:', error);
    } finally {
      if (!isBackground) setDiscoverLoading(false);
    }
  }, []);

  const loadMoreDiscoverProjects = async () => {
    if (discoverLoadingMore || discoverPage >= discoverTotalPages) return;
    setDiscoverLoadingMore(true);
    try {
      const nextPage = discoverPage + 1;
      const res = await discoverProjects({ page: nextPage, limit: 50 });
      if (res.success && Array.isArray(res.data)) {
        setDiscoverProjectsList((current) => [...current, ...res.data]);
        setDiscoverPage(res.page || nextPage);
        setDiscoverTotalPages(res.totalPages || discoverTotalPages);
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Could not load more projects.', 'error');
    } finally {
      setDiscoverLoadingMore(false);
    }
  };

  const fetchMyPartnerships = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setPartnershipsLoading(true);
      const res = await getMyPartnerships();
      if (res.success && Array.isArray(res.data)) {
        setMyPartnerships(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch agent partnerships:', error);
    } finally {
      if (!isBackground) setPartnershipsLoading(false);
    }
  }, []);

  // Real-time synchronization for inquiries, properties, and affiliations
  useRealtimeSync(
    [
      SYNC_EVENTS.INQUIRIES,
      SYNC_EVENTS.PROPERTIES,
      SYNC_EVENTS.PARTNERSHIPS,
    ],
    () => {
      fetchProperties(true);
      fetchInquiries(true);
      fetchDiscoverProjects(true);
      fetchMyPartnerships(true);
    },
    { revalidateOnFocus: true, intervalMs: 15000 }
  );

  // Server-push Socket.io real-time events
  useEffect(() => {
    // A buyer submitted a lead on a project attributed to this agent
    on(SOCKET_EVENTS.NEW_ATTRIBUTED_LEAD, (data) => {
      showToast(`📩 New ${data.visitRequested ? 'site visit' : 'inquiry'} lead from ${data.buyerName || 'a buyer'} on "${data.propertyTitle}"!`, 'info');
      fetchInquiries(true);
    });

    // Real-time popup notification when builder accepts or rejects acquisition request (Spec §9)
    on(SOCKET_EVENTS.PARTNERSHIP_STATUS_CHANGED, (data) => {
      fetchMyPartnerships(true);
      fetchDiscoverProjects(true);
      setStatusNotificationModal({
        status: data.status,
        projectTitle: data.projectTitle || 'Project Listing',
        builderName: data.builderName || 'The Project Builder',
        affiliateUrl: data.affiliateUrl,
        affiliateCode: data.affiliateCode,
        commissionRate: data.commissionRate || 2.5,
        rejectionReason: data.rejectionReason || '',
      });
      if (data.status === 'approved' || data.status === 'accepted') {
        showToast(`🎉 Congratulations! Your request for "${data.projectTitle}" has been approved!`, 'success');
      } else if (data.status === 'rejected') {
        showToast(`ℹ️ Your request for "${data.projectTitle}" was declined by the developer.`, 'info');
      }
    });

    return () => {
      off(SOCKET_EVENTS.NEW_ATTRIBUTED_LEAD);
      off(SOCKET_EVENTS.PARTNERSHIP_STATUS_CHANGED);
    };
  }, [on, off, fetchInquiries, fetchMyPartnerships, fetchDiscoverProjects, showToast]);

  useEffect(() => {
    fetchProperties(false);
    fetchInquiries(false);
    fetchDiscoverProjects(false);
    fetchMyPartnerships(false);
  }, [fetchProperties, fetchInquiries, fetchDiscoverProjects, fetchMyPartnerships]);

  const handleCopyLink = (code, url, id) => {
    const targetUrl = url || `${window.location.origin}/property/${id}?agent=${code || user?.agentCode || user?._id}`;
    navigator.clipboard.writeText(targetUrl);
    setCopiedLinkMap((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedLinkMap((prev) => ({ ...prev, [id]: false }));
    }, 2000);
    showToast('Affiliate tracking link copied to clipboard!', 'success');
  };

  const getProjectPartnership = (projectId) => {
    return myPartnerships.find((p) => {
      const pId = p.project?._id || p.project;
      return String(pId) === String(projectId);
    });
  };


  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this listing from your agency portfolio?')) {
      try {
        const res = await deleteProperty(id);
        if (res.success) {
          broadcastRealtimeSync(SYNC_EVENTS.PROPERTIES, { action: 'deleted', id });
          showToast('Listing removed successfully', 'success');
          fetchProperties();
        }
      } catch (error) {
        showToast('Failed to delete listing', 'error');
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
        lifecycleStage: newStatus === 'visit' ? 'site_visit_scheduled' : newStatus === 'closed' ? 'site_visit_done' : newStatus,
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
                lifecycleStage: res.data?.lifecycleStage || (newStatus === 'visit' ? 'site_visit_scheduled' : newStatus === 'closed' ? 'site_visit_done' : newStatus),
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
              : `Lead status updated to ${newStatus}`,
          'success'
        );
      }
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to update lead status', 'error');
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
  const exportLeadsCsv = () => {
    if (filteredInquiries.length === 0) {
      showToast('No inquiries available to export', 'info');
      return;
    }

    const headers = ['Buyer Name', 'Email', 'Managed Listing', 'Message', 'Date Received'];
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
    if (!name) return 'AG';
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
  const rejectedCount = inquiries.filter((e) => e.status === 'rejected').length;

  // Filtered Discover Projects & Properties (Spec §2)
  const filteredDiscoverProjects = discoverProjectsList.filter((p) => {
    if (discoverSearch.trim()) {
      const q = discoverSearch.toLowerCase().trim();
      const title = (p.title || p.name || '').toLowerCase();
      const city = (p.location?.city || '').toLowerCase();
      const seller = (p.builder?.companyName || p.builder?.name || p.user?.companyName || p.user?.name || '').toLowerCase();
      if (!title.includes(q) && !city.includes(q) && !seller.includes(q)) return false;
    }
    if (discoverCityFilter !== 'all') {
      const city = (p.location?.city || '').toLowerCase();
      if (city !== discoverCityFilter.toLowerCase()) return false;
    }
    if (discoverTypeFilter !== 'all') {
      const type = (p.type || p.propertyType || '').toLowerCase();
      if (!type.includes(discoverTypeFilter.toLowerCase())) return false;
    }
    return true;
  });

  // Filtered My Affiliations (Spec §7)
  const filteredAffiliations = myPartnerships.filter((item) => {
    if (affiliationFilter !== 'all') {
      if (affiliationFilter === 'approved' && item.status !== 'approved' && item.status !== 'accepted') return false;
      if (affiliationFilter === 'pending' && item.status !== 'pending') return false;
      if (affiliationFilter === 'rejected' && item.status !== 'rejected') return false;
    }
    if (affiliationSearch.trim()) {
      const q = affiliationSearch.toLowerCase().trim();
      const title = (item.project?.title || item.project?.name || '').toLowerCase();
      const seller = (item.project?.builder?.companyName || item.project?.builder?.name || item.builder?.companyName || item.builder?.name || '').toLowerCase();
      if (!title.includes(q) && !seller.includes(q)) return false;
    }
    return true;
  });

  const affiliatedApprovedCount = myPartnerships.filter((p) => p.status === 'approved' || p.status === 'accepted').length;
  const affiliatedPendingCount = myPartnerships.filter((p) => p.status === 'pending').length;

  // Unique cities from discoverable projects
  const discoverCities = Array.from(
    new Set(
      discoverProjectsList
        .map((p) => p.location?.city)
        .filter(Boolean)
    )
  );

  const initials = getInitials(user?.name);
  const agencyName = user?.agentProfile?.agencyName || user?.name || 'Agent Console';

  return (
    <div className="builder-wrapper agent-wrapper">
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
            <div className="brand-text"><Link to="/">Estate<span>Xplorer</span></Link></div>
            <div className="role">Agent Portal</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-label">Main</div>
            <button
              className={`nav-item w-full text-left bg-transparent border-0 ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => handleTabChange('overview')}
            >
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg>
              Dashboard
            </button>
          </div>

          <div className="nav-section">
            <div className="nav-section-label">Inventory &amp; Leads</div>
            <button
              className={`nav-item w-full text-left bg-transparent border-0 ${activeTab === 'listings' ? 'active' : ''}`}
              onClick={() => handleTabChange('listings')}
            >
              <Briefcase size={18} />
              Managed Listings
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
            <div className="nav-section-label">Acquisitions</div>
            <button
              className={`nav-item w-full text-left bg-transparent border-0 ${activeTab === 'find-projects' ? 'active' : ''}`}
              onClick={() => handleTabChange('find-projects')}
            >
              <Compass size={18} />
              <span className="nav-text">Find Projects &amp; Properties</span>
              {discoverProjectsList.length > 0 && (
                <span className="badge info">{discoverProjectsList.length}</span>
              )}
            </button>
            <button
              className={`nav-item w-full text-left bg-transparent border-0 ${activeTab === 'affiliations' ? 'active' : ''}`}
              onClick={() => handleTabChange('affiliations')}
            >
              <Award size={18} />
              <span>My Affiliations</span>
              {affiliatedApprovedCount > 0 && (
                <span className="badge success">{affiliatedApprovedCount}</span>
              )}
            </button>
          </div>

          <div className="nav-section">
            <div className="nav-section-label">Account</div>
            <Link className="nav-item" to="/dashboard/profile">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              Agent Profile
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
              className="nav-item w-full text-left bg-transparent border-0"
              onClick={logout}
            >
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              Sign Out
            </button>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="builder-profile" onClick={() => navigate('/dashboard/profile')}>
            <div className="builder-avatar">{initials}</div>
            <div className="builder-info">
              <div className="builder-name">{user?.name}</div>
              <div className="builder-company">{agencyName}</div>
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
              {activeTab === 'overview' && 'Agent Console'}
              {activeTab === 'listings' && 'Exclusive Managed Inventory'}
              {activeTab === 'leads' && 'Property Inquiries'}
              {activeTab === 'visits' && 'Site Visit Appointments'}
              {activeTab === 'find-projects' && 'Find & Acquire Builder Projects'}
              {activeTab === 'affiliations' && 'My Affiliations & Referral Links'}
            </h1>
          </div>
          <div className="topbar-right flex items-center gap-2">
            {activeTab === 'leads' && (
              <button
                className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3"
                onClick={exportLeadsCsv}
                title="Export Leads to CSV"
              >
                <Download size={14} /> Export CSV
              </button>
            )}
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => handleOpenAddProperty(null)}
            >
              <Plus size={16} /> Add Client Listing
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
                  Welcome back, <strong style={{ color: 'var(--text)' }}>{user?.name}</strong> ({agencyName}) · Here is your client pipeline and listing performance today.
                </p>
              </div>

              {/* 4 STATS CARDS */}
              <div className="stats-grid mb-6">
                <div className="stat-card cursor-pointer" onClick={() => handleTabChange('listings')}>
                  <div className="stat-header">
                    <div className="stat-icon blue">
                      <Briefcase size={20} />
                    </div>
                    <span className="stat-trend up">Active</span>
                  </div>
                  <div className="stat-value">{loading ? '...' : properties.length}</div>
                  <div className="stat-label">Managed Listings</div>
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
                  <div className="stat-label">Site Tour Requests</div>
                </div>

                <div className="stat-card cursor-pointer" onClick={() => navigate('/dashboard/profile')}>
                  <div className="stat-header">
                    <div className="stat-icon navy">
                      <Award size={20} />
                    </div>
                    <span className="stat-trend up">Verified</span>
                  </div>
                  <div
                    className="stat-value"
                    style={{
                      fontSize: user?.agentProfile?.experienceYears ? '1.5rem' : '1.35rem',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {user?.agentProfile?.experienceYears ? `${user.agentProfile.experienceYears} Yrs` : 'RERA'}
                  </div>
                  <div className="stat-label">License &amp; Experience</div>
                </div>
              </div>

              {/* RECENT INQUIRIES (COMPACT SNAPSHOT) */}
              <div className="card mb-6">
                <div className="card-header flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="card-title text-base font-bold text-slate-900">Recent Inquiries</h2>
                    <span className="text-xs text-muted">Latest prospective buyers asking about your listings</span>
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
                            className={`py-2 px-2 rounded-lg transition-colors ${isSelected ? 'bg-blue-50/50' : isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50/70'
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
                                    <span className="text-slate-500 font-medium">Listing:</span>{' '}
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

              {/* MANAGED PROPERTIES SNAPSHOT */}
              <div className="card">
                <div className="card-header flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="card-title text-base font-bold text-slate-900">Featured Managed Listings ({properties.length})</h2>
                    <span className="text-xs text-muted">Quick preview of your top agency properties</span>
                  </div>
                  <button
                    onClick={() => handleTabChange('listings')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Manage Full Portfolio &rarr;
                  </button>
                </div>

                <div className="card-body p-4">
                  {loading ? (
                    <p className="text-muted text-xs p-4">Loading listings...</p>
                  ) : properties.length === 0 ? (
                    <div className="text-center py-8">
                      <Briefcase size={36} className="mx-auto text-slate-400 mb-2" />
                      <h4 className="font-bold text-navy text-sm mb-1">No client properties listed yet</h4>
                      <p className="text-muted text-xs max-w-sm mx-auto mb-3">
                        Add properties to manage leads and book site tours.
                      </p>
                      <button
                        className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1"
                        onClick={() => { setEditProperty(null); setIsModalOpen(true); }}
                      >
                        <Plus size={14} /> Add Listing
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
                              View Live &rarr;
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

          {/* TAB 2: MANAGED LISTINGS */}
          {activeTab === 'listings' && (
            <div className="card">
              <div className="card-header flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="card-title text-base font-bold text-slate-900">
                    Exclusive Managed Inventory ({filteredProperties.length})
                  </h2>
                  <span className="text-xs text-muted">All residential and commercial properties managed by your agency</span>
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
                    onClick={() => handleOpenAddProperty(null)}
                  >
                    <Plus size={14} /> Add Listing
                  </button>
                </div>
              </div>

              <div className="card-body p-4">
                {loading ? (
                  <p className="text-muted text-xs p-6">Loading listings...</p>
                ) : filteredProperties.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <Briefcase size={36} className="mx-auto text-slate-400 mb-2" />
                    <h4 className="font-bold text-navy text-sm mb-1">No matching properties found</h4>
                    <p className="text-muted text-xs max-w-sm mx-auto mb-4">
                      {propertySearch || propertyStatusFilter !== 'all'
                        ? 'Try adjusting your search query or status filter.'
                        : 'Start adding client listings to receive inquiries and booking tours.'}
                    </p>
                    <button
                      className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                      onClick={() => { setEditProperty(null); setIsModalOpen(true); }}
                    >
                      <Plus size={14} /> Add Client Listing
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
                                <span className="block font-bold text-slate-800">{property.bhk ? `${property.bhk} BHK` : property.type || 'Flat'}</span>
                                <span className="text-[0.62rem] text-slate-400">Config</span>
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
                              title="Edit Listing"
                              onClick={() => {
                                setEditProperty(property);
                                setIsModalOpen(true);
                              }}
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              className="p-1.5 text-red-500 hover:bg-red-50 border border-slate-200 rounded transition-colors"
                              title="Delete Listing"
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
                <div>
                  <h2 className="card-title text-base font-bold text-slate-900">
                    Property Inquiries ({filteredInquiries.length})
                  </h2>
                  <span className="text-xs text-muted">
                    Questions and messages from buyers interested in your properties
                  </span>
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
                    onClick={exportLeadsCsv}
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
                            <th className="py-3 px-3 whitespace-nowrap">Project</th>
                            <th className="py-3 px-3 whitespace-nowrap">Property</th>
                            <th className="py-3 px-3 whitespace-nowrap">Buyer Contact</th>
                            <th className="py-3 px-3 min-w-[200px]">Buyer Inquiry</th>
                            <th className="py-3 px-3 whitespace-nowrap">Lead Status</th>
                            <th className="py-3 px-3 whitespace-nowrap">Received</th>
                            <th className="py-3 px-3 text-right whitespace-nowrap">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredInquiries.map((lead) => {
                            const isSelected = selectedInquiryIds.includes(lead._id);
                            const projTitle = lead.projectName || lead.project?.title || lead.property?.title || lead.propertyTitle || 'Project';
                            const propTitle = lead.propertyTitle || lead.property?.title || 'Main Unit';

                            return (
                              <tr
                                key={lead._id}
                                className={`transition-colors ${isSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/70'
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

                                {/* Project */}
                                <td className="py-3 px-3 whitespace-nowrap">
                                  <div className="font-bold text-slate-900 flex items-center gap-1">
                                    <Building2 size={13} className="text-slate-400 shrink-0" />
                                    <span>{projTitle}</span>
                                  </div>
                                  {(lead.project?.location?.city || lead.property?.location?.city) && (
                                    <div className="text-[0.68rem] text-slate-400 mt-0.5 ml-4">
                                      {lead.project?.location?.city || lead.property?.location?.city}
                                    </div>
                                  )}
                                </td>

                                {/* Property */}
                                <td className="py-3 px-3 whitespace-nowrap">
                                  <div className="font-semibold text-slate-800">{propTitle}</div>
                                  {lead.property?.type && (
                                    <div className="text-[0.68rem] text-slate-500 mt-0.5">
                                      {lead.property.type} {lead.property.bhk ? `· ${lead.property.bhk} BHK` : ''}
                                    </div>
                                  )}
                                </td>

                                {/* Buyer Contact */}
                                <td className="py-3 px-3 whitespace-nowrap">
                                  <div className="font-bold text-slate-900">{lead.name}</div>
                                  {lead.phone && (
                                    <div className="text-[0.72rem] text-slate-600 flex items-center gap-1 mt-0.5">
                                      <Phone size={11} className="text-slate-400 shrink-0" />
                                      <a href={`tel:${lead.phone}`} className="hover:text-emerald-700 hover:underline">{lead.phone}</a>
                                    </div>
                                  )}
                                  <div className="text-[0.72rem] text-slate-500 flex items-center gap-1 mt-0.5">
                                    <Mail size={11} className="text-slate-400 shrink-0" />
                                    <a href={`mailto:${lead.email}`} className="hover:text-blue-600 hover:underline">{lead.email}</a>
                                  </div>
                                </td>

                                {/* Buyer Inquiry */}
                                <td className="py-3 px-3 text-slate-700 min-w-[200px] max-w-md">
                                  <div className="text-xs leading-relaxed">
                                    {lead.message || '—'}
                                  </div>
                                </td>

                                {/* Lead Status */}
                                <td className="py-3 px-3 whitespace-nowrap">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[0.68rem] font-bold inline-flex items-center gap-1 ${lead.status === 'closed'
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      : lead.status === 'contacted'
                                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                        : lead.status === 'visit'
                                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                          : lead.status === 'rejected'
                                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                      }`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                    {lead.status === 'visit' ? 'Site Visit' : lead.status ? lead.status.charAt(0).toUpperCase() + lead.status.slice(1) : 'New'}
                                  </span>
                                </td>

                                <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                                  {new Date(lead.createdAt).toLocaleDateString()}
                                </td>

                                <td className="py-3 px-3 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-2">
                                    {lead.bookingRef && (
                                      <button
                                        type="button"
                                        onClick={() => setInvoiceBookingId(typeof lead.bookingRef === 'object' ? lead.bookingRef._id : lead.bookingRef)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-colors cursor-pointer"
                                        title="View official token payment invoice"
                                      >
                                        Invoice
                                      </button>
                                    )}
                                    {lead.property?.category === 'project' && !lead.bookingRef && (() => {
                                      const hasSiteVisitDone = Boolean(
                                        lead.siteVisitCompleted ||
                                        lead.lifecycleStage === 'site_visit_done' ||
                                        (lead.visitRequested && lead.status === 'closed')
                                      );

                                      return hasSiteVisitDone ? (
                                        <button
                                          type="button"
                                          onClick={() => setBookingLead(lead)}
                                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors cursor-pointer"
                                        >
                                          Book unit
                                        </button>
                                      ) : (
                                        <span
                                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-400 font-semibold text-xs border border-slate-200 cursor-not-allowed"
                                          title="At least 1 site visit must be completed before booking and collecting token amount."
                                        >
                                          Site Visit Required
                                        </span>
                                      );
                                    })()}
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
                                      <span className="whitespace-nowrap">Reply</span>
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
                      When prospective buyers request tours on your managed properties, they will appear here.
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
                          className={`p-4 bg-white border rounded-xl shadow-xs transition-all flex flex-col justify-between ${isClosed ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-200 hover:border-amber-300'
                            }`}
                        >
                          <div>
                            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[0.68rem] font-bold flex items-center gap-1 ${isClosed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
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

                            {/* Project Name */}
                            <div className="text-xs text-slate-600 font-medium mb-1 flex items-center gap-1">
                              <span className="text-slate-400">Project:</span>
                              <span className="font-bold text-slate-900 truncate">
                                {visit.projectName || visit.project?.title || visit.property?.title || visit.propertyTitle || 'Project'}
                              </span>
                            </div>

                            {/* Property / Unit */}
                            <div className="text-xs text-slate-600 font-medium mb-2 flex items-center gap-1">
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

                            {/* Buyer Name & Notes */}
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-bold text-xs text-slate-900">{visit.name}</h4>
                              <span className="text-[0.62rem] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                                Affiliated Lead
                              </span>
                            </div>
                            {visit.message && (
                              <p className="text-[0.70rem] text-slate-600 italic mb-2 line-clamp-2">
                                "{visit.message}"
                              </p>
                            )}

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

                          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                            {isClosed ? (
                              <>
                                <div className="flex-1 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center justify-center gap-1">
                                  <Check size={12} className="text-emerald-600" /> Completed
                                </div>
                                {visit.bookingRef ? (
                                  <button
                                    type="button"
                                    onClick={() => setInvoiceBookingId(typeof visit.bookingRef === 'object' ? visit.bookingRef._id : visit.bookingRef)}
                                    className="py-1.5 px-3 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors cursor-pointer"
                                  >
                                    Invoice
                                  </button>
                                ) : visit.property?.category === 'project' && (
                                  <button
                                    type="button"
                                    onClick={() => setBookingLead(visit)}
                                    className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer"
                                  >
                                    Book Unit
                                  </button>
                                )}
                                <button
                                  onClick={() => handleOpenReschedule(visit)}
                                  disabled={actionLoadingId === visit._id}
                                  className="py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
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

          {/* TAB 5: FIND PROJECTS & PROPERTIES (Spec §2) */}
          {activeTab === 'find-projects' && (
            <div className="section-card">
              <div className="section-header pb-3 border-b border-border mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Compass size={18} className="text-blue-600" />
                    <h3 className="section-title !mb-0">
                      Find &amp; Acquire Projects ({filteredDiscoverProjects.length})
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Discover builder projects open for agent representation. Apply for authorized selling rights to earn commissions and unlock client referral tracking.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Search query */}
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={discoverSearch}
                      onChange={(e) => setDiscoverSearch(e.target.value)}
                      placeholder="Search title, city, seller..."
                      className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 w-48"
                    />
                  </div>

                  {/* Filter by City */}
                  <select
                    value={discoverCityFilter}
                    onChange={(e) => setDiscoverCityFilter(e.target.value)}
                    className="text-xs py-1.5 px-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none"
                  >
                    <option value="all">All Locations</option>
                    {discoverCities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>

                  {/* Filter by Type */}
                  <select
                    value={discoverTypeFilter}
                    onChange={(e) => setDiscoverTypeFilter(e.target.value)}
                    className="text-xs py-1.5 px-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none"
                  >
                    <option value="all">All Property Types</option>
                    <option value="apartment">Apartment / Flat</option>
                    <option value="villa">Villa / House</option>
                    <option value="commercial">Commercial</option>
                    <option value="plot">Plot / Land</option>
                  </select>
                </div>
              </div>

              <div className="section-body">
                {discoverLoading ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin inline-block mr-2" />
                    Loading available projects and properties...
                  </div>
                ) : filteredDiscoverProjects.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <Compass size={36} className="text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700">No partner-ready listings found</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {discoverProjectsList.length === 0
                        ? 'No sellers have enabled agent acquisition yet. Check back soon for new project releases.'
                        : 'No listings matched your current filter criteria. Try adjusting your filters.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredDiscoverProjects.map((item) => {
                      const isProject = (item.category || 'project') === 'project';
                      const partnership = getProjectPartnership(item._id);
                      const isApproved = partnership?.status === 'approved' || partnership?.status === 'accepted';
                      const isPending = partnership?.status === 'pending';
                      const isRejected = partnership?.status === 'rejected';
                      const sellerName = item.builder?.companyName || item.builder?.name || item.user?.companyName || item.user?.name || (isProject ? 'Verified Developer' : 'Property Owner');
                      const img = item.images?.[0] || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=600';
                      const commissionRate = item.defaultCommissionRate || 2.5;

                      return (
                        <div
                          key={item._id}
                          className="border border-slate-200 rounded-2xl overflow-hidden bg-white hover:shadow-lg transition-all flex flex-col justify-between"
                        >
                          <div>
                            {/* Project/Property Image & Badges */}
                            <div className="h-44 w-full bg-slate-100 relative overflow-hidden group">
                              <img
                                src={img}
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider text-white shadow-xs ${isProject ? 'bg-purple-700' : 'bg-amber-600'
                                  }`}>
                                  {isProject ? 'Master Project' : 'Property'}
                                </span>
                                {item.statusLabel && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/90 text-slate-800 backdrop-blur-xs">
                                    {item.statusLabel}
                                  </span>
                                )}
                              </div>

                              <div className="absolute top-2.5 right-2.5">
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-xs flex items-center gap-1">
                                  <Award size={11} /> {commissionRate}% Comm.
                                </span>
                              </div>
                            </div>

                            {/* Info */}
                            <div className="p-4">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 mb-1">
                                {item.propertyType || item.type || (isProject ? 'Residential Project' : 'Property')}
                              </div>

                              <h4 className="font-bold text-sm text-slate-900 mb-1 truncate" title={item.title}>
                                {item.title}
                              </h4>

                              <div className="text-xs text-slate-600 font-medium mb-2 flex items-center gap-1.5">
                                <Building2 size={13} className="text-slate-400 shrink-0" />
                                <span className="truncate">{sellerName}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold shrink-0">
                                  {isProject ? 'Developer' : 'Owner'}
                                </span>
                              </div>

                              <p className="text-xs text-slate-500 mb-3 flex items-center gap-1">
                                <MapPin size={12} className="text-slate-400 shrink-0" />
                                <span className="truncate">
                                  {item.location?.address ? `${item.location.address}, ` : ''}{item.location?.city}
                                </span>
                              </p>

                              {/* Price & Configuration Specs */}
                              <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-slate-100 text-xs">
                                <div>
                                  <span className="text-[10px] text-slate-400 block font-semibold">{isProject ? 'Starting Price' : 'Asking Price'}</span>
                                  <span className="font-black text-slate-900 text-sm">
                                    {item.priceDisplay || `₹ ${item.price?.toLocaleString()}`}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] text-slate-400 block font-semibold">Configuration</span>
                                  <span className="font-bold text-slate-700 truncate block">
                                    {isProject
                                      ? (item.unitsCount ? `${item.unitsCount} Units` : (item.bedrooms ? `${item.bedrooms} BHK Units` : 'Multi-Config'))
                                      : `${item.bedrooms ? `${item.bedrooms} BHK · ` : ''}${item.area ? `${item.area} sqft` : (item.purpose ? item.purpose.toUpperCase() : 'Ready to Move')}`
                                    }
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Footer & Acquisition Actions */}
                          <div className="p-3.5 border-t border-slate-100 bg-slate-50/70 space-y-2">
                            {isApproved ? (
                              <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800">
                                  <CheckCircle2 size={13} /> Already Affiliated
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleTabChange('affiliations')}
                                  className="text-xs font-bold text-blue-600 hover:text-blue-800"
                                >
                                  View Link →
                                </button>
                              </div>
                            ) : isPending ? (
                              <div className="w-full py-1.5 px-3 rounded-xl bg-amber-100 text-amber-800 font-semibold text-xs flex items-center justify-center gap-1.5 border border-amber-300">
                                <Clock size={13} />
                                <span>Request Sent — Pending Approval</span>
                              </div>
                            ) : isRejected ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setRequestModalProject(item)}
                                  className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer transition-colors"
                                >
                                  <ShieldCheck size={13} />
                                  <span>Apply Again</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const agentKycObj = user?.roleKycVerification?.agent;
                                  const fallbackKyc = user?.kycVerification?.roleAtSubmission === 'agent' ? user?.kycVerification : null;
                                  const kycStatus = agentKycObj?.status || fallbackKyc?.status || 'unverified';

                                  if (kycStatus !== 'verified') {
                                    if (kycStatus === 'pending') {
                                      showToast('Your agent verification documents are under review by the Administrator.', 'info');
                                    } else if (kycStatus === 'rejected') {
                                      showToast(`Agent document verification rejected: ${agentKycObj?.rejectionReason || fallbackKyc?.rejectionReason || 'Please re-upload clear documents.'}`, 'error');
                                    } else {
                                      showToast('Mandatory Agent document verification required before requesting selling rights. Please upload your documents.', 'warning');
                                    }
                                    setShowKycModal(true);
                                    return;
                                  }
                                  setRequestModalProject(item);
                                }}
                                className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all"
                              >
                                <ShieldCheck size={14} />
                                <span>Request Selling Rights</span>
                              </button>
                            )}

                            <div className="flex items-center justify-between pt-1 text-[11px]">
                              <Link
                                to={`/property/${item._id}`}
                                className="text-slate-600 hover:text-blue-600 font-semibold flex items-center gap-1"
                                target="_blank"
                              >
                                <ExternalLink size={12} /> View Full {isProject ? 'Project' : 'Property'} Details
                              </Link>
                              <span className="text-emerald-700 font-bold">
                                Protected 30-Day Attribution
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {!discoverLoading && discoverPage < discoverTotalPages && (
                  <div className="mt-6 text-center">
                    <button
                      type="button"
                      onClick={loadMoreDiscoverProjects}
                      disabled={discoverLoadingMore}
                      className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-60"
                    >
                      {discoverLoadingMore ? 'Loading projects…' : 'Load more projects'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: MY AFFILIATIONS (Spec §7) */}
          {activeTab === 'affiliations' && (
            <div className="section-card">
              <div className="section-header pb-3 border-b border-border mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Award size={18} className="text-emerald-600" />
                    <h3 className="section-title !mb-0">
                      My Affiliations &amp; Referral Links ({filteredAffiliations.length})
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Manage all projects and properties you represent. Share your unique client tracking URLs to automatically attribute leads and secure commissions.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={affiliationSearch}
                      onChange={(e) => setAffiliationSearch(e.target.value)}
                      placeholder="Search affiliated listings..."
                      className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 w-52"
                    />
                  </div>

                  <select
                    value={affiliationFilter}
                    onChange={(e) => setAffiliationFilter(e.target.value)}
                    className="text-xs py-1.5 px-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none"
                  >
                    <option value="all">All Requests ({myPartnerships.length})</option>
                    <option value="approved">Affiliated &amp; Active ({affiliatedApprovedCount})</option>
                    <option value="pending">Pending Approval ({affiliatedPendingCount})</option>
                    <option value="rejected">Declined</option>
                  </select>
                </div>
              </div>

              <div className="section-body">
                {partnershipsLoading ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    <span className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin inline-block mr-2" />
                    Loading your affiliations...
                  </div>
                ) : filteredAffiliations.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <Award size={36} className="text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700">No affiliations found</p>
                    <p className="text-xs text-slate-500 mt-1 mb-4">
                      {myPartnerships.length === 0
                        ? "You haven't applied to represent any projects or properties yet. Explore available listings to get authorized."
                        : 'No affiliations match your current filter.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleTabChange('find-projects')}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Compass size={14} /> Find Projects &amp; Properties to Represent
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredAffiliations.map((item) => {
                      const project = item.project || {};
                      const projId = project._id || project;
                      const isProject = (project.category || 'project') === 'project';
                      const projectTitle = project.title || project.name || (isProject ? 'Development Project' : 'Property Listing');
                      const sellerName = project.builder?.companyName || project.builder?.name || item.builder?.companyName || item.builder?.name || (isProject ? 'Verified Developer' : 'Property Owner');
                      const img = project.images?.[0] || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=300';
                      const isApproved = item.status === 'approved' || item.status === 'accepted';
                      const isPending = item.status === 'pending';
                      const isRejected = item.status === 'rejected';
                      const affiliateCode = item.agentCode || user?.agentCode || user?._id;
                      const affiliateUrl = item.affiliateUrl || `${window.location.origin}/property/${projId}?agent=${affiliateCode}`;
                      const commissionRate = item.commissionRate || project.defaultCommissionRate || 2.5;

                      return (
                        <div
                          key={item._id}
                          className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          {/* Left: Thumbnail & Project/Property Meta */}
                          <div className="flex items-start gap-3.5 min-w-0 flex-1">
                            <img
                              src={img}
                              alt={projectTitle}
                              className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide text-white ${isProject ? 'bg-purple-700' : 'bg-amber-600'
                                  }`}>
                                  {isProject ? 'Project' : 'Property'}
                                </span>
                                <h4 className="font-bold text-sm text-slate-900 truncate" title={projectTitle}>
                                  {projectTitle}
                                </h4>
                                {isApproved && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                    <CheckCircle2 size={11} /> Affiliated
                                  </span>
                                )}
                                {isPending && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                                    <Clock size={11} /> Pending Review
                                  </span>
                                )}
                                {isRejected && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                                    <X size={11} /> Request Declined
                                  </span>
                                )}
                              </div>

                              <div className="text-xs text-slate-600 flex items-center gap-2 mb-1">
                                <span className="font-semibold text-slate-800">{sellerName}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-medium">
                                  {isProject ? 'Developer' : 'Owner'}
                                </span>
                                {project.location?.city && (
                                  <span className="text-slate-400">· {project.location.city}</span>
                                )}
                              </div>

                              <div className="text-[11px] text-emerald-800 font-bold flex items-center gap-1">
                                <Award size={12} />
                                <span>Commission Terms: {commissionRate}% of verified agreement value</span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Referral Link or Status CTA */}
                          <div className="md:w-96 shrink-0 space-y-2">
                            {isApproved ? (
                              <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                                  <span>Client Referral Tracking Link:</span>
                                  <span className="text-[10px] text-emerald-700 font-semibold">Active &amp; Attributed</span>
                                </label>
                                <div className="flex items-center gap-1.5 bg-slate-50 p-1 pl-2.5 rounded-xl border border-slate-300">
                                  <input
                                    type="text"
                                    readOnly
                                    value={affiliateUrl}
                                    className="w-full bg-transparent text-[11px] font-mono text-slate-800 truncate select-all outline-hidden"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleCopyLink(affiliateCode, affiliateUrl, item._id)}
                                    className={`shrink-0 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${copiedLinkMap[item._id]
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                                      }`}
                                  >
                                    {copiedLinkMap[item._id] ? <Check size={12} /> : <Copy size={12} />}
                                    <span>{copiedLinkMap[item._id] ? 'Copied!' : 'Copy Link'}</span>
                                  </button>
                                </div>
                                <div className="flex items-center justify-between pt-0.5">
                                  <a
                                    href={affiliateUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                                  >
                                    <span>Open {isProject ? 'Project' : 'Property'} Page</span>
                                    <ExternalLink size={11} />
                                  </a>
                                  <span className="text-[10px] text-slate-400">
                                    30-Day First-Touch Lock
                                  </span>
                                </div>
                              </div>
                            ) : isPending ? (
                              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs space-y-1">
                                <div className="font-bold flex items-center gap-1">
                                  <Clock size={13} />
                                  <span>Application Pending Review</span>
                                </div>
                                <p className="text-[11px] text-amber-800 leading-relaxed">
                                  The seller has been notified. As soon as they accept your request, your unique tracking URL will activate here.
                                </p>
                              </div>
                            ) : (
                              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 text-xs space-y-2">
                                <div className="font-bold flex items-center gap-1">
                                  <AlertCircle size={13} />
                                  <span>Request Declined</span>
                                </div>
                                <p className="text-[11px] text-rose-800 leading-relaxed">
                                  {item.rejectionReason
                                    ? `Seller note: "${item.rejectionReason}".`
                                    : 'The seller declined this request. You can re-apply.'}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setRequestModalProject(project)}
                                  className="w-full py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
                                >
                                  Apply Again
                                </button>
                              </div>
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
      {isModalOpen && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {/* Mandatory KYC Verification Modal for Agent */}
      {showKycModal && (
        <Suspense fallback={null}>
          <KycVerificationModal
            isOpen={showKycModal}
            onClose={() => setShowKycModal(false)}
            user={user}
            targetRole="agent"
            showToast={showToast}
            onVerificationSubmitted={(kycData) => {
              if (user) {
                if (!user.roleKycVerification) user.roleKycVerification = {};
                user.roleKycVerification.agent = kycData;
                user.kycVerification = kycData;
              }
            }}
          />
        </Suspense>
      )}

      {/* ── 1. Request Selling Rights Modal for Agents (Spec §3) ── */}
      {bookingLead && (
        <Suspense fallback={null}>
          <BookUnitModal
            isOpen={!!bookingLead}
            lead={bookingLead}
            showToast={showToast}
            onClose={() => setBookingLead(null)}
            onViewInvoice={(bId) => setInvoiceBookingId(bId)}
            onSuccess={(data) => {
              const bRef = data?.booking?._id || data?.booking || true;
              setInquiries((items) => items.map((item) => item._id === bookingLead?._id
                ? { ...item, lifecycleStage: 'unit_booked', bookingRef: bRef }
                : item));
              setBookingLead(null);
            }}
          />
        </Suspense>
      )}

      {/* Official Token Payment Invoice Modal */}
      {Boolean(invoiceBookingId) && (
        <Suspense fallback={null}>
          <BookingInvoiceModal
            isOpen={Boolean(invoiceBookingId)}
            bookingId={invoiceBookingId}
            onClose={() => setInvoiceBookingId(null)}
          />
        </Suspense>
      )}

      {Boolean(requestModalProject) && (
        <Suspense fallback={null}>
          <RequestSellingRightsModal
            isOpen={Boolean(requestModalProject)}
            project={requestModalProject}
            showToast={showToast}
            onClose={() => setRequestModalProject(null)}
            onSuccess={() => {
              setRequestModalProject(null);
              fetchMyPartnerships(true);
              fetchDiscoverProjects(true);
              if (showToast) showToast('Acquisition request submitted to builder!', 'success');
            }}
          />
        </Suspense>
      )}

      {/* ── 2. Real-Time Acquisition Status Notification Window (Spec §9) ── */}
      {statusNotificationModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-left relative overflow-hidden">
            <div className={`h-1.5 absolute top-0 left-0 right-0 ${statusNotificationModal.status === 'approved' || statusNotificationModal.status === 'accepted'
              ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600'
              : 'bg-gradient-to-r from-rose-500 via-red-500 to-rose-600'
              }`} />

            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${statusNotificationModal.status === 'approved' || statusNotificationModal.status === 'accepted'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
                  }`}>
                  {statusNotificationModal.status === 'approved' || statusNotificationModal.status === 'accepted' ? (
                    <Award size={20} />
                  ) : (
                    <AlertCircle size={20} />
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-base">
                    {statusNotificationModal.status === 'approved' || statusNotificationModal.status === 'accepted'
                      ? 'Your Agent Request Has Been Accepted'
                      : 'Your Agent Request Has Been Rejected'}
                  </h4>
                  <p className="text-[11px] text-slate-500">Real-time Acquisition Update</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStatusNotificationModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs mb-5">
              {statusNotificationModal.status === 'approved' || statusNotificationModal.status === 'accepted' ? (
                <>
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 space-y-1">
                    <div>
                      Developer <strong>{statusNotificationModal.builderName}</strong> approved your request to acquire and represent:
                    </div>
                    <div className="font-black text-sm text-emerald-800 pt-0.5">
                      &ldquo;{statusNotificationModal.projectTitle}&rdquo;
                    </div>
                    <div className="text-[11px] text-emerald-900 pt-1 font-semibold">
                      Agreed Commission: {statusNotificationModal.commissionRate}% of agreement value
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600">
                    Your exclusive client tracking link is now active. Any prospective buyer who clicks your link will be locked to your agency under 30-day first-touch attribution:
                  </p>

                  <div className="flex items-center gap-1.5 bg-slate-50 p-1 pl-2.5 rounded-xl border border-slate-300">
                    <input
                      type="text"
                      readOnly
                      value={statusNotificationModal.affiliateUrl || `${window.location.origin}/property?agent=${statusNotificationModal.affiliateCode || user?.agentCode}`}
                      className="w-full bg-transparent text-[11px] font-mono text-slate-800 select-all outline-hidden truncate"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const link = statusNotificationModal.affiliateUrl || `${window.location.origin}/property?agent=${statusNotificationModal.affiliateCode || user?.agentCode}`;
                        navigator.clipboard.writeText(link);
                        if (showToast) showToast('Referral link copied to clipboard!', 'success');
                      }}
                      className="shrink-0 py-1.5 px-3 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Copy size={12} />
                      <span>Copy</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-950 space-y-1">
                  <div>
                    Developer <strong>{statusNotificationModal.builderName}</strong> declined your request for:
                  </div>
                  <div className="font-bold text-sm text-rose-800 pt-0.5">
                    &ldquo;{statusNotificationModal.projectTitle}&rdquo;
                  </div>
                  {statusNotificationModal.rejectionReason && (
                    <div className="text-[11px] text-slate-700 italic pt-1 bg-white p-2 rounded border border-rose-200">
                      &ldquo;{statusNotificationModal.rejectionReason}&rdquo;
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStatusNotificationModal(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Dismiss
              </button>
              {statusNotificationModal.status === 'approved' || statusNotificationModal.status === 'accepted' ? (
                <button
                  type="button"
                  onClick={() => {
                    setStatusNotificationModal(null);
                    handleTabChange('affiliations');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Award size={13} />
                  <span>View in My Affiliations</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setStatusNotificationModal(null);
                    handleTabChange('find-projects');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Compass size={13} />
                  <span>Find Other Projects</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AgentDashboard;
