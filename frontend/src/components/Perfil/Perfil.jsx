import { useState } from 'react';
import { useToast } from '../../utils/toast';
import { updateMe, enviarCodigoPassword, changePassword, configurarPin, eliminarPin } from '../../api';
import { User, Lock, Check, Building2, Mail, RefreshCw, KeyRound, ShieldCheck, ShieldOff, Shield, PlayCircle } from 'lucide-react';

const AUTH_USER_KEY  = 'mc_auth_user';
const POLICY_KEY     = 'mc_pass_policy';
const defaultPolicy  = { minLength: 6, requireUppercase: false, requireNumbers: false, requireSymbols: false };

const loadPolicy = () => {
    try { return { ...defaultPolicy, ...JSON.parse(localStorage.getItem(POLICY_KEY)) }; }
    catch { return { ...defaultPolicy }; }
};

const savePolicy = (p) => localStorage.setItem(POLICY_KEY, JSON.stringify(p));

const validarContra = (pass, policy) => [
    { label: `Mínimo ${policy.minLength} caracteres`,     ok: pass.length >= policy.minLength },
    ...(policy.requireUppercase ? [{ label: 'Al menos una mayúscula',          ok: /[A-Z]/.test(pass) }] : []),
    ...(policy.requireNumbers   ? [{ label: 'Al menos un número',              ok: /\d/.test(pass) }] : []),
    ...(policy.requireSymbols   ? [{ label: 'Al menos un símbolo (!@#$...)',   ok: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pass) }] : []),
];

const Toggle = ({ value, onChange, label }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
        <div onClick={() => onChange(!value)} style={{
            width: '38px', height: '20px', borderRadius: '10px',
            background: value ? '#f5a623' : '#c8d6e5',
            position: 'relative', transition: 'background .2s', flexShrink: 0,
        }}>
            <div style={{
                position: 'absolute', top: '2px', left: value ? '20px' : '2px',
                width: '16px', height: '16px', borderRadius: '50%',
                background: '#fff', transition: 'left .2s',
                boxShadow: '0 1px 3px rgba(0,0,0,.2)',
            }} />
        </div>
        <span style={{ fontSize: '13px', color: '#1a2d42' }}>{label}</span>
    </label>
);

function Perfil({ user, onUpdate, onIniciarTour }) {
    const toast = useToast();

    const [perfForm, setPerfForm] = useState({ nombre: user.nombre || '', empresa: user.empresa || '' });
    const [guardando, setGuardando] = useState(false);

    const [pinForm, setPinForm] = useState('');
    const [guardandoPin, setGuardandoPin] = useState(false);

    const [codigoEnviado, setCodigoEnviado] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [passForm, setPassForm] = useState({ codigo: '', nueva: '', confirmar: '' });
    const [cambiando, setCambiando] = useState(false);

    const [policy, setPolicy] = useState(loadPolicy);

    const actualizarPolicy = (campo, valor) => {
        const nueva = { ...policy, [campo]: valor };
        setPolicy(nueva);
        savePolicy(nueva);
    };

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
            setCountdown(60);
            const t = setInterval(() => {
                setCountdown(c => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; });
            }, 1000);
        } catch (err) {
            toast(err.response?.data?.error || 'No se pudo enviar el correo.', 'e');
        } finally { setEnviando(false); }
    };

    const cambiarPass = async () => {
        if (!passForm.codigo.trim()) return toast('Ingresa el código que llegó a tu correo', 'e');
        const checks = validarContra(passForm.nueva, policy);
        const fallido = checks.find(c => !c.ok);
        if (fallido) return toast(fallido.label, 'e');
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

    const guardarPin = async () => {
        if (!/^\d{4}$/.test(pinForm)) return toast('El PIN debe ser exactamente 4 dígitos numéricos', 'e');
        setGuardandoPin(true);
        try {
            const { data } = await configurarPin({ pin: pinForm });
            localStorage.setItem('mc_pin_email', user.email);
            onUpdate(data);
            setPinForm('');
            toast('PIN configurado — ya puedes usarlo al entrar', 's');
        } catch (err) {
            toast(err.response?.data?.error || 'Error al guardar el PIN', 'e');
        } finally { setGuardandoPin(false); }
    };

    const quitarPin = async () => {
        setGuardandoPin(true);
        try {
            const { data } = await eliminarPin();
            localStorage.removeItem('mc_pin_email');
            onUpdate(data);
            toast('PIN eliminado', 'i');
        } catch {
            toast('Error al eliminar el PIN', 'e');
        } finally { setGuardandoPin(false); }
    };

    const checks   = validarContra(passForm.nueva, policy);
    const todoOk   = checks.every(c => c.ok) && passForm.nueva === passForm.confirmar;
    const inicial  = (user.nombre || 'U').charAt(0).toUpperCase();

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

                {/* Datos personales */}
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

                {/* Política de contraseña */}
                <div className="fc">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Shield size={18} /> Política de contraseña</h3>
                    <p style={{ fontSize: '13px', color: '#6b7a8d', margin: '0 0 14px' }}>
                        Define los requisitos que debe cumplir tu contraseña al cambiarla.
                    </p>

                    <div style={{ marginBottom: '14px' }}>
                        <label className="fl">Longitud mínima</label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {[6, 8, 10, 12].map(n => (
                                <button key={n} onClick={() => actualizarPolicy('minLength', n)}
                                    style={{
                                        padding: '6px 16px', borderRadius: '8px', border: '1.5px solid',
                                        borderColor: policy.minLength === n ? '#f5a623' : '#dde4ed',
                                        background: policy.minLength === n ? '#fff8ee' : '#fff',
                                        color: policy.minLength === n ? '#f5a623' : '#6b7a8d',
                                        fontWeight: policy.minLength === n ? '700' : '400',
                                        cursor: 'pointer', fontSize: '13px',
                                    }}>
                                    {n} caracteres
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <Toggle value={policy.requireUppercase} onChange={v => actualizarPolicy('requireUppercase', v)} label="Requerir al menos una mayúscula (A-Z)" />
                        <Toggle value={policy.requireNumbers}   onChange={v => actualizarPolicy('requireNumbers', v)}   label="Requerir al menos un número (0-9)" />
                        <Toggle value={policy.requireSymbols}   onChange={v => actualizarPolicy('requireSymbols', v)}   label="Requerir al menos un símbolo (!@#$...)" />
                    </div>
                </div>

                {/* Cambiar contraseña */}
                <div className="fc">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Lock size={18} /> Cambiar contraseña</h3>

                    {!codigoEnviado ? (
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
                                    placeholder="Ej: 483921" maxLength={6} inputMode="numeric"
                                    style={{ letterSpacing: '4px', fontSize: '20px', fontWeight: '700', textAlign: 'center' }} />
                            </div>

                            <div className="fg2" style={{ marginTop: '4px' }}>
                                <div>
                                    <label className="fl">Nueva contraseña *</label>
                                    <input className="fi" type="password" value={passForm.nueva}
                                        onChange={e => setPassForm({ ...passForm, nueva: e.target.value })}
                                        placeholder={`Mínimo ${policy.minLength} caracteres`} />
                                </div>
                                <div>
                                    <label className="fl">Confirmar nueva *</label>
                                    <input className="fi" type="password" value={passForm.confirmar}
                                        onChange={e => setPassForm({ ...passForm, confirmar: e.target.value })}
                                        placeholder="Repite la contraseña" />
                                </div>
                            </div>

                            {/* Checklist en tiempo real */}
                            {passForm.nueva && (
                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    {checks.map((c, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: c.ok ? '#27ae60' : '#9aa5b4' }}>
                                            <span style={{ fontSize: '14px' }}>{c.ok ? '✅' : '⬜'}</span>
                                            {c.label}
                                        </div>
                                    ))}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: (passForm.confirmar && passForm.nueva === passForm.confirmar) ? '#27ae60' : '#9aa5b4' }}>
                                        <span style={{ fontSize: '14px' }}>{(passForm.confirmar && passForm.nueva === passForm.confirmar) ? '✅' : '⬜'}</span>
                                        Las contraseñas coinciden
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                                <button className="bp" onClick={cambiarPass} disabled={cambiando || !todoOk}>
                                    <Lock size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                                    {cambiando ? 'Cambiando...' : 'Cambiar contraseña'}
                                </button>
                                <button className="bs" onClick={pedirCodigo} disabled={enviando || countdown > 0}
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

                {/* PIN de acceso rápido */}
                <div className="fc">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><KeyRound size={18} /> Acceso con PIN</h3>
                    {user.hasPin ? (
                        <div>
                            <div className="ale" style={{ background: '#e8f5e9', borderColor: '#27ae60', marginBottom: '14px' }}>
                                <ShieldCheck size={18} color="#27ae60" />
                                <div>
                                    <p>PIN activo — puedes entrar con 4 dígitos desde la pantalla de inicio</p>
                                    <span className="ale-desc">Correo vinculado: <strong>{user.email}</strong></span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '160px' }}>
                                    <label className="fl">Cambiar PIN</label>
                                    <input className="fi" type="password" inputMode="numeric" maxLength={4}
                                        value={pinForm} onChange={e => setPinForm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                        placeholder="Nuevo PIN (4 dígitos)" />
                                </div>
                                <button className="bp" disabled={guardandoPin || pinForm.length !== 4} onClick={guardarPin}
                                    style={{ alignSelf: 'flex-end', whiteSpace: 'nowrap' }}>
                                    <Check size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                                    {guardandoPin ? 'Guardando...' : 'Cambiar PIN'}
                                </button>
                                <button className="bs" disabled={guardandoPin} onClick={quitarPin}
                                    style={{ alignSelf: 'flex-end', color: '#e74c3c', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <ShieldOff size={14} /> Eliminar PIN
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="ale" style={{ background: '#f0f4f8', borderColor: '#c8d6e5', marginBottom: '14px' }}>
                                <KeyRound size={18} color="#6b7a8d" />
                                <div>
                                    <p>Sin PIN configurado</p>
                                    <span className="ale-desc">Configura un PIN de 4 dígitos para entrar más rápido desde tu dispositivo.</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                <div style={{ flex: 1, minWidth: '160px' }}>
                                    <label className="fl">Nuevo PIN (4 dígitos) *</label>
                                    <input className="fi" type="password" inputMode="numeric" maxLength={4}
                                        value={pinForm} onChange={e => setPinForm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                        placeholder="Ej: 1234" style={{ letterSpacing: '8px', fontSize: '20px', textAlign: 'center' }} />
                                </div>
                                <button className="bp" disabled={guardandoPin || pinForm.length !== 4} onClick={guardarPin}>
                                    <ShieldCheck size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                                    {guardandoPin ? 'Guardando...' : 'Activar PIN'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Tour guiado */}
                <div className="fc">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><PlayCircle size={18} /> Ayuda y tutorial</h3>
                    <p style={{ fontSize: '13px', color: '#6b7a8d', margin: '0 0 14px' }}>
                        Recorre todos los módulos de MaquiControl con una guía paso a paso.
                    </p>
                    <button className="bp" onClick={onIniciarTour}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}>
                        <PlayCircle size={14} /> Iniciar tour guiado
                    </button>
                </div>

            </div></div>
        </div>
    );
}

export default Perfil;
