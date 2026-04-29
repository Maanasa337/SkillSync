import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getEmployeeDashboard, getCourseDetail, getAssessment, submitAssessment, getAssessmentReview, getAssessmentReviewInsight, clearAssessmentReviewInsightCache, getCourseMaterials, getMaterialUrl, summarizeMaterial } from '../api';
import { IconBook, IconTrendingUp, IconAward, IconAlertCircle, IconCheckCircle, IconClock, IconPlay, IconX, IconGlobe, IconDownload } from '../components/Icons';
import { useLanguage } from '../context/LanguageContext';
import './Dashboard.css';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
];

export default function EmployeeDashboard() {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
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

  // Assessment Review State
  const [expandedReviewId, setExpandedReviewId] = useState('');
  const [assessmentReviews, setAssessmentReviews] = useState({});
  const [reviewLoading, setReviewLoading] = useState({});
  const [reviewInsights, setReviewInsights] = useState({});
  const [reviewInsightLoading, setReviewInsightLoading] = useState({});
  // Course Materials State
  const [courseMaterials, setCourseMaterials] = useState([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const fetchData = async () => {
    try {
      const res = await getEmployeeDashboard(language);
      setData(res.data);
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
        navigate('/login');
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    setAssessmentReviews({});
    setExpandedReviewId('');
    fetchData();
  }, [language]);

  const loadAssessmentReview = async (courseId) => {
    setExpandedReviewId(prev => prev === courseId ? '' : courseId);
    if (assessmentReviews[courseId]) return;
    setReviewLoading(prev => ({ ...prev, [courseId]: true }));
    try {
      const [reviewRes, insightRes] = await Promise.all([
        getAssessmentReview(courseId, language),
        getAssessmentReviewInsight(courseId),
      ]);
      setAssessmentReviews(prev => ({ ...prev, [courseId]: reviewRes.data }));
      setReviewInsights(prev => ({ ...prev, [courseId]: insightRes.data.insights || '' }));
    } catch (e) {
      console.error('Assessment review error', e);
      setActionMsg(e.response?.data?.detail || 'Failed to load assessment review');
      setTimeout(() => setActionMsg(''), 3000);
    }
    setReviewLoading(prev => ({ ...prev, [courseId]: false }));
  };

  const refreshAssessmentInsight = async (courseId) => {
    setReviewInsightLoading(prev => ({ ...prev, [courseId]: true }));
    try {
      await clearAssessmentReviewInsightCache(courseId);
      const res = await getAssessmentReviewInsight(courseId);
      setReviewInsights(prev => ({ ...prev, [courseId]: res.data.insights || '' }));
    } catch (e) {
      console.error('Assessment insight error', e);
    }
    setReviewInsightLoading(prev => ({ ...prev, [courseId]: false }));
  };

  const handleOpenCourse = async (courseId) => {
      try {
          const res = await getCourseDetail(courseId, language);
          setCourseContent(res.data);
          setActiveCourse(courseId);
          // Also fetch materials
          setMaterialsLoading(true);
          setSummaryData(null);
          try {
            const matRes = await getCourseMaterials(courseId);
            setCourseMaterials(matRes.data.materials || []);
          } catch (e) { setCourseMaterials([]); }
          setMaterialsLoading(false);
      } catch (error) {
          console.error(error);
          setActionMsg('Failed to load course details');
      }
  }

  const handleStartAssessment = async () => {
      try {
          const res = await getAssessment(activeCourse, language);
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

  const { progress, courses, certificates, notifications } = data || {};
  const completedCourses = (courses || []).filter(course => course.status === 'completed');

    const navItems = [
    { id: 'courses', icon: <IconBook size={20} />, label: t('nav.my_courses') },
    { id: 'progress', icon: <IconTrendingUp size={20} />, label: t('nav.my_performance') },
    { id: 'certificates', icon: <IconCheckCircle size={20} />, label: t('nav.certificates') },
    { id: 'notifications', icon: <IconAlertCircle size={20} />, label: t('nav.notifications') },
  ];

  // If in assessment mode
  if (activeAssessment) {
      const qCount = activeAssessment.questions.length;
      return (
        <div className="dashboard-layout" style={{background: 'var(--bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '40px'}}>
             <div style={{width: '800px', maxWidth: '95vw', background: 'var(--surface)', padding: '40px', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)'}}>
                 <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid var(--border-light)', paddingBottom: '20px'}}>
                     <h2>{courseContent?.title} - {t('courses.final_assessment')}</h2>
                     <button className="btn btn-outline" onClick={() => setActiveAssessment(null)}>{t('courses.exit_assessment')}</button>
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
                         {t('courses.submit_assessment')} ({Object.keys(answers).length} / {qCount})
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
                         <span className="badge" style={{background: 'rgba(255,255,255,0.2)', color: 'white', marginBottom: '10px'}}>{t(`departments.${courseContent.category}`) !== `departments.${courseContent.category}` ? t(`departments.${courseContent.category}`) : courseContent.category}</span>
                         <h1 style={{fontSize: '24px', margin: 0}}>{courseContent.title}</h1>
                     </div>
                     <button className="btn btn-outline" style={{borderColor: 'rgba(255,255,255,0.3)', color: 'white'}} onClick={() => {setActiveCourse(null); setCourseContent(null)}}>
                         <IconX /> {t('assignment.cancel') || 'Close'}
                     </button>
                </div>
                
                {actionMsg && <div className="toast" style={{margin: "20px", position: "relative", alignSelf: "stretch"}}>{actionMsg}</div>}

                <div style={{padding: '0'}}>
                    {/* YouTube Embed */}
                    <div className="video-container" style={{position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', background: '#000'}}>
                        <iframe 
                            src={(() => {
                                const url = courseContent.youtube_link;
                                if (!url) return '';
                                const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
                                return match ? `https://www.youtube.com/embed/${match[1]}` : url;
                            })()} 
                            style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0}}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowFullScreen
                            title={courseContent.title}
                        ></iframe>
                    </div>
                </div>

                <div className="course-detail-body">
                     <div className="course-detail-content">
                         <h3 style={{marginBottom: '15px'}}>{t('courses.content_overview')}</h3>
                         <p style={{color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '30px'}}>{courseContent.description}</p>
                         
                         <h3 style={{marginBottom: '15px'}}>{t('courses.skills_acquired')}</h3>
                         <ul style={{listStyle: 'none', padding: 0, display: 'flex', flexWrap: 'wrap', gap: '10px'}}>
                             {courseContent.skills.map((skill, i) => (
                                 <li key={i} style={{padding: '8px 16px', background: 'var(--surface-hover)', borderRadius: 'var(--radius-full)', fontSize: '14px', color: 'var(--text)', border: '1px solid var(--border)'}}>
                                     {skill}
                                 </li>
                             ))}
                         </ul>
                     </div>
                     
                     <div className="course-detail-meta">
                         <h4 style={{marginBottom: '20px'}}>{t('courses.training_meta')}</h4>
                         <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', color: 'var(--text-secondary)'}}>
                             <IconClock size={18} />
                             <span>{courseContent.duration_minutes} {t('courses.minutes_video')}</span>
                         </div>
                         <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '25px', color: 'var(--text-secondary)'}}>
                             <IconBook size={18} />
                             <span>{courseContent.duration_days} {t('courses.days_training')}</span>
                         </div>
                         
                         <button className="btn btn-primary" style={{width: '100%', padding: '14px'}} onClick={handleStartAssessment}>
                             {t('courses.proceed_assessment')}
                         </button>
                     </div>
                </div>

                {/* Course Materials Section */}
                <div style={{padding: '25px 40px', borderTop: '1px solid var(--border-light)'}}>
                  <h3 style={{marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px'}}>
                    <IconDownload size={20} /> {t('materials.course_materials')}
                  </h3>
                  {materialsLoading ? (
                    <p style={{color: 'var(--text-tertiary)', fontSize: '14px'}}>Loading...</p>
                  ) : courseMaterials.length > 0 ? (
                    <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                      {courseMaterials.map((mat, idx) => {
                        const isPdfOrPptx = mat.filename?.toLowerCase().endsWith('.pdf') || mat.filename?.toLowerCase().endsWith('.pptx');
                        return (
                          <div key={idx} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)'}}>
                            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                              <span style={{fontSize: '20px'}}>{mat.content_type?.includes('pdf') ? '📄' : mat.content_type?.includes('video') ? '🎬' : mat.content_type?.includes('presentation') ? '📊' : '📁'}</span>
                              <div>
                                <p style={{fontWeight: 500, fontSize: '14px', margin: 0}}>{mat.filename}</p>
                                <p style={{fontSize: '11px', color: 'var(--text-tertiary)', margin: 0}}>{(mat.file_size / 1024).toFixed(0)} KB · {mat.language === 'all' ? t('materials.all_languages') : mat.language}</p>
                              </div>
                            </div>
                            <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                              {isPdfOrPptx && (
                                <button className="btn btn-outline btn-sm" onClick={async () => {
                                  setSummaryLoading(true); setSummaryData(null);
                                  try {
                                    const res = await summarizeMaterial(mat.file_id, language);
                                    setSummaryData(res.data);
                                  } catch(e) { setActionMsg('Failed to summarize'); }
                                  setSummaryLoading(false);
                                }} disabled={summaryLoading}>
                                  {summaryLoading ? t('ai.summarizing') : t('ai.summarize_with_ai')}
                                </button>
                              )}
                              <a href={getMaterialUrl(mat.file_id)} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                                <IconDownload size={14} /> {t('materials.view_download')}
                              </a>
                            </div>
                          </div>
                        );
                      })}

                      {/* AI Summary Display */}
                      {summaryData && summaryData.summary?.length > 0 && (
                        <div style={{marginTop: '10px', padding: '16px', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 'var(--radius-md)'}}>
                          <h4 style={{fontSize: '13px', color: 'var(--accent)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px'}}>✨ {t('ai.summarized_by_ai')} — {summaryData.filename}</h4>
                          <ul style={{margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px'}}>
                            {summaryData.summary.map((bullet, i) => (
                              <li key={i} style={{fontSize: '13px', color: 'var(--text)', lineHeight: 1.5}}>{bullet}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p style={{color: 'var(--text-tertiary)', fontSize: '14px'}}>{t('materials.no_materials')}</p>
                  )}
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
            <span>{t('app_name')}</span>
          </div>
        </div>
        <div className="sidebar-user" style={{ marginBottom: "2rem" }}>
            <div className="avatar">{user?.name?.charAt(0) || 'E'}</div>
            <div>
              <p className="sidebar-name">{user?.name}</p>
              <p className="sidebar-role">{t('dashboard.apprentice')}</p>
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
          <span>{t('nav.sign_out')}</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="main-header">
          <div>
            <h1>{t('dashboard.employee_title')}</h1>
            <p>{t('dashboard.welcome')}, {user?.name}</p>
          </div>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)' }}>
              <IconGlobe size={18} />
              <select 
                value={language} 
                onChange={(e) => setLanguage(e.target.value)}
                style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', cursor: 'pointer' }}
              >
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
            {actionMsg && <div className="toast">{actionMsg}</div>}
          </div>
        </header>

        <div className="dashboard-content">
          {/* My Courses */}
          {activeSection === 'courses' && (
            <section className="fade-in">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px'}}>
                  <h2 className="section-title" style={{margin: 0}}>{t('courses.training_modules')}</h2>
              </div>
              
              <h3 className="subsection-title" style={{marginTop: '10px', color: 'var(--primary)'}}>{t('courses.mandatory')}</h3>
              <div className="course-grid" style={{marginBottom: '40px'}}>
                {(courses || []).filter(c => c.type === 'mandatory').map(course => (
                  <div key={course.course_id} className="card course-card">
                    <div className="course-header">
                      <span className="course-category" style={{color: 'var(--primary)', background: 'var(--primary-bg)', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 600}}>{t(`departments.${course.category}`) !== `departments.${course.category}` ? t(`departments.${course.category}`) : course.category}</span>
                      <span className={`badge ${course.status === 'completed' ? 'badge-success' : course.status === 'in_progress' ? 'badge-warning' : 'badge-primary'}`}>
                        {t(`status.${course.status}`) !== `status.${course.status}` ? t(`status.${course.status}`) : course.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                    </div>
                    <h4 style={{fontSize: '18px', margin: '15px 0 5px 0'}}>{course.title}</h4>
                    <p style={{fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '15px', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>{course.description}</p>
                    <div style={{display: 'flex', gap: '8px', marginBottom: '15px', flexWrap: 'wrap'}}>
                        {course.skills?.slice(0, 2).map((s, i) => <span key={i} style={{background: 'var(--surface-hover)', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-tertiary)'}}>{s}</span>)}
                    </div>
                    
                    <div className="course-footer" style={{borderTop: '1px solid var(--border-light)', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '15px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: '12px', color: 'var(--text-secondary)'}}>
                         <span><IconClock size={14} style={{verticalAlign: 'text-bottom'}}/> {course.duration_minutes || 0} {t('courses.mins')}</span>
                         {course.status === 'completed' && <span className="course-score" style={{color: 'var(--success)', fontWeight: 600}}>{t('courses.score')}: {course.score}%</span>}
                      </div>

                      <button className={`btn ${course.status === 'completed' ? 'btn-outline' : 'btn-primary'} btn-sm`} style={{width: '100%', justifyContent: 'center'}} onClick={() => handleOpenCourse(course.course_id)}>
                        <IconPlay size={16} /> {course.status === 'completed' ? t('courses.rewatch') : course.status === 'in_progress' ? t('courses.resume_training') : t('courses.start_training')}
                      </button>
                    </div>
                  </div>
                ))}
                {(courses || []).filter(c => c.type === 'mandatory').length === 0 && <p className="empty-state">{t('courses.no_mandatory')}</p>}
              </div>

              <h3 className="subsection-title" style={{marginTop: '10px', color: 'var(--primary)'}}>{t('courses.role_specific')}</h3>
              <div className="course-grid">
                {(courses || []).filter(c => c.type !== 'mandatory').map(course => (
                  <div key={course.course_id} className="card course-card">
                    <div className="course-header">
                      <span className="course-category" style={{color: 'var(--primary)', background: 'var(--primary-bg)', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 600}}>{t(`departments.${course.category}`) !== `departments.${course.category}` ? t(`departments.${course.category}`) : course.category}</span>
                      <span className={`badge ${course.status === 'completed' ? 'badge-success' : course.status === 'in_progress' ? 'badge-warning' : 'badge-primary'}`}>
                        {t(`status.${course.status}`) !== `status.${course.status}` ? t(`status.${course.status}`) : course.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                    </div>
                    <h4 style={{fontSize: '18px', margin: '15px 0 5px 0'}}>{course.title}</h4>
                    <p style={{fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '15px', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>{course.description}</p>
                    <div style={{display: 'flex', gap: '8px', marginBottom: '15px', flexWrap: 'wrap'}}>
                        {course.skills?.slice(0, 2).map((s, i) => <span key={i} style={{background: 'var(--surface-hover)', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-tertiary)'}}>{s}</span>)}
                    </div>
                    
                    <div className="course-footer" style={{borderTop: '1px solid var(--border-light)', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '15px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: '12px', color: 'var(--text-secondary)'}}>
                         <span><IconClock size={14} style={{verticalAlign: 'text-bottom'}}/> {course.duration_minutes || 0} {t('courses.mins')}</span>
                         {course.status === 'completed' && <span className="course-score" style={{color: 'var(--success)', fontWeight: 600}}>{t('courses.score')}: {course.score}%</span>}
                      </div>

                      <button className={`btn ${course.status === 'completed' ? 'btn-outline' : 'btn-primary'} btn-sm`} style={{width: '100%', justifyContent: 'center'}} onClick={() => handleOpenCourse(course.course_id)}>
                        <IconPlay size={16} /> {course.status === 'completed' ? t('courses.rewatch') : course.status === 'in_progress' ? t('courses.resume_training') : t('courses.start_training')}
                      </button>
                    </div>
                  </div>
                ))}
                {(courses || []).filter(c => c.type !== 'mandatory').length === 0 && <p className="empty-state">{t('courses.no_role_specific')}</p>}
              </div>

            </section>
          )}

          {/* My Progress / Performance */}
          {activeSection === 'progress' && (
            <section className="fade-in">
              <h2 className="section-title">{t('performance.title')}</h2>
              <div className="overview-grid three-col">
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}><IconTrendingUp /></div>
                  <div>
                    <p className="stat-value">{progress?.completion_pct || 0}%</p>
                    <p className="stat-label">{t('performance.completion')}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}><IconAward /></div>
                  <div>
                    <p className="stat-value">{progress?.avg_score || 0}%</p>
                    <p className="stat-label">{t('performance.total_avg_score')}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><IconCheckCircle /></div>
                  <div>
                    <p className="stat-value">{progress?.completed || 0}/{progress?.total_courses || 0}</p>
                    <p className="stat-label">{t('performance.modules_passed')}</p>
                  </div>
                </div>
              </div>

              <div className="card progress-detail-card" style={{ marginTop: 'var(--space-xl)' }}>
                <h3>{t('performance.progress_vector')}</h3>
                <div className="big-progress">
                  <div className="progress-bar-track" style={{ height: '14px' }}>
                    <div className="progress-bar-fill" style={{ width: `${progress?.completion_pct || 0}%` }} />
                  </div>
                  <span className="big-progress-label">{progress?.completion_pct || 0}% {t('performance.complete')}</span>
                </div>
              </div>

              {/* Assessment Reviews */}
              <div className="card" style={{marginTop: 'var(--space-xl)', padding: 'var(--space-lg)'}}>
                <h3 style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px'}}><IconAward size={20} /> Review Assessment</h3>
                {completedCourses.length > 0 ? (
                  <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                    {completedCourses.map(course => {
                      const isOpen = expandedReviewId === course.course_id;
                      const review = assessmentReviews[course.course_id];
                      return (
                        <div key={course.course_id} style={{border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--surface)'}}>
                          <button className="btn btn-outline" style={{width: '100%', justifyContent: 'space-between', border: 0, borderRadius: 0, padding: '14px 16px'}} onClick={() => loadAssessmentReview(course.course_id)}>
                            <span style={{fontWeight: 700, color: 'var(--text)'}}>{course.title}</span>
                            <span style={{color: 'var(--success)', fontWeight: 700}}>{course.score}%</span>
                          </button>
                          {isOpen && (
                            <div style={{padding: '16px', borderTop: '1px solid var(--border-light)'}}>
                              {reviewLoading[course.course_id] ? (
                                <p style={{color: 'var(--text-tertiary)', fontSize: '14px'}}>Loading review...</p>
                              ) : review ? (
                                <>
                                  <div style={{marginBottom: '16px', padding: '14px', background: 'var(--accent-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-border)'}}>
                                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                                      <h4 style={{fontSize: '14px', margin: 0}}>AI Insights</h4>
                                      <button className="btn btn-outline btn-sm" onClick={() => refreshAssessmentInsight(course.course_id)} disabled={reviewInsightLoading[course.course_id]}>
                                        {reviewInsightLoading[course.course_id] ? '...' : t('ai.regenerate')}
                                      </button>
                                    </div>
                                    <div style={{whiteSpace: 'pre-line', fontSize: '13px', lineHeight: 1.6, color: 'var(--text-secondary)'}}>
                                      {reviewInsights[course.course_id] || 'No insights available yet.'}
                                    </div>
                                  </div>
                                  <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                                    {review.questions.map(q => (
                                      <div key={q.question_index} style={{padding: '14px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: q.is_correct ? 'var(--success-bg)' : 'var(--surface-hover)'}}>
                                        <p style={{fontWeight: 700, margin: '0 0 10px 0', fontSize: '14px'}}>{q.question_index + 1}. {q.question}</p>
                                        <p style={{fontSize: '13px', margin: '0 0 6px 0', color: q.is_correct ? 'var(--success)' : 'var(--danger)'}}>Your answer: {q.selected_text || 'Not available'}</p>
                                        <p style={{fontSize: '13px', margin: 0, color: 'var(--text-secondary)'}}>Correct answer: <strong>{q.correct_text}</strong></p>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              ) : (
                                <p style={{color: 'var(--text-tertiary)', fontSize: '14px'}}>Review unavailable.</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{color: 'var(--text-tertiary)', fontSize: '14px'}}>Completed assessments will appear here for review.</p>
                )}
              </div>
            </section>
          )}

          {/* Certificates */}
          {activeSection === 'certificates' && (
            <section className="fade-in">
              <h2 className="section-title">{t('certs.title')}</h2>
              {(certificates || []).length > 0 ? (
                <div className="cert-grid">
                  {certificates.map((cert, i) => (
                    <div key={i} className="card cert-card" style={{borderTop: '4px solid var(--accent)'}}>
                      <div className="cert-badge" style={{fontSize: '30px', marginBottom: '15px'}}><IconAward size={36} className="text-accent" /></div>
                      <h4 style={{fontSize: '16px', marginBottom: '10px'}}>{cert.title}</h4>
                      <p className="cert-date" style={{fontSize: '13px', color: 'var(--text-secondary)'}}>{t('certs.issued')}: {cert.completion_date ? new Date(cert.completion_date).toLocaleDateString() : 'N/A'}</p>
                      <p className="cert-score" style={{fontSize: '13px', marginBottom: '20px', color: 'var(--text-secondary)'}}>{t('certs.verified_score')}: <strong style={{color: 'var(--text)'}}>{cert.score}%</strong></p>
                      <button className="btn btn-outline btn-sm" style={{width: '100%', justifyContent: 'center'}} onClick={() => {
                        const el = document.createElement('a');
                        el.setAttribute('href', 'data:text/plain,Official%20Training%20Credential%20for%20' + encodeURIComponent(cert.title) + '%0A%0AThis%20document%20certifies%20completion%20with%20a%20passing%20score%20of%20' + cert.score + '%25.');
                        el.setAttribute('download', `${cert.title.replace(/\s+/g,'_')}_credential.txt`);
                        el.click();
                      }}>
                        <IconDownload size={16} /> {t('certs.export')}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">{t('certs.no_certs')}</p>
              )}
            </section>
          )}

          {/* Notifications */}
          {activeSection === 'notifications' && (
            <section className="fade-in">
              <h2 className="section-title">{t('notif.title')}</h2>
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
                          {notif.type === 'deadline' ? t('notif.pending_requirement') : t('notif.new_module')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">{t('notif.all_caught_up')}</p>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
