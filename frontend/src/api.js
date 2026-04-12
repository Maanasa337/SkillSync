import axios from 'axios';

const API_BASE = 'http://localhost:8000';

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

// Auth
export const login = (data) => api.post('/login', data);
export const register = (data) => api.post('/register', data);

// Admin
export const getAdminDashboard = () => api.get('/dashboard/admin');
export const getEmployees = (status) => api.get('/employees', { params: status ? { status_filter: status } : {} });
export const addEmployee = (data) => api.post('/employees/add', data);
export const getAllCourses = () => api.get('/courses');
export const assignCourse = (data) => api.post('/courses/assign', data);
export const claimIncentive = (data) => api.post('/incentive/claim', data);

// Employee APIs
export const getEmployeeDashboard = () => api.get('/dashboard/employee');
export const getMyCourses = () => api.get('/courses/my');
export const getCourseDetail = (courseId) => api.get(`/courses/${courseId}`);
export const getAssessment = (courseId) => api.get(`/assessments/${courseId}`);
export const submitAssessment = (data) => api.post('/assessment/submit', data);

export default api;
