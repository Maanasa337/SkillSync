import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getAdminDashboard, getEmployees, getAllCourses, addEmployee, assignCourse, claimIncentive } from '../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { IconUsers, IconCheckCircle, IconClock, IconDollarSign, IconTrendingUp, IconAward, IconAlertCircle, IconX } from '../components/Icons';
import axios from 'axios';
import './Dashboard.css';

const PIE_COLORS = ['#16A34A', '#F59E0B', '#EF4444'];
const API_URL = 'http://localhost:8000'; // Reuse since it's isolated

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [courses, setCourses] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [activeSection, setActiveSection] = useState('overview');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showAssignCourse, setShowAssignCourse] = useState(false);
  const [drillDownModal, setDrillDownModal] = useState({ show: false, title: '', data: [] });
  const [empForm, setEmpForm] = useState({ name: '', email: '', password: '', job_role: '' });
  const [assignForm, setAssignForm] = useState({ employee_id: '', course_id: '' });
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
      const [dashRes, empRes, courseRes] = await Promise.all([
        getAdminDashboard(),
        getEmployees(statusFilter || undefined),
        getAllCourses(),
      ]);
      setDashboard(dashRes.data);
      setEmployees(empRes.data);
      setCourses(courseRes.data);
      
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

  useEffect(() => { fetchData(); }, [statusFilter]);

  const handleScoreboardChange = (e) => {
    const cid = e.target.value;
    setScoreboardCourseId(cid);
    fetchScoreboard(cid);
  }

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
    try {
      await assignCourse(assignForm);
      setShowAssignCourse(false);
      setAssignForm({ employee_id: '', course_id: '' });
      setActionMsg('Course assigned successfully!');
      fetchData();
      setTimeout(() => setActionMsg(''), 3000);
    } catch (err) {
      setActionMsg(err.response?.data?.detail || 'Failed to assign course');
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

  if (loading) return <div className="loading-screen"><div className="loader"></div></div>;

  const { overview, incentive_progress, course_chart, pie_data } = dashboard || {};
// Define pie colors within the file if not already
const PIE_COLORS = ['#A1C942', '#FFC000', '#EF4444'];

  const pieChartData = pie_data ? [
    { name: 'Completed', value: pie_data.completed },
    { name: 'Pending', value: pie_data.pending },
  ] : [];

  const navItems = [
    { id: 'overview', icon: <IconTrendingUp size={20} />, label: 'Overview' },
    { id: 'incentives', icon: <IconDollarSign size={20} />, label: 'Incentives' },
    { id: 'employees', icon: <IconUsers size={20} />, label: 'Employees' },
    { id: 'scoreboard', icon: <IconAward size={20} />, label: 'Scoreboard' },
  ];

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header" style={{ marginBottom: "2rem" }}>
          <div className="sidebar-logo">
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="8" fill="var(--primary)"/>
              <path d="M12 20L18 26L28 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>SkillSync</span>
          </div>
        </div>
        <div className="sidebar-user" style={{ marginBottom: "2rem" }}>
            <div className="avatar">{user?.name?.charAt(0) || 'A'}</div>
            <div>
              <p className="sidebar-name">{user?.name}</p>
              <p className="sidebar-role">Administrator</p>
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
          <span>Sign Out</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="main-header">
          <div>
            <h1>Admin Intelligence Platform</h1>
            <p>Enterprise Training & Eligibility Hub</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setShowAddEmployee(true)}>+ Employee</button>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAssignCourse(true)}>Assign Course</button>
          </div>
        </header>

        {actionMsg && <div className="toast" style={{marginBottom: "20px"}}>{actionMsg}</div>}

        <div className="dashboard-content">
          {/* Overview Cards */}
          {activeSection === 'overview' && (
            <section className="fade-in">
              <h2 className="section-title">System Overview</h2>
              <div className="overview-grid">
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}><IconUsers /></div>
                  <div>
                    <p className="stat-value">{overview?.total_employees || 0}</p>
                    <p className="stat-label">Total Workforce</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><IconCheckCircle /></div>
                  <div>
                    <p className="stat-value">{overview?.completed_trainings || 0}</p>
                    <p className="stat-label">Assessments Passed</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}><IconClock /></div>
                  <div>
                    <p className="stat-value">{overview?.pending_trainings || 0}</p>
                    <p className="stat-label">Pending Modules</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><IconDollarSign /></div>
                  <div>
                    <p className="stat-value">₹{(overview?.total_incentive_earned || 0).toLocaleString()}</p>
                    <p className="stat-label">Claimed Incentives</p>
                  </div>
                </div>
              </div>

              {/* Quick Charts */}
              <div className="charts-row" style={{ marginTop: 'var(--space-xl)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="card chart-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <h3>Assessment Pass Rates</h3>
                  <div className="chart-container" style={{ width: '100%', flex: 1, minHeight: '350px', paddingTop: '20px' }}>
                    <ResponsiveContainer width="99%" height={350}>
                      <BarChart data={course_chart || []} margin={{ top: 10, right: 20, left: 0, bottom: 90 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                        <XAxis dataKey="course" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: 'var(--shadow-md)', fontSize: '13px' }} cursor={{fill: 'var(--surface-hover)'}} />
                        <Bar dataKey="completion_rate" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Pass %" barSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="card chart-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <h3>Workforce Training Progress</h3>
                  <div className="chart-container" style={{ width: '100%', flex: 1, minHeight: '350px', paddingTop: '20px' }}>
                    <ResponsiveContainer width="99%" height={350}>
                      <PieChart>
                        <Pie data={pieChartData} cx="50%" cy="45%" innerRadius={70} outerRadius={100} paddingAngle={2}
                          dataKey="value" stroke="none">
                          {pieChartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Incentive Progress */}
          {activeSection === 'incentives' && (() => {
            const SCHEME_META = {
              NAPS: {
                description: 'Govt. apprenticeship scheme — stipend shared between employer & BOAT for on-the-job training.',
                benefit: 'Saves 25–35% salary cost',
                benefitColor: '#16A34A',
              },
              NEEM: {
                description: 'On-the-job skill training via AICTE-approved NEEM facilitators for non-enrolled youth.',
                benefit: 'Cut hiring costs by 40–50%',
                benefitColor: '#0EA5E9',
              },
              PMKVY: {
                description: 'MSDE-funded scheme that reimburses training costs for skill certification of workers.',
                benefit: 'Up to ₹8,000 reimbursed per trainee',
                benefitColor: '#7C3AED',
              },
            };

            return (
            <section className="fade-in">
              <h2 className="section-title">Incentive Intelligence Engine</h2>
              <div className="incentive-grid">
                {(incentive_progress || []).map((inc) => {
                  const meta = SCHEME_META[inc.scheme_name] || {};
                  return (
                  <div key={inc.id} className="card incentive-card">
                    <div className="incentive-header" style={{ marginBottom: "14px" }}>
                      <div>
                        <h3>{inc.scheme_name}</h3>
                        <span style={{marginTop: "5px"}} className={`badge ${inc.status === 'claimed' ? 'badge-success' : 'badge-warning'}`}>
                          {inc.status === 'claimed' ? 'Claimed' : 'Pending'}
                        </span>
                      </div>
                      <p className="incentive-amount" style={{ color: "var(--success)" }}>₹{inc.claimable_amount.toLocaleString()}</p>
                    </div>

                    {/* Scheme description + financial benefit */}
                    {meta.description && (
                      <div style={{ marginBottom: "16px" }}>
                        <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: "1.5", marginBottom: "8px" }}>
                          {meta.description}
                        </p>
                        <span style={{
                          display: "inline-block",
                          fontSize: "11px",
                          fontWeight: 700,
                          letterSpacing: "0.3px",
                          padding: "3px 10px",
                          borderRadius: "20px",
                          background: `${meta.benefitColor}18`,
                          color: meta.benefitColor,
                          border: `1px solid ${meta.benefitColor}40`,
                        }}>
                          💰 {meta.benefit}
                        </span>
                      </div>
                    )}
                    
                    <div className="incentive-stats" style={{ marginBottom: "15px", gap: "10px" }}>
                      <div className="btn-outline" style={{flex: 1, padding: "10px", borderRadius: "8px", cursor: "pointer", textAlign: "center" }} onClick={() => fetchSchemeEmployees(inc.scheme_name, 'eligible')}>
                         <span className="stat-num" style={{color: "var(--success)"}}>{inc.eligible_count}</span>
                         <span className="stat-txt">Eligible</span>
                      </div>
                      <div className="btn-outline" style={{flex: 1, padding: "10px", borderRadius: "8px", cursor: "pointer", textAlign: "center"}} onClick={() => fetchSchemeEmployees(inc.scheme_name, 'pending')}>
                        <span className="stat-num" style={{color: "var(--warning)"}}>{inc.remaining + (inc.pending_duration_count || 0)}</span>
                        <span className="stat-txt">Pending</span>
                      </div>
                    </div>
                    
                    <div className="progress-bar-track" style={{ marginBottom: "15px" }}>
                      <div className="progress-bar-fill" style={{ width: `${inc.completion_pct}%` }} />
                    </div>
                    
                    <div className="incentive-footer" style={{ borderTop: "1px solid var(--border-light)", paddingTop: "15px" }}>
                      <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500 }}>
                          Target: {inc.required_count} eligible | Requires 6 months + assigned courses passed
                      </span>
                      {inc.status !== 'claimed' && (
                        <button className="btn btn-primary" onClick={() => handleClaimIncentive(inc.id)}>
                          Apply on Portal →
                        </button>
                      )}
                    </div>
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
                <h2 className="section-title">Workforce Management</h2>
                <div className="filter-group">
                  {['', 'completed', 'in_progress', 'not_started'].map(f => (
                    <button key={f} className={`btn btn-sm ${statusFilter === f ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setStatusFilter(f)}>
                      {f === '' ? 'All Employees' : f.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </button>
                  ))}
                </div>
              </div>
              <div className="card table-card" style={{ padding: "0" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee Name</th>
                      <th>Designation</th>
                      <th>Active Modules</th>
                      <th>Passed</th>
                      <th>Overall Status</th>
                      <th>Avg Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => (
                      <tr key={emp.id}>
                        <td>
                          <div className="emp-name">
                            <div className="avatar-sm" style={{ background: "var(--primary-bg)", color: "var(--primary)" }}>{emp.name.charAt(0)}</div>
                            <div>
                              <p className="name" style={{fontWeight: 600}}>{emp.name}</p>
                              <p className="email">{emp.email}</p>
                            </div>
                          </div>
                        </td>
                        <td><span style={{color: "var(--text-secondary)", fontSize: "14px"}}>{emp.job_role}</span></td>
                        <td>{emp.assigned_courses}</td>
                        <td>{emp.completed_courses}</td>
                        <td>
                          <span className={`badge ${emp.status === 'completed' ? 'badge-success' : emp.status === 'in_progress' ? 'badge-warning' : 'badge-danger'}`}>
                            {emp.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </span>
                        </td>
                        <td>
                           <span style={{ fontWeight: 600, color: emp.score >= 60 ? 'var(--success)' : (emp.score > 0 ? 'var(--danger)' : 'var(--text)')}}>
                              {emp.score > 0 ? `${emp.score}%` : 'N/A'}
                           </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {employees.length === 0 && <div className="empty-state" style={{padding: "40px", textAlign: "center", color: "var(--text-secondary)"}}>No personnel records found matching filters.</div>}
              </div>
            </section>
          )}

          {/* Scoreboard NEW FEATURE */}
          {activeSection === 'scoreboard' && (
             <section className="fade-in">
                <div className="section-header">
                <h2 className="section-title">Assessment Scoreboard</h2>
                <div className="filter-group">
                   <select className="btn btn-outline" style={{appearance: "auto", minWidth: "250px", padding: "8px 12px"}} value={scoreboardCourseId} onChange={handleScoreboardChange}>
                       {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                   </select>
                </div>
              </div>
              
              <div className="card table-card" style={{ padding: "0" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{width: "80px"}}>Rank</th>
                      <th>Employee Name</th>
                      <th>Assessment Score</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoreboardData.map((row) => (
                      <tr key={row.employee_id}>
                        <td>
                            {row.rank === 1 && <span style={{color: "#F59E0B", fontWeight: 800, fontSize: "16px"}}>#1 🏆</span>}
                            {row.rank === 2 && <span style={{color: "#9CA3AF", fontWeight: 800, fontSize: "16px"}}>#2 🥈</span>}
                            {row.rank === 3 && <span style={{color: "#B45309", fontWeight: 800, fontSize: "16px"}}>#3 🥉</span>}
                            {row.rank > 3 && <span style={{fontWeight: 700, color: "var(--text-secondary)"}}>#{row.rank}</span>}
                        </td>
                        <td>
                          <div className="emp-name">
                             <p className="name" style={{fontWeight: 600}}>{row.employee_name}</p>
                          </div>
                        </td>
                        <td>
                           <span style={{ fontWeight: 700, fontSize: "15px", color: row.score >= 60 ? 'var(--success)' : 'var(--danger)'}}>
                              {row.score}%
                           </span>
                        </td>
                        <td>
                          <span className={`badge ${row.status === 'Pass' ? 'badge-success' : 'badge-danger'}`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {scoreboardData.length === 0 && <div className="empty-state" style={{padding: "40px", textAlign: "center", color: "var(--text-secondary)"}}>No assessment records found for this module.</div>}
              </div>
             </section>
          )}



        </div>
      </main>

      {/* Drill-down Modal */}
      {drillDownModal.show && (
         <div className="modal-overlay" onClick={() => setDrillDownModal({show: false, title: '', data: []})}>
            <div className="modal" style={{width: "800px", maxWidth: "95vw"}} onClick={e => e.stopPropagation()}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "20px"}}>
                   <h2>{drillDownModal.title}</h2>
                   <button style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)'}} onClick={() => setDrillDownModal({show: false, title: '', data: []})}><IconX /></button>
                </div>
                
                <div className="table-card" style={{border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden"}}>
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
                                        <p style={{fontWeight: 600, fontSize: "14px"}}>{emp.name}</p>
                                        <p style={{fontSize: "12px", color: "var(--text-tertiary)"}}>{emp.role}</p>
                                    </td>
                                    <td><span style={{color: emp.duration_months >= 6 ? 'var(--success)' : 'var(--danger)'}}>{emp.duration_months}m</span></td>
                                    <td>{emp.courses_completed} passed</td>
                                    <td>{emp.score}%</td>
                                    <td>
                                        <div style={{display: "flex", flexDirection: "column", gap: "4px"}}>
                                            <span className={`badge ${emp.status === 'Eligible' ? 'badge-success' : 'badge-warning'}`} style={{alignSelf: "flex-start"}}>
                                                {emp.status}
                                            </span>
                                            {emp.missing_requirements && <span style={{fontSize: "11px", color: "var(--danger)"}}>{emp.missing_requirements}</span>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {drillDownModal.data.length === 0 && <div style={{padding: "30px", textAlign: "center", color: "var(--text-secondary)"}}>No matching records found.</div>}
                </div>
            </div>
         </div>
      )}


      {/* Add Employee Modal */}
      {showAddEmployee && (
        <div className="modal-overlay" onClick={() => setShowAddEmployee(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
             <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "20px"}}>
               <h2>Register Personnel</h2>
               <button style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)'}} onClick={() => setShowAddEmployee(false)}><IconX /></button>
            </div>
            <form onSubmit={handleAddEmployee} className="modal-form">
              <div className="input-group" style={{marginBottom: "15px"}}>
                <label>Full Name</label>
                <input value={empForm.name} onChange={e => setEmpForm({...empForm, name: e.target.value})} required />
              </div>
              <div className="input-group" style={{marginBottom: "15px"}}>
                <label>Corporate Email</label>
                <input type="email" value={empForm.email} onChange={e => setEmpForm({...empForm, email: e.target.value})} required />
              </div>
              <div className="input-group" style={{marginBottom: "15px"}}>
                <label>Temporary Password</label>
                <input type="password" value={empForm.password} onChange={e => setEmpForm({...empForm, password: e.target.value})} required />
              </div>
              <div className="input-group" style={{marginBottom: "15px"}}>
                <label>Designation</label>
                <input value={empForm.job_role} onChange={e => setEmpForm({...empForm, job_role: e.target.value})} required />
              </div>
              <div className="modal-actions" style={{marginTop: "30px"}}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddEmployee(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Onboard Employee</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Course Modal */}
      {showAssignCourse && (
        <div className="modal-overlay" onClick={() => setShowAssignCourse(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
             <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "20px"}}>
               <h2>Assign Training Module</h2>
               <button style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)'}} onClick={() => setShowAssignCourse(false)}><IconX /></button>
            </div>
            <form onSubmit={handleAssignCourse} className="modal-form">
              <div className="input-group" style={{marginBottom: "20px"}}>
                <label>Personnel Selection</label>
                <select value={assignForm.employee_id} onChange={e => setAssignForm({...assignForm, employee_id: e.target.value})} required>
                  <option value="">Select an employee...</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} ({emp.job_role})</option>)}
                </select>
              </div>
              <div className="input-group" style={{marginBottom: "20px"}}>
                <label>Training Module</label>
                <select value={assignForm.course_id} onChange={e => setAssignForm({...assignForm, course_id: e.target.value})} required>
                  <option value="">Select a course module...</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
              <div className="modal-actions" style={{marginTop: "30px"}}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAssignCourse(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Dispatch Assignment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
