import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Edit2,
  Trash2,
  Building2,
  Calendar,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Search,
  Download,
  CheckCircle2,
  Clock,
  MessageSquare,
  TrendingUp,
  LayoutDashboard,
  Filter,
  Check,
  X,
  Eye,
  ShieldCheck,
  ChevronDown,
  Send,
  Users,
  Award,
  UserCheck,
  UserX,
  AlertTriangle,
  Copy,
  Bell,
  Globe,
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
  updateProperty,
} from '../../services/propertyService';
import {
  getBuilderPartnerships,
  updatePartnershipStatus,
} from '../../services/partnershipService';
import { formatPhoneNumber, formatPrice } from '../../utils/formatters';
import { broadcastRealtimeSync, useRealtimeSync, SYNC_EVENTS } from '../../utils/realtimeSync';
import AddPropertyModal from '../../components/dashboard/AddPropertyModal';
import './BuilderDashboard.css';

const BuilderDashboard = () => {
  const { user, accessToken, showToast, logout } = useAuth();
  const { on, off } = useSocket(accessToken);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const validTabs = ['overview', 'projects', 'leads', 'visits', 'requests'];
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

  // Projects / Properties State
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editProperty, setEditProperty] = useState(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState('all');
  const [projectCategoryFilter, setProjectCategoryFilter] = useState('all');

  // Inquiries / Leads State
  const [inquiries, setInquiries] = useState([]);
  const [inqLoading, setInqLoading] = useState(true);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadSourceFilter, setLeadSourceFilter] = useState('all'); // 'all' | 'agent' | 'direct'
  const [expandedInquiryId, setExpandedInquiryId] = useState(null);
  const [selectedInquiryIds, setSelectedInquiryIds] = useState([]);

  // Reply Modal State
  const [replyModalItem, setReplyModalItem] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Reschedule visit modal state
  const [rescheduleItem, setRescheduleItem] = useState(null);
  const [newVisitDate, setNewVisitDate] = useState('');
  const [newVisitTime, setNewVisitTime] = useState('');

  // Agent Acquisition / Partnerships State (Spec §1, §5, §8, §9)
  const [partnerships, setPartnerships] = useState([]);
  const [partnershipsLoading, setPartnershipsLoading] = useState(false);
  const [partnershipProjectFilter, setPartnershipProjectFilter] = useState('all');
  const [partnershipStatusFilter, setPartnershipStatusFilter] = useState('all');
  const [partnershipSearch, setPartnershipSearch] = useState('');
  const [partnershipDateSort, setPartnershipDateSort] = useState('desc');
  const [selectedAgentModal, setSelectedAgentModal] = useState(null);
  const [projectAgentModal, setProjectAgentModal] = useState(null);
  const [newRequestNotification, setNewRequestNotification] = useState(null);
  const [rejectReasonModal, setRejectReasonModal] = useState(null);
  const [rejectionReasonText, setRejectionReasonText] = useState('');
  const [actionPartnershipId, setActionPartnershipId] = useState(null);
  const [copiedLinkMap, setCopiedLinkMap] = useState({});

  const fetchProperties = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const res = await getMyProperties();
      if (res.success && Array.isArray(res.data)) {
        setProjects(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch builder properties:', error);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, []);

  const fetchInquiries = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setInqLoading(true);
      const res = await getMyInquiries({ role: 'builder' });
      if (res.success && Array.isArray(res.data)) {
        setInquiries(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch builder inquiries:', error);
    } finally {
      if (!isBackground) setInqLoading(false);
    }
  }, []);

  const fetchPartnerships = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setPartnershipsLoading(true);
      const res = await getBuilderPartnerships();
      if (res.success && Array.isArray(res.data)) {
        setPartnerships(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch builder agent requests:', error);
    } finally {
      if (!isBackground) setPartnershipsLoading(false);
    }
  }, []);

  // Real-time synchronization for inquiries, properties, and agent partnerships
  useRealtimeSync(
    [
      SYNC_EVENTS.INQUIRIES,
      SYNC_EVENTS.PROPERTIES,
      SYNC_EVENTS.PARTNERSHIPS,
    ],
    () => {
      fetchProperties(true);
      fetchInquiries(true);
      fetchPartnerships(true);
    },
    { revalidateOnFocus: true, intervalMs: 15000 }
  );

  // Server-push Socket.io real-time events
  useEffect(() => {
    // New lead / inquiry attributed to this builder's project
    on(SOCKET_EVENTS.NEW_ATTRIBUTED_LEAD, (data) => {
      showToast(`📩 New ${data.visitRequested ? 'site visit request' : 'inquiry'} on "${data.propertyTitle}"!`, 'info');
      fetchInquiries(true);
    });

    // Real-time popup notification for new agent acquisition requests (Spec §9)
    on(SOCKET_EVENTS.PARTNERSHIP_REQUEST_CREATED, (data) => {
      fetchPartnerships(true);
      setNewRequestNotification({
        agentName: data.agentName || 'Channel Partner',
        projectTitle: data.projectTitle || 'Your Project',
        projectId: data.projectId,
        partnershipId: data.partnershipId,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        message: data.message || '',
      });
      showToast(`🤝 New Agent Request: ${data.agentName || 'An agent'} requested to acquire "${data.projectTitle || 'your project'}"!`, 'info');
    });

    return () => {
      off(SOCKET_EVENTS.NEW_ATTRIBUTED_LEAD);
      off(SOCKET_EVENTS.PARTNERSHIP_REQUEST_CREATED);
    };
  }, [on, off, fetchInquiries, fetchPartnerships, showToast]);

  useEffect(() => {
    fetchProperties(false);
    fetchInquiries(false);
    fetchPartnerships(false);
  }, [fetchProperties, fetchInquiries, fetchPartnerships]);

  // Project-Level Agent Acquisition Toggle Handler (Spec §1, §8)
  const handleToggleAcquisition = async (project) => {
    const nextVal = !(project.allowAgentAcquisition || project.networkEnabled);
    try {
      const res = await updateProperty(project._id, {
        allowAgentAcquisition: nextVal,
        networkEnabled: nextVal,
      });
      if (res.success) {
        setProjects((prev) =>
          prev.map((p) =>
            p._id === project._id
              ? { ...p, allowAgentAcquisition: nextVal, networkEnabled: nextVal }
              : p
          )
        );
        if (projectAgentModal && projectAgentModal._id === project._id) {
          setProjectAgentModal((prev) => ({
            ...prev,
            allowAgentAcquisition: nextVal,
            networkEnabled: nextVal,
          }));
        }
        broadcastRealtimeSync(SYNC_EVENTS.PROPERTIES, { action: 'updated', id: project._id });
        broadcastRealtimeSync(SYNC_EVENTS.PARTNERSHIPS, { action: 'acquisition_toggled', id: project._id });
        showToast(
          nextVal
            ? `Agent acquisition enabled for "${project.title}". Agents can now discover and request selling rights.`
            : `Agent acquisition disabled for "${project.title}". Hidden from agent discovery.`,
          'success'
        );
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update agent acquisition setting', 'error');
    }
  };

  // Partnership Accept Action Handler (Spec §5, §6)
  const handleAcceptPartnership = async (partnershipId) => {
    try {
      setActionPartnershipId(partnershipId);
      const res = await updatePartnershipStatus(partnershipId, 'approved');
      if (res.success) {
        setPartnerships((prev) =>
          prev.map((item) => (item._id === partnershipId ? { ...item, ...res.data, status: 'approved' } : item))
        );
        broadcastRealtimeSync(SYNC_EVENTS.PARTNERSHIPS, { action: 'approved', partnershipId });
        showToast('Agent request approved! Referral tracking link activated for this agent.', 'success');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to approve agent request', 'error');
    } finally {
      setActionPartnershipId(null);
    }
  };

  // Partnership Reject Action Handler (Spec §5)
  const handleRejectPartnership = async (partnershipId, reason = '') => {
    try {
      setActionPartnershipId(partnershipId);
      const res = await updatePartnershipStatus(partnershipId, 'rejected', null, reason);
      if (res.success) {
        setPartnerships((prev) =>
          prev.map((item) => (item._id === partnershipId ? { ...item, ...res.data, status: 'rejected' } : item))
        );
        broadcastRealtimeSync(SYNC_EVENTS.PARTNERSHIPS, { action: 'rejected', partnershipId });
        showToast('Agent request rejected.', 'info');
        setRejectReasonModal(null);
        setRejectionReasonText('');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to reject agent request', 'error');
    } finally {
      setActionPartnershipId(null);
    }
  };

  const handleCopyLink = (code, url, id) => {
    const targetUrl = url || `${window.location.origin}/property/${id}?agent=${code}`;
    navigator.clipboard.writeText(targetUrl);
    setCopiedLinkMap((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedLinkMap((prev) => ({ ...prev, [id]: false }));
    }, 2000);
    showToast('Affiliate tracking link copied to clipboard!', 'success');
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this listing from your portfolio?')) {
      try {
        const res = await deleteProperty(id);
        if (res.success) {
          broadcastRealtimeSync(SYNC_EVENTS.PROPERTIES, { action: 'deleted', id });
          showToast('Project listing deleted successfully', 'success');
          await fetchProperties();
        }
      } catch (error) {
        showToast('Failed to delete project listing', 'error');
      }
    }
  };

  const [actionLoadingId, setActionLoadingId] = useState(null);

  const handleStatusChange = async (inquiryId, newStatus, extraData = {}) => {
    try {
      setActionLoadingId(inquiryId);
      const res = await updateInquiryStatus(inquiryId, newStatus, {
        lifecycleStage: newStatus,
        ...extraData,
      });
      if (res.success) {
        broadcastRealtimeSync(SYNC_EVENTS.INQUIRIES, { action: 'status_updated', inquiryId, newStatus, ...extraData });
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
                  lifecycleStage: newStatus,
                  ...extraData,
                }
              : inq
          )
        );
        showToast(
          newStatus === 'closed'
            ? 'Site visit confirmed and marked completed!'
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

  const handleSendReply = async (e) => {
    if (e) e.preventDefault();
    if (!replyModalItem || !replyMessage.trim()) {
      showToast('Please enter a reply message to send', 'error');
      return;
    }

    const inquiryId = replyModalItem._id;
    const buyerEmail = replyModalItem.email;

    try {
      setSendingReply(true);
      const res = await replyToInquiryApi(inquiryId, replyMessage.trim());
      if (res.success) {
        showToast(res.message || `Reply email sent to ${buyerEmail} and inquiry resolved!`, 'success');
        // Automatically remove replied inquiry from database & UI
        setInquiries((prev) => prev.filter((inq) => inq._id !== inquiryId));
        setSelectedInquiryIds((prev) => prev.filter((id) => id !== inquiryId));
        if (expandedInquiryId === inquiryId) setExpandedInquiryId(null);
        broadcastRealtimeSync(SYNC_EVENTS.INQUIRIES, { action: 'deleted', id: inquiryId });
        setReplyModalItem(null);
        setReplyMessage('');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send reply email';
      showToast(msg, 'error');
    } finally {
      setSendingReply(false);
    }
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

  // CSV Inquiry Export
  const exportLeadsCsv = () => {
    if (filteredInquiries.length === 0) {
      showToast('No inquiries available to export', 'info');
      return;
    }

    const headers = ['Buyer Name', 'Email', 'Project / Property', 'Message', 'Date Received'];
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
    if (!name) return '??';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  // General Property Inquiries (Strictly excludes site visit requests)
  const propertyInquiries = inquiries.filter((e) => !e.visitRequested && e.status !== 'visit');

  // Site visits list (Strictly site visits only)
  const siteVisitsList = inquiries.filter((e) => e.visitRequested || e.status === 'visit');

  // Agent vs Direct lead counts
  const agentInquiriesCount = propertyInquiries.filter((e) => Boolean(e.isAttributed || e.agent || e.agentCode)).length;
  const directInquiriesCount = propertyInquiries.filter((e) => !Boolean(e.isAttributed || e.agent || e.agentCode)).length;

  const agentVisitsCount = siteVisitsList.filter((e) => Boolean(e.isAttributed || e.agent || e.agentCode)).length;
  const directVisitsCount = siteVisitsList.filter((e) => !Boolean(e.isAttributed || e.agent || e.agentCode)).length;

  // Filtered general inquiries (Strictly excludes site visit requests)
  const filteredInquiries = propertyInquiries
    .filter((e) => {
      const isAgentLead = Boolean(e.isAttributed || e.agent || e.agentCode);
      if (leadSourceFilter === 'agent') return isAgentLead;
      if (leadSourceFilter === 'direct') return !isAgentLead;
      return true;
    })
    .filter((e) => {
      if (!leadSearch) return true;
      const q = leadSearch.toLowerCase().trim();
      return (
        (e.name && e.name.toLowerCase().includes(q)) ||
        (e.email && e.email.toLowerCase().includes(q)) ||
        (e.property?.title && e.property.title.toLowerCase().includes(q)) ||
        (e.propertyTitle && e.propertyTitle.toLowerCase().includes(q)) ||
        (e.projectName && e.projectName.toLowerCase().includes(q)) ||
        (e.agent?.name && e.agent.name.toLowerCase().includes(q)) ||
        (e.agentCode && e.agentCode.toLowerCase().includes(q))
      );
    });

  // Filtered site visits
  const filteredVisits = siteVisitsList.filter((e) => {
    const isAgentLead = Boolean(e.isAttributed || e.agent || e.agentCode);
    if (leadSourceFilter === 'agent') return isAgentLead;
    if (leadSourceFilter === 'direct') return !isAgentLead;
    return true;
  });

  // Filtered projects
  const filteredProjects = projects
    .filter((p) => {
      if (projectStatusFilter === 'all') return true;
      return p.status === projectStatusFilter;
    })
    .filter((p) => {
      if (projectCategoryFilter === 'all') return true;
      const isProj = p.category === 'project' || p.isProject || p.propertyType === 'project' || Boolean(p.unitsCount || p.towersCount);
      return projectCategoryFilter === 'project' ? isProj : !isProj;
    })
    .filter((p) => {
      if (!projectSearch) return true;
      const q = projectSearch.toLowerCase();
      return (
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.location?.city && p.location.city.toLowerCase().includes(q)) ||
        (p.location?.address && p.location.address.toLowerCase().includes(q))
      );
    });

  const visitCount = siteVisitsList.length;
  const newCount = propertyInquiries.length;
  const closedCount = inquiries.filter((e) => e.status === 'closed').length;

  // Filtered agent partnership requests (Spec §5)
  const filteredPartnerships = partnerships.filter((req) => {
    if (partnershipProjectFilter !== 'all') {
      const projId = req.project?._id || req.project;
      if (String(projId) !== String(partnershipProjectFilter)) return false;
    }
    if (partnershipStatusFilter !== 'all') {
      if (partnershipStatusFilter === 'pending' && req.status !== 'pending') return false;
      if (partnershipStatusFilter === 'accepted' && req.status !== 'approved' && req.status !== 'accepted') return false;
      if (partnershipStatusFilter === 'rejected' && req.status !== 'rejected') return false;
    }
    if (partnershipSearch.trim()) {
      const q = partnershipSearch.toLowerCase().trim();
      const agentName = (req.agent?.name || req.agentProfile?.user?.name || '').toLowerCase();
      const agentEmail = (req.agent?.email || req.agentProfile?.user?.email || '').toLowerCase();
      const projTitle = (req.project?.title || '').toLowerCase();
      if (!agentName.includes(q) && !agentEmail.includes(q) && !projTitle.includes(q)) {
        return false;
      }
    }
    return true;
  }).sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    return partnershipDateSort === 'asc' ? timeA - timeB : timeB - timeA;
  });

  const pendingPartnershipsCount = partnerships.filter((p) => p.status === 'pending').length;
  const approvedPartnershipsCount = partnerships.filter((p) => p.status === 'approved' || p.status === 'accepted').length;
  const rejectedPartnershipsCount = partnerships.filter((p) => p.status === 'rejected').length;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentCount = propertyInquiries.filter((e) => new Date(e.createdAt) > thirtyDaysAgo).length;

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'BL';

  const companyName = user?.builderProfile?.companyName || user?.name || 'Builder Partner';

  return (
    <div className="builder-wrapper">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="logo-icon">
            <Building2 size={20} />
          </div>
          <div>
            <div className="brand-text">
              <Link to="/">
                Estate<span>Xplorer</span>
              </Link>
            </div>
            <div className="role">Builder Portal</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-label">Management</div>
            <button
              onClick={() => handleTabChange('overview')}
              className={`nav-item w-full text-left flex items-center gap-2 ${
                activeTab === 'overview' ? 'active' : ''
              }`}
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => handleTabChange('projects')}
              className={`nav-item w-full text-left flex items-center justify-between ${
                activeTab === 'projects' ? 'active' : ''
              }`}
            >
              <span className="flex items-center gap-2">
                <Building2 size={18} />
                <span>Projects & Listings</span>
              </span>
              {projects.length > 0 && (
                <span className="nav-badge nav-badge-neutral">{projects.length}</span>
              )}
            </button>

            <button
              onClick={() => handleTabChange('leads')}
              className={`nav-item w-full text-left flex items-center justify-between ${
                activeTab === 'leads' ? 'active' : ''
              }`}
            >
              <span className="flex items-center gap-2">
                <MessageSquare size={18} />
                <span>Property Inquiries</span>
              </span>
              {propertyInquiries.length > 0 && (
                <span className="nav-badge nav-badge-blue">{propertyInquiries.length}</span>
              )}
            </button>

            <button
              onClick={() => handleTabChange('visits')}
              className={`nav-item w-full text-left flex items-center justify-between ${
                activeTab === 'visits' ? 'active' : ''
              }`}
            >
              <span className="flex items-center gap-2">
                <Calendar size={18} />
                <span>Site Visit Bookings</span>
              </span>
              {siteVisitsList.length > 0 && (
                <span className="nav-badge nav-badge-amber">{siteVisitsList.length}</span>
              )}
            </button>

            <button
              onClick={() => handleTabChange('requests')}
              className={`nav-item w-full text-left flex items-center justify-between ${
                activeTab === 'requests' ? 'active' : ''
              }`}
            >
              <span className="flex items-center gap-2">
                <Users size={18} />
                <span>Agent Requests</span>
              </span>
              {pendingPartnershipsCount > 0 ? (
                <span className="nav-badge nav-badge-amber">{pendingPartnershipsCount}</span>
              ) : partnerships.length > 0 ? (
                <span className="nav-badge nav-badge-neutral">{partnerships.length}</span>
              ) : null}
            </button>
          </div>

          <div className="nav-section">
            <div className="nav-section-label">Account & System</div>
            <Link className="nav-item flex items-center gap-2" to="/dashboard/profile">
              <ShieldCheck size={18} />
              <span>Profile</span>
            </Link>
            <button
              className="nav-item w-full text-left bg-transparent border-0 cursor-pointer flex items-center gap-2"
              onClick={logout}
            >
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span>Sign Out</span>
            </button>
          </div>
        </nav>

        <div className="sidebar-footer">
          <Link to="/dashboard/profile" className="builder-profile">
            <div className="builder-avatar">{initials}</div>
            <div className="builder-info">
              <div className="builder-name">{companyName}</div>
              <div className="builder-company">Builder Account</div>
            </div>
          </Link>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="main">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="page-title">
              {activeTab === 'overview' && 'Builder Management Dashboard'}
              {activeTab === 'projects' && 'Project & Development Portfolio'}
              {activeTab === 'leads' && 'Buyer Leads & Inquiries CRM'}
              {activeTab === 'visits' && 'Site Visit Bookings & Schedules'}
              {activeTab === 'requests' && 'Agent Acquisition Requests & Network'}
            </h1>
          </div>
          <div className="topbar-right flex items-center gap-3">
            <button
              className="btn btn-primary inline-flex items-center gap-2 shadow-sm"
              onClick={() => {
                setEditProperty(null);
                setIsModalOpen(true);
              }}
            >
              <Plus size={16} /> Add New Project
            </button>
          </div>
        </header>

        <div className="content space-y-6">
          {/* Welcome Note */}
          <div className="welcome">
            <p>
              Welcome back, <strong>{companyName}</strong> · Manage your residential &amp; commercial developments, monitor buyer inquiries, and confirm site visit schedules.
            </p>
          </div>

          {/* Stats Grid */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon blue">
                  <Building2 size={20} />
                </div>
              </div>
              <div className="stat-value">{projects.length}</div>
              <div className="stat-label">Live Developments</div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon purple" style={{ background: 'rgba(124, 58, 237, 0.08)', color: '#7c3aed' }}>
                  <MessageSquare size={20} />
                </div>
              </div>
              <div className="stat-value">{propertyInquiries.length}</div>
              <div className="stat-label">Property Inquiries</div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon orange">
                  <Calendar size={20} />
                </div>
              </div>
              <div className="stat-value">{visitCount}</div>
              <div className="stat-label">Scheduled Site Visits</div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon green">
                  <CheckCircle2 size={20} />
                </div>
              </div>
              <div className="stat-value">{closedCount}</div>
              <div className="stat-label">Closed / Booked Leads</div>
            </div>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Enquiries Feed (2 cols) */}
                <div className="lg:col-span-2 card">
                  <div className="card-header">
                    <h2 className="card-title">Recent Property Inquiries</h2>
                    <button
                      onClick={() => handleTabChange('leads')}
                      className="card-action text-xs"
                    >
                      View All ({propertyInquiries.length}) →
                    </button>
                  </div>

                  <div className="card-body">
                    {inqLoading ? (
                      <p className="text-xs text-muted">Loading inquiries...</p>
                    ) : propertyInquiries.length === 0 ? (
                      <div className="text-center py-8 text-muted text-xs">
                        No property inquiries received yet. When visitors inquire on your projects, they will appear here.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Bulk Action Bar - Only shows when items are selected */}
                        {selectedInquiryIds.length > 0 && (
                          <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                            <span className="font-semibold text-blue-800">
                              {selectedInquiryIds.length} inquiry{selectedInquiryIds.length > 1 ? 'ies' : ''} selected
                            </span>
                            <button
                              type="button"
                              onClick={handleBulkDeleteInquiries}
                              className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Trash2 size={12} />
                              <span>Delete Selected</span>
                            </button>
                          </div>
                        )}

                        <div className="divide-y divide-slate-100">
                          {propertyInquiries.slice(0, 5).map((lead) => {
                            const isExpanded = expandedInquiryId === lead._id;
                            const isSelected = selectedInquiryIds.includes(lead._id);
                            const propTitle = lead.property?.title || lead.propertyTitle || 'Project Listing';

                            return (
                              <div
                                key={lead._id}
                                className={`py-2.5 px-2 rounded-lg transition-colors ${
                                  isSelected ? 'bg-blue-50/50' : isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50/70'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  {/* Left: Checkbox + Avatar + Buyer & Project Info */}
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
                                        <span className="text-slate-600 font-normal truncate max-w-[220px]" title={propTitle}>
                                          {propTitle}
                                        </span>
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
                                      className="px-2.5 py-1 rounded-md text-[0.68rem] font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                                      title="Reply via Email"
                                    >
                                      <Mail size={11} />
                                      <span>Reply</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setExpandedInquiryId(isExpanded ? null : lead._id)}
                                      className="px-2 py-1 rounded text-[0.68rem] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center gap-1 transition-colors cursor-pointer"
                                    >
                                      <Eye size={11} />
                                      <span>{isExpanded ? 'Hide' : 'View'}</span>
                                    </button>

                                    <button
                                      type="button"
                                      title="Delete Inquiry"
                                      onClick={(e) => handleDeleteSingleInquiry(lead._id, e)}
                                      className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>

                                {/* Compact Detail Expand on click */}
                                {isExpanded && (
                                  <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-700 space-y-1.5 bg-white p-2.5 rounded border border-slate-200 text-left animate-fade-in">
                                    {lead.message && (
                                      <p className="text-[0.72rem] text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-100">
                                        &ldquo;{lead.message}&rdquo;
                                      </p>
                                    )}
                                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                      <div className="flex items-center gap-3 text-[0.72rem]">
                                        {lead.email && (
                                          <a
                                            href={`mailto:${lead.email}`}
                                            className="text-blue-700 hover:underline font-semibold flex items-center gap-1"
                                          >
                                            <Mail size={11} /> Email Buyer ({lead.email})
                                          </a>
                                        )}
                                      </div>
                                      {(lead.property?._id || lead.property) && (
                                        <Link
                                          to={`/property/${lead.property?._id || lead.property}`}
                                          className="text-slate-600 hover:text-blue-600 hover:underline text-[0.72rem] font-medium flex items-center gap-1 ml-auto"
                                        >
                                          <ExternalLink size={10} /> View Project
                                        </Link>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Upcoming Site Visits Snapshot (1 col) */}
                <div className="card">
                  <div className="card-header">
                    <h2 className="card-title">Site Visit Bookings</h2>
                    <button
                      onClick={() => handleTabChange('visits')}
                      className="card-action text-xs"
                    >
                      View All →
                    </button>
                  </div>

                  <div className="p-5">
                    {siteVisitsList.length === 0 ? (
                      <div className="text-center py-8 text-muted text-xs">
                        No pending site visit appointments.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {siteVisitsList.slice(0, 4).map((visit) => (
                          <div
                            key={visit._id}
                            className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl flex items-start gap-2.5"
                          >
                            <div className="p-2 bg-amber-500 text-white rounded-lg text-center shrink-0">
                              <Calendar size={15} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-xs text-navy truncate">
                                {visit.name}
                              </div>
                              <div className="text-[0.7rem] text-muted truncate">
                                {visit.property?.title || visit.propertyTitle}
                              </div>
                              <div className="text-[0.68rem] text-amber-800 font-semibold mt-1 flex items-center gap-1">
                                <Clock size={11} /> {visit.visitDate || 'Date TBD'} · {visit.visitTime || 'Time TBD'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Projects Grid Snapshot */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Project Developments Portfolio</h2>
                  <button
                    onClick={() => handleTabChange('projects')}
                    className="card-action text-xs"
                  >
                    Manage All ({projects.length}) →
                  </button>
                </div>

                <div className="p-5">
                  {loading ? (
                    <p className="text-xs text-muted">Loading your developments...</p>
                  ) : projects.length === 0 ? (
                    <div className="text-center py-8 text-muted text-xs">
                      No project listings created yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {projects.slice(0, 3).map((project) => (
                        <div
                          key={project._id}
                          className="border border-border rounded-xl overflow-hidden bg-surface hover:shadow-md transition-shadow flex flex-col justify-between"
                        >
                          <div>
                            <div className="h-36 w-full bg-slate-100 relative">
                              <img
                                src={project.images?.[0] || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=600&auto=format&fit=crop'}
                                alt={project.title}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-2 left-2 flex items-center gap-1.5 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-[0.65rem] font-extrabold uppercase tracking-wider shadow-xs ${
                                  (project.category === 'project' || project.isProject || project.propertyType === 'project' || project.unitsCount || project.towersCount)
                                    ? 'bg-purple-700 text-white'
                                    : 'bg-blue-600 text-white'
                                }`}>
                                  {(project.category === 'project' || project.isProject || project.propertyType === 'project' || project.unitsCount || project.towersCount) ? 'Project' : 'Property'}
                                </span>
                              </div>
                              <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[0.65rem] font-bold bg-white/90 text-slate-800 backdrop-blur-sm">
                                {project.statusLabel || (project.status === 'uc' ? 'Under Construction' : 'Ready')}
                              </span>
                            </div>
                            <div className="p-3.5">
                              <h4 className="font-bold text-xs text-navy mb-1 truncate">{project.title}</h4>
                              <p className="text-[0.72rem] text-muted mb-2 truncate">
                                {project.location?.address}, {project.location?.city}
                              </p>
                              <div className="text-xs font-black text-blue-600">{project.priceDisplay || `₹ ${project.price?.toLocaleString()}`}</div>
                            </div>
                          </div>

                          <div className="p-3 border-t border-border flex items-center justify-between bg-slate-50/50">
                            <Link
                              to={`/property/${project._id}`}
                              className="text-[0.72rem] text-muted font-semibold hover:text-blue-600 flex items-center gap-1"
                              target="_blank"
                            >
                              <ExternalLink size={12} /> View on Site
                            </Link>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setEditProperty(project);
                                  setIsModalOpen(true);
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                                title="Edit Project"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(project._id)}
                                className="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition-colors"
                                title="Delete Project"
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
            </div>
          )}

          {/* TAB 2: PROJECTS & DEVELOPMENTS */}
          {activeTab === 'projects' && (
            <div className="section-card">
              <div className="section-header pb-3 border-b border-border mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Building2 size={18} className="text-blue-600" />
                  <h3 className="section-title !mb-0">All Projects & Properties ({filteredProjects.length})</h3>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Search */}
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      placeholder="Search projects..."
                      className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 w-48"
                    />
                  </div>

                  {/* Filter Status */}
                  <select
                    value={projectStatusFilter}
                    onChange={(e) => setProjectStatusFilter(e.target.value)}
                    className="text-xs py-1.5 px-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="uc">Under Construction</option>
                    <option value="ready">Ready to Move</option>
                    <option value="upcoming">New Launch</option>
                  </select>

                  {/* Filter Type (Project vs Property) */}
                  <select
                    value={projectCategoryFilter}
                    onChange={(e) => setProjectCategoryFilter(e.target.value)}
                    className="text-xs py-1.5 px-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none"
                  >
                    <option value="all">All Types</option>
                    <option value="project">Only Projects</option>
                    <option value="property">Only Properties</option>
                  </select>

                  <button
                    onClick={() => {
                      setEditProperty(null);
                      setIsModalOpen(true);
                    }}
                    className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                  >
                    <Plus size={14} /> Add Project
                  </button>
                </div>
              </div>

              <div className="section-body">
                {loading ? (
                  <p className="text-xs text-slate-500">Loading listings...</p>
                ) : filteredProjects.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <Building2 size={36} className="text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700">No project listings found</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Click "Add New Project" to create your first housing development.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProjects.map((project) => (
                      <div
                        key={project._id}
                        className="border border-slate-200 rounded-xl overflow-hidden bg-white hover:shadow-md transition-shadow flex flex-col justify-between"
                      >
                        <div>
                          <div className="h-40 w-full bg-slate-100 relative">
                            <img
                              src={project.images?.[0] || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=600&auto=format&fit=crop'}
                              alt={project.title}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 left-2 flex items-center gap-1.5 flex-wrap">
                              <span className={`px-2 py-0.5 rounded text-[0.65rem] font-extrabold uppercase tracking-wider shadow-xs ${
                                (project.category === 'project' || project.isProject || project.propertyType === 'project' || project.unitsCount || project.towersCount)
                                  ? 'bg-purple-700 text-white'
                                  : 'bg-blue-600 text-white'
                              }`}>
                                {(project.category === 'project' || project.isProject || project.propertyType === 'project' || project.unitsCount || project.towersCount) ? 'Project' : 'Property'}
                              </span>
                              {project.rera && (
                                <span className="px-2 py-0.5 rounded text-[0.65rem] font-bold bg-emerald-600 text-white shadow-xs">
                                  RERA
                                </span>
                              )}
                            </div>
                            <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[0.65rem] font-bold bg-white/90 text-slate-800 backdrop-blur-sm">
                              {project.statusLabel || (project.status === 'uc' ? 'Under Construction' : 'Ready')}
                            </span>
                          </div>
                          <div className="p-4">
                            <div className="text-[0.7rem] font-bold uppercase tracking-wider text-blue-600 mb-1">
                              {project.type || 'Residential Project'}
                            </div>
                            <h4 className="font-bold text-sm text-slate-900 mb-1">{project.title}</h4>
                            <p className="text-xs text-slate-500 mb-2.5 flex items-center gap-1">
                              <MapPin size={12} className="shrink-0" />
                              <span className="truncate">{project.location?.address}, {project.location?.city}</span>
                            </p>
                            <div className="flex items-baseline justify-between pt-2 border-t border-slate-100">
                              <div className="text-sm font-black text-slate-900">
                                {project.priceDisplay || `₹ ${project.price?.toLocaleString()}`}
                              </div>
                              <span className="text-[0.7rem] text-slate-500">
                                {project.area ? `${project.area} sq.ft` : ''}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Agent Acquisition Setting & Agent Management (Spec §8) */}
                        {(project.category === 'project' || project.isProject) && (
                          <div className="px-3.5 py-2.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${project.allowAgentAcquisition || project.networkEnabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                              <span className="text-[11px] font-semibold text-slate-700 truncate">Agent Acquisition:</span>
                              <span className={`text-[11px] font-bold shrink-0 ${project.allowAgentAcquisition || project.networkEnabled ? 'text-emerald-700' : 'text-slate-500'}`}>
                                {project.allowAgentAcquisition || project.networkEnabled ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleToggleAcquisition(project)}
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                                  project.allowAgentAcquisition || project.networkEnabled
                                    ? 'border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50'
                                    : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-100'
                                }`}
                                title={project.allowAgentAcquisition || project.networkEnabled ? 'Click to disable agent acquisition' : 'Click to allow agents to acquire this project'}
                              >
                                {project.allowAgentAcquisition || project.networkEnabled ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setProjectAgentModal(project)}
                                className="text-[11px] font-bold px-2 py-0.5 rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-all flex items-center gap-1 cursor-pointer"
                                title="Manage affiliated agents and pending requests for this project"
                              >
                                <Users size={11} /> Manage Agents
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="p-3 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                          <Link
                            to={`/property/${project._id}`}
                            className="text-xs text-slate-600 font-semibold hover:text-blue-600 flex items-center gap-1"
                            target="_blank"
                          >
                            <ExternalLink size={13} /> View on Site
                          </Link>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditProperty(project);
                                setIsModalOpen(true);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-100 text-blue-600 rounded-md transition-colors flex items-center gap-1"
                            >
                              <Edit2 size={12} /> Edit
                            </button>
                            <button
                              onClick={() => handleDelete(project._id)}
                              className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 hover:bg-red-50 text-red-600 rounded-md transition-colors flex items-center gap-1"
                            >
                              <Trash2 size={12} /> Delete
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
            <div className="section-card">
              <div className="section-header pb-3 border-b border-border mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MessageSquare size={18} className="text-blue-600" />
                  <h3 className="section-title !mb-0">Property Inquiries ({filteredInquiries.length})</h3>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={leadSearch}
                      onChange={(e) => setLeadSearch(e.target.value)}
                      placeholder="Search buyer, agent, project..."
                      className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 w-56"
                    />
                  </div>

                  <button
                    onClick={exportLeadsCsv}
                    className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Download size={13} /> Export CSV
                  </button>
                </div>
              </div>

              {/* Lead Source Filter Buttons: All | Agent-Generated | Direct */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setLeadSourceFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    leadSourceFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  All Inquiries ({propertyInquiries.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLeadSourceFilter('agent')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    leadSourceFilter === 'agent'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white border border-blue-200 text-blue-700 hover:bg-blue-50'
                  }`}
                >
                  <Users size={13} />
                  <span>Agent-Generated Leads ({agentInquiriesCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLeadSourceFilter('direct')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    leadSourceFilter === 'direct'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  <Globe size={13} />
                  <span>Direct Website Leads ({directInquiriesCount})</span>
                </button>
              </div>

              <div className="section-body">
                {inqLoading ? (
                  <p className="text-xs text-slate-500">Loading inquiries...</p>
                ) : filteredInquiries.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <MessageSquare size={36} className="text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700">No property inquiries found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {leadSourceFilter === 'agent'
                        ? 'No agent-affiliated inquiries recorded yet.'
                        : leadSourceFilter === 'direct'
                        ? 'No direct website inquiries recorded yet.'
                        : 'No inquiries have been received yet.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Bulk Delete Toolbar */}
                    {selectedInquiryIds.length > 0 && (
                      <div className="flex items-center justify-between p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs">
                        <span className="font-bold text-blue-800">
                          {selectedInquiryIds.length} inquir{selectedInquiryIds.length > 1 ? 'ies' : 'y'} selected
                        </span>
                        <button
                          type="button"
                          onClick={handleBulkDeleteInquiries}
                          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                        >
                          <Trash2 size={13} />
                          <span>Delete Selected ({selectedInquiryIds.length})</span>
                        </button>
                      </div>
                    )}

                    <div className="overflow-x-auto">
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
                            <th className="py-3 px-3 whitespace-nowrap">Agent</th>
                            <th className="py-3 px-3 whitespace-nowrap">Lead Status</th>
                            <th className="py-3 px-3 whitespace-nowrap">
                              {leadSourceFilter === 'agent' ? 'Masked Buyer Contact' : 'Buyer Contact'}
                            </th>
                            {leadSourceFilter !== 'agent' && (
                              <th className="py-3 px-3 min-w-[180px]">Inquiry Message</th>
                            )}
                            <th className="py-3 px-3 whitespace-nowrap">Received</th>
                            <th className="py-3 px-3 text-right whitespace-nowrap">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredInquiries.map((lead) => {
                            const isSelected = selectedInquiryIds.includes(lead._id);
                            const isAgentLead = Boolean(lead.isAttributed || lead.agent || lead.agentCode);
                            const projTitle = lead.projectName || lead.project?.title || lead.property?.title || lead.propertyTitle || 'Project';
                            const propTitle = lead.propertyTitle || lead.property?.title || 'Main Unit';
                            const agentName = lead.agent?.name || lead.agent?.agencyName || 'Channel Partner';
                            const agentCode = lead.agentCode || lead.agent?.agentCode || 'CP-PARTNER';
                            const maskedContact = lead.maskedBuyerContact || lead.buyerPhone || lead.phone || '+91******1234';

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

                                {/* Column 1: Project */}
                                <td className="py-3 px-3 whitespace-nowrap">
                                  <div className="font-bold text-slate-900 flex items-center gap-1">
                                    <Building2 size={13} className="text-slate-400 shrink-0" />
                                    <span>{projTitle}</span>
                                  </div>
                                  {(lead.project?.location?.city || lead.property?.location?.city) && (
                                    <div className="text-[0.70rem] text-slate-400 mt-0.5 ml-4">
                                      {lead.project?.location?.city || lead.property?.location?.city}
                                    </div>
                                  )}
                                </td>

                                {/* Column 2: Property */}
                                <td className="py-3 px-3 whitespace-nowrap">
                                  <div className="font-semibold text-slate-800">{propTitle}</div>
                                  {lead.property?.type && (
                                    <div className="text-[0.70rem] text-slate-500 mt-0.5">
                                      {lead.property.type} {lead.property.bhk ? `· ${lead.property.bhk} BHK` : ''}
                                    </div>
                                  )}
                                </td>

                                {/* Column 3: Agent */}
                                <td className="py-3 px-3 whitespace-nowrap">
                                  {isAgentLead ? (
                                    <div>
                                      <div className="font-bold text-blue-700 flex items-center gap-1">
                                        <Users size={12} className="text-blue-600 shrink-0" />
                                        <span>{agentName}</span>
                                      </div>
                                      <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[0.62rem] font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                        {agentCode}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[0.68rem] font-medium bg-slate-100 text-slate-600">
                                      <Globe size={10} className="text-slate-400" />
                                      <span>Direct (No Agent)</span>
                                    </span>
                                  )}
                                </td>

                                {/* Column 4: Lead Status */}
                                <td className="py-3 px-3 whitespace-nowrap">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[0.68rem] font-bold inline-flex items-center gap-1 ${
                                      lead.status === 'closed'
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

                                {/* Column 5: Masked Buyer Contact (+91******1234) for Agent Leads / Full Contact for Direct Leads */}
                                <td className="py-3 px-3 whitespace-nowrap">
                                  {isAgentLead ? (
                                    <div>
                                      <div className="font-mono font-bold text-slate-800 text-[0.76rem] flex items-center gap-1.5">
                                        <ShieldCheck size={13} className="text-amber-600 shrink-0" />
                                        <span>{maskedContact}</span>
                                      </div>
                                      <div className="text-[0.68rem] text-slate-400 font-mono mt-0.5">
                                        {lead.buyerEmail || lead.email || '***@***.com'}
                                      </div>
                                      <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.2 rounded text-[0.60rem] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                        Agent Protected Lead
                                      </span>
                                    </div>
                                  ) : (
                                    <div>
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
                                    </div>
                                  )}
                                </td>

                                {/* Optional Message column for non-agent pure view */}
                                {leadSourceFilter !== 'agent' && (
                                  <td className="py-3 px-3 text-slate-700 min-w-[180px] max-w-sm">
                                    <div className="text-xs leading-relaxed truncate">
                                      {lead.message || '—'}
                                    </div>
                                  </td>
                                )}

                                <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                                  {new Date(lead.createdAt).toLocaleDateString()}
                                </td>

                                <td className="py-3 px-3 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-2">
                                    {!isAgentLead && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReplyModalItem(lead);
                                          setReplyMessage('');
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer whitespace-nowrap shrink-0"
                                        title="Reply to direct buyer via Email"
                                      >
                                        <Mail size={12} className="shrink-0" />
                                        <span className="whitespace-nowrap">Reply</span>
                                      </button>
                                    )}
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
            <div className="section-card">
              <div className="section-header pb-3 border-b border-border mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-amber-600" />
                  <h3 className="section-title !mb-0">Site Visit Appointments ({filteredVisits.length})</h3>
                </div>
              </div>

              {/* Lead Source Filter Buttons: All | Agent-Generated | Direct */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setLeadSourceFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    leadSourceFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  All Visits ({siteVisitsList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLeadSourceFilter('agent')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    leadSourceFilter === 'agent'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white border border-blue-200 text-blue-700 hover:bg-blue-50'
                  }`}
                >
                  <Users size={13} />
                  <span>Agent-Generated Visits ({agentVisitsCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLeadSourceFilter('direct')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    leadSourceFilter === 'direct'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  <Globe size={13} />
                  <span>Direct Site Visits ({directVisitsCount})</span>
                </button>
              </div>

              <div className="section-body">
                {filteredVisits.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <Calendar size={36} className="text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700">No scheduled site visits found</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {leadSourceFilter === 'agent'
                        ? 'No agent-affiliated site visits recorded yet.'
                        : leadSourceFilter === 'direct'
                        ? 'No direct website site visits recorded yet.'
                        : 'When buyers book site visits from project pages, they will appear here for confirmation.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredVisits.map((visit) => {
                      const isClosed = visit.status === 'closed';
                      const isAgentLead = Boolean(visit.isAttributed || visit.agent || visit.agentCode);
                      const projTitle = visit.projectName || visit.project?.title || visit.property?.title || visit.propertyTitle || 'Project';
                      const propTitle = visit.propertyTitle || visit.property?.title || 'Main Unit';
                      const agentName = visit.agent?.name || visit.agent?.agencyName || 'Channel Partner';
                      const agentCode = visit.agentCode || visit.agent?.agentCode || 'CP-PARTNER';
                      const maskedContact = visit.maskedBuyerContact || visit.buyerPhone || visit.phone || '+91******1234';

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

                            {/* Project Name */}
                            <div className="text-xs text-slate-600 font-medium mb-1 flex items-center gap-1">
                              <span className="text-slate-400">Project:</span>
                              <span className="font-bold text-slate-900 truncate">{projTitle}</span>
                            </div>

                            {/* Property / Unit */}
                            <div className="text-xs text-slate-600 font-medium mb-2 flex items-center gap-1">
                              <span className="text-slate-400">Property:</span>
                              {visit.property?._id || (typeof visit.property === 'string' && visit.property) ? (
                                <Link
                                  to={`/property/${visit.property._id || visit.property}`}
                                  className="text-blue-600 hover:underline font-semibold inline-flex items-center gap-1 truncate"
                                >
                                  {propTitle}
                                  <ExternalLink size={10} />
                                </Link>
                              ) : (
                                <span className="font-semibold text-slate-800 truncate">{propTitle}</span>
                              )}
                            </div>

                            {/* Agent Indicator */}
                            {isAgentLead ? (
                              <div className="mb-2 p-2 rounded-lg bg-blue-50/70 border border-blue-200 text-xs">
                                <div className="text-[0.66rem] text-blue-600 font-semibold uppercase tracking-wider">
                                  Generated by Agent
                                </div>
                                <div className="font-bold text-blue-900 flex items-center justify-between gap-1 mt-0.5">
                                  <span className="truncate">{agentName}</span>
                                  <span className="font-mono text-[0.62rem] px-1.5 py-0.2 bg-white text-blue-800 rounded border border-blue-300 shrink-0">
                                    {agentCode}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="mb-2 px-2 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[0.68rem] font-bold inline-flex items-center gap-1">
                                <Globe size={11} /> Direct Website Visit (No Agent)
                              </div>
                            )}

                            {/* Buyer Contact: Masked for Agent-Generated Lead, Full for Direct Lead */}
                            {isAgentLead ? (
                              <div className="text-[0.72rem] text-slate-500 space-y-1 mb-3">
                                <div className="font-mono font-bold text-slate-800 flex items-center gap-1.5">
                                  <ShieldCheck size={12} className="text-amber-600 shrink-0" />
                                  <span>{maskedContact}</span>
                                </div>
                                <div className="text-[0.68rem] text-slate-400 font-mono">
                                  {visit.buyerEmail || visit.email || '***@***.com'}
                                </div>
                                <span className="inline-block px-1.5 py-0.2 rounded text-[0.60rem] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  Masked for Agent Attribution
                                </span>
                              </div>
                            ) : (
                              <div className="text-[0.72rem] text-slate-500 space-y-1 mb-3">
                                <h4 className="font-bold text-sm text-slate-900 mb-1">{visit.name}</h4>
                                {visit.phone && (
                                  <div>
                                    <a href={`tel:${visit.phone}`} className="hover:text-emerald-700 hover:underline inline-flex items-center gap-1.5 text-slate-600">
                                      <Phone size={12} className="text-slate-400 shrink-0" /> {formatPhoneNumber(visit.phone)}
                                    </a>
                                  </div>
                                )}
                                {visit.email && (
                                  <div>
                                    <a href={`mailto:${visit.email}`} className="hover:text-blue-700 hover:underline inline-flex items-center gap-1.5 text-slate-600 break-all">
                                      <Mail size={12} className="text-slate-400 shrink-0" /> {visit.email}
                                    </a>
                                  </div>
                                )}
                              </div>
                            )}
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

          {/* TAB 5: AGENT ACQUISITION REQUESTS (Spec §5) */}
          {activeTab === 'requests' && (
            <div className="section-card">
              <div className="section-header pb-3 border-b border-border mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-blue-600" />
                  <h3 className="section-title !mb-0">
                    Agent Acquisition Requests ({filteredPartnerships.length})
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Search by agent or project */}
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={partnershipSearch}
                      onChange={(e) => setPartnershipSearch(e.target.value)}
                      placeholder="Search agent name, email, or project..."
                      className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 w-60"
                    />
                  </div>

                  {/* Filter by Project */}
                  <select
                    value={partnershipProjectFilter}
                    onChange={(e) => setPartnershipProjectFilter(e.target.value)}
                    className="text-xs py-1.5 px-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none"
                  >
                    <option value="all">All Projects</option>
                    {projects
                      .filter((p) => p.category === 'project' || p.isProject)
                      .map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.title}
                        </option>
                      ))}
                  </select>

                  {/* Filter by Status */}
                  <select
                    value={partnershipStatusFilter}
                    onChange={(e) => setPartnershipStatusFilter(e.target.value)}
                    className="text-xs py-1.5 px-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending Approval</option>
                    <option value="accepted">Accepted / Affiliated</option>
                    <option value="rejected">Rejected</option>
                  </select>

                  {/* Sort by Date */}
                  <select
                    value={partnershipDateSort}
                    onChange={(e) => setPartnershipDateSort(e.target.value)}
                    className="text-xs py-1.5 px-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none"
                  >
                    <option value="desc">Newest First</option>
                    <option value="asc">Oldest First</option>
                  </select>
                </div>
              </div>

              {/* Status Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <div
                  onClick={() => setPartnershipStatusFilter('all')}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    partnershipStatusFilter === 'all'
                      ? 'bg-blue-50/80 border-blue-300 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Requests</div>
                  <div className="text-xl font-black text-slate-900 mt-1">{partnerships.length}</div>
                </div>

                <div
                  onClick={() => setPartnershipStatusFilter('pending')}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    partnershipStatusFilter === 'pending'
                      ? 'bg-amber-50/90 border-amber-300 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                    <Clock size={12} /> Pending Review
                  </div>
                  <div className="text-xl font-black text-amber-700 mt-1">{pendingPartnershipsCount}</div>
                </div>

                <div
                  onClick={() => setPartnershipStatusFilter('accepted')}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    partnershipStatusFilter === 'accepted'
                      ? 'bg-emerald-50/90 border-emerald-300 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                    <Award size={12} /> Affiliated Agents
                  </div>
                  <div className="text-xl font-black text-emerald-700 mt-1">{approvedPartnershipsCount}</div>
                </div>

                <div
                  onClick={() => setPartnershipStatusFilter('rejected')}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    partnershipStatusFilter === 'rejected'
                      ? 'bg-rose-50/90 border-rose-300 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1">
                    <X size={12} /> Rejected
                  </div>
                  <div className="text-xl font-black text-rose-700 mt-1">{rejectedPartnershipsCount}</div>
                </div>
              </div>

              {/* Requests List */}
              <div className="section-body">
                {partnershipsLoading ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin inline-block mr-2" />
                    Loading agent acquisition requests...
                  </div>
                ) : filteredPartnerships.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <Users size={36} className="text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700">No agent requests found</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {partnerships.length === 0
                        ? 'When agents apply to acquire your projects, their applications will appear here.'
                        : 'No requests matched your current search and filter criteria.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <th className="py-3 px-4">Agent Name &amp; Details</th>
                          <th className="py-3 px-4">Project Applied For</th>
                          <th className="py-3 px-4">Date of Request</th>
                          <th className="py-3 px-4">Current Status</th>
                          <th className="py-3 px-4">Affiliate Referral Link</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {filteredPartnerships.map((req) => {
                          const agentName = req.agent?.name || req.agentProfile?.user?.name || 'Agent Partner';
                          const agentEmail = req.agent?.email || req.agentProfile?.user?.email || 'N/A';
                          const agentPhone = req.agent?.phone || req.agentProfile?.user?.phone || req.agentProfile?.phone || '';
                          const agencyName = req.agentProfile?.agencyName || '';
                          const projectTitle = req.project?.title || req.project?.name || 'Development Project';
                          const projectImg = req.project?.images?.[0] || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=200';
                          const projId = req.project?._id || req.project;
                          const affiliateCode = req.affiliateCode || req.agent?.agentCode || 'CP-PARTNER';
                          const affiliateUrl = req.affiliateUrl || `${window.location.origin}/property/${projId}?agent=${affiliateCode}`;
                          const isApproved = req.status === 'approved' || req.status === 'accepted';
                          const isPending = req.status === 'pending';
                          const isRejected = req.status === 'rejected';

                          return (
                            <tr key={req._id} className="hover:bg-slate-50/60 transition-colors">
                              {/* Agent Info */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 uppercase text-xs">
                                    {getInitials(agentName)}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-900">{agentName}</div>
                                    <div className="text-[11px] text-slate-500">{agentEmail}</div>
                                    {(agentPhone || agencyName) && (
                                      <div className="text-[10px] text-slate-400 mt-0.5">
                                        {agencyName ? `${agencyName} · ` : ''}{agentPhone}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Project Applied For */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2.5">
                                  <img
                                    src={projectImg}
                                    alt={projectTitle}
                                    className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                                  />
                                  <div>
                                    <div className="font-semibold text-slate-900 max-w-[200px] truncate" title={projectTitle}>
                                      {projectTitle}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      {req.project?.location?.city || 'Project'}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Date */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="text-slate-900 font-medium">
                                  {new Date(req.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {formatTime(req.createdAt)}
                                </div>
                              </td>

                              {/* Status */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                {isPending ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                    <Clock size={11} /> Pending Approval
                                  </span>
                                ) : isApproved ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                                    <CheckCircle2 size={11} /> Accepted / Affiliated
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-300">
                                    <X size={11} /> Rejected
                                  </span>
                                )}
                              </td>

                              {/* Referral Link (Active upon approval) */}
                              <td className="py-3.5 px-4">
                                {isApproved ? (
                                  <div className="flex items-center gap-1 max-w-[220px]">
                                    <input
                                      type="text"
                                      readOnly
                                      value={affiliateUrl}
                                      className="text-[11px] bg-slate-50 border border-slate-200 rounded px-2 py-1 font-mono truncate text-slate-700 w-full"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleCopyLink(affiliateCode, affiliateUrl, req._id)}
                                      className={`shrink-0 p-1.5 rounded border transition-all cursor-pointer ${
                                        copiedLinkMap[req._id]
                                          ? 'bg-emerald-600 text-white border-emerald-600'
                                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                      }`}
                                      title="Copy unique agent referral link"
                                    >
                                      {copiedLinkMap[req._id] ? <Check size={12} /> : <Copy size={12} />}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-slate-400 italic">
                                    {isPending ? 'Activates on approval' : 'Not active'}
                                  </span>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedAgentModal(req)}
                                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                                  >
                                    View Agent
                                  </button>

                                  {isPending && (
                                    <>
                                      <button
                                        type="button"
                                        disabled={actionPartnershipId === req._id}
                                        onClick={() => handleAcceptPartnership(req._id)}
                                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition-colors cursor-pointer flex items-center gap-1"
                                      >
                                        <Check size={12} /> Accept
                                      </button>
                                      <button
                                        type="button"
                                        disabled={actionPartnershipId === req._id}
                                        onClick={() => setRejectReasonModal(req)}
                                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white transition-colors cursor-pointer flex items-center gap-1"
                                      >
                                        <X size={12} /> Reject
                                      </button>
                                    </>
                                  )}

                                  {isRejected && (
                                    <button
                                      type="button"
                                      disabled={actionPartnershipId === req._id}
                                      onClick={() => handleAcceptPartnership(req._id)}
                                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors cursor-pointer flex items-center gap-1"
                                    >
                                      <Check size={12} /> Re-Approve
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Reschedule Visit Modal */}
        {rescheduleItem && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
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

              <form onSubmit={handleRescheduleSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    New Visit Date
                  </label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={newVisitDate}
                    onChange={(e) => setNewVisitDate(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    New Time Slot
                  </label>
                  <select
                    required
                    value={newVisitTime}
                    onChange={(e) => setNewVisitTime(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 bg-white"
                  >
                    <option value="">Select Time Slot</option>
                    <option value="Morning (10 AM - 1 PM)">Morning (10 AM - 1 PM)</option>
                    <option value="Afternoon (1 PM - 4 PM)">Afternoon (1 PM - 4 PM)</option>
                    <option value="Evening (4 PM - 7 PM)">Evening (4 PM - 7 PM)</option>
                    <option value="10:00 AM - 12:00 PM">Morning (10:00 AM - 12:00 PM)</option>
                    <option value="12:00 PM - 02:00 PM">Afternoon (12:00 PM - 02:00 PM)</option>
                    <option value="02:00 PM - 04:00 PM">Late Afternoon (02:00 PM - 04:00 PM)</option>
                    <option value="04:00 PM - 06:00 PM">Evening (04:00 PM - 06:00 PM)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setRescheduleItem(null)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Save Appointment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ── Reply via Email Modal ── */}
      {replyModalItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 text-left animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Mail size={16} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Reply to Buyer Inquiry</h4>
                  <p className="text-[0.72rem] text-slate-500">Sending response directly to buyer via email</p>
                </div>
              </div>
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
                <span className="text-slate-500">Project:</span>{' '}
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
                  placeholder={`Write your answer or pricing/project details here... It will be emailed directly to ${replyModalItem.email}.`}
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
                      <Send size={13} />
                      <span>Send Reply &amp; Delete</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Project Modal */}
      <AddPropertyModal
        isOpen={isModalOpen}
        initialData={editProperty}
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
      />

      {/* ── 1. View Agent Profile Modal (Spec §5) ── */}
      {selectedAgentModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm uppercase">
                  {getInitials(selectedAgentModal.agent?.name || selectedAgentModal.agentProfile?.user?.name)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-base">
                    {selectedAgentModal.agent?.name || selectedAgentModal.agentProfile?.user?.name || 'Agent Partner'}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {selectedAgentModal.agentProfile?.agencyName || 'Authorized Real Estate Channel Partner'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAgentModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Email Address</span>
                  <span className="font-semibold text-slate-800 break-all">
                    {selectedAgentModal.agent?.email || selectedAgentModal.agentProfile?.user?.email || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Phone Number</span>
                  <span className="font-semibold text-slate-800">
                    {selectedAgentModal.agent?.phone || selectedAgentModal.agentProfile?.user?.phone || 'Not provided'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Partner Code</span>
                  <span className="font-mono font-bold text-blue-700">
                    {selectedAgentModal.affiliateCode || selectedAgentModal.agent?.agentCode || 'CP-PARTNER'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Current Status</span>
                  <span className="font-bold capitalize text-slate-900">
                    {selectedAgentModal.status === 'approved' ? 'Accepted / Affiliated' : selectedAgentModal.status}
                  </span>
                </div>
              </div>

              {selectedAgentModal.agentProfile?.experienceYears && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Industry Experience</span>
                  <span className="font-semibold text-slate-800">
                    {selectedAgentModal.agentProfile.experienceYears} Years in Real Estate Consulting
                  </span>
                </div>
              )}

              {selectedAgentModal.agentProfile?.licenseNumber && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">RERA / Professional License</span>
                  <span className="font-mono font-bold text-slate-800">
                    {selectedAgentModal.agentProfile.licenseNumber}
                  </span>
                </div>
              )}

              {selectedAgentModal.requestMessage && (
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 text-blue-950">
                  <span className="text-blue-900 block text-[10px] uppercase font-bold mb-1">Agent Proposal / Message</span>
                  <p className="italic text-slate-700 bg-white p-2.5 rounded-lg border border-blue-100">
                    &ldquo;{selectedAgentModal.requestMessage}&rdquo;
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={() => setSelectedAgentModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                Close
              </button>
              {selectedAgentModal.status === 'pending' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      handleAcceptPartnership(selectedAgentModal._id);
                      setSelectedAgentModal(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
                  >
                    Accept Application
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectReasonModal(selectedAgentModal);
                      setSelectedAgentModal(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors cursor-pointer"
                  >
                    Reject Application
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 2. Project-Level Agent Management Modal (Spec §8) ── */}
      {projectAgentModal && (() => {
        const projId = projectAgentModal._id;
        const projectRequests = partnerships.filter(
          (p) => String(p.project?._id || p.project) === String(projId)
        );
        const affiliatedList = projectRequests.filter((p) => p.status === 'approved' || p.status === 'accepted');
        const pendingList = projectRequests.filter((p) => p.status === 'pending');
        const rejectedList = projectRequests.filter((p) => p.status === 'rejected');
        const isAcquisitionEnabled = projectAgentModal.allowAgentAcquisition || projectAgentModal.networkEnabled;

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-slate-200 text-left max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Project Agent Management</h3>
                    <p className="text-xs text-slate-500">{projectAgentModal.title}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setProjectAgentModal(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="overflow-y-auto pr-1 space-y-4 flex-1">
                {/* Acquisition Setting Toggle Banner */}
                <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                  isAcquisitionEnabled
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <div>
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${isAcquisitionEnabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      <span>Allow Agents to Acquire This Project</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      {isAcquisitionEnabled
                        ? 'Project is visible in Agent "Find Projects". Verified agents can submit acquisition requests.'
                        : 'Project is hidden from agent discovery. No new agent acquisition requests can be submitted.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleAcquisition(projectAgentModal)}
                    className={`shrink-0 py-2 px-3.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                      isAcquisitionEnabled
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                        : 'bg-slate-800 hover:bg-slate-900 text-white shadow-xs'
                    }`}
                  >
                    {isAcquisitionEnabled ? 'Enabled (Click to Disable)' : 'Disabled (Click to Enable)'}
                  </button>
                </div>

                {/* Counters */}
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                    <div className="text-[10px] font-bold uppercase text-emerald-700">Affiliated Agents</div>
                    <div className="text-lg font-black text-emerald-900 mt-0.5">{affiliatedList.length}</div>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="text-[10px] font-bold uppercase text-amber-700">Pending Requests</div>
                    <div className="text-lg font-black text-amber-900 mt-0.5">{pendingList.length}</div>
                  </div>
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                    <div className="text-[10px] font-bold uppercase text-rose-700">Rejected</div>
                    <div className="text-lg font-black text-rose-900 mt-0.5">{rejectedList.length}</div>
                  </div>
                </div>

                {/* Agent Lists */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Associated Agents ({projectRequests.length})
                  </h4>

                  {projectRequests.length === 0 ? (
                    <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                      No agent requests or affiliations for this project yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {projectRequests.map((req) => {
                        const agentName = req.agent?.name || req.agentProfile?.user?.name || 'Agent Partner';
                        const agentEmail = req.agent?.email || req.agentProfile?.user?.email || 'N/A';
                        const affiliateCode = req.affiliateCode || req.agent?.agentCode || 'CP-PARTNER';
                        const affiliateUrl = req.affiliateUrl || `${window.location.origin}/property/${projId}?agent=${affiliateCode}`;
                        const isApproved = req.status === 'approved' || req.status === 'accepted';
                        const isPending = req.status === 'pending';

                        return (
                          <div
                            key={req._id}
                            className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <strong className="font-bold text-slate-900 truncate">{agentName}</strong>
                                {isApproved && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    Affiliated
                                  </span>
                                )}
                                {isPending && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                    Pending
                                  </span>
                                )}
                                {req.status === 'rejected' && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                    Rejected
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">{agentEmail}</div>

                              {isApproved && (
                                <div className="mt-1.5 flex items-center gap-1.5">
                                  <span className="text-[10px] font-semibold text-slate-500">Referral:</span>
                                  <code className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-mono truncate max-w-[200px]">
                                    {affiliateUrl}
                                  </code>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyLink(affiliateCode, affiliateUrl, req._id)}
                                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                                    title="Copy link"
                                  >
                                    <Copy size={11} />
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setSelectedAgentModal(req)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                              >
                                Details
                              </button>
                              {isPending && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleAcceptPartnership(req._id)}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRejectReasonModal(req)}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer"
                                  >
                                    Reject
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

              <div className="flex items-center justify-end pt-3 border-t border-slate-200 mt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setProjectAgentModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 3. Real-Time New Agent Request Pop-up Window (Spec §9) ── */}
      {newRequestNotification && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-blue-300 text-left relative overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 absolute top-0 left-0 right-0" />

            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Users size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-base">New Agent Request</h4>
                  <p className="text-[11px] text-slate-500">Real-time Acquisition Notification</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNewRequestNotification(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs mb-5">
              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-blue-950 space-y-1">
                <div>
                  <strong className="text-slate-900 font-bold">{newRequestNotification.agentName}</strong> has applied to become an authorized selling agent for:
                </div>
                <div className="font-black text-sm text-blue-700 pt-0.5">
                  &ldquo;{newRequestNotification.projectTitle}&rdquo;
                </div>
                <div className="text-[10px] text-slate-500 pt-1">
                  Received: {newRequestNotification.date}
                </div>
              </div>

              {newRequestNotification.message && (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 italic text-[11px]">
                  &ldquo;{newRequestNotification.message}&rdquo;
                </div>
              )}

              <p className="text-[11px] text-slate-500">
                Approving this request will immediately generate and activate an exclusive client tracking link for this agent.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setNewRequestNotification(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewRequestNotification(null);
                  handleTabChange('requests');
                  setPartnershipStatusFilter('pending');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Review Request</span>
                <ExternalLink size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. Reject Request Reason Modal ── */}
      {rejectReasonModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h4 className="font-bold text-slate-900 text-base flex items-center gap-2 text-rose-600">
                <AlertTriangle size={18} /> Reject Agent Request
              </h4>
              <button
                type="button"
                onClick={() => {
                  setRejectReasonModal(null);
                  setRejectionReasonText('');
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-3">
              Are you sure you want to decline the acquisition request from{' '}
              <strong>{rejectReasonModal.agent?.name || rejectReasonModal.agentProfile?.user?.name || 'this agent'}</strong> for{' '}
              <strong>{rejectReasonModal.project?.title || 'your project'}</strong>?
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reason for Rejection (Optional — helpful for the agent)
              </label>
              <textarea
                rows={3}
                value={rejectionReasonText}
                onChange={(e) => setRejectionReasonText(e.target.value)}
                placeholder="e.g., We are currently not accepting new channel partners for this inventory phase."
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-rose-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setRejectReasonModal(null);
                  setRejectionReasonText('');
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionPartnershipId === rejectReasonModal._id}
                onClick={() => handleRejectPartnership(rejectReasonModal._id, rejectionReasonText)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors flex items-center gap-1"
              >
                <X size={13} />
                <span>{actionPartnershipId === rejectReasonModal._id ? 'Rejecting...' : 'Confirm Reject'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default BuilderDashboard;
