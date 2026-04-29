import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getAdminDashboard, getEmployees, getAllCourses, addEmployee, claimIncentive, getDepartmentAnalytics, createCourse, assignIndividual, assignDepartment, assignAll, getDeptEmployees, getIncentiveDetails, assignEmployeesToScheme, uploadCourseMaterial, getCourseMaterials, deleteCourseMaterial, updateCourse, updateEmployee, getEmployeeCourses, deassignCourse, generateCourseAI, generateAssessmentAI } from '../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { IconUsers, IconCheckCircle, IconClock, IconDollarSign, IconTrendingUp, IconAward, IconAlertCircle, IconX, IconGlobe, IconBuilding, IconBook } from '../components/Icons';
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
  const [assignForm, setAssignForm] = useState({ course_id: '', employee_ids: [], department: 'Production', deadline_date: '' });
  const [assignIndividualSearchTerm, setAssignIndividualSearchTerm] = useState('');
  const [showAssignIndividualDropdown, setShowAssignIndividualDropdown] = useState(false);

  const [createForm, setCreateForm] = useState({
    title: { en: '', hi: '', ta: '' },
    description: { en: '', hi: '', ta: '' },
    youtube_link: { en: '', hi: '', ta: '' },
    training_mode: 'online',
    category: 'Safety',
    skills: [],
    duration_minutes: 0,
    duration_days: 0,
    generate_assessment: false,
    assessment_questions: [],
  });
  const [createStatus, setCreateStatus] = useState({ loading: false, msg: '', err: '' });
  const [courseFiles, setCourseFiles] = useState([]);
  const [actionMsg, setActionMsg] = useState('');

  // Scoreboard
  const [scoreboardCourseId, setScoreboardCourseId] = useState('');
  const [scoreboardData, setScoreboardData] = useState([]);

  // Edit Course Modal
  const [showEditCourse, setShowEditCourse] = useState(false);
  const [editCourseId, setEditCourseId] = useState('');
  const [editCourseForm, setEditCourseForm] = useState({ title: '', description: '', youtube_link: '', skills: [], duration_minutes: 0, duration_days: 0, training_mode: 'online', category: 'Safety' });
  const [editCourseStatus, setEditCourseStatus] = useState({ loading: false, msg: '', err: '' });
  const [editCourseMaterials, setEditCourseMaterials] = useState([]);
  const [editCourseFiles, setEditCourseFiles] = useState([]);
  const [editMaterialsLoading, setEditMaterialsLoading] = useState(false);
  const [aiGenLoading, setAiGenLoading] = useState(false);
  const [skillInput, setSkillInput] = useState('');

  // Edit Employee Modal
  const [showEditEmployee, setShowEditEmployee] = useState(false);
  const [editEmpId, setEditEmpId] = useState('');
  const [editEmpForm, setEditEmpForm] = useState({ name: '', email: '', job_role: '', department: 'Production', primary_language: 'en' });
  const [editEmpStatus, setEditEmpStatus] = useState({ loading: false, msg: '', err: '' });

  // Employee Course Management
  const [expandedEmpId, setExpandedEmpId] = useState(null);
  const [empCourses, setEmpCourses] = useState([]);
  const [empCoursesLoading, setEmpCoursesLoading] = useState(false);
  const [showEmpAssign, setShowEmpAssign] = useState(false);
  const [empAssignCourseId, setEmpAssignCourseId] = useState('');
  const [empAssignDeadline, setEmpAssignDeadline] = useState('');

  // Create course AI gen
  const [createAiGenLoading, setCreateAiGenLoading] = useState(false);
  const [assessmentGenLoading, setAssessmentGenLoading] = useState(false);
  const [createSkillInput, setCreateSkillInput] = useState('');

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

  // --- Edit Course ---
  const openEditCourse = async (course) => {
    setEditCourseId(course.id);
    setEditCourseForm({
      title: course.title || '',
      description: course.description || '',
      youtube_link: course.youtube_link || '',
      skills: course.skills_raw || course.skills || [],
      duration_minutes: course.duration_minutes || 0,
      duration_days: course.duration_days || 0,
      training_mode: course.training_mode || 'online',
      category: course.category || 'Safety',
    });
    setSkillInput('');
    setEditCourseFiles([]);
    setEditCourseMaterials([]);
    setEditCourseStatus({ loading: false, msg: '', err: '' });
    setShowEditCourse(true);
    setEditMaterialsLoading(true);
    try {
      const res = await getCourseMaterials(course.id);
      setEditCourseMaterials(res.data.materials || []);
    } catch (err) {
      setEditCourseMaterials([]);
    }
    setEditMaterialsLoading(false);
  };

  const handleEditCourse = async (e) => {
    e.preventDefault();
    setEditCourseStatus({ loading: true, msg: '', err: '' });
    try {
      await updateCourse(editCourseId, { ...editCourseForm, source_lang: language });
      if (editCourseFiles.length > 0) {
        setEditCourseStatus({ loading: true, msg: 'Uploading materials...', err: '' });
        for (const cf of editCourseFiles) {
          await uploadCourseMaterial(editCourseId, cf.file, cf.lang);
        }
      }
      setEditCourseStatus({ loading: false, msg: 'Course updated!', err: '' });
      setShowEditCourse(false);
      setActionMsg('Course updated and translations generated!');
      await fetchData();
      setTimeout(() => setActionMsg(''), 3000);
    } catch (err) {
      setEditCourseStatus({ loading: false, msg: '', err: err.response?.data?.detail || 'Failed to update course' });
    }
  };

  const handleDeleteEditMaterial = async (fileId) => {
    if (!window.confirm('Remove this course material?')) return;
    setEditMaterialsLoading(true);
    try {
      await deleteCourseMaterial(editCourseId, fileId);
      const res = await getCourseMaterials(editCourseId);
      setEditCourseMaterials(res.data.materials || []);
      setActionMsg('Course material removed');
      setTimeout(() => setActionMsg(''), 3000);
      fetchData();
    } catch (err) {
      setActionMsg(err.response?.data?.detail || 'Failed to remove material');
      setTimeout(() => setActionMsg(''), 3000);
    }
    setEditMaterialsLoading(false);
  };

  const handleAIGenerate = async (isCreate = false) => {
    const form = isCreate ? createForm : editCourseForm;
    const titleVal = isCreate ? (form.title?.[language] || form.title?.en || '') : form.title;
    const descVal = isCreate ? (form.description?.[language] || form.description?.en || '') : form.description;
    if (!titleVal) { setActionMsg('Enter a title first'); setTimeout(() => setActionMsg(''), 2000); return; }
    if (isCreate) setCreateAiGenLoading(true); else setAiGenLoading(true);
    try {
      const res = await generateCourseAI({ title: titleVal, description: descVal, source_lang: language });
      const data = res.data;
      if (isCreate) {
        setCreateForm(prev => ({
          ...prev,
          youtube_link: { ...prev.youtube_link, [language]: data.youtube_link || '' },
          skills: data.skills || [],
          duration_minutes: data.duration_minutes || 0,
          duration_days: data.duration_days || 0,
        }));
      } else {
        setEditCourseForm(prev => ({
          ...prev,
          youtube_link: data.youtube_link || prev.youtube_link,
          skills: data.skills || prev.skills,
          duration_minutes: data.duration_minutes || prev.duration_minutes,
          duration_days: data.duration_days || prev.duration_days,
        }));
      }
      setActionMsg('AI generated fields successfully!');
      setTimeout(() => setActionMsg(''), 2000);
    } catch (err) {
      setActionMsg('AI generation failed');
      setTimeout(() => setActionMsg(''), 2000);
    }
    if (isCreate) setCreateAiGenLoading(false); else setAiGenLoading(false);
  };

  const handleGenerateAssessment = async () => {
    const titleVal = createForm.title?.[language] || createForm.title?.en || '';
    const descVal = createForm.description?.[language] || createForm.description?.en || '';
    if (!titleVal) { setActionMsg('Enter a title first'); setTimeout(() => setActionMsg(''), 2000); return; }
    setAssessmentGenLoading(true);
    try {
      const res = await generateAssessmentAI({ title: titleVal, description: descVal, source_lang: language });
      setCreateForm(prev => ({
        ...prev,
        generate_assessment: true,
        assessment_questions: res.data.questions || [],
      }));
      setActionMsg('Assessment questions generated!');
      setTimeout(() => setActionMsg(''), 2000);
    } catch (err) {
      setActionMsg('Assessment generation failed');
      setTimeout(() => setActionMsg(''), 2000);
    }
    setAssessmentGenLoading(false);
  };

  // --- Edit Employee ---
  const openEditEmployee = (emp) => {
    setEditEmpId(emp.id);
    setEditEmpForm({ name: emp.name, email: emp.email, job_role: emp.job_role, department: emp.department || 'Production', primary_language: emp.primary_language || 'en' });
    setEditEmpStatus({ loading: false, msg: '', err: '' });
    setShowEditEmployee(true);
  };

  const handleEditEmployee = async (e) => {
    e.preventDefault();
    setEditEmpStatus({ loading: true, msg: '', err: '' });
    try {
      await updateEmployee(editEmpId, editEmpForm);
      setEditEmpStatus({ loading: false, msg: 'Updated!', err: '' });
      setShowEditEmployee(false);
      setActionMsg('Employee updated successfully!');
      fetchData();
      setTimeout(() => setActionMsg(''), 3000);
    } catch (err) {
      setEditEmpStatus({ loading: false, msg: '', err: err.response?.data?.detail || 'Failed to update' });
    }
  };

  // --- Employee Course Management ---
  const handleExpandEmpCourses = async (empId) => {
    if (expandedEmpId === empId) { setExpandedEmpId(null); return; }
    setExpandedEmpId(empId);
    setEmpCoursesLoading(true);
    setShowEmpAssign(false);
    try {
      const res = await getEmployeeCourses(empId);
      setEmpCourses(res.data);
    } catch { setEmpCourses([]); }
    setEmpCoursesLoading(false);
  };

  const handleDeassignCourse = async (empId, courseId) => {
    if (!window.confirm('Deassign this course from the employee?')) return;
    try {
      await deassignCourse(empId, courseId);
      setActionMsg('Course deassigned!');
      const res = await getEmployeeCourses(empId);
      setEmpCourses(res.data);
      fetchData();
      setTimeout(() => setActionMsg(''), 3000);
    } catch (err) {
      setActionMsg(err.response?.data?.detail || 'Failed to deassign');
    }
  };

  const handleEmpAssignCourse = async (empId) => {
    if (!empAssignCourseId || !empAssignDeadline) return;
    try {
      await assignIndividual({ user_id: empId, course_id: empAssignCourseId, deadline_date: new Date(empAssignDeadline).toISOString() });
      setActionMsg('Course assigned!');
      setShowEmpAssign(false);
      setEmpAssignCourseId('');
      setEmpAssignDeadline('');
      const res = await getEmployeeCourses(empId);
      setEmpCourses(res.data);
      fetchData();
      setTimeout(() => setActionMsg(''), 3000);
    } catch (err) {
      setActionMsg(err.response?.data?.detail || 'Failed to assign');
    }
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    setCreateStatus({ loading: true, msg: '', err: '' });
    try {
      const coursePayload = {
        ...createForm,
        assessment_questions: createForm.generate_assessment ? (createForm.assessment_questions || []) : [],
      };
      const res = await createCourse(coursePayload);
      const newCourseId = res.data?.course_id;

      if (courseFiles.length > 0 && newCourseId) {
        setCreateStatus({ loading: true, msg: 'Uploading materials...', err: '' });
        for (const cf of courseFiles) {
           await uploadCourseMaterial(newCourseId, cf.file, cf.lang);
        }
      }

      setCreateStatus({ loading: false, msg: 'Course created successfully!', err: '' });
      await fetchData();
      setActiveSection('courses');
      setShowCreateCourse(false);
      setCreateForm({
        title: { en: '', hi: '', ta: '' },
        description: { en: '', hi: '', ta: '' },
        youtube_link: { en: '', hi: '', ta: '' },
        training_mode: 'online',
        category: 'Safety',
        skills: [],
        duration_minutes: 0,
        duration_days: 0,
        generate_assessment: false,
        assessment_questions: [],
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
        if (!assignForm.employee_ids || assignForm.employee_ids.length === 0) return;
        await Promise.all(
          assignForm.employee_ids.map((emp) => 
            assignIndividual({
              user_id: emp.id,
              course_id: assignForm.course_id,
              deadline_date: new Date(assignForm.deadline_date).toISOString()
            })
          )
        );
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
      setAssignForm({ ...assignForm, course_id: '', employee_ids: [] });
      setAssignIndividualSearchTerm('');
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
    { id: 'courses', icon: <IconBook size={20} />, label: 'Course Management' },
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
              <div className="overview-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
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
                <button className="stat-card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setActiveSection('courses')}>
                  <div className="stat-icon" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}><IconBook /></div>
                  <div>
                    <p className="stat-value">{courses.length}</p>
                    <p className="stat-label">Course Management</p>
                  </div>
                </button>
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

              {/* Courses Management Table */}
              <div style={{ marginTop: 'var(--space-xl)' }}>
                <h3 style={{ marginBottom: '16px' }}>Course Management</h3>
                <div className="card table-card" style={{ padding: 0 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Course Title</th>
                        <th>Category</th>
                        <th>Mode</th>
                        <th>Duration</th>
                        <th>Days</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courses.map(c => (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 600 }}>{c.title}</td>
                          <td><span className="badge badge-primary">{c.category}</span></td>
                          <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{c.training_mode}</td>
                          <td style={{ fontSize: '13px' }}>{c.duration_minutes || 0} mins</td>
                          <td style={{ fontSize: '13px' }}>{c.duration_days || 0} days</td>
                          <td>
                            <button className="btn btn-outline btn-sm" onClick={() => openEditCourse(c)}>✏️ Edit</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {courses.length === 0 && <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>No courses found</div>}
                </div>
              </div>

            </section>
          )}

          {activeSection === 'courses' && (
            <section className="fade-in">
              <h2 className="section-title">Course Management</h2>
              <div className="card table-card" style={{ padding: 0 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Course Title</th>
                      <th>Category</th>
                      <th>Mode</th>
                      <th>Duration</th>
                      <th>Days</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.title}</td>
                        <td><span className="badge badge-primary">{c.category}</span></td>
                        <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{c.training_mode}</td>
                        <td style={{ fontSize: '13px' }}>{c.duration_minutes || 0} mins</td>
                        <td style={{ fontSize: '13px' }}>{c.duration_days || 0} days</td>
                        <td>
                          <button className="btn btn-outline btn-sm" onClick={() => openEditCourse(c)}>Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {courses.length === 0 && <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>No courses found</div>}
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
                {empLoading ? <SkeletonTable rows={8} cols={9} /> : (
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
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map(emp => (
                        <React.Fragment key={emp.id}>
                        <tr style={{ cursor: 'pointer' }} onClick={() => handleExpandEmpCourses(emp.id)}>
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
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); openEditEmployee(emp); }}>✏️</button>
                              <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); handleExpandEmpCourses(emp.id); }}>{expandedEmpId === emp.id ? '▲' : '▼'}</button>
                            </div>
                          </td>
                        </tr>
                        {/* Expanded Course Panel */}
                        {expandedEmpId === emp.id && (
                          <tr>
                            <td colSpan={9} style={{ padding: 0, background: 'var(--surface-hover)' }}>
                              <div style={{ padding: '20px 30px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                  <h4 style={{ fontSize: '14px', fontWeight: 700 }}>Assigned Courses for {emp.name}</h4>
                                  <button className="btn btn-primary btn-sm" onClick={() => setShowEmpAssign(!showEmpAssign)}>+ Assign Course</button>
                                </div>
                                {showEmpAssign && (
                                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', alignItems: 'flex-end', padding: '12px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                    <div style={{ flex: 2 }}>
                                      <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Course</label>
                                      <select value={empAssignCourseId} onChange={e => setEmpAssignCourseId(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                        <option value="">Select a course</option>
                                        {courses.filter(c => !empCourses.find(ec => ec.course_id === c.id)).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                      </select>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Deadline</label>
                                      <input type="date" value={empAssignDeadline} onChange={e => setEmpAssignDeadline(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }} />
                                    </div>
                                    <button className="btn btn-primary btn-sm" onClick={() => handleEmpAssignCourse(emp.id)} disabled={!empAssignCourseId || !empAssignDeadline}>Assign</button>
                                  </div>
                                )}
                                {empCoursesLoading ? <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Loading...</p> : empCourses.length > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {empCourses.map(ec => (
                                      <div key={ec.course_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                                        <div style={{ flex: 1 }}>
                                          <span style={{ fontWeight: 600, fontSize: '13px' }}>{ec.title}</span>
                                          <span style={{ marginLeft: '10px', fontSize: '11px', color: 'var(--text-tertiary)' }}>{ec.category} · {ec.training_mode}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                          <span className={`badge ${ec.status === 'completed' ? 'badge-success' : ec.status === 'in_progress' ? 'badge-warning' : 'badge-primary'}`}>
                                            {ec.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                          </span>
                                          {ec.score > 0 && <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--success)' }}>{ec.score}%</span>}
                                          <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)', fontSize: '11px', padding: '4px 8px' }} onClick={() => handleDeassignCourse(emp.id, ec.course_id)}>Deassign</button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>No courses assigned</p>}
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
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
                  <div className="multi-select-container">
                    <input
                      className="multi-select-search"
                      type="text"
                      placeholder={t('assignment.select_an_employee')}
                      value={assignIndividualSearchTerm}
                      onChange={(e) => { setAssignIndividualSearchTerm(e.target.value); setShowAssignIndividualDropdown(true); }}
                      onFocus={() => setShowAssignIndividualDropdown(true)}
                    />
                    {showAssignIndividualDropdown && assignIndividualSearchTerm && (
                      <div className="multi-select-dropdown">
                        {employees
                          .filter(emp => {
                            const alreadySelected = assignForm.employee_ids.map(s => s.id);
                            return !alreadySelected.includes(emp.id) &&
                              emp.name.toLowerCase().includes(assignIndividualSearchTerm.toLowerCase());
                          })
                          .slice(0, 10)
                          .map(emp => (
                            <div key={emp.id} className="multi-select-option"
                              onClick={() => {
                                setAssignForm(prev => ({...prev, employee_ids: [...prev.employee_ids, emp]}));
                                setAssignIndividualSearchTerm('');
                                setShowAssignIndividualDropdown(false);
                              }}>
                              {emp.name} — {emp.department}
                            </div>
                          ))
                        }
                        {employees.filter(emp => {
                          const alreadySelected = assignForm.employee_ids.map(s => s.id);
                          return !alreadySelected.includes(emp.id) && emp.name.toLowerCase().includes(assignIndividualSearchTerm.toLowerCase());
                        }).length === 0 && (
                            <div style={{ padding: "10px 14px", color: "var(--text-tertiary)", fontSize: "13px" }}>No matching employees found</div>
                          )}
                      </div>
                    )}
                    {assignForm.employee_ids.length > 0 && (
                      <div className="selected-tags">
                        {assignForm.employee_ids.map(emp => (
                          <span key={emp.id} className="selected-tag">
                            {emp.name}
                            <button type="button" onClick={() => setAssignForm(prev => ({...prev, employee_ids: prev.employee_ids.filter(s => s.id !== emp.id)}))}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
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

      {/* Create Course Modal — Single Language */}
      {showCreateCourse && (
        <div className="modal-overlay" onClick={() => setShowCreateCourse(false)}>
          <div className="modal" style={{ width: '650px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "20px" }}>
              <h2>{t('create_course_panel.title')}</h2>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setShowCreateCourse(false)}><IconX /></button>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '15px', background: 'var(--primary-bg)', padding: '8px 12px', borderRadius: '6px' }}>
              ℹ️ Fill in the current language ({LANGUAGES.find(l => l.code === language)?.label}). Other languages will be auto-translated.
            </p>

            <form onSubmit={handleCreateCourse} className="modal-form">
              <div className="input-group" style={{ marginBottom: '15px' }}>
                <label>Title ({LANGUAGES.find(l => l.code === language)?.label})</label>
                <input value={createForm.title[language] || ''} onChange={e => setCreateForm({ ...createForm, title: { ...createForm.title, [language]: e.target.value } })} required />
              </div>

              <div className="input-group" style={{ marginBottom: '15px' }}>
                <label>Description ({LANGUAGES.find(l => l.code === language)?.label})</label>
                <textarea value={createForm.description[language] || ''} onChange={e => setCreateForm({ ...createForm, description: { ...createForm.description, [language]: e.target.value } })} required rows={3} />
              </div>

              <div className="input-group" style={{ marginBottom: '15px' }}>
                <label>YouTube Link ({LANGUAGES.find(l => l.code === language)?.label})</label>
                <input value={createForm.youtube_link[language] || ''} onChange={e => setCreateForm({ ...createForm, youtube_link: { ...createForm.youtube_link, [language]: e.target.value } })} placeholder="https://youtube.com/watch?v=..." />
              </div>

              {/* Skills */}
              <div className="input-group" style={{ marginBottom: '15px' }}>
                <label>Acquired Skills</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {(createForm.skills || []).map((s, i) => (
                    <span key={i} className="selected-tag">{s}<button type="button" onClick={() => setCreateForm(prev => ({ ...prev, skills: prev.skills.filter((_, idx) => idx !== i) }))}>×</button></span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={createSkillInput} onChange={e => setCreateSkillInput(e.target.value)} placeholder="Type a skill and press Add" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (createSkillInput.trim()) { setCreateForm(prev => ({ ...prev, skills: [...(prev.skills || []), createSkillInput.trim()] })); setCreateSkillInput(''); } } }} />
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => { if (createSkillInput.trim()) { setCreateForm(prev => ({ ...prev, skills: [...(prev.skills || []), createSkillInput.trim()] })); setCreateSkillInput(''); } }}>Add</button>
                </div>
              </div>

              {/* Duration */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div className="input-group">
                  <label>Duration (minutes)</label>
                  <input type="number" value={createForm.duration_minutes || 0} onChange={e => setCreateForm({ ...createForm, duration_minutes: parseInt(e.target.value) || 0 })} min={0} />
                </div>
                <div className="input-group">
                  <label>Training Days Equivalent</label>
                  <input type="number" value={createForm.duration_days || 0} onChange={e => setCreateForm({ ...createForm, duration_days: parseInt(e.target.value) || 0 })} min={0} />
                </div>
              </div>

              {/* AI Generate Button */}
              <button type="button" className="btn btn-outline" style={{ width: '100%', marginBottom: '15px', justifyContent: 'center', background: 'linear-gradient(135deg, #f0f4ff, #e8f5e9)', border: '1px solid var(--primary-light)' }} onClick={() => handleAIGenerate(true)} disabled={createAiGenLoading}>
                {createAiGenLoading ? 'Generating...' : 'Generate Skills, YouTube Link, Duration & Days with AI'}
              </button>

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
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={createForm.generate_assessment}
                    onChange={e => setCreateForm({ ...createForm, generate_assessment: e.target.checked })}
                  />
                  Auto-generate assessment MCQs
                </label>
                <button type="button" className="btn btn-outline" style={{ width: '100%', marginTop: '10px', justifyContent: 'center' }} onClick={handleGenerateAssessment} disabled={assessmentGenLoading}>
                  {assessmentGenLoading ? 'Generating assessment...' : 'Generate Assessment Questions with AI'}
                </button>
                {(createForm.assessment_questions || []).length > 0 && (
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {createForm.assessment_questions.map((q, qIdx) => (
                      <div key={qIdx} style={{ padding: '12px', border: '1px solid var(--border-light)', borderRadius: '8px', background: 'var(--surface-hover)' }}>
                        <label style={{ fontSize: '12px', fontWeight: 700 }}>Question {qIdx + 1}</label>
                        <input value={q.question || ''} onChange={e => setCreateForm(prev => ({ ...prev, assessment_questions: prev.assessment_questions.map((item, idx) => idx === qIdx ? { ...item, question: e.target.value } : item) }))} style={{ marginTop: '6px', marginBottom: '8px' }} />
                        {(q.options || []).map((opt, optIdx) => (
                          <div key={optIdx} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                            <input
                              type="radio"
                              name={`correct-${qIdx}`}
                              checked={q.correct_answer === optIdx}
                              onChange={() => setCreateForm(prev => ({ ...prev, assessment_questions: prev.assessment_questions.map((item, idx) => idx === qIdx ? { ...item, correct_answer: optIdx } : item) }))}
                              aria-label={`Correct option ${optIdx + 1}`}
                            />
                            <input value={opt} onChange={e => setCreateForm(prev => ({ ...prev, assessment_questions: prev.assessment_questions.map((item, idx) => idx === qIdx ? { ...item, options: item.options.map((o, oi) => oi === optIdx ? e.target.value : o) } : item) }))} />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="input-group" style={{ marginBottom: '20px' }}>
                <label>{t('materials.upload_materials')} ({t('materials.max_files')})</label>
                <div style={{ padding: '15px', border: '2px dashed var(--border)', borderRadius: '8px', background: 'var(--surface)' }}>
                  <input type="file" multiple onChange={(e) => {
                    const newFiles = Array.from(e.target.files).map(f => ({ file: f, lang: 'all' }));
                    if (courseFiles.length + newFiles.length > 5) { alert(t('materials.max_files_reached')); return; }
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
                        <button type="button" onClick={() => setCourseFiles(courseFiles.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><IconX size={14} /></button>
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

      {/* Edit Course Modal */}
      {showEditCourse && (
        <div className="modal-overlay" onClick={() => setShowEditCourse(false)}>
          <div className="modal" style={{ width: '650px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "20px" }}>
              <h2>Edit Course</h2>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setShowEditCourse(false)}><IconX /></button>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '15px', background: 'var(--primary-bg)', padding: '8px 12px', borderRadius: '6px' }}>
              ℹ️ Edit in {LANGUAGES.find(l => l.code === language)?.label}. Changes will auto-translate to all languages via Bhashini API.
            </p>

            <form onSubmit={handleEditCourse} className="modal-form">
              <div className="input-group" style={{ marginBottom: '15px' }}>
                <label>Title ({LANGUAGES.find(l => l.code === language)?.label})</label>
                <input value={editCourseForm.title} onChange={e => setEditCourseForm({ ...editCourseForm, title: e.target.value })} required />
              </div>

              <div className="input-group" style={{ marginBottom: '15px' }}>
                <label>Description ({LANGUAGES.find(l => l.code === language)?.label})</label>
                <textarea value={editCourseForm.description} onChange={e => setEditCourseForm({ ...editCourseForm, description: e.target.value })} required rows={3} />
              </div>

              <div className="input-group" style={{ marginBottom: '15px' }}>
                <label>YouTube Link ({LANGUAGES.find(l => l.code === language)?.label})</label>
                <input value={editCourseForm.youtube_link} onChange={e => setEditCourseForm({ ...editCourseForm, youtube_link: e.target.value })} placeholder="https://youtube.com/watch?v=..." />
              </div>

              {/* Skills */}
              <div className="input-group" style={{ marginBottom: '15px' }}>
                <label>Acquired Skills</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {(editCourseForm.skills || []).map((s, i) => (
                    <span key={i} className="selected-tag">{s}<button type="button" onClick={() => setEditCourseForm(prev => ({ ...prev, skills: prev.skills.filter((_, idx) => idx !== i) }))}>×</button></span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={skillInput} onChange={e => setSkillInput(e.target.value)} placeholder="Type a skill and press Add" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (skillInput.trim()) { setEditCourseForm(prev => ({ ...prev, skills: [...(prev.skills || []), skillInput.trim()] })); setSkillInput(''); } } }} />
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => { if (skillInput.trim()) { setEditCourseForm(prev => ({ ...prev, skills: [...(prev.skills || []), skillInput.trim()] })); setSkillInput(''); } }}>Add</button>
                </div>
              </div>

              {/* Duration */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div className="input-group">
                  <label>Duration (minutes)</label>
                  <input type="number" value={editCourseForm.duration_minutes} onChange={e => setEditCourseForm({ ...editCourseForm, duration_minutes: parseInt(e.target.value) || 0 })} min={0} />
                </div>
                <div className="input-group">
                  <label>Training Days Equivalent</label>
                  <input type="number" value={editCourseForm.duration_days} onChange={e => setEditCourseForm({ ...editCourseForm, duration_days: parseInt(e.target.value) || 0 })} min={0} />
                </div>
              </div>

              {/* AI Generate Button */}
              <button type="button" className="btn btn-outline" style={{ width: '100%', marginBottom: '15px', justifyContent: 'center', background: 'linear-gradient(135deg, #f0f4ff, #e8f5e9)', border: '1px solid var(--primary-light)' }} onClick={() => handleAIGenerate(false)} disabled={aiGenLoading}>
                {aiGenLoading ? 'Generating...' : 'Generate Skills, YouTube Link, Duration & Days with AI'}
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div className="input-group">
                  <label>Training Mode</label>
                  <select value={editCourseForm.training_mode} onChange={e => setEditCourseForm({ ...editCourseForm, training_mode: e.target.value })}>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="self-paced">Self-paced</option>
                    <option value="classroom">Classroom</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Category</label>
                  <select value={editCourseForm.category} onChange={e => setEditCourseForm({ ...editCourseForm, category: e.target.value })}>
                    <option value="Safety">Safety</option>
                    <option value="Operations">Operations</option>
                    <option value="Quality">Quality</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="HR">HR</option>
                  </select>
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: '20px' }}>
                <label>Course Materials</label>
                <div style={{ padding: '15px', border: '2px dashed var(--border)', borderRadius: '8px', background: 'var(--surface)' }}>
                  <input type="file" multiple onChange={(e) => {
                    const newFiles = Array.from(e.target.files).map(f => ({ file: f, lang: 'all' }));
                    if (editCourseMaterials.length + editCourseFiles.length + newFiles.length > 5) { alert(t('materials.max_files_reached')); return; }
                    setEditCourseFiles([...editCourseFiles, ...newFiles]);
                    e.target.value = null;
                  }} />
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '5px' }}>{t('materials.accepted_types')}</p>
                </div>
                {editMaterialsLoading ? (
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', marginTop: '10px' }}>Loading materials...</p>
                ) : editCourseMaterials.length > 0 && (
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {editCourseMaterials.map((mat, idx) => (
                      <div key={mat.file_id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-hover)', padding: '8px 12px', borderRadius: '4px', gap: '10px' }}>
                        <span style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mat.filename}</span>
                        <button type="button" className="btn btn-outline btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleDeleteEditMaterial(mat.file_id)}>Remove</button>
                      </div>
                    ))}
                  </div>
                )}
                {editCourseFiles.length > 0 && (
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {editCourseFiles.map((cf, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-hover)', padding: '8px 12px', borderRadius: '4px', gap: '10px' }}>
                        <span style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cf.file.name}</span>
                        <button type="button" onClick={() => setEditCourseFiles(editCourseFiles.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><IconX size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {editCourseStatus.msg && <div style={{ padding: '10px', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: '6px', marginBottom: '15px' }}>{editCourseStatus.msg}</div>}
              {editCourseStatus.err && <div style={{ padding: '10px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: '6px', marginBottom: '15px' }}>{editCourseStatus.err}</div>}

              <div className="modal-actions" style={{ marginTop: "10px" }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowEditCourse(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editCourseStatus.loading}>
                  {editCourseStatus.loading ? 'Saving & Translating...' : 'Save & Auto-Translate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditEmployee && (
        <div className="modal-overlay" onClick={() => setShowEditEmployee(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "20px" }}>
              <h2>Edit Employee</h2>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setShowEditEmployee(false)}><IconX /></button>
            </div>
            <form onSubmit={handleEditEmployee} className="modal-form">
              <div className="input-group" style={{ marginBottom: "15px" }}>
                <label>Full Name</label>
                <input value={editEmpForm.name} onChange={e => setEditEmpForm({ ...editEmpForm, name: e.target.value })} required />
              </div>
              <div className="input-group" style={{ marginBottom: "15px" }}>
                <label>Email</label>
                <input type="email" value={editEmpForm.email} onChange={e => setEditEmpForm({ ...editEmpForm, email: e.target.value })} required />
              </div>
              <div className="input-group" style={{ marginBottom: "15px" }}>
                <label>Designation</label>
                <input value={editEmpForm.job_role} onChange={e => setEditEmpForm({ ...editEmpForm, job_role: e.target.value })} required />
              </div>
              <div className="input-group" style={{ marginBottom: "15px" }}>
                <label>Department</label>
                <select value={editEmpForm.department} onChange={e => setEditEmpForm({ ...editEmpForm, department: e.target.value })}>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: "15px" }}>
                <label>Primary Language</label>
                <select value={editEmpForm.primary_language} onChange={e => setEditEmpForm({ ...editEmpForm, primary_language: e.target.value })}>
                  {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </div>

              {editEmpStatus.err && <div style={{ padding: '10px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: '6px', marginBottom: '15px' }}>{editEmpStatus.err}</div>}

              <div className="modal-actions" style={{ marginTop: "30px" }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowEditEmployee(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editEmpStatus.loading}>
                  {editEmpStatus.loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
