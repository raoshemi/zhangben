import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * 401 统一处理：会话失效（token 过期 / 服务端密钥轮换 / 用户被禁用）时，
 * 清空本地登录态并跳回登录页，避免各页面把"未授权"误显示成"还没有数据/没有账套"。
 * 登录接口本身的 401（密码错误）不跳转，由登录页就地提示。
 */
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 401) {
      const hadToken = !!localStorage.getItem('token');
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      localStorage.removeItem('role');
      localStorage.removeItem('user');
      if (hadToken && window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  },
);

export default api;
