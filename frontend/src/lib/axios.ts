import axios from 'axios';

const getBaseURL = () => {
  if (import.meta.env.MODE === 'development') {
    const host = window.location.hostname;
    const port = import.meta.env.VITE_API_PORT ?? '5000';
    return `http://${host}:${port}/api`;
  }
  return '/api';
};

export const axiosInstance = axios.create({
  baseURL: getBaseURL(),
});
