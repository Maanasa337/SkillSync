import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getAdminDashboard, getEmployees, getAllCourses, addEmployee, claimIncentive, getDepartmentAnalytics, createCourse, assignIndividual, assignDepartment, assignAll, getDeptEmployees, getIncentiveDetails, assignEmployeesToScheme, uploadCourseMaterial } from '../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { IconUsers, IconCheckCircle, IconClock, IconDollarSign, IconTrendingUp, IconAward, IconAlertCircle, IconX, IconGlobe, IconBuilding } from '../components/Icons';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import './Dashboard.css';

const PIE_COLORS = ['#63ae2aff', '#ffea30ff'];
const DEPARTMENTS = ['Production', 'Quality', 'Maintenance', 'HR'];
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
];
const API_URL = import.meta.env.VITE_API_URL;

// Helper: format experience months
function formatExperience(months) {
  if (!months && months !== 0) return 'N/A';
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} year${years !== 1 ? 's' : ''}`;
  return `${years} year${years !== 1 ? 's' : ''} ${rem} month${rem !== 1 ? 's' : ''}`;
}

// Helper: format date as DD MMM YYYY
function formatDate(isoStr) {
  if (!isoStr) return 'N/A';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return 'N/A'; }
}

// Skeleton loader component
function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="skeleton-row">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="skeleton-cell" style={{ flex: c === 0 ? 2 : 1, height: '16px' }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [courses, setCourses] = useState([]);
  const [deptAnalytics, setDeptAnalytics] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [activeSection, setActiveSection] = useState('overview');
  const [loading, setLoading] = useState(true);

  // Employee filters
  const [deptFilter, setDeptFilter] = useState('');
  const [expFilter, setExpFilter] = useState('');
  const [sortBy, setSortBy] = useState('score');
  const [empLoading, setEmpLoading] = useState(false);
  const debounceRef = useRef(null);

  // Department drill-down
  const [selectedDept, setSelectedDept] = useState(null);
  const [deptEmployees, setDeptEmployees] = useState([]);
  const [deptLoading, setDeptLoading] = useState(false);

  // Incentive panel
  const [expandedScheme, setExpandedScheme] = useState(null);
  const [incentiveDetails, setIncentiveDetails] = useState([]);
  const [incentiveTab, setIncentiveTab] = useState('assigned');
  const [incentiveLoading, setIncentiveLoading] = useState(false);
  const [assignSearchTerm, setAssignSearchTerm] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState([]);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);

  // Modals
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showAssignCourse, setShowAssignCourse] = useState(false);
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [drillDownModal, setDrillDownModal] = useState({ show: false, title: '', data: [] });
  const [empForm, setEmpForm] = useState({ name: '', email: '', password: '', job_role: '', department: 'Production', primary_language: 'en', known_languages: ['en'] });

  const [assignTab, setAssignTab] = useState('individual');
  const [assignForm, setAssignForm] = useState({ course_id: '', employee_id: '', department: 'Production', deadline_date: '' });

  const [createForm, setCreateForm] = useState({
    title: { en: '', hi: '', ta: '' },
    description: { en: '', hi: '', ta: '' },
    youtube_link: { en: '', hi: '', ta: '' },
    training_mode: 'online',
    category: 'Safety'
  });
  const [createStatus, setCreateStatus] = useState({ loading: false, msg: '', err: '' });
  const [courseFiles, setCourseFiles] = useState([]);
  const [actionMsg, setActionMsg] = useState('');

  // Scoreboard
  const [scoreboardCourseId, setScoreboardCourseId] = useState('');
  const [scoreboardData, setScoreboardData] = useState([]);

  const fetchScoreboard = async (cId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/courses/${cId}/leaderboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setScoreboardData(res.data);
    } catch (error) {
      console.error('Failed to load scoreboard', error);
    }
  };

  const fetchData = async () => {
    try {
      const [dashRes, empRes, courseRes, deptRes] = await Promise.all([
        getAdminDashboard(language),
        getEmployees(statusFilter || undefined, deptFilter || undefined, expFilter || undefined, sortBy || undefined),
        getAllCourses(language),
        getDepartmentAnalytics(),
      ]);
      setDashboard(dashRes.data);
      setEmployees(empRes.data);
      setCourses(courseRes.data);
      setDeptAnalytics(deptRes.data);

      // Select first course for scoreboard by default
      if (courseRes.data.length > 0 && !scoreboardCourseId) {
        setScoreboardCourseId(courseRes.data[0].id);
        fetchScoreboard(courseRes.data[0].id);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        navigate('/login');
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [statusFilter, language]);

  // Debounced employee refetch on filter/sort change
  const fetchEmployeesFiltered = useCallback(async () => {
    setEmpLoading(true);
    try {
      const res = await getEmployees(
        statusFilter || undefined,
        deptFilter || undefined,
        expFilter || undefined,
        sortBy || undefined
      );
      setEmployees(res.data);
    } catch (err) {
      console.error('Failed to fetch filtered employees', err);
    }
    setEmpLoading(false);
  }, [statusFilter, deptFilter, expFilter, sortBy]);

  useEffect(() => {
    if (!loading) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchEmployeesFiltered();
      }, 300);
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [deptFilter, expFilter, sortBy, fetchEmployeesFiltered, loading]);

  const handleScoreboardChange = (e) => {
    const cid = e.target.value;
    setScoreboardCourseId(cid);
    fetchScoreboard(cid);
  }

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    setCreateStatus({ loading: true, msg: '', err: '' });
    try {
      const res = await createCourse(createForm);
      const newCourseId = res.data?.course_id;

      if (courseFiles.length > 0 && newCourseId) {
        setCreateStatus({ loading: true, msg: 'Uploading materials...', err: '' });
        for (const cf of courseFiles) {
           await uploadCourseMaterial(newCourseId, cf.file, cf.lang);
        }
      }

      setCreateStatus({ loading: false, msg: 'Course created successfully!', err: '' });
      fetchData();
      setShowCreateCourse(false);
      setCreateForm({
        title: { en: '', hi: '', ta: '' },
        description: { en: '', hi: '', ta: '' },
        youtube_link: { en: '', hi: '', ta: '' },
        training_mode: 'online',
        category: 'Safety'
      });
      setCourseFiles([]);
      setActionMsg('Course created successfully!');
      setTimeout(() => setActionMsg(''), 3000);
    } catch (err) {
      setCreateStatus({ loading: false, msg: '', err: 'Failed to create course' });
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    try {
      await addEmployee(empForm);
      setShowAddEmployee(false);
      setEmpForm({ name: '', email: '', password: '', job_role: '' });
      setActionMsg('Employee added successfully!');
      fetchData();
      setTimeout(() => setActionMsg(''), 3000);
    } catch (err) {
      setActionMsg(err.response?.data?.detail || 'Failed to add employee');
    }
  };

  const handleAssignCourse = async (e) => {
    e.preventDefault();
    if (!assignForm.course_id || !assignForm.deadline_date) return;

    try {
      if (assignTab === 'individual') {
        if (!assignForm.employee_id) return;
        await assignIndividual({
          user_id: assignForm.employee_id,
          course_id: assignForm.course_id,
          deadline_date: new Date(assignForm.deadline_date).toISOString()
        });
      } else if (assignTab === 'department') {
        await assignDepartment({
          department: assignForm.department,
          course_id: assignForm.course_id,
          deadline_date: new Date(assignForm.deadline_date).toISOString()
        });
      } else {
        if (!window.confirm("Assign this module to EVERY employee?")) return;
        await assignAll({
          course_id: assignForm.course_id,
          deadline_date: new Date(assignForm.deadline_date).toISOString()
        });
      }
      setShowAssignCourse(false);
      setAssignForm({ ...assignForm, course_id: '', employee_id: '' });
      setActionMsg('Training module dispatched with deadlines!');
      fetchData();
      setTimeout(() => setActionMsg(''), 3000);
    } catch (err) {
      setActionMsg(err.response?.data?.detail || "Error assigning course");
    }
  };

  const handleClaimIncentive = async (incId) => {
    try {
      const res = await claimIncentive({ incentive_id: incId });
      setActionMsg(`Incentive claimed! Amount: ₹${res.data.amount.toLocaleString()}. Redirecting...`);
      fetchData();
      setTimeout(() => {
        if (res.data.redirect_url) {
          window.location.href = res.data.redirect_url;
        }
      }, 2000);
    } catch (err) {
      setActionMsg(err.response?.data?.detail || 'Failed to claim');
    }
  };

  const fetchSchemeEmployees = async (schemeName, status) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/schemes/${schemeName}/employees?status=${status}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDrillDownModal({
        show: true,
        title: `${schemeName} - ${status === 'eligible' ? 'Ready to Claim' : 'Pending Requirements'}`,
        data: res.data
      });
    } catch (error) {
      console.error(error);
      setActionMsg('Failed to load employee details');
    }
  }

  // Department drill-down handler
  const handleDeptCardClick = async (deptName) => {
    if (selectedDept === deptName) {
      setSelectedDept(null);
      setDeptEmployees([]);
      return;
    }
    setSelectedDept(deptName);
    setDeptLoading(true);
    try {
      const res = await getDeptEmployees(deptName);
      setDeptEmployees(res.data);
    } catch (err) {
      console.error('Failed to load dept employees', err);
      setDeptEmployees([]);
    }
    setDeptLoading(false);
  };

  // Incentive details handler
  const fetchIncentiveDetails = async () => {
    setIncentiveLoading(true);
    try {
      const res = await getIncentiveDetails();
      setIncentiveDetails(res.data);
    } catch (err) {
      console.error('Failed to load incentive details', err);
    }
    setIncentiveLoading(false);
  };

  useEffect(() => {
    if (activeSection === 'incentives') {
      fetchIncentiveDetails();
    }
  }, [activeSection]);

  const handleSchemeCardClick = (schemeId) => {
    if (expandedScheme === schemeId) {
      setExpandedScheme(null);
    } else {
      setExpandedScheme(schemeId);
      setIncentiveTab('assigned');
      setSelectedAssignees([]);
      setAssignSearchTerm('');
    }
  };

  const handleAssignEmployeesToScheme = async (schemeId) => {
    if (selectedAssignees.length === 0) return;
    try {
      await assignEmployeesToScheme(schemeId, selectedAssignees.map(e => e.id));
      setActionMsg(`${selectedAssignees.length} employees assigned to scheme successfully!`);
      setSelectedAssignees([]);
      setAssignSearchTerm('');
      fetchIncentiveDetails();
      setTimeout(() => setActionMsg(''), 3000);
    } catch (err) {
      setActionMsg(err.response?.data?.detail || 'Failed to assign employees');
      setTimeout(() => setActionMsg(''), 3000);
    }
  };

  // Rank badge helper
  const getRankBadge = (rank) => {
    if (rank === 1) return 'rank-badge rank-gold';
    if (rank === 2) return 'rank-badge rank-silver';
    if (rank === 3) return 'rank-badge rank-bronze';
    return 'rank-badge rank-default';
  };

  if (loading) return <div className="loading-screen"><div className="loader"></div></div>;

  const { overview, incentive_progress, course_chart, pie_data } = dashboard || {};

  const pieChartData = pie_data ? [
    { name: t('dashboard.completed'), value: pie_data.completed },
    { name: t('dashboard.pending'), value: pie_data.pending },
  ] : [];

  const navItems = [
    { id: 'overview', icon: <IconTrendingUp size={20} />, label: t('nav.overview') },
    { id: 'incentives', icon: <IconDollarSign size={20} />, label: t('nav.incentives') },
    { id: 'employees', icon: <IconUsers size={20} />, label: t('nav.employees') },
    { id: 'departments', icon: <IconBuilding size={20} />, label: t('nav.dept_analytics') },
  ];

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header" style={{ marginBottom: "2rem" }}>
          <div className="sidebar-logo">
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="8" fill="var(--primary)" />
              <path d="M12 20L18 26L28 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>SkillSync</span>
          </div>
        </div>
        <div className="sidebar-user" style={{ marginBottom: "2rem" }}>
          <div className="avatar">{user?.name?.charAt(0) || 'A'}</div>
          <div>
            <p className="sidebar-name">{user?.name}</p>
            <p className="sidebar-role">{t('dashboard.administrator')}</p>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button key={item.id} className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => setActiveSection(item.id)}>
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <button className="nav-item logout-btn" onClick={() => { logout(); navigate('/login'); }}>
          <span className="nav-icon"><IconAlertCircle size={20} /></span>
          <span>{t('nav.sign_out')}</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="main-header">
          <div>
            <h1>{t('dashboard.admin_title')}</h1>
            <p>{t('dashboard.admin_subtitle')}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginRight: '15px', color: 'var(--text-secondary)' }}>
              <IconGlobe size={18} />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', cursor: 'pointer' }}
              >
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => setShowAddEmployee(true)}>+ {t('nav.employees')}</button>
            <button className="btn btn-outline btn-sm" onClick={() => setShowCreateCourse(true)}>+ {t('nav.create_course')}</button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAssignCourse(true)}>{t('nav.assign_course')}</button>
          </div>
        </header>

        {actionMsg && <div className="toast" style={{ marginBottom: "20px" }}>{actionMsg}</div>}

        <div className="dashboard-content">
          {/* Overview Cards */}
          {activeSection === 'overview' && (
            <section className="fade-in">
              <h2 className="section-title">{t('dashboard.system_overview')}</h2>
              <div className="overview-grid">
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}><IconUsers /></div>
                  <div>
                    <p className="stat-value">{overview?.total_employees || 0}</p>
                    <p className="stat-label">{t('dashboard.total_workforce')}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><IconCheckCircle /></div>
                  <div>
                    <p className="stat-value">{overview?.completed_trainings || 0}</p>
                    <p className="stat-label">{t('dashboard.assessments_passed')}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}><IconClock /></div>
                  <div>
                    <p className="stat-value">{overview?.pending_trainings || 0}</p>
                    <p className="stat-label">{t('dashboard.pending_modules')}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><IconDollarSign /></div>
                  <div>
                    <p className="stat-value">₹{(overview?.total_incentive_earned || 0).toLocaleString()}</p>
                    <p className="stat-label">{t('dashboard.claimed_incentives')}</p>
                  </div>
                </div>
              </div>

              {/* Quick Charts */}
              <div className="charts-row" style={{ marginTop: 'var(--space-xl)' }}>
                <div className="card chart-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <h3>{t('dashboard.pass_rates')}</h3>
                  <div className="chart-container" style={{ width: '100%', flex: 1, minHeight: '420px', paddingTop: '20px' }}>
                    <ResponsiveContainer width="99%" height={420}>
                      <BarChart data={course_chart || []} margin={{ top: 10, right: 20, left: 30, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                        <XAxis dataKey="course" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" interval={0} height={160} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: 'var(--shadow-md)', fontSize: '13px' }} cursor={{ fill: 'var(--surface-hover)' }} />
                        <Bar dataKey="completion_rate" fill="#002147" radius={[4, 4, 0, 0]} name="Pass %" barSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="card chart-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <h3>{t('dashboard.training_progress')}</h3>
                  <div className="chart-container" style={{ width: '100%', flex: 1, minHeight: '420px', paddingTop: '20px' }}>
                    <ResponsiveContainer width="99%" height={420}>
                      <PieChart>
                        <Pie data={pieChartData} cx="50%" cy="45%" innerRadius={80} outerRadius={120} paddingAngle={2}
                          dataKey="value" stroke="none">
                          {pieChartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          iconType="square"
                          formatter={(value) => <span style={{ color: '#000' }}>{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

            </section>
          )}

          {/* Incentive Progress */}
          {activeSection === 'incentives' && (() => {
            return (
              <section className="fade-in">
                <h2 className="section-title">{t('incentives_panel.title')}</h2>
                <div className="incentive-grid">
                  {(incentive_progress || []).map((inc) => {
                    const detail = incentiveDetails.find(d => d.scheme_name === inc.scheme_name);
                    const isExpanded = expandedScheme === inc.id;
                    const benefitColor = inc.benefit_color || '#16A34A';

                    return (
                      <div key={inc.id} style={{ display: 'flex', flexDirection: 'column', gridColumn: isExpanded ? '1 / -1' : undefined }}>
                        <div className="card incentive-card" style={{ cursor: 'pointer' }} onClick={() => handleSchemeCardClick(inc.id)}>
                          <div className="incentive-header" style={{ marginBottom: "14px" }}>
                            <div>
                              <h3>{inc.scheme_name}</h3>
                              <span style={{ marginTop: "5px" }} className={`badge ${inc.status === 'claimed' ? 'badge-success' : 'badge-warning'}`}>
                                {inc.status === 'claimed' ? t('incentives_panel.claimed') : t('incentives_panel.pending')}
                              </span>
                            </div>
                            <p className="incentive-amount" style={{ color: "var(--success)" }}>₹{inc.claimable_amount.toLocaleString()}</p>
                          </div>

                          {/* Scheme description + financial benefit */}
                          {inc.description && (
                            <div style={{ marginBottom: "16px" }}>
                              <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: "1.5", marginBottom: "8px" }}>
                                {inc.description}
                              </p>
                              {inc.benefit && (
                                <span style={{
                                  display: "inline-block",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  letterSpacing: "0.3px",
                                  padding: "3px 10px",
                                  borderRadius: "20px",
                                  background: `${benefitColor}18`,
                                  color: benefitColor,
                                  border: `1px solid ${benefitColor}40`,
                                }}>
                                  {inc.benefit}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="incentive-stats" style={{ marginBottom: "15px", gap: "10px" }}>
                            <div style={{ flex: 1, padding: "10px", borderRadius: "8px", textAlign: "center", border: "1.5px solid var(--border)", background: "var(--surface-hover)" }}>
                              <span className="stat-num" style={{ color: "var(--primary)" }}>{detail?.assigned_employees?.length || 0}</span>
                              <span className="stat-txt">Employees Assigned</span>
                            </div>
                            <div style={{ flex: 1, padding: "10px", borderRadius: "8px", textAlign: "center", border: "1.5px solid var(--border)", background: "var(--surface-hover)" }}>
                              <span className="stat-num" style={{ color: "var(--warning)" }}>{inc.remaining + (inc.pending_duration_count || 0)}</span>
                              <span className="stat-txt">{t('incentives_panel.pending')}</span>
                            </div>
                          </div>

                          <div className="progress-bar-track" style={{ marginBottom: "15px" }}>
                            <div className="progress-bar-fill" style={{ width: `${inc.completion_pct}%` }} />
                          </div>

                          <div className="incentive-footer" style={{ borderTop: "1px solid var(--border-light)", paddingTop: "15px" }}>
                            <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500 }}>
                              {t('incentives_panel.target')}: {inc.required_count} {t('incentives_panel.eligible').toLowerCase()}
                            </span>
                            {inc.status !== 'claimed' && (
                              <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); handleClaimIncentive(inc.id); }}>
                                {t('incentives_panel.apply_portal')} →
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expandable Panel */}
                        {isExpanded && detail && (
                          <div className="incentive-expand-panel">
                            {/* Section 1: Scheme Requirements */}
                            <div className="scheme-requirements">
                              <div>
                                <span className="req-label">Min. Employees to Train</span>
                                <span className="req-value">{detail.min_employees_required}</span>
                              </div>
                              <div>
                                <span className="req-label">Mandatory Training Duration</span>
                                <span className="req-value">{detail.min_training_duration_months} months</span>
                              </div>
                            </div>

                            {/* Section 2: Employee Status Tabs */}
                            <div className="tab-bar">
                              <button className={`tab-btn ${incentiveTab === 'assigned' ? 'active' : ''}`} onClick={() => setIncentiveTab('assigned')}>
                                Assigned ({detail.assigned_employees?.length || 0})
                              </button>
                              <button className={`tab-btn ${incentiveTab === 'completed' ? 'active' : ''}`} onClick={() => setIncentiveTab('completed')}>
                                Completed ({detail.completed_employees?.length || 0})
                              </button>
                              <button className={`tab-btn ${incentiveTab === 'pending' ? 'active' : ''}`} onClick={() => setIncentiveTab('pending')}>
                                Pending ({detail.pending_employees?.length || 0})
                              </button>
                            </div>

                            <div className="table-card" style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden", marginBottom: "var(--space-lg)" }}>
                              <table className="data-table">
                                <thead>
                                  <tr>
                                    <th>Name</th>
                                    <th>Department</th>
                                    <th>Completion %</th>
                                    <th>Score</th>
                                    <th>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(incentiveTab === 'assigned' ? detail.assigned_employees :
                                    incentiveTab === 'completed' ? detail.completed_employees :
                                      detail.pending_employees
                                  )?.map(emp => (
                                    <tr key={emp.id}>
                                      <td style={{ fontWeight: 600 }}>{emp.name}</td>
                                      <td>{emp.dept}</td>
                                      <td>{emp.completion_status}%</td>
                                      <td>
                                        <span style={{ fontWeight: 600, color: emp.score >= 60 ? 'var(--success)' : 'var(--text)' }}>
                                          {emp.score > 0 ? `${emp.score}%` : 'N/A'}
                                        </span>
                                      </td>
                                      <td>
                                        <span className={`badge ${emp.status === 'Completed' ? 'badge-success' : 'badge-warning'}`}>
                                          {emp.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {(incentiveTab === 'assigned' ? detail.assigned_employees :
                                incentiveTab === 'completed' ? detail.completed_employees :
                                  detail.pending_employees
                              )?.length === 0 && (
                                  <div style={{ padding: "30px", textAlign: "center", color: "var(--text-secondary)" }}>No employees in this category.</div>
                                )}
                            </div>

                            {/* Section 3: Assign Employees */}
                            <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "var(--space-lg)" }}>
                              <h4 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "var(--space-md)" }}>Assign Employees to Scheme</h4>
                              <div className="multi-select-container">
                                <input
                                  className="multi-select-search"
                                  type="text"
                                  placeholder="Search employees to assign..."
                                  value={assignSearchTerm}
                                  onChange={(e) => { setAssignSearchTerm(e.target.value); setShowAssignDropdown(true); }}
                                  onFocus={() => setShowAssignDropdown(true)}
                                />
                                {showAssignDropdown && assignSearchTerm && (
                                  <div className="multi-select-dropdown">
                                    {employees
                                      .filter(emp => {
                                        const assignedIds = (detail.assigned_employees || []).map(a => a.id);
                                        const alreadySelected = selectedAssignees.map(s => s.id);
                                        return !assignedIds.includes(emp.id) && !alreadySelected.includes(emp.id) &&
                                          emp.name.toLowerCase().includes(assignSearchTerm.toLowerCase());
                                      })
                                      .slice(0, 10)
                                      .map(emp => (
                                        <div key={emp.id} className="multi-select-option"
                                          onClick={() => {
                                            setSelectedAssignees(prev => [...prev, emp]);
                                            setAssignSearchTerm('');
                                            setShowAssignDropdown(false);
                                          }}>
                                          {emp.name} — {emp.department}
                                        </div>
                                      ))
                                    }
                                    {employees.filter(emp => {
                                      const assignedIds = (detail.assigned_employees || []).map(a => a.id);
                                      return !assignedIds.includes(emp.id) && emp.name.toLowerCase().includes(assignSearchTerm.toLowerCase());
                                    }).length === 0 && (
                                        <div style={{ padding: "10px 14px", color: "var(--text-tertiary)", fontSize: "13px" }}>No matching employees found</div>
                                      )}
                                  </div>
                                )}
                                {selectedAssignees.length > 0 && (
                                  <div className="selected-tags">
                                    {selectedAssignees.map(emp => (
                                      <span key={emp.id} className="selected-tag">
                                        {emp.name}
                                        <button onClick={() => setSelectedAssignees(prev => prev.filter(s => s.id !== emp.id))}>×</button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <button
                                className="btn btn-primary btn-sm"
                                disabled={selectedAssignees.length === 0}
                                onClick={() => handleAssignEmployeesToScheme(detail.id)}
                              >
                                Assign Selected ({selectedAssignees.length})
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })()}

          {/* Employee Directory */}
          {activeSection === 'employees' && (
            <section className="fade-in">
              <div className="section-header">
                <h2 className="section-title">{t('employee_mgmt.workforce_management')}</h2>
                <div className="filter-group">
                  {['', 'completed', 'in_progress', 'not_started'].map(f => (
                    <button key={f} className={`btn btn-sm ${statusFilter === f ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setStatusFilter(f)}>
                      {f === '' ? t('employee_mgmt.all_employees') : f.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter Bar */}
              <div className="filter-bar">
                <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                  <option value="">{t('departments.all')}</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{t(`departments.${d}`)}</option>)}
                </select>
                <select value={expFilter} onChange={(e) => setExpFilter(e.target.value)}>
                  <option value="">All Experience</option>
                  <option value="lt6">&lt; 6 months</option>
                  <option value="6to12">6–12 months</option>
                  <option value="gt12">1+ year</option>
                </select>
                <button
                  className={`sort-toggle ${sortBy === 'name' ? 'active' : ''}`}
                  onClick={() => setSortBy(sortBy === 'score' ? 'name' : 'score')}
                >
                  {sortBy === 'score' ? 'Sort: Score ↓' : 'Sort: Name A–Z'}
                </button>
              </div>

              <div className="card table-card" style={{ padding: "0" }}>
                {empLoading ? <SkeletonTable rows={8} cols={8} /> : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t('employee_mgmt.employee_name')}</th>
                        <th>{t('employee_mgmt.designation')}</th>
                        <th>{t('employee_mgmt.active_modules')}</th>
                        <th>{t('employee_mgmt.passed')}</th>
                        <th>{t('employee_mgmt.overall_status')}</th>
                        <th>{t('employee_mgmt.avg_score')}</th>
                        <th>Date of Joining</th>
                        <th>Experience</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map(emp => (
                        <tr key={emp.id}>
                          <td>
                            <div className="emp-name">
                              <div className="avatar-sm" style={{ background: "var(--primary-bg)", color: "var(--primary)" }}>{emp.name.charAt(0)}</div>
                              <div>
                                <p className="name" style={{ fontWeight: 600 }}>{emp.name}</p>
                                <p className="email">{emp.email}</p>
                              </div>
                            </div>
                          </td>
                          <td><span style={{ color: "var(--text-secondary)", fontSize: "14px" }}>{emp.job_role}</span></td>
                          <td>{emp.assigned_courses}</td>
                          <td>{emp.completed_courses}</td>
                          <td>
                            <span className={`badge ${emp.status === 'completed' ? 'badge-success' : emp.status === 'in_progress' ? 'badge-warning' : 'badge-danger'}`}>
                              {emp.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600, color: emp.score >= 60 ? 'var(--success)' : (emp.score > 0 ? 'var(--danger)' : 'var(--text)') }}>
                              {emp.score > 0 ? `${emp.score}%` : 'N/A'}
                            </span>
                          </td>
                          <td><span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{formatDate(emp.date_of_joining)}</span></td>
                          <td><span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{formatExperience(emp.experience_months)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {!empLoading && employees.length === 0 && <div className="empty-state" style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>{t('employee_mgmt.no_records')}</div>}
              </div>
            </section>
          )}

          {/* Department Analytics Page */}
          {activeSection === 'departments' && (
            <section className="fade-in">
              <div className="section-header">
                <h2 className="section-title">{t('employee_mgmt.department_analytics')}</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                {deptAnalytics.map(d => (
                  <div key={d.department}
                    className={`card dept-card-clickable ${selectedDept === d.department ? 'selected' : ''}`}
                    style={{ textAlign: 'center', padding: '20px' }}
                    onClick={() => handleDeptCardClick(d.department)}
                  >
                    <div style={{ marginBottom: '10px', color: 'var(--text-secondary)' }}><IconBuilding size={32} /></div>
                    <h4 style={{ fontWeight: '700', fontSize: '18px' }}>{d.department}</h4>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '5px', marginBottom: '15px' }}>{d.total_employees} Personnel</p>
                    <div style={{ marginTop: '15px', paddingTop: '20px', borderTop: '2px dashed var(--border-light)', display: 'flex', justifyContent: 'space-around' }}>
                      <div>
                        <span style={{ display: 'block', fontSize: '22px', fontWeight: '800', color: 'var(--success)' }}>{d.completion_pct}%</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>{t('employee_mgmt.completion')}</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '22px', fontWeight: '800', color: 'var(--primary)' }}>{d.avg_score}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>{t('employee_mgmt.avg_score')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Department Drill-Down Table */}
              {selectedDept && (
                <div style={{ marginTop: '24px' }} className="fade-in">
                  <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>
                    {selectedDept} — Employee Rankings
                  </h3>
                  {deptLoading ? (
                    <div className="card" style={{ padding: 0 }}>
                      <SkeletonTable rows={6} cols={4} />
                    </div>
                  ) : deptEmployees.length === 0 ? (
                    <div className="card" style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
                      No employees in this department
                    </div>
                  ) : (
                    <div className="card table-card" style={{ padding: 0 }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Rank</th>
                            <th>{t('employee_mgmt.employee_name')}</th>
                            <th>Course Completion %</th>
                            <th>{t('employee_mgmt.avg_score')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deptEmployees.map(emp => (
                            <tr key={emp.id}>
                              <td>
                                <span className={getRankBadge(emp.dept_rank)}>
                                  {emp.dept_rank}
                                </span>
                              </td>
                              <td style={{ fontWeight: 600 }}>{emp.name}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div className="progress-bar-track" style={{ flex: 1, maxWidth: '120px' }}>
                                    <div className="progress-bar-fill" style={{ width: `${emp.course_completion_percent}%` }} />
                                  </div>
                                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{emp.course_completion_percent}%</span>
                                </div>
                              </td>
                              <td>
                                <span style={{ fontWeight: 700, color: emp.avg_assessment_score >= 60 ? 'var(--success)' : (emp.avg_assessment_score > 0 ? 'var(--danger)' : 'var(--text-secondary)') }}>
                                  {emp.avg_assessment_score > 0 ? `${emp.avg_assessment_score}%` : 'N/A'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}



        </div>
      </main>

      {/* Drill-down Modal */}
      {drillDownModal.show && (
        <div className="modal-overlay" onClick={() => setDrillDownModal({ show: false, title: '', data: [] })}>
          <div className="modal" style={{ width: "800px", maxWidth: "95vw" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "20px" }}>
              <h2>{drillDownModal.title}</h2>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setDrillDownModal({ show: false, title: '', data: [] })}><IconX /></button>
            </div>

            <div className="table-card" style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Duration</th>
                    <th>Courses</th>
                    <th>Avg Score</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {drillDownModal.data.map(emp => (
                    <tr key={emp.id}>
                      <td>
                        <p style={{ fontWeight: 600, fontSize: "14px" }}>{emp.name}</p>
                        <p style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>{emp.role}</p>
                      </td>
                      <td><span style={{ color: emp.duration_months >= 6 ? 'var(--success)' : 'var(--danger)' }}>{emp.duration_months}m</span></td>
                      <td>{emp.courses_completed} passed</td>
                      <td>{emp.score}%</td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span className={`badge ${emp.status === 'Eligible' ? 'badge-success' : 'badge-warning'}`} style={{ alignSelf: "flex-start" }}>
                            {emp.status}
                          </span>
                          {emp.missing_requirements && <span style={{ fontSize: "11px", color: "var(--danger)" }}>{emp.missing_requirements}</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {drillDownModal.data.length === 0 && <div style={{ padding: "30px", textAlign: "center", color: "var(--text-secondary)" }}>No matching records found.</div>}
            </div>
          </div>
        </div>
      )}


      {/* Add Employee Modal */}
      {showAddEmployee && (
        <div className="modal-overlay" onClick={() => setShowAddEmployee(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "20px" }}>
              <h2>{t('employee_mgmt.register_personnel')}</h2>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setShowAddEmployee(false)}><IconX /></button>
            </div>
            <form onSubmit={handleAddEmployee} className="modal-form">
              <div className="input-group" style={{ marginBottom: "15px" }}>
                <label>{t('employee_mgmt.full_name_label')}</label>
                <input value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} required />
              </div>
              <div className="input-group" style={{ marginBottom: "15px" }}>
                <label>{t('employee_mgmt.corporate_email')}</label>
                <input type="email" value={empForm.email} onChange={e => setEmpForm({ ...empForm, email: e.target.value })} required />
              </div>
              <div className="input-group" style={{ marginBottom: "15px" }}>
                <label>{t('employee_mgmt.temp_password')}</label>
                <input type="password" value={empForm.password} onChange={e => setEmpForm({ ...empForm, password: e.target.value })} required />
              </div>
              <div className="input-group" style={{ marginBottom: "15px" }}>
                <label>{t('employee_mgmt.designation_label')}</label>
                <input value={empForm.job_role} onChange={e => setEmpForm({ ...empForm, job_role: e.target.value })} required />
              </div>
              <div className="input-group" style={{ marginBottom: "15px" }}>
                <label>{t('auth.department')}</label>
                <select value={empForm.department} onChange={e => setEmpForm({ ...empForm, department: e.target.value })}>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: "15px" }}>
                <label>{t('auth.primary_language')}</label>
                <select value={empForm.primary_language} onChange={e => setEmpForm({ ...empForm, primary_language: e.target.value })}>
                  {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </div>
              <div className="modal-actions" style={{ marginTop: "30px" }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddEmployee(false)}>{t('employee_mgmt.cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('employee_mgmt.onboard')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Course Modal */}
      {showAssignCourse && (
        <div className="modal-overlay" onClick={() => setShowAssignCourse(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "20px" }}>
              <h2>{t('assignment.assign_training')}</h2>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setShowAssignCourse(false)}><IconX /></button>
            </div>
            <form onSubmit={handleAssignCourse} className="modal-form">
              <div className="input-group" style={{ marginBottom: "20px" }}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <button type="button" className={`btn btn-sm ${assignTab === 'individual' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setAssignTab('individual')}>{t('assignment.individual')}</button>
                  <button type="button" className={`btn btn-sm ${assignTab === 'department' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setAssignTab('department')}>{t('assignment.department_tab')}</button>
                  <button type="button" className={`btn btn-sm ${assignTab === 'all' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setAssignTab('all')}>{t('assignment.all_employees')}</button>
                </div>
              </div>

              {assignTab === 'individual' && (
                <div className="input-group" style={{ marginBottom: "20px" }}>
                  <label>{t('assignment.personnel_selection')}</label>
                  <select value={assignForm.employee_id} onChange={e => setAssignForm({ ...assignForm, employee_id: e.target.value })} required>
                    <option value="">{t('assignment.select_an_employee')}</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} ({emp.job_role})</option>)}
                  </select>
                </div>
              )}

              {assignTab === 'department' && (
                <div className="input-group" style={{ marginBottom: "20px" }}>
                  <label>{t('assignment.select_department')}</label>
                  <select value={assignForm.department} onChange={e => setAssignForm({ ...assignForm, department: e.target.value })} required>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              )}

              <div className="input-group" style={{ marginBottom: "20px" }}>
                <label>{t('assignment.select_course')}</label>
                <select value={assignForm.course_id} onChange={e => setAssignForm({ ...assignForm, course_id: e.target.value })} required>
                  <option value="">{t('assignment.select_a_course')}</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>

              <div className="input-group" style={{ marginBottom: "20px" }}>
                <label>{t('assignment.set_deadline')}</label>
                <input type="date" value={assignForm.deadline_date} onChange={e => setAssignForm({ ...assignForm, deadline_date: e.target.value })} required />
              </div>

              <div className="modal-actions" style={{ marginTop: "30px" }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAssignCourse(false)}>{t('employee_mgmt.cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('assignment.dispatch')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Course Modal */}
      {showCreateCourse && (
        <div className="modal-overlay" onClick={() => setShowCreateCourse(false)}>
          <div className="modal" style={{ width: '800px', maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "20px" }}>
              <h2>{t('create_course_panel.title')}</h2>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setShowCreateCourse(false)}><IconX /></button>
            </div>

            <form onSubmit={handleCreateCourse} className="modal-form">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div className="input-group">
                  <label>{t('create_course_panel.title_en')}</label>
                  <input value={createForm.title.en} onChange={e => setCreateForm({ ...createForm, title: { ...createForm.title, en: e.target.value } })} required />
                </div>
                <div className="input-group">
                  <label>{t('create_course_panel.title_hi')}</label>
                  <input value={createForm.title.hi} onChange={e => setCreateForm({ ...createForm, title: { ...createForm.title, hi: e.target.value } })} required />
                </div>
                <div className="input-group">
                  <label>{t('create_course_panel.title_ta')}</label>
                  <input value={createForm.title.ta} onChange={e => setCreateForm({ ...createForm, title: { ...createForm.title, ta: e.target.value } })} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div className="input-group">
                  <label>{t('create_course_panel.desc_en')}</label>
                  <textarea value={createForm.description.en} onChange={e => setCreateForm({ ...createForm, description: { ...createForm.description, en: e.target.value } })} required />
                </div>
                <div className="input-group">
                  <label>{t('create_course_panel.desc_hi')}</label>
                  <textarea value={createForm.description.hi} onChange={e => setCreateForm({ ...createForm, description: { ...createForm.description, hi: e.target.value } })} required />
                </div>
                <div className="input-group">
                  <label>{t('create_course_panel.desc_ta')}</label>
                  <textarea value={createForm.description.ta} onChange={e => setCreateForm({ ...createForm, description: { ...createForm.description, ta: e.target.value } })} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div className="input-group">
                  <label>{t('create_course_panel.yt_en')}</label>
                  <input value={createForm.youtube_link.en} onChange={e => setCreateForm({ ...createForm, youtube_link: { ...createForm.youtube_link, en: e.target.value } })} />
                </div>
                <div className="input-group">
                  <label>{t('create_course_panel.yt_hi')}</label>
                  <input value={createForm.youtube_link.hi} onChange={e => setCreateForm({ ...createForm, youtube_link: { ...createForm.youtube_link, hi: e.target.value } })} />
                </div>
                <div className="input-group">
                  <label>{t('create_course_panel.yt_ta')}</label>
                  <input value={createForm.youtube_link.ta} onChange={e => setCreateForm({ ...createForm, youtube_link: { ...createForm.youtube_link, ta: e.target.value } })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div className="input-group">
                  <label>{t('create_course_panel.training_mode')}</label>
                  <select value={createForm.training_mode} onChange={e => setCreateForm({ ...createForm, training_mode: e.target.value })}>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="self-paced">Self-paced</option>
                    <option value="classroom">Classroom</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>{t('create_course_panel.category')}</label>
                  <select value={createForm.category} onChange={e => setCreateForm({ ...createForm, category: e.target.value })}>
                    <option value="Safety">Safety</option>
                    <option value="Operations">Operations</option>
                    <option value="Quality">Quality</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="HR">HR</option>
                  </select>
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: '20px' }}>
                <label>{t('materials.upload_materials')} ({t('materials.max_files')})</label>
                <div style={{ padding: '15px', border: '2px dashed var(--border)', borderRadius: '8px', background: 'var(--surface)' }}>
                  <input type="file" multiple onChange={(e) => {
                    const newFiles = Array.from(e.target.files).map(f => ({ file: f, lang: 'all' }));
                    if (courseFiles.length + newFiles.length > 5) {
                       alert(t('materials.max_files_reached'));
                       return;
                    }
                    setCourseFiles([...courseFiles, ...newFiles]);
                    e.target.value = null;
                  }} />
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '5px' }}>{t('materials.accepted_types')}</p>
                </div>
                {courseFiles.length > 0 && (
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {courseFiles.map((cf, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-hover)', padding: '8px 12px', borderRadius: '4px' }}>
                        <span style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{cf.file.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <select value={cf.lang} onChange={(e) => {
                            const updated = [...courseFiles];
                            updated[idx].lang = e.target.value;
                            setCourseFiles(updated);
                          }} style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                            <option value="all">{t('materials.all_languages')}</option>
                            <option value="en">{t('materials.english')}</option>
                            <option value="hi">{t('materials.hindi')}</option>
                            <option value="ta">{t('materials.tamil')}</option>
                          </select>
                          <button type="button" onClick={() => setCourseFiles(courseFiles.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><IconX size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {createStatus.msg && <div style={{ padding: '10px', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: '6px', marginBottom: '15px' }}>{createStatus.msg}</div>}
              {createStatus.err && <div style={{ padding: '10px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: '6px', marginBottom: '15px' }}>{createStatus.err}</div>}

              <div className="modal-actions" style={{ marginTop: "10px" }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowCreateCourse(false)}>{t('employee_mgmt.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={createStatus.loading}>
                  {createStatus.loading ? t('create_course_panel.creating') : t('create_course_panel.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
