import axios from 'axios';

const API = axios.create({
    baseURL: 'http://localhost:8081/api'
});

// Adjunta el JWT en cada petición si existe
API.interceptors.request.use((config) => {
    const session = localStorage.getItem('mc_auth_user');
    if (session) {
        try {
            const { token } = JSON.parse(session);
            if (token) config.headers.Authorization = `Bearer ${token}`;
        } catch { /* sesión corrupta */ }
    }
    return config;
});

// Si el backend devuelve 401 limpia la sesión y recarga
API.interceptors.response.use(
    (r) => r,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem('mc_auth_user');
            window.location.reload();
        }
        return Promise.reject(err);
    }
);

// Auth
export const apiLogin    = (data) => API.post('/auth/login', data);
export const apiRegister = (data) => API.post('/auth/register', data);
export const apiMe       = ()     => API.get('/auth/me');

// Maquinaria
export const getMaquinas    = ()         => API.get('/maquinaria');
export const getMaquina     = (id)       => API.get(`/maquinaria/${id}`);
export const createMaquina  = (data)     => API.post('/maquinaria', data);
export const updateMaquina  = (id, data) => API.put(`/maquinaria/${id}`, data);
export const deleteMaquina  = (id)       => API.delete(`/maquinaria/${id}`);

// Gastos
export const getGastos    = ()         => API.get('/gastos');
export const createGasto  = (data)     => API.post('/gastos', data);
export const updateGasto  = (id, data) => API.put(`/gastos/${id}`, data);
export const deleteGasto  = (id)       => API.delete(`/gastos/${id}`);

// Ingresos
export const getIngresos    = ()         => API.get('/ingresos');
export const createIngreso  = (data)     => API.post('/ingresos', data);
export const updateIngreso  = (id, data) => API.put(`/ingresos/${id}`, data);
export const deleteIngreso  = (id)       => API.delete(`/ingresos/${id}`);

// Salarios
export const getSalarios    = ()         => API.get('/salarios');
export const createSalario  = (data)     => API.post('/salarios', data);
export const updateSalario  = (id, data) => API.put(`/salarios/${id}`, data);
export const deleteSalario  = (id)       => API.delete(`/salarios/${id}`);

// Horas trabajadas
export const getHoras              = ()         => API.get('/horas');
export const getHorasOperador      = (opId)     => API.get(`/horas/operador/${opId}`);
export const createHora            = (data)     => API.post('/horas', data);
export const deleteHora            = (id)       => API.delete(`/horas/${id}`);

// Mantenimientos
export const getMantenimientos    = ()         => API.get('/mantenimientos');
export const createMantenimiento  = (data)     => API.post('/mantenimientos', data);
export const updateMantenimiento  = (id, data) => API.put(`/mantenimientos/${id}`, data);
export const deleteMantenimiento  = (id)       => API.delete(`/mantenimientos/${id}`);

// Combustible
export const getCombustible    = ()     => API.get('/combustible');
export const createCombustible = (data) => API.post('/combustible', data);
export const deleteCombustible = (id)   => API.delete(`/combustible/${id}`);

// Pagos clientes
export const getPagos    = ()         => API.get('/pagos');
export const createPago  = (data)     => API.post('/pagos', data);
export const updatePago  = (id, data) => API.put(`/pagos/${id}`, data);
export const deletePago  = (id)       => API.delete(`/pagos/${id}`);

// Operadores
export const getOperadoresAPI   = ()         => API.get('/operadores');
export const createOperadorAPI  = (data)     => API.post('/operadores', data);
export const updateOperadorAPI  = (id, data) => API.put(`/operadores/${id}`, data);
export const deleteOperadorAPI  = (id)       => API.delete(`/operadores/${id}`);

// Períodos de operadores
export const getPeriodosAPI       = (opId)       => API.get(`/operadores/${opId}/periodos`);
export const getPeriodoActivoAPI  = (opId)       => API.get(`/operadores/${opId}/periodos/activo`);
export const createPeriodoAPI     = (opId, data) => API.post(`/operadores/${opId}/periodos`, data);
export const updatePeriodoAPI     = (id, data)   => API.put(`/operadores/periodos/${id}`, data);
export const deletePeriodoAPI     = (id)         => API.delete(`/operadores/periodos/${id}`);

// Usuarios (solo admin)
export const getUsuarios         = ()         => API.get('/usuarios');
export const createUsuario       = (data)     => API.post('/usuarios', data);
export const updateUsuarioRol    = (id, rol)  => API.put(`/usuarios/${id}/rol`, { rol });
export const updateUsuarioActivo = (id, activo) => API.put(`/usuarios/${id}/activo`, { activo });
export const vincularUsuarioOperador = (id, operadorId) => API.put(`/usuarios/${id}/vincular-operador`, { operadorId });
