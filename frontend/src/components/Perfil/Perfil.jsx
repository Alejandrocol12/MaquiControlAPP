import { useState } from 'react';
import { useToast } from '../../utils/toast';
import { updateMe, enviarCodigoPassword, changePassword } from '../../api';
import { User, Lock, Check, Building2, Mail, RefreshCw } from 'lucide-react';

const AUTH_USER_KEY = 'mc_auth_user';

function Perfil({ user, onUpdate }) {
    const toast = useToast();

    // Datos personales
    const [perfForm, setPerfForm] = useState({ nombre: user.nombre || '', empresa: user.empresa || '' });
    const [guardando, setGuardando] = useState(false);

    // Cambio de contraseña — paso 1: pedir código
    const [codigoEnviado, setCodigoEnviado] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [countdown, setCountdown] = useState(0);

    // Cambio de contraseña — paso 2: verificar código + nueva clave
    const [passForm, setPassForm] = useState({ codigo: '', nueva: '', confirmar: '' });
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

    const pedirCodigo = async () => {
        setEnviando(true);
        try {
            await enviarCodigoPassword();
            setCodigoEnviado(true);
            toast('Código enviado — revisa tu correo', 's');
            // Countdown de 60 s para reenviar
            setCountdown(60);
            const t = setInterval(() => {
                setCountdown(c => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; });
            }, 1000);
        } catch (err) {
            toast(err.response?.data?.error || 'No se pudo enviar el correo. Verifica la config de Gmail en Railway.', 'e');
        } finally { setEnviando(false); }
    };

    const cambiarPass = async () => {
        if (!passForm.codigo.trim()) return toast('Ingresa el código que llegó a tu correo', 'e');
        if (passForm.nueva.length < 6) return toast('La nueva contraseña debe tener al menos 6 caracteres', 'e');
        if (passForm.nueva !== passForm.confirmar) return toast('Las contraseñas no coinciden', 'e');
        setCambiando(true);
        try {
            await changePassword({ codigo: passForm.codigo.trim(), nueva: passForm.nueva });
            setPassForm({ codigo: '', nueva: '', confirmar: '' });
            setCodigoEnviado(false);
            toast('Contraseña cambiada correctamente', 's');
        } catch (err) {
            toast(err.response?.data?.error || 'Código incorrecto o expirado', 'e');
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

                {/* Editar datos personales */}
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

                    {!codigoEnviado ? (
                        /* PASO 1 — pedir código */
                        <div>
                            <div className="ale" style={{ background: '#e8f0fe', borderColor: '#2980b9', marginBottom: '14px' }}>
                                <Mail size={18} color="#2980b9" />
                                <div>
                                    <p>Se enviará un código de verificación a</p>
                                    <span className="ale-desc" style={{ fontWeight: '700', color: '#1a2d42' }}>{user.email}</span>
                                </div>
                            </div>
                            <button className="bp" onClick={pedirCodigo} disabled={enviando}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Mail size={14} />
                                {enviando ? 'Enviando...' : 'Enviar código a mi correo'}
                            </button>
                        </div>
                    ) : (
                        /* PASO 2 — ingresar código + nueva contraseña */
                        <div>
                            <div className="ale" style={{ background: '#e8f5e9', borderColor: '#27ae60', marginBottom: '14px' }}>
                                <Check size={18} color="#27ae60" />
                                <div>
                                    <p>Código enviado a <strong>{user.email}</strong></p>
                                    <span className="ale-desc">Revisa tu bandeja de entrada (y spam). Válido por 15 minutos.</span>
                                </div>
                            </div>

                            <div>
                                <label className="fl">Código de verificación *</label>
                                <input className="fi" value={passForm.codigo}
                                    onChange={e => setPassForm({ ...passForm, codigo: e.target.value })}
                                    placeholder="Ej: 483921"
                                    maxLength={6}
                                    inputMode="numeric"
                                    style={{ letterSpacing: '4px', fontSize: '20px', fontWeight: '700', textAlign: 'center' }} />
                            </div>

                            <div className="fg2" style={{ marginTop: '4px' }}>
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

                            <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                                <button className="bp" onClick={cambiarPass} disabled={cambiando}>
                                    <Lock size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                                    {cambiando ? 'Cambiando...' : 'Cambiar contraseña'}
                                </button>
                                <button className="bs" onClick={pedirCodigo}
                                    disabled={enviando || countdown > 0}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <RefreshCw size={13} />
                                    {countdown > 0 ? `Reenviar en ${countdown}s` : 'Reenviar código'}
                                </button>
                                <button className="bs" onClick={() => { setCodigoEnviado(false); setPassForm({ codigo: '', nueva: '', confirmar: '' }); }}>
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </div></div>
        </div>
    );
}

export default Perfil;
