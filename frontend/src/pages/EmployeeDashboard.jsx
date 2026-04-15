import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getEmployeeDashboard, getCourseDetail, getAssessment, submitAssessment } from '../api';
import { IconBook, IconTrendingUp, IconAward, IconAlertCircle, IconCheckCircle, IconClock, IconPlay, IconX, IconDownload } from '../components/Icons';
import './Dashboard.css';

export default function EmployeeDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [activeSection, setActiveSection] = useState('courses');
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  // Course Viewer State
  const [activeCourse, setActiveCourse] = useState(null);
  const [courseContent, setCourseContent] = useState(null);
  
  // Assessment State
  const [activeAssessment, setActiveAssessment] = useState(null);
  const [answers, setAnswers] = useState({});

  const fetchData = async () => {
    try {
      const res = await getEmployeeDashboard();
      setData(res.data);
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
        navigate('/login');
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleOpenCourse = async (courseId) => {
      try {
          const res = await getCourseDetail(courseId);
          setCourseContent(res.data);
          setActiveCourse(courseId);
      } catch (error) {
          console.error(error);
          setActionMsg('Failed to load course details');
      }
  }

  const handleStartAssessment = async () => {
      try {
          const res = await getAssessment(activeCourse);
          setActiveAssessment(res.data);
          setAnswers({});
      } catch (error) {
          console.error(error);
          setActionMsg('Failed to load assessment. Ensure you are authorized to take it.');
      }
  }

  const handleOptionSelect = (questionIndex, optionIndex) => {
      setAnswers(prev => ({
          ...prev,
          [questionIndex]: optionIndex
      }));
  }

  const handleSubmitAssessment = async () => {
      // Validate all answered
      if (Object.keys(answers).length < activeAssessment.questions.length) {
          setActionMsg("Please answer all questions before submitting.");
          setTimeout(() => setActionMsg(''), 3000);
          return;
      }

      // Format answers as ordered array
      const answerArray = [];
      for (let i = 0; i < activeAssessment.questions.length; i++) {
          answerArray.push(answers[i]);
      }

      try {
          const res = await submitAssessment({
              course_id: activeCourse,
              answers: answerArray
          });
          
          if (res.data.passed) {
              setActionMsg(`Assessment Passed! Score: ${res.data.score}%`);
          } else {
              setActionMsg(`Assessment Failed. Score: ${res.data.score}%. Minimum 60% required.`);
          }
          
          // Cleanup and refresh
          setTimeout(() => {
              setActionMsg('');
              setActiveAssessment(null);
              setActiveCourse(null);
              setCourseContent(null);
              fetchData();
          }, 3500);
      } catch (err) {
          setActionMsg(err.response?.data?.detail || "Error submitting assessment");
      }
  }

  if (loading) return <div className="loading-screen"><div className="loader"></div></div>;

  const { progress, courses, growth_insights, certificates, notifications } = data || {};

  const navItems = [
    { id: 'courses', icon: <IconBook size={20} />, label: 'My Courses' },
    { id: 'progress', icon: <IconTrendingUp size={20} />, label: 'My Performance' },
    { id: 'growth', icon: <IconAward size={20} />, label: 'Growth Insights' },
    { id: 'certificates', icon: <IconCheckCircle size={20} />, label: 'Certificates' },
    { id: 'notifications', icon: <IconAlertCircle size={20} />, label: 'Notifications' },
  ];

  // If in assessment mode
  if (activeAssessment) {
      const qCount = activeAssessment.questions.length;
      return (
        <div className="dashboard-layout" style={{background: 'var(--bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '40px'}}>
             <div style={{width: '800px', maxWidth: '95vw', background: 'var(--surface)', padding: '40px', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)'}}>
                 <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid var(--border-light)', paddingBottom: '20px'}}>
                     <h2>{courseContent?.title} - Final Assessment</h2>
                     <button className="btn btn-outline" onClick={() => setActiveAssessment(null)}>Exit Assessment</button>
                 </div>
                 
                 {actionMsg && <div className="toast" style={{marginBottom: "20px", position: "relative", alignSelf: "stretch"}}>{actionMsg}</div>}

                 <div className="assessment-questions" style={{display: 'flex', flexDirection: 'column', gap: '30px', marginBottom: '40px'}}>
                     {activeAssessment.questions.map((q, qIndex) => (
                         <div key={qIndex} className="question-block" style={{background: 'var(--surface-hover)', padding: '20px', borderRadius: 'var(--radius-lg)'}}>
                             <h4 style={{marginBottom: '15px'}}>{qIndex + 1}. {q.question}</h4>
                             <div className="options-grid" style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                                 {q.options.map((opt, optIndex) => {
                                     const isSelected = answers[qIndex] === optIndex;
                                     return (
                                         <label key={optIndex} style={{
                                             display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', 
                                             background: isSelected ? 'var(--primary-bg)' : 'var(--bg-white)',
                                             border: `1.5px solid ${isSelected ? 'var(--primary-light)' : 'var(--border)'}`,
                                             borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s'
                                         }}>
                                             <input 
                                                type="radio" 
                                                name={`q-${qIndex}`} 
                                                value={optIndex} 
                                                checked={isSelected}
                                                onChange={() => handleOptionSelect(qIndex, optIndex)}
                                                style={{accentColor: 'var(--accent)'}}
                                                aria-label={`Option ${optIndex + 1}`}
                                             />
                                             <span>{opt}</span>
                                         </label>
                                     )
                                 })}
                             </div>
                         </div>
                     ))}
                 </div>
                 
                 <div style={{display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-light)', paddingTop: '20px'}}>
                     <button 
                        className="btn btn-primary btn-lg" 
                        onClick={handleSubmitAssessment}
                        disabled={Object.keys(answers).length < qCount}
                     >
                         Submit Assessment ({Object.keys(answers).length} / {qCount})
                     </button>
                 </div>
             </div>
        </div>
      )
  }

  // If viewing course detail
  if (activeCourse && courseContent) {
      return (
        <div className="dashboard-layout" style={{background: 'var(--bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 'max(40px, 3vh)'}}>
            <div style={{width: '900px', maxWidth: '95vw', background: 'var(--surface)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', boxShadow: 'var(--shadow-lg)'}}>
                <div style={{padding: '30px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--primary)', color: 'white'}}>
                     <div>
                         <span className="badge" style={{background: 'rgba(255,255,255,0.2)', color: 'white', marginBottom: '10px'}}>{courseContent.category}</span>
                         <h1 style={{fontSize: '24px', margin: 0}}>{courseContent.title}</h1>
                     </div>
                     <button className="btn btn-outline" style={{borderColor: 'rgba(255,255,255,0.3)', color: 'white'}} onClick={() => {setActiveCourse(null); setCourseContent(null)}}>
                         <IconX /> Close
                     </button>
                </div>
                
                {actionMsg && <div className="toast" style={{margin: "20px", position: "relative", alignSelf: "stretch"}}>{actionMsg}</div>}

                <div style={{padding: '0'}}>
                    {/* YouTube Embed */}
                    <div className="video-container" style={{position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', background: '#000'}}>
                        <iframe 
                            src={courseContent.youtube_url} 
                            style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0}}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowFullScreen
                            title={courseContent.title}
                        ></iframe>
                    </div>
                </div>

                <div className="course-detail-body">
                     <div className="course-detail-content">
                         <h3 style={{marginBottom: '15px'}}>Content Overview</h3>
                         <p style={{color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '30px'}}>{courseContent.description}</p>
                         
                         <h3 style={{marginBottom: '15px'}}>Skills Acquired</h3>
                         <ul style={{listStyle: 'none', padding: 0, display: 'flex', flexWrap: 'wrap', gap: '10px'}}>
                             {courseContent.skills.map((skill, i) => (
                                 <li key={i} style={{padding: '8px 16px', background: 'var(--surface-hover)', borderRadius: 'var(--radius-full)', fontSize: '14px', color: 'var(--text)', border: '1px solid var(--border)'}}>
                                     {skill}
                                 </li>
                             ))}
                         </ul>
                     </div>
                     
                     <div className="course-detail-meta">
                         <h4 style={{marginBottom: '20px'}}>Training Meta</h4>
                         <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', color: 'var(--text-secondary)'}}>
                             <IconClock size={18} />
                             <span>{courseContent.duration_minutes} minutes video</span>
                         </div>
                         <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '25px', color: 'var(--text-secondary)'}}>
                             <IconBook size={18} />
                             <span>{courseContent.duration_days} days training equiv.</span>
                         </div>
                         
                         <button className="btn btn-primary" style={{width: '100%', padding: '14px'}} onClick={handleStartAssessment}>
                             Proceed to Assessment
                         </button>
                     </div>
                </div>
            </div>
        </div>
      )
  }

  // Normal Dashboard
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
            <div className="avatar">{user?.name?.charAt(0) || 'E'}</div>
            <div>
              <p className="sidebar-name">{user?.name}</p>
              <p className="sidebar-role">Apprentice</p>
            </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button key={item.id} className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => setActiveSection(item.id)}>
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'notifications' && notifications?.length > 0 && (
                <span className="nav-badge" style={{background: 'var(--danger)', color: 'white'}}>{notifications.length}</span>
              )}
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
            <h1>Learning Portal</h1>
            <p>Welcome, {user?.name}</p>
          </div>
          {actionMsg && <div className="toast">{actionMsg}</div>}
        </header>

        <div className="dashboard-content">
          {/* My Courses */}
          {activeSection === 'courses' && (
            <section className="fade-in">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px'}}>
                  <h2 className="section-title" style={{margin: 0}}>Training Modules</h2>
              </div>
              
              <h3 className="subsection-title" style={{marginTop: '10px', color: 'var(--primary)'}}>Mandatory / Basic</h3>
              <div className="course-grid" style={{marginBottom: '40px'}}>
                {(courses || []).filter(c => c.type === 'mandatory').map(course => (
                  <div key={course.course_id} className="card course-card">
                    <div className="course-header">
                      <span className="course-category" style={{color: 'var(--primary)', background: 'var(--primary-bg)', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 600}}>{course.category}</span>
                      <span className={`badge ${course.status === 'completed' ? 'badge-success' : course.status === 'in_progress' ? 'badge-warning' : 'badge-primary'}`}>
                        {course.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                    </div>
                    <h4 style={{fontSize: '18px', margin: '15px 0 5px 0'}}>{course.title}</h4>
                    <p style={{fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '15px', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>{course.description}</p>
                    <div style={{display: 'flex', gap: '8px', marginBottom: '15px', flexWrap: 'wrap'}}>
                        {course.skills?.slice(0, 2).map((s, i) => <span key={i} style={{background: 'var(--surface-hover)', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-tertiary)'}}>{s}</span>)}
                    </div>
                    
                    <div className="course-footer" style={{borderTop: '1px solid var(--border-light)', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '15px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: '12px', color: 'var(--text-secondary)'}}>
                         <span><IconClock size={14} style={{verticalAlign: 'text-bottom'}}/> {course.duration_minutes || 0} mins</span>
                         {course.status === 'completed' && <span className="course-score" style={{color: 'var(--success)', fontWeight: 600}}>Score: {course.score}%</span>}
                      </div>

                      <button className={`btn ${course.status === 'completed' ? 'btn-outline' : 'btn-primary'} btn-sm`} style={{width: '100%', justifyContent: 'center'}} onClick={() => handleOpenCourse(course.course_id)}>
                        <IconPlay size={16} /> {course.status === 'completed' ? 'Re-watch Training' : course.status === 'in_progress' ? 'Resume Training' : 'Start Training'}
                      </button>
                    </div>
                  </div>
                ))}
                {(courses || []).filter(c => c.type === 'mandatory').length === 0 && <p className="empty-state">No mandatory courses assigned.</p>}
              </div>

              <h3 className="subsection-title" style={{marginTop: '10px', color: 'var(--primary)'}}>Role-Specific</h3>
              <div className="course-grid">
                {(courses || []).filter(c => c.type !== 'mandatory').map(course => (
                  <div key={course.course_id} className="card course-card">
                    <div className="course-header">
                      <span className="course-category" style={{color: 'var(--primary)', background: 'var(--primary-bg)', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 600}}>{course.category}</span>
                      <span className={`badge ${course.status === 'completed' ? 'badge-success' : course.status === 'in_progress' ? 'badge-warning' : 'badge-primary'}`}>
                        {course.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                    </div>
                    <h4 style={{fontSize: '18px', margin: '15px 0 5px 0'}}>{course.title}</h4>
                    <p style={{fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '15px', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>{course.description}</p>
                    <div style={{display: 'flex', gap: '8px', marginBottom: '15px', flexWrap: 'wrap'}}>
                        {course.skills?.slice(0, 2).map((s, i) => <span key={i} style={{background: 'var(--surface-hover)', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-tertiary)'}}>{s}</span>)}
                    </div>
                    
                    <div className="course-footer" style={{borderTop: '1px solid var(--border-light)', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '15px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: '12px', color: 'var(--text-secondary)'}}>
                         <span><IconClock size={14} style={{verticalAlign: 'text-bottom'}}/> {course.duration_minutes || 0} mins</span>
                         {course.status === 'completed' && <span className="course-score" style={{color: 'var(--success)', fontWeight: 600}}>Score: {course.score}%</span>}
                      </div>

                      <button className={`btn ${course.status === 'completed' ? 'btn-outline' : 'btn-primary'} btn-sm`} style={{width: '100%', justifyContent: 'center'}} onClick={() => handleOpenCourse(course.course_id)}>
                        <IconPlay size={16} /> {course.status === 'completed' ? 'Re-watch Training' : course.status === 'in_progress' ? 'Resume Training' : 'Start Training'}
                      </button>
                    </div>
                  </div>
                ))}
                {(courses || []).filter(c => c.type !== 'mandatory').length === 0 && <p className="empty-state">No role-specific courses assigned.</p>}
              </div>

            </section>
          )}

          {/* My Progress / Performance */}
          {activeSection === 'progress' && (
            <section className="fade-in">
              <h2 className="section-title">My Performance</h2>
              <div className="overview-grid three-col">
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}><IconTrendingUp /></div>
                  <div>
                    <p className="stat-value">{progress?.completion_pct || 0}%</p>
                    <p className="stat-label">Completion</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}><IconAward /></div>
                  <div>
                    <p className="stat-value">{progress?.avg_score || 0}%</p>
                    <p className="stat-label">Total Avg Score</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><IconCheckCircle /></div>
                  <div>
                    <p className="stat-value">{progress?.completed || 0}/{progress?.total_courses || 0}</p>
                    <p className="stat-label">Modules Passed</p>
                  </div>
                </div>
              </div>

              <div className="card progress-detail-card" style={{ marginTop: 'var(--space-xl)' }}>
                <h3>Overall Progress Vector</h3>
                <div className="big-progress">
                  <div className="progress-bar-track" style={{ height: '14px' }}>
                    <div className="progress-bar-fill" style={{ width: `${progress?.completion_pct || 0}%` }} />
                  </div>
                  <span className="big-progress-label">{progress?.completion_pct || 0}% Complete</span>
                </div>
              </div>
            </section>
          )}

          {/* Growth Insights */}
          {activeSection === 'growth' && (
            <section className="fade-in">
              <h2 className="section-title">Growth Trajectory</h2>
              {(growth_insights || []).length > 0 ? (
                <div className="insights-grid">
                  {growth_insights.map((insight, i) => (
                    <div key={i} className="card insight-card">
                      <div className="insight-icon" style={{background: 'var(--success-bg)', color: 'var(--success)', padding: '10px', borderRadius: '8px', display: 'inline-block', marginBottom: '15px'}}><IconTrendingUp /></div>
                      <h3>{insight.track}</h3>
                      <p style={{color: 'var(--text-secondary)'}}>{insight.message}</p>
                      <div className="insight-tags" style={{marginTop: '20px'}}>
                        {insight.categories_completed.map(cat => (
                          <span key={cat} className="badge badge-success">{cat}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card empty-insights">
                  <div style={{color: 'var(--text-tertiary)', marginBottom: '15px'}}><IconAward size={40} /></div>
                  <h3>Keep Learning!</h3>
                  <p>Pass more assessment modules to unlock specialized engineering and management tracks.</p>
                </div>
              )}
            </section>
          )}

          {/* Certificates */}
          {activeSection === 'certificates' && (
            <section className="fade-in">
              <h2 className="section-title">Verified Credentials</h2>
              {(certificates || []).length > 0 ? (
                <div className="cert-grid">
                  {certificates.map((cert, i) => (
                    <div key={i} className="card cert-card" style={{borderTop: '4px solid var(--accent)'}}>
                      <div className="cert-badge" style={{fontSize: '30px', marginBottom: '15px'}}><IconAward size={36} className="text-accent" /></div>
                      <h4 style={{fontSize: '16px', marginBottom: '10px'}}>{cert.title}</h4>
                      <p className="cert-date" style={{fontSize: '13px', color: 'var(--text-secondary)'}}>Issued: {cert.completion_date ? new Date(cert.completion_date).toLocaleDateString() : 'N/A'}</p>
                      <p className="cert-score" style={{fontSize: '13px', marginBottom: '20px', color: 'var(--text-secondary)'}}>Verified Score: <strong style={{color: 'var(--text)'}}>{cert.score}%</strong></p>
                      <button className="btn btn-outline btn-sm" style={{width: '100%', justifyContent: 'center'}} onClick={() => {
                        const el = document.createElement('a');
                        el.setAttribute('href', 'data:text/plain,Official%20Training%20Credential%20for%20' + encodeURIComponent(cert.title) + '%0A%0AThis%20document%20certifies%20completion%20with%20a%20passing%20score%20of%20' + cert.score + '%25.');
                        el.setAttribute('download', `${cert.title.replace(/\s+/g,'_')}_credential.txt`);
                        el.click();
                      }}>
                        <IconDownload size={16} /> Export Credential
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No credentials earned yet. Pass assessments to earn official certificates.</p>
              )}
            </section>
          )}

          {/* Notifications */}
          {activeSection === 'notifications' && (
            <section className="fade-in">
              <h2 className="section-title">Inbox</h2>
              {(notifications || []).length > 0 ? (
                <div className="notif-list">
                  {notifications.map((notif, i) => (
                    <div key={i} className="card notif-card" style={{display: 'flex', gap: '15px', alignItems: 'flex-start', padding: '20px'}}>
                      <span className="notif-icon" style={{background: notif.type === 'deadline' ? 'var(--warning-bg)' : 'var(--primary-bg)', color: notif.type === 'deadline' ? 'var(--warning)' : 'var(--primary)', padding: '10px', borderRadius: '8px'}}>
                            {notif.type === 'deadline' ? <IconClock size={20} /> : <IconBook size={20} />}
                      </span>
                      <div>
                        <p className="notif-msg" style={{fontWeight: 500, margin: '0 0 8px 0'}}>{notif.message}</p>
                        <span className={`badge ${notif.type === 'deadline' ? 'badge-warning' : 'badge-primary'}`}>
                          {notif.type === 'deadline' ? 'Pending Requirement' : 'New Module'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">All caught up! No required actions.</p>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
