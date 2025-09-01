import axios from 'axios';

const api = axios.create({
    baseURL: "https://",
    timeout: 1000000,
});

api.interceptors.request.use(
    (config) => {
        console.log(`向${config.method?.toUpperCase()} ${config.url} 发送请求`);
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => {
        return response.data;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;