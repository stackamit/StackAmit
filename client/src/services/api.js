import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ─────────────────────────────────────────────
// Axios Instance
// ─────────────────────────────────────────────

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─────────────────────────────────────────────
// Token Refresh State
// ─────────────────────────────────────────────

let isRefreshing = false;
let failedQueue = [];

// Process requests waiting for a new token
const processQueue = (error, token = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });

  failedQueue = [];
};

// ─────────────────────────────────────────────
// Request Interceptor
// ─────────────────────────────────────────────

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ─────────────────────────────────────────────
// Response Interceptor
// ─────────────────────────────────────────────

api.interceptors.response.use(
  (response) => {
    return response;
  },

  async (error) => {
    const originalRequest = error.config;

    // No response from server
    if (!error.response) {
      return Promise.reject(error);
    }

    // Only handle 401
    if (error.response.status !== 401) {
      return Promise.reject(error);
    }

    // Safety checks
    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Never refresh the refresh-token request itself
    if (
      originalRequest.url?.includes('/auth/refresh-token')
    ) {
      return Promise.reject(error);
    }

    // Prevent infinite retry loop
    if (originalRequest._retry) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');

      window.location.href = '/login';

      return Promise.reject(error);
    }

    originalRequest._retry = true;

    // ─────────────────────────────────────────
    // If another request is already refreshing
    // the token, wait for it.
    // ─────────────────────────────────────────

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve,
          reject,
        });
      })
        .then((newToken) => {
          originalRequest.headers =
            originalRequest.headers || {};

          originalRequest.headers.Authorization =
            `Bearer ${newToken}`;

          return api(originalRequest);
        })
        .catch((queueError) => {
          return Promise.reject(queueError);
        });
    }

    // ─────────────────────────────────────────
    // Start token refresh
    // ─────────────────────────────────────────

    isRefreshing = true;

    try {
      const { data } = await axios.post(
        `${API_URL}/api/auth/refresh-token`,
        {},
        {
          withCredentials: true,
        }
      );

      const newToken = data?.data?.accessToken;

      if (!newToken) {
        throw new Error(
          'No access token received from refresh endpoint'
        );
      }

      // Save new access token
      localStorage.setItem(
        'accessToken',
        newToken
      );

      // Resolve all queued requests
      processQueue(null, newToken);

      // Retry original request
      originalRequest.headers =
        originalRequest.headers || {};

      originalRequest.headers.Authorization =
        `Bearer ${newToken}`;

      return api(originalRequest);
    } catch (refreshError) {
      // Reject all queued requests
      processQueue(refreshError, null);

      // Remove invalid authentication data
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');

      // Redirect only if not already on login
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;












// import axios from 'axios';

// const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// const api = axios.create({
//   baseURL: `${API_URL}/api`,
//   withCredentials: true,
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

// // Request interceptor - attach token
// api.interceptors.request.use(
//   (config) => {
//     const token = localStorage.getItem('accessToken');
//     if (token) {
//       config.headers.Authorization = `Bearer ${token}`;
//     }
//     return config;
//   },
//   (error) => Promise.reject(error)
// );

// // Response interceptor - handle errors & refresh token
// api.interceptors.response.use(
//   (response) => response,
//   async (error) => {
//     const originalRequest = error.config;

//     if (error.response?.status === 401 && !originalRequest._retry) {
//       originalRequest._retry = true;

//       try {
//         const { data } = await axios.post(`${API_URL}/api/auth/refresh-token`, {}, { withCredentials: true });
//         const newToken = data.data.accessToken;
//         localStorage.setItem('accessToken', newToken);
//         originalRequest.headers.Authorization = `Bearer ${newToken}`;
//         return api(originalRequest);
//       } catch (refreshError) {
//         localStorage.removeItem('accessToken');
//         localStorage.removeItem('user');
//         window.location.href = '/login';
//         return Promise.reject(refreshError);
//       }
//     }

//     return Promise.reject(error);
//   }
// );

// export default api;
