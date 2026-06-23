import { useState } from 'react';
import { useToast } from '../../utils/toast';
import { updateMe, changePassword } from '../../api';
import { User, Lock, Check, Building2 } from 'lucide-react';

const AUTH_USER_KEY = 'mc_auth_user';

function Perfil({ user, onUpdate }) {
    const toast = useToast();
    const [perfForm, setPerfForm] = useState({ nombre: user.nombre || '', empresa: user.empresa || '' });
    const [passForm, setPassForm] = useState({ actual: '', nueva: '', confirmar: '' });
    const [guardando, setGuardando] = useState(false);
    const [cambiando, setCambiando] = useState(false);

    const guardarPerfil = async () => {
        if (!perfForm.nombre.trim()) return toast('El nombre es obligatorio', 'e');
        setGuardando(true);
        try {
            const { data } = await updateMe({ nombre: perfForm.nombre.trim(), empresa: perfForm.empresa.trim() });
            const session = JSON.parse(localStorage.getItem(AUTH_USER_KEY) || '{}');
            if (session.user) { session.user = { ...session.user, ...data }; localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session)); }
            onUpdate(data);
            toast('Perfil actualizado');
        } catch (err) {
            toast(err.response?.data?.error || 'Error al actualizar el perfil', 'e');
        } finally { setGuardando(false); }
    };

    const cambiarPass = async () => {
        if (!passForm.actual) return toast('Ingresa tu contraseña actual', 'e');
        if (passForm.nueva.length < 6) return toast('La nueva contraseña debe tener al menos 6 caracteres', 'e');
        if (passForm.nueva !== passForm.confirmar) return toast('Las contraseñas no coinciden', 'e');
        setCambiando(true);
        try {
            await changePassword({ actual: passForm.actual, nueva: passForm.nueva });
            setPassForm({ actual: '', nueva: '', confirmar: '' });
            toast('Contraseña actualizada');
        } catch (err) {
            toast(err.response?.data?.error || 'Contraseña actual incorrecta', 'e');
        } finally { setCambiando(false); }
    };

    const inicial = (user.nombre || 'U').charAt(0).toUpperCase();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar">
                <div><h1>Mi Perfil</h1><p>Información de tu cuenta</p></div>
            </div>
            <div className="content"><div className="pad">

                {/* Tarjeta de usuario */}
                <div className="perf-card">
                    <div className="perf-av">{inicial}</div>
                    <div>
                        <div className="perf-name">{user.nombre}</div>
                        <div className="perf-meta">{user.email}</div>
                        <div className="perf-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <Building2 size={12} style={{ color: '#9aa5b4' }} />
                            {user.empresa || '—'}
                            <span className="b comp" style={{ fontSize: '11px', marginLeft: '4px' }}>{user.rol}</span>
                        </div>
                    </div>
                </div>

                {/* Editar datos */}
                <div className="fc">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><User size={18} /> Datos personales</h3>
                    <div className="fg2">
                        <div>
                            <label className="fl">Nombre *</label>
                            <input className="fi" value={perfForm.nombre}
                                onChange={e => setPerfForm({ ...perfForm, nombre: e.target.value })}
                                placeholder="Tu nombre completo" />
                        </div>
                        <div>
                            <label className="fl">Empresa</label>
                            <input className="fi" value={perfForm.empresa}
                                onChange={e => setPerfForm({ ...perfForm, empresa: e.target.value })}
                                placeholder="Nombre de tu empresa" />
                        </div>
                    </div>
                    <div>
                        <label className="fl">Correo electrónico</label>
                        <input className="fi" value={user.email} readOnly
                            style={{ background: '#f0f4f8', color: '#9aa5b4', cursor: 'not-allowed' }} />
                        <span style={{ fontSize: '11px', color: '#9aa5b4' }}>El correo no se puede cambiar</span>
                    </div>
                    <button className="bp" onClick={guardarPerfil} disabled={guardando}>
                        <Check size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                        {guardando ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                </div>

                {/* Cambiar contraseña */}
                <div className="fc">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Lock size={18} /> Cambiar contraseña</h3>
                    <div>
                        <label className="fl">Contraseña actual *</label>
                        <input className="fi" type="password" value={passForm.actual}
                            onChange={e => setPassForm({ ...passForm, actual: e.target.value })}
                            placeholder="Tu contraseña actual" />
                    </div>
                    <div className="fg2">
                        <div>
                            <label className="fl">Nueva contraseña *</label>
                            <input className="fi" type="password" value={passForm.nueva}
                                onChange={e => setPassForm({ ...passForm, nueva: e.target.value })}
                                placeholder="Mínimo 6 caracteres" />
                        </div>
                        <div>
                            <label className="fl">Confirmar nueva *</label>
                            <input className="fi" type="password" value={passForm.confirmar}
                                onChange={e => setPassForm({ ...passForm, confirmar: e.target.value })}
                                placeholder="Repite la contraseña" />
                        </div>
                    </div>
                    <button className="bp" onClick={cambiarPass} disabled={cambiando}>
                        <Lock size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                        {cambiando ? 'Cambiando...' : 'Cambiar contraseña'}
                    </button>
                </div>

            </div></div>
        </div>
    );
}

export default Perfil;
