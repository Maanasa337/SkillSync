import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (data) => api.post('/login', data);
export const register = (data) => api.post('/register', data);

// Admin
export const getAdminDashboard = (lang) => api.get('/dashboard/admin', { params: { lang: lang || 'en' } });
export const getEmployees = (status, department, experience_range, sort_by) => api.get('/employees', {
  params: {
    ...(status ? { status_filter: status } : {}),
    ...(department ? { department } : {}),
    ...(experience_range ? { experience_range } : {}),
    ...(sort_by ? { sort_by } : {}),
  }
});
export const addEmployee = (data) => api.post('/employees/add', data);
export const getAllCourses = (lang) => api.get('/courses', { params: { lang: lang || 'en' } });
export const assignCourse = (data) => api.post('/courses/assign', data);
export const claimIncentive = (data) => api.post('/incentive/claim', data);
export const getDepartmentAnalytics = () => api.get('/employees/department-analytics');

// Department drill-down
export const getDeptEmployees = (deptName) => api.get(`/departments/${deptName}/employees`);

// Incentive details & assign
export const getIncentiveDetails = () => api.get('/incentives/details');
export const assignEmployeesToScheme = (schemeId, employeeIds) => api.post(`/incentives/${schemeId}/assign-employees`, { employee_ids: employeeIds });

// New assignment endpoints
export const assignIndividual = (data) => api.post('/assignments/assign-individual', data);
export const assignDepartment = (data) => api.post('/assignments/assign-department', data);
export const assignAll = (data) => api.post('/assignments/assign-all', data);

// Create course (multilingual)
export const createCourse = (data) => api.post('/courses', data);

// Employee APIs
export const getEmployeeDashboard = (lang) => api.get('/dashboard/employee', { params: { lang: lang || 'en' } });
export const getMyCourses = (lang) => api.get('/courses/my', { params: { lang: lang || 'en' } });
export const getCourseDetail = (courseId, lang) => api.get(`/courses/${courseId}`, { params: { lang: lang || 'en' } });
export const getAssessment = (courseId) => api.get(`/assessments/${courseId}`);
export const submitAssessment = (data) => api.post('/assessment/submit', data);

// User language preference
export const updateLanguage = (lang) => api.patch('/users/me/language', { selected_language: lang });

// Translation (Bhashini)
export const translateTexts = (texts, targetLang) => api.post('/api/translate', { texts, target_lang: targetLang });

// Course Materials
export const uploadCourseMaterial = (courseId, file, language = 'all') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('language', language);
  return api.post(`/api/courses/${courseId}/materials`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: undefined, // caller can override
  });
};
export const getCourseMaterials = (courseId) => api.get(`/api/courses/${courseId}/materials`);
export const deleteCourseMaterial = (courseId, fileId) => api.delete(`/api/courses/${courseId}/materials/${fileId}`);
export const getMaterialUrl = (fileId) => `${API_BASE}/api/courses/materials/${fileId}`;

// AI Features
export const getAIRecommendations = () => api.get('/api/ai/recommendations');
export const clearAIRecommendationsCache = () => api.delete('/api/ai/recommendations/cache');
export const getAIInsightsMe = () => api.get('/api/ai/insights/me');
export const getAIInsightsFor = (employeeId) => api.get(`/api/ai/insights/${employeeId}`);
export const clearAIInsightsCache = () => api.delete('/api/ai/insights/cache');
export const summarizeMaterial = (fileId, lang) => api.post('/api/ai/summarize-material', { file_id: fileId, lang });

export default api;

