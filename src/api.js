import axios from 'axios';

const API = axios.create({
    baseURL: 'http://localhost:8080/api'
});

// Maquinaria
export const getMaquinas = () => API.get('/maquinaria');
export const getMaquina = (id) => API.get(`/maquinaria/${id}`);
export const createMaquina = (data) => API.post('/maquinaria', data);
export const updateMaquina = (id, data) => API.put(`/maquinaria/${id}`, data);
export const deleteMaquina = (id) => API.delete(`/maquinaria/${id}`);

// Gastos
export const getGastos = () => API.get('/gastos');
export const createGasto = (data) => API.post('/gastos', data);
export const updateGasto = (id, data) => API.put(`/gastos/${id}`, data);
export const deleteGasto = (id) => API.delete(`/gastos/${id}`);

// Ingresos
export const getIngresos = () => API.get('/ingresos');
export const createIngreso = (data) => API.post('/ingresos', data);
export const updateIngreso = (id, data) => API.put(`/ingresos/${id}`, data);
export const deleteIngreso = (id) => API.delete(`/ingresos/${id}`);

// Salarios
export const getSalarios = () => API.get('/salarios');
export const createSalario = (data) => API.post('/salarios', data);
export const updateSalario = (id, data) => API.put(`/salarios/${id}`, data);
export const deleteSalario = (id) => API.delete(`/salarios/${id}`);

// Horas trabajadas
export const getHoras = () => API.get('/horas');
export const createHora = (data) => API.post('/horas', data);
export const deleteHora = (id) => API.delete(`/horas/${id}`);

// Mantenimientos
export const getMantenimientos = () => API.get('/mantenimientos');
export const createMantenimiento = (data) => API.post('/mantenimientos', data);
export const updateMantenimiento = (id, data) => API.put(`/mantenimientos/${id}`, data);
export const deleteMantenimiento = (id) => API.delete(`/mantenimientos/${id}`);

// Combustible
export const getCombustible = () => API.get('/combustible');
export const createCombustible = (data) => API.post('/combustible', data);
export const deleteCombustible = (id) => API.delete(`/combustible/${id}`);

// Pagos clientes
export const getPagos = () => API.get('/pagos');
export const createPago = (data) => API.post('/pagos', data);
export const updatePago = (id, data) => API.put(`/pagos/${id}`, data);
export const deletePago = (id) => API.delete(`/pagos/${id}`);