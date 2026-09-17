import { useState } from 'react';
import { useToast } from '../../utils/toast';
import { updateMe, enviarCodigoPassword, changePassword, configurarPin, eliminarPin, solicitarCambioEmail, verificarEmailViejo, confirmarCambioEmail } from '../../api';
import { User, Lock, Check, Building2, Mail, RefreshCw, KeyRound, ShieldCheck, ShieldOff, Shield, PlayCircle, HelpCircle } from 'lucide-react';
import './Perfil.css';

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
    const [tab, setTab] = useState(0);

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

    const [emailForm, setEmailForm] = useState({ nuevo: '', codigoViejo: '', codigoNuevo: '' });
    const [pasoEmail, setPasoEmail] = useState(0); // 0=form, 1=código correo viejo, 2=código correo nuevo
    const [cargandoEmail, setCargandoEmail] = useState(false);
    const [countdownEmail, setCountdownEmail] = useState(0);

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

    const iniciarCambioEmail = async () => {
        const email = emailForm.nuevo.trim().toLowerCase();
        if (!email.includes('@')) return toast('Ingresa un correo válido', 'e');
        setCargandoEmail(true);
        try {
            await solicitarCambioEmail({ nuevoEmail: email });
            setPasoEmail(1);
            toast(`Código enviado a ${user.email} — revisa tu bandeja`, 's');
            iniciarCountdown();
        } catch (err) {
            toast(err.response?.data?.error || 'No se pudo enviar el código', 'e');
        } finally { setCargandoEmail(false); }
    };

    const verificarViejo = async () => {
        if (!emailForm.codigoViejo.trim()) return toast('Ingresa el código que llegó a tu correo actual', 'e');
        setCargandoEmail(true);
        try {
            await verificarEmailViejo({ codigo: emailForm.codigoViejo.trim() });
            setPasoEmail(2);
            toast(`Código enviado a ${emailForm.nuevo} — revísalo`, 's');
            iniciarCountdown();
        } catch (err) {
            toast(err.response?.data?.error || 'Código incorrecto o expirado', 'e');
        } finally { setCargandoEmail(false); }
    };

    const confirmarEmail = async () => {
        if (!emailForm.codigoNuevo.trim()) return toast('Ingresa el código que llegó al nuevo correo', 'e');
        setCargandoEmail(true);
        try {
            const { data } = await confirmarCambioEmail({ codigo: emailForm.codigoNuevo.trim() });
            onUpdate(data);
            const session = JSON.parse(localStorage.getItem(AUTH_USER_KEY) || '{}');
            if (session.user) { session.user = { ...session.user, ...data }; localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session)); }
            setEmailForm({ nuevo: '', codigoViejo: '', codigoNuevo: '' });
            setPasoEmail(0);
            toast('Correo actualizado correctamente', 's');
        } catch (err) {
            toast(err.response?.data?.error || 'Código incorrecto o expirado', 'e');
        } finally { setCargandoEmail(false); }
    };

    const iniciarCountdown = () => {
        setCountdownEmail(60);
        const t = setInterval(() => {
            setCountdownEmail(c => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; });
        }, 1000);
    };

    const resetEmail = () => { setEmailForm({ nuevo: '', codigoViejo: '', codigoNuevo: '' }); setPasoEmail(0); setCountdownEmail(0); };

    const checks   = validarContra(passForm.nueva, policy);
    const todoOk   = checks.every(c => c.ok) && passForm.nueva === passForm.confirmar;
    const inicial  = (user.nombre || 'U').charAt(0).toUpperCase();

    const TABS = [
        { label: 'Datos personales', ico: <User size={14} /> },
        { label: 'Seguridad', ico: <Shield size={14} /> },
        { label: 'Ayuda', ico: <HelpCircle size={14} /> },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar">
                <div><h1>Mi Perfil</h1><p>Información de tu cuenta</p></div>
            </div>
            <div className="content"><div className="pad">

                {/* Hero de usuario */}
                <div className="pf-hero">
                    <div className="pf-av">{inicial}</div>
                    <div className="pf-hero-info">
                        <div className="pf-hero-name">{user.nombre}</div>
                        <div className="pf-hero-email">{user.email}</div>
                        <div className="pf-hero-badges">
                            <span className="pf-badge"><Building2 size={11} /> {user.empresa || 'Sin empresa'}</span>
                            <span className="pf-badge gold">{user.rol}</span>
                            {user.hasPin && <span className="pf-badge"><ShieldCheck size={11} /> PIN activo</span>}
                        </div>
                    </div>
                </div>

                <div className="pf-tabs">
                    {TABS.map((t, i) => (
                        <button key={i} className={`pf-tab ${tab === i ? 'on' : ''}`} onClick={() => setTab(i)}>{t.ico}{t.label}</button>
                    ))}
                </div>

                {tab === 0 && <>
                {/* Datos personales */}
                <div className="pf-sec">
                    <div className="pf-sec-head">
                        <span className="pf-sec-ico gold"><User size={16} /></span>
                        <div><div className="pf-sec-title">Datos personales</div><div className="pf-sec-desc">Tu nombre y empresa, visibles en reportes y vista compartida.</div></div>
                    </div>
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
                    </div>
                    <button className="bp" onClick={guardarPerfil} disabled={guardando}>
                        <Check size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                        {guardando ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                </div>

                {/* Cambiar correo */}
                <div className="pf-sec">
                    <div className="pf-sec-head">
                        <span className="pf-sec-ico info"><Mail size={16} /></span>
                        <div><div className="pf-sec-title">Cambiar correo</div><div className="pf-sec-desc">Verificación en dos pasos: confirmas el correo actual y luego el nuevo.</div></div>
                    </div>

                    {/* Indicador de pasos */}
                    <div className="pf-steps">
                        {[['1', 'Nuevo correo'], ['2', 'Verificar cuenta'], ['3', 'Verificar nuevo']].map(([n, label], i) => (
                            <div key={n} className="pf-step">
                                <div className="pf-step">
                                    <div className={`pf-step-dot ${pasoEmail > i ? 'done' : pasoEmail === i ? 'on' : ''}`}>
                                        {pasoEmail > i ? <Check size={11} /> : n}
                                    </div>
                                    <span className={`pf-step-label ${pasoEmail === i ? 'on' : ''}`}>{label}</span>
                                </div>
                                {i < 2 && <div className="pf-step-line" />}
                            </div>
                        ))}
                    </div>

                    {pasoEmail === 0 && (
                        <div>
                            <div className="ale blue" style={{ marginBottom: '14px' }}>
                                <Mail size={18} color="#2980b9" />
                                <div>
                                    <p>Correo actual: <strong>{user.email}</strong></p>
                                    <span className="ale-desc">Se verificará tu identidad por el correo actual, luego confirmarás el nuevo.</span>
                                </div>
                            </div>
                            <div style={{ marginBottom: '10px' }}>
                                <label className="fl">Nuevo correo *</label>
                                <input className="fi" type="email" value={emailForm.nuevo}
                                    onChange={e => setEmailForm({ ...emailForm, nuevo: e.target.value })}
                                    placeholder="nuevo@correo.com" />
                            </div>
                            <button className="bp" onClick={iniciarCambioEmail} disabled={cargandoEmail || !emailForm.nuevo.trim()}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Mail size={14} />
                                {cargandoEmail ? 'Enviando...' : 'Continuar'}
                            </button>
                        </div>
                    )}

                    {pasoEmail === 1 && (
                        <div>
                            <div className="ale green" style={{ marginBottom: '14px' }}>
                                <Check size={18} color="#27ae60" />
                                <div>
                                    <p>Código enviado a <strong>{user.email}</strong></p>
                                    <span className="ale-desc">Ingresa el código para confirmar que eres el dueño de esta cuenta.</span>
                                </div>
                            </div>
                            <div style={{ marginBottom: '10px' }}>
                                <label className="fl">Código de verificación *</label>
                                <input className="fi" value={emailForm.codigoViejo}
                                    onChange={e => setEmailForm({ ...emailForm, codigoViejo: e.target.value })}
                                    placeholder="000000" maxLength={6} inputMode="numeric"
                                    style={{ letterSpacing: '4px', fontSize: '20px', fontWeight: '700', textAlign: 'center' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                <button className="bp" onClick={verificarViejo} disabled={cargandoEmail || !emailForm.codigoViejo.trim()}>
                                    <Check size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                                    {cargandoEmail ? 'Verificando...' : 'Verificar'}
                                </button>
                                <button className="bs" onClick={iniciarCambioEmail} disabled={cargandoEmail || countdownEmail > 0}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <RefreshCw size={13} />
                                    {countdownEmail > 0 ? `Reenviar en ${countdownEmail}s` : 'Reenviar'}
                                </button>
                                <button className="bs" onClick={resetEmail}>Cancelar</button>
                            </div>
                        </div>
                    )}

                    {pasoEmail === 2 && (
                        <div>
                            <div className="ale green" style={{ marginBottom: '14px' }}>
                                <Check size={18} color="#27ae60" />
                                <div>
                                    <p>Código enviado a <strong>{emailForm.nuevo}</strong></p>
                                    <span className="ale-desc">Último paso: confirma que ese correo es tuyo.</span>
                                </div>
                            </div>
                            <div style={{ marginBottom: '10px' }}>
                                <label className="fl">Código de verificación *</label>
                                <input className="fi" value={emailForm.codigoNuevo}
                                    onChange={e => setEmailForm({ ...emailForm, codigoNuevo: e.target.value })}
                                    placeholder="000000" maxLength={6} inputMode="numeric"
                                    style={{ letterSpacing: '4px', fontSize: '20px', fontWeight: '700', textAlign: 'center' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                <button className="bp" onClick={confirmarEmail} disabled={cargandoEmail || !emailForm.codigoNuevo.trim()}>
                                    <Check size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                                    {cargandoEmail ? 'Confirmando...' : 'Confirmar nuevo correo'}
                                </button>
                                <button className="bs" onClick={verificarViejo} disabled={cargandoEmail || countdownEmail > 0}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <RefreshCw size={13} />
                                    {countdownEmail > 0 ? `Reenviar en ${countdownEmail}s` : 'Reenviar'}
                                </button>
                                <button className="bs" onClick={resetEmail}>Cancelar</button>
                            </div>
                        </div>
                    )}
                </div>
                </>}

                {tab === 1 && <>
                {/* Política de contraseña */}
                <div className="pf-sec">
                    <div className="pf-sec-head">
                        <span className="pf-sec-ico purple"><Shield size={16} /></span>
                        <div><div className="pf-sec-title">Política de contraseña</div><div className="pf-sec-desc">Define los requisitos que debe cumplir tu contraseña al cambiarla.</div></div>
                    </div>

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
                <div className="pf-sec">
                    <div className="pf-sec-head">
                        <span className="pf-sec-ico bad"><Lock size={16} /></span>
                        <div><div className="pf-sec-title">Cambiar contraseña</div><div className="pf-sec-desc">Requiere un código de verificación enviado a tu correo.</div></div>
                    </div>

                    {!codigoEnviado ? (
                        <div>
                            <div className="ale blue" style={{ marginBottom: '14px' }}>
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
                            <div className="ale green" style={{ marginBottom: '14px' }}>
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
                                            <span style={{ width:'14px', height:'14px', borderRadius:'50%', flexShrink:0, display:'inline-flex', alignItems:'center', justifyContent:'center', background: c.ok ? '#27ae60' : 'transparent', border: `2px solid ${c.ok ? '#27ae60' : '#c8d6e5'}` }}>
                                                {c.ok && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                                            </span>
                                            {c.label}
                                        </div>
                                    ))}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: (passForm.confirmar && passForm.nueva === passForm.confirmar) ? '#27ae60' : '#9aa5b4' }}>
                                        <span style={{ width:'14px', height:'14px', borderRadius:'50%', flexShrink:0, display:'inline-flex', alignItems:'center', justifyContent:'center', background: (passForm.confirmar && passForm.nueva === passForm.confirmar) ? '#27ae60' : 'transparent', border: `2px solid ${(passForm.confirmar && passForm.nueva === passForm.confirmar) ? '#27ae60' : '#c8d6e5'}` }}>
                                            {(passForm.confirmar && passForm.nueva === passForm.confirmar) && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                                        </span>
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
                <div className="pf-sec">
                    <div className="pf-sec-head">
                        <span className="pf-sec-ico good"><KeyRound size={16} /></span>
                        <div><div className="pf-sec-title">Acceso con PIN</div><div className="pf-sec-desc">Entra más rápido desde este dispositivo con un PIN de 4 dígitos.</div></div>
                    </div>
                    {user.hasPin ? (
                        <div>
                            <div className="ale green" style={{ marginBottom: '14px' }}>
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
                            <div className="ale gray" style={{ marginBottom: '14px' }}>
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

                </>}

                {tab === 2 && <>
                {/* Tour guiado */}
                <div className="pf-sec">
                    <div className="pf-sec-head">
                        <span className="pf-sec-ico info"><PlayCircle size={16} /></span>
                        <div><div className="pf-sec-title">Ayuda y tutorial</div><div className="pf-sec-desc">Recorre todos los módulos de MaquiControl con una guía paso a paso.</div></div>
                    </div>
                    <button className="bp" onClick={onIniciarTour}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}>
                        <PlayCircle size={14} /> Iniciar tour guiado
                    </button>
                </div>
                </>}

            </div></div>
        </div>
    );
}

export default Perfil;
