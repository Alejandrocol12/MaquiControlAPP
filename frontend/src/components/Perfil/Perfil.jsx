import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '../../utils/toast';
import {
    updateMe, enviarCodigoPassword, changePassword, configurarPin, eliminarPin,
    solicitarCambioEmail, verificarEmailViejo, confirmarCambioEmail,
    getSesiones, cerrarSesionRemota, cerrarOtrasSesiones, subirLogoEmpresa, quitarLogoEmpresa,
    getMaquinas, getOperadoresAPI,
} from '../../api';
import { empresaActual, guardarEmpresa, cargarEmpresa } from '../../utils/empresa';
import {
    User, Lock, Check, Building2, Mail, ShieldCheck, PlayCircle, HelpCircle, SlidersHorizontal,
    Monitor, Smartphone, LogOut, ImagePlus, Trash2, KeyRound, Sun, Moon, X,
} from 'lucide-react';
import './Perfil.css';

const AUTH_USER_KEY = 'mc_auth_user';

// Requisitos fijos de la contraseña nueva (el servidor exige además el mínimo de 8)
const requisitos = (p) => [
    { label: 'Mínimo 8 caracteres', ok: p.length >= 8 },
    { label: 'Una mayúscula', ok: /[A-Z]/.test(p) },
    { label: 'Un número', ok: /\d/.test(p) },
];

// Fortaleza de 0 a 4 para el medidor
const fortaleza = (p) => {
    if (!p) return { n: 0, texto: '' };
    let n = 0;
    if (p.length >= 8) n++;
    if (p.length >= 12) n++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p)) n++;
    if (/[^A-Za-z0-9]/.test(p)) n++;
    return { n, texto: ['Muy débil', 'Débil', 'Media', 'Buena', 'Fuerte'][n] };
};

const hace = (iso) => {
    if (!iso) return '';
    const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (min < 6) return 'Activa ahora';
    if (min < 60) return `Activa hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `Activa hace ${h} h`;
    const d = Math.round(h / 24);
    return `Activa hace ${d} ${d === 1 ? 'día' : 'días'}`;
};

// Reduce la imagen para que el logo pese poco y se guarde sin problema
const prepararLogo = (file) => new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg)$/.test(file.type)) return reject(new Error('El logo debe ser una imagen PNG o JPG.'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
        const escala = Math.min(1, 480 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * escala);
        c.height = Math.round(img.height * escala);
        const ctx = c.getContext('2d');
        const png = file.type === 'image/png';
        if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        let out = png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9);
        if (out.length > 380000) out = c.toDataURL('image/jpeg', 0.8); // un PNG muy pesado pasa a JPG
        if (out.length > 380000) return reject(new Error('El logo es muy pesado. Usa una imagen más pequeña.'));
        resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')); };
    img.src = url;
});

const SECCIONES = [
    { id: 'cuenta', label: 'Cuenta', Icono: User },
    { id: 'seguridad', label: 'Seguridad', Icono: Lock },
    { id: 'preferencias', label: 'Preferencias', Icono: SlidersHorizontal },
    { id: 'ayuda', label: 'Ayuda', Icono: HelpCircle },
];

function Perfil({ user, onUpdate, onIniciarTour, onLogout, tema, setTema }) {
    const toast = useToast();
    const [seccion, setSeccion] = useState('cuenta');

    // ── cabecera ──
    const [conteo, setConteo] = useState({ maquinas: null, operadores: null });
    const [empresaDatos, setEmpresaDatos] = useState(empresaActual());

    // ── cuenta ──
    const [nombre, setNombre] = useState(user.nombre || '');
    const [emp, setEmp] = useState({ empresa: user.empresa || '', nit: user.nit || '', ciudad: user.ciudad || '', telefono: user.telefono || '', direccion: user.direccion || '' });
    const [guardando, setGuardando] = useState('');
    const [subiendoLogo, setSubiendoLogo] = useState(false);
    const archivoLogo = useRef(null);

    // ── correo ──
    const [abrirEmail, setAbrirEmail] = useState(false);
    const [emailForm, setEmailForm] = useState({ nuevo: '', codigoViejo: '', codigoNuevo: '' });
    const [pasoEmail, setPasoEmail] = useState(0); // 0 nuevo correo, 1 código del correo actual, 2 código del nuevo
    const [cargandoEmail, setCargandoEmail] = useState(false);
    const [cuentaEmail, setCuentaEmail] = useState(0);

    // ── contraseña ──
    const [abrirPass, setAbrirPass] = useState(false);
    const [codigoEnviado, setCodigoEnviado] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [cuentaPass, setCuentaPass] = useState(0);
    const [passForm, setPassForm] = useState({ codigo: '', nueva: '', confirmar: '' });
    const [cambiando, setCambiando] = useState(false);

    // ── PIN ──
    const [abrirPin, setAbrirPin] = useState(false);
    const [pinForm, setPinForm] = useState('');
    const [guardandoPin, setGuardandoPin] = useState(false);

    // ── sesiones ──
    const [sesiones, setSesiones] = useState(null);
    const [cerrandoSesion, setCerrandoSesion] = useState('');

    useEffect(() => { try { localStorage.removeItem('mc_pass_policy'); } catch { /* sin almacenamiento */ } }, []);

    useEffect(() => {
        let vivo = true;
        Promise.all([getMaquinas(), getOperadoresAPI()])
            .then(([m, o]) => { if (vivo) setConteo({ maquinas: (m.data || []).length, operadores: (o.data || []).length }); })
            .catch(() => {});
        cargarEmpresa().then(d => { if (vivo && d) setEmpresaDatos(d); });
        return () => { vivo = false; };
    }, []);

    const cargarSesiones = useCallback(() => {
        getSesiones().then(r => setSesiones(r.data || [])).catch(() => setSesiones([]));
    }, []);
    useEffect(() => { if (seccion === 'seguridad') cargarSesiones(); }, [seccion, cargarSesiones]);

    const contar = (set) => {
        set(60);
        const t = setInterval(() => set(c => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; }), 1000);
    };

    const aplicarUsuario = (data) => {
        const sesion = JSON.parse(localStorage.getItem(AUTH_USER_KEY) || '{}');
        if (sesion.user) { sesion.user = { ...sesion.user, ...data }; localStorage.setItem(AUTH_USER_KEY, JSON.stringify(sesion)); }
        onUpdate(data);
    };

    // ── cuenta: guardar ──
    const guardar = async (cual) => {
        if (cual === 'personal' && !nombre.trim()) return toast('El nombre es obligatorio', 'e');
        if (cual === 'empresa' && !emp.empresa.trim()) return toast('El nombre de la empresa es obligatorio', 'e');
        setGuardando(cual);
        try {
            const cuerpo = cual === 'personal'
                ? { nombre: nombre.trim() }
                : { empresa: emp.empresa.trim(), nit: emp.nit, ciudad: emp.ciudad, telefono: emp.telefono, direccion: emp.direccion };
            const { data } = await updateMe(cuerpo);
            aplicarUsuario(data);
            if (cual === 'empresa') {
                const nuevo = { ...(empresaActual() || {}), ...cuerpo };
                guardarEmpresa(nuevo); setEmpresaDatos(nuevo);
            }
            toast(cual === 'personal' ? 'Datos personales guardados' : 'Datos de la empresa guardados');
        } catch (err) {
            toast(err.response?.data?.error || 'No se pudieron guardar los cambios', 'e');
        } finally { setGuardando(''); }
    };

    const elegirLogo = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setSubiendoLogo(true);
        try {
            const logo = await prepararLogo(file);
            const { data } = await subirLogoEmpresa(logo);
            aplicarUsuario(data);
            const nuevo = { ...(empresaActual() || {}), logo };
            guardarEmpresa(nuevo); setEmpresaDatos(nuevo);
            toast('Logo guardado. Saldrá en tus PDF.');
        } catch (err) {
            toast(err.response?.data?.error || err.message || 'No se pudo subir el logo', 'e');
        } finally { setSubiendoLogo(false); }
    };

    const quitarLogo = async () => {
        setSubiendoLogo(true);
        try {
            const { data } = await quitarLogoEmpresa();
            aplicarUsuario(data);
            const nuevo = { ...(empresaActual() || {}), logo: null };
            guardarEmpresa(nuevo); setEmpresaDatos(nuevo);
            toast('Logo quitado', 'i');
        } catch { toast('No se pudo quitar el logo', 'e'); }
        finally { setSubiendoLogo(false); }
    };

    // ── correo ──
    const cerrarEmail = () => { setAbrirEmail(false); setEmailForm({ nuevo: '', codigoViejo: '', codigoNuevo: '' }); setPasoEmail(0); setCuentaEmail(0); };

    const iniciarCambioEmail = async () => {
        const email = emailForm.nuevo.trim().toLowerCase();
        if (!email.includes('@')) return toast('Escribe un correo válido', 'e');
        setCargandoEmail(true);
        try {
            await solicitarCambioEmail({ nuevoEmail: email });
            setPasoEmail(1); contar(setCuentaEmail);
            toast(`Código enviado a ${user.email}`, 's');
        } catch (err) { toast(err.response?.data?.error || 'No se pudo enviar el código', 'e'); }
        finally { setCargandoEmail(false); }
    };

    const verificarViejo = async () => {
        if (!emailForm.codigoViejo.trim()) return toast('Escribe el código que llegó a tu correo actual', 'e');
        setCargandoEmail(true);
        try {
            await verificarEmailViejo({ codigo: emailForm.codigoViejo.trim() });
            setPasoEmail(2); contar(setCuentaEmail);
            toast(`Código enviado a ${emailForm.nuevo}`, 's');
        } catch (err) { toast(err.response?.data?.error || 'Código incorrecto o vencido', 'e'); }
        finally { setCargandoEmail(false); }
    };

    const confirmarEmail = async () => {
        if (!emailForm.codigoNuevo.trim()) return toast('Escribe el código que llegó al correo nuevo', 'e');
        setCargandoEmail(true);
        try {
            const { data } = await confirmarCambioEmail({ codigo: emailForm.codigoNuevo.trim() });
            aplicarUsuario(data);
            cerrarEmail();
            toast('Correo actualizado', 's');
        } catch (err) { toast(err.response?.data?.error || 'Código incorrecto o vencido', 'e'); }
        finally { setCargandoEmail(false); }
    };

    // ── contraseña ──
    const cerrarPass = () => { setAbrirPass(false); setCodigoEnviado(false); setPassForm({ codigo: '', nueva: '', confirmar: '' }); setCuentaPass(0); };

    const pedirCodigo = async () => {
        setEnviando(true);
        try {
            await enviarCodigoPassword();
            setCodigoEnviado(true); contar(setCuentaPass);
            toast('Código enviado. Revisa tu correo.', 's');
        } catch (err) { toast(err.response?.data?.error || 'No se pudo enviar el correo', 'e'); }
        finally { setEnviando(false); }
    };

    const reqs = requisitos(passForm.nueva);
    const fuerza = fortaleza(passForm.nueva);
    const passOk = reqs.every(r => r.ok) && passForm.nueva === passForm.confirmar && passForm.codigo.trim();

    const cambiarPass = async () => {
        if (!passForm.codigo.trim()) return toast('Escribe el código que llegó a tu correo', 'e');
        const falla = reqs.find(r => !r.ok);
        if (falla) return toast(`La contraseña necesita: ${falla.label.toLowerCase()}`, 'e');
        if (passForm.nueva !== passForm.confirmar) return toast('Las contraseñas no coinciden', 'e');
        setCambiando(true);
        try {
            await changePassword({ codigo: passForm.codigo.trim(), nueva: passForm.nueva });
            cerrarPass();
            toast('Contraseña cambiada', 's');
        } catch (err) { toast(err.response?.data?.error || 'Código incorrecto o vencido', 'e'); }
        finally { setCambiando(false); }
    };

    // ── PIN ──
    const guardarPin = async () => {
        if (!/^\d{4}$/.test(pinForm)) return toast('El PIN son exactamente 4 números', 'e');
        setGuardandoPin(true);
        try {
            const { data } = await configurarPin({ pin: pinForm });
            localStorage.setItem('mc_pin_email', user.email);
            onUpdate(data);
            setPinForm(''); setAbrirPin(false);
            toast('PIN guardado. Ya puedes usarlo al entrar.', 's');
        } catch (err) { toast(err.response?.data?.error || 'No se pudo guardar el PIN', 'e'); }
        finally { setGuardandoPin(false); }
    };

    const quitarPin = async () => {
        setGuardandoPin(true);
        try {
            const { data } = await eliminarPin();
            localStorage.removeItem('mc_pin_email');
            onUpdate(data);
            setAbrirPin(false);
            toast('PIN quitado', 'i');
        } catch { toast('No se pudo quitar el PIN', 'e'); }
        finally { setGuardandoPin(false); }
    };

    // ── sesiones ──
    const cerrarUna = async (id) => {
        setCerrandoSesion(id);
        try { await cerrarSesionRemota(id); toast('Sesión cerrada', 'i'); cargarSesiones(); }
        catch { toast('No se pudo cerrar la sesión', 'e'); }
        finally { setCerrandoSesion(''); }
    };

    const cerrarOtras = async () => {
        setCerrandoSesion('todas');
        try {
            const { data } = await cerrarOtrasSesiones();
            toast(data.cerradas ? `Se cerraron ${data.cerradas} sesiones` : 'No había otras sesiones abiertas', 'i');
            cargarSesiones();
        } catch { toast('No se pudieron cerrar las sesiones', 'e'); }
        finally { setCerrandoSesion(''); }
    };

    // Teclado en el menú de secciones
    const alTeclear = (e, i) => {
        const d = ['ArrowDown', 'ArrowRight'].includes(e.key) ? 1 : ['ArrowUp', 'ArrowLeft'].includes(e.key) ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        const sig = SECCIONES[(i + d + SECCIONES.length) % SECCIONES.length];
        setSeccion(sig.id);
        document.getElementById(`pf-t-${sig.id}`)?.focus();
    };

    const otras = (sesiones || []).filter(s => !s.actual).length;
    const inicial = (user.nombre || 'U').charAt(0).toUpperCase();
    const logo = empresaDatos?.logo;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar">
                <div><h1>Mi Perfil</h1><p>Tu cuenta, tu empresa y tu seguridad</p></div>
            </div>
            <div className="content"><div className="pad">
                <div className="pf">

                    <header className="pf-hero">
                        <div className="pf-av" aria-hidden="true">{logo ? <img src={logo} alt="" /> : inicial}</div>
                        <div className="pf-hero-info">
                            <h2>{user.nombre}</h2>
                            <div className="pf-hero-mail">{user.email}</div>
                            <div className="pf-badges">
                                <span className="pf-bd"><Building2 size={12} aria-hidden="true" /> {user.empresa || 'Sin empresa'}</span>
                                <span className="pf-bd oro">{user.rol}</span>
                                {user.hasPin && <span className="pf-bd"><ShieldCheck size={12} aria-hidden="true" /> PIN activo</span>}
                            </div>
                        </div>
                        <div className="pf-stats">
                            <div><b>{conteo.maquinas ?? '–'}</b><span>Máquinas</span></div>
                            <div><b>{conteo.operadores ?? '–'}</b><span>Operadores</span></div>
                        </div>
                    </header>

                    <div className="pf-cuerpo">
                        <div className="pf-menu" role="tablist" aria-label="Secciones del perfil">
                            {SECCIONES.map(({ id, label, Icono }, i) => (
                                <button key={id} id={`pf-t-${id}`} type="button" role="tab" aria-selected={seccion === id} aria-controls={`pf-p-${id}`}
                                    tabIndex={seccion === id ? 0 : -1} className="pf-tab" onClick={() => setSeccion(id)} onKeyDown={e => alTeclear(e, i)}>
                                    <Icono size={16} aria-hidden="true" /> {label}
                                </button>
                            ))}
                        </div>

                        <div className="pf-paneles">

                            {seccion === 'cuenta' && (
                                <div className="pf-panel" id="pf-p-cuenta" role="tabpanel" aria-labelledby="pf-t-cuenta">
                                    <section className="pf-card">
                                        <h3>Datos personales</h3>
                                        <p className="pf-d">Tu nombre aparece en los reportes y en la vista compartida.</p>
                                        <div className="pf-campo">
                                            <label htmlFor="pf-nombre">Nombre *</label>
                                            <input id="pf-nombre" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre completo" autoComplete="name" />
                                        </div>
                                        <div className="pf-campo">
                                            <label htmlFor="pf-correo">Correo</label>
                                            <div className="pf-linea">
                                                <input id="pf-correo" value={user.email} readOnly />
                                                <button type="button" className="pf-btn sec" onClick={() => (abrirEmail ? cerrarEmail() : setAbrirEmail(true))} aria-expanded={abrirEmail}>
                                                    <Mail size={15} aria-hidden="true" /> {abrirEmail ? 'Cancelar' : 'Cambiar correo'}
                                                </button>
                                            </div>
                                        </div>

                                        {abrirEmail && (
                                            <div className="pf-flujo">
                                                <ol className="pf-pasos" aria-label="Pasos para cambiar el correo">
                                                    {['Correo nuevo', 'Confirmar el actual', 'Confirmar el nuevo'].map((t, i) => (
                                                        <li key={t} className={i < pasoEmail ? 'hecho' : i === pasoEmail ? 'ahora' : ''} aria-current={i === pasoEmail ? 'step' : undefined}>
                                                            <span>{i < pasoEmail ? <Check size={12} aria-hidden="true" /> : i + 1}</span>{t}
                                                        </li>
                                                    ))}
                                                </ol>
                                                {pasoEmail === 0 && (<>
                                                    <div className="pf-campo">
                                                        <label htmlFor="pf-nuevo-correo">Correo nuevo</label>
                                                        <input id="pf-nuevo-correo" type="email" value={emailForm.nuevo} onChange={e => setEmailForm({ ...emailForm, nuevo: e.target.value })} placeholder="nuevo@correo.com" autoComplete="email" />
                                                    </div>
                                                    <p className="pf-nota">Primero te enviamos un código a <b>{user.email}</b> para confirmar que eres tú.</p>
                                                    <button type="button" className="pf-btn" onClick={iniciarCambioEmail} disabled={cargandoEmail}>{cargandoEmail ? 'Enviando…' : 'Enviar código'}</button>
                                                </>)}
                                                {pasoEmail === 1 && (<>
                                                    <div className="pf-campo">
                                                        <label htmlFor="pf-cod-viejo">Código enviado a {user.email}</label>
                                                        <input id="pf-cod-viejo" inputMode="numeric" value={emailForm.codigoViejo} onChange={e => setEmailForm({ ...emailForm, codigoViejo: e.target.value })} placeholder="Código de 6 dígitos" autoComplete="one-time-code" />
                                                    </div>
                                                    <div className="pf-linea-btn">
                                                        <button type="button" className="pf-btn" onClick={verificarViejo} disabled={cargandoEmail}>{cargandoEmail ? 'Verificando…' : 'Verificar'}</button>
                                                        <button type="button" className="pf-btn sec" onClick={iniciarCambioEmail} disabled={cargandoEmail || cuentaEmail > 0}>{cuentaEmail > 0 ? `Reenviar en ${cuentaEmail} s` : 'Reenviar código'}</button>
                                                    </div>
                                                </>)}
                                                {pasoEmail === 2 && (<>
                                                    <div className="pf-campo">
                                                        <label htmlFor="pf-cod-nuevo">Código enviado a {emailForm.nuevo}</label>
                                                        <input id="pf-cod-nuevo" inputMode="numeric" value={emailForm.codigoNuevo} onChange={e => setEmailForm({ ...emailForm, codigoNuevo: e.target.value })} placeholder="Código de 6 dígitos" autoComplete="one-time-code" />
                                                    </div>
                                                    <button type="button" className="pf-btn" onClick={confirmarEmail} disabled={cargandoEmail}>{cargandoEmail ? 'Confirmando…' : 'Confirmar cambio'}</button>
                                                </>)}
                                            </div>
                                        )}

                                        <div className="pf-acciones">
                                            <button type="button" className="pf-btn" onClick={() => guardar('personal')} disabled={guardando === 'personal'}>
                                                <Check size={15} aria-hidden="true" /> {guardando === 'personal' ? 'Guardando…' : 'Guardar'}
                                            </button>
                                        </div>
                                    </section>

                                    <section className="pf-card">
                                        <h3>Datos de la empresa</h3>
                                        <p className="pf-d">Salen en el encabezado de los PDF: reportes, actas y comprobantes.</p>
                                        <div className="pf-f2">
                                            <div className="pf-campo"><label htmlFor="pf-empresa">Empresa *</label><input id="pf-empresa" value={emp.empresa} onChange={e => setEmp({ ...emp, empresa: e.target.value })} placeholder="Nombre de tu empresa" autoComplete="organization" /></div>
                                            <div className="pf-campo"><label htmlFor="pf-nit">NIT</label><input id="pf-nit" value={emp.nit} onChange={e => setEmp({ ...emp, nit: e.target.value })} placeholder="900.123.456-7" maxLength={40} /></div>
                                            <div className="pf-campo"><label htmlFor="pf-ciudad">Ciudad</label><input id="pf-ciudad" value={emp.ciudad} onChange={e => setEmp({ ...emp, ciudad: e.target.value })} placeholder="Ciudad" maxLength={80} autoComplete="address-level2" /></div>
                                            <div className="pf-campo"><label htmlFor="pf-tel">Teléfono</label><input id="pf-tel" type="tel" value={emp.telefono} onChange={e => setEmp({ ...emp, telefono: e.target.value })} placeholder="300 123 4567" maxLength={40} autoComplete="tel" /></div>
                                        </div>
                                        <div className="pf-campo"><label htmlFor="pf-dir">Dirección</label><input id="pf-dir" value={emp.direccion} onChange={e => setEmp({ ...emp, direccion: e.target.value })} placeholder="Dirección de la empresa" maxLength={160} autoComplete="street-address" /></div>

                                        <div className="pf-campo">
                                            <label>Logo de la empresa</label>
                                            <div className="pf-logo">
                                                <div className="pf-logo-caja">{logo ? <img src={logo} alt="Logo de la empresa" /> : <ImagePlus size={22} aria-hidden="true" />}</div>
                                                <div className="pf-logo-acc">
                                                    <input ref={archivoLogo} type="file" accept="image/png,image/jpeg" onChange={elegirLogo} hidden />
                                                    <button type="button" className="pf-btn sec" onClick={() => archivoLogo.current?.click()} disabled={subiendoLogo}>
                                                        <ImagePlus size={15} aria-hidden="true" /> {subiendoLogo ? 'Subiendo…' : logo ? 'Cambiar logo' : 'Subir logo'}
                                                    </button>
                                                    {logo && <button type="button" className="pf-btn sec peligro" onClick={quitarLogo} disabled={subiendoLogo}><Trash2 size={15} aria-hidden="true" /> Quitar</button>}
                                                </div>
                                                <p className="pf-nota">PNG o JPG. Se ve en el encabezado de tus PDF junto al de Moventra.</p>
                                            </div>
                                        </div>

                                        <div className="pf-acciones">
                                            <button type="button" className="pf-btn" onClick={() => guardar('empresa')} disabled={guardando === 'empresa'}>
                                                <Check size={15} aria-hidden="true" /> {guardando === 'empresa' ? 'Guardando…' : 'Guardar datos de la empresa'}
                                            </button>
                                        </div>
                                    </section>
                                </div>
                            )}

                            {seccion === 'seguridad' && (
                                <div className="pf-panel" id="pf-p-seguridad" role="tabpanel" aria-labelledby="pf-t-seguridad">
                                    <section className="pf-card">
                                        <h3>Contraseña</h3>
                                        <p className="pf-d">Para cambiarla te enviamos un código a tu correo.</p>
                                        {!abrirPass ? (
                                            <div className="pf-fila">
                                                <div className="pf-fila-t"><b>Contraseña</b><span>Cámbiala cuando quieras</span></div>
                                                <button type="button" className="pf-btn sec" onClick={() => setAbrirPass(true)}><Lock size={15} aria-hidden="true" /> Cambiar contraseña</button>
                                            </div>
                                        ) : (
                                            <div className="pf-flujo">
                                                {!codigoEnviado ? (<>
                                                    <p className="pf-nota">Enviaremos un código a <b>{user.email}</b>.</p>
                                                    <div className="pf-linea-btn">
                                                        <button type="button" className="pf-btn" onClick={pedirCodigo} disabled={enviando}><Mail size={15} aria-hidden="true" /> {enviando ? 'Enviando…' : 'Enviar código'}</button>
                                                        <button type="button" className="pf-btn sec" onClick={cerrarPass}>Cancelar</button>
                                                    </div>
                                                </>) : (<>
                                                    <div className="pf-campo"><label htmlFor="pf-pcod">Código del correo</label>
                                                        <input id="pf-pcod" inputMode="numeric" value={passForm.codigo} onChange={e => setPassForm({ ...passForm, codigo: e.target.value })} placeholder="Código de 6 dígitos" autoComplete="one-time-code" /></div>
                                                    <div className="pf-f2">
                                                        <div className="pf-campo"><label htmlFor="pf-pnueva">Contraseña nueva</label>
                                                            <input id="pf-pnueva" type="password" value={passForm.nueva} onChange={e => setPassForm({ ...passForm, nueva: e.target.value })} autoComplete="new-password" /></div>
                                                        <div className="pf-campo"><label htmlFor="pf-pconf">Repite la contraseña</label>
                                                            <input id="pf-pconf" type="password" value={passForm.confirmar} onChange={e => setPassForm({ ...passForm, confirmar: e.target.value })} autoComplete="new-password" /></div>
                                                    </div>
                                                    <div className="pf-medidor" role="img" aria-label={`Fortaleza: ${fuerza.texto || 'sin escribir'}`}>
                                                        <div className="pf-barra"><i className={`n${fuerza.n}`} style={{ width: `${(fuerza.n / 4) * 100}%` }} /></div>
                                                        <span>{fuerza.texto}</span>
                                                    </div>
                                                    <ul className="pf-reqs">
                                                        {reqs.map(r => <li key={r.label} className={r.ok ? 'ok' : ''}>{r.ok ? <Check size={13} aria-hidden="true" /> : <X size={13} aria-hidden="true" />} {r.label}</li>)}
                                                        {passForm.confirmar && <li className={passForm.nueva === passForm.confirmar ? 'ok' : ''}>{passForm.nueva === passForm.confirmar ? <Check size={13} aria-hidden="true" /> : <X size={13} aria-hidden="true" />} Las dos coinciden</li>}
                                                    </ul>
                                                    <div className="pf-linea-btn">
                                                        <button type="button" className="pf-btn" onClick={cambiarPass} disabled={cambiando || !passOk}>{cambiando ? 'Cambiando…' : 'Cambiar contraseña'}</button>
                                                        <button type="button" className="pf-btn sec" onClick={pedirCodigo} disabled={enviando || cuentaPass > 0}>{cuentaPass > 0 ? `Reenviar en ${cuentaPass} s` : 'Reenviar código'}</button>
                                                        <button type="button" className="pf-btn sec" onClick={cerrarPass}>Cancelar</button>
                                                    </div>
                                                </>)}
                                            </div>
                                        )}
                                    </section>

                                    <section className="pf-card">
                                        <h3>Acceso rápido con PIN</h3>
                                        <p className="pf-d">Entra desde este dispositivo con 4 números.</p>
                                        <div className="pf-fila">
                                            <div className="pf-fila-t"><b>{user.hasPin ? 'PIN activo' : 'Sin PIN'}</b><span>{user.hasPin ? 'Puedes entrar con él desde la pantalla de acceso' : 'Crea uno para entrar más rápido'}</span></div>
                                            <div className="pf-linea-btn">
                                                <button type="button" className="pf-btn sec" onClick={() => setAbrirPin(a => !a)} aria-expanded={abrirPin}><KeyRound size={15} aria-hidden="true" /> {user.hasPin ? 'Cambiar PIN' : 'Crear PIN'}</button>
                                                {user.hasPin && <button type="button" className="pf-btn sec peligro" onClick={quitarPin} disabled={guardandoPin}>Quitar</button>}
                                            </div>
                                        </div>
                                        {abrirPin && (
                                            <div className="pf-flujo">
                                                <div className="pf-campo"><label htmlFor="pf-pin">PIN de 4 números</label>
                                                    <input id="pf-pin" type="password" inputMode="numeric" maxLength={4} value={pinForm} onChange={e => setPinForm(e.target.value.replace(/\D/g, ''))} placeholder="••••" autoComplete="off" style={{ maxWidth: 160, letterSpacing: '.4em', textAlign: 'center' }} /></div>
                                                <button type="button" className="pf-btn" onClick={guardarPin} disabled={guardandoPin || pinForm.length !== 4}>{guardandoPin ? 'Guardando…' : 'Guardar PIN'}</button>
                                            </div>
                                        )}
                                    </section>

                                    <section className="pf-card">
                                        <h3>Sesiones activas</h3>
                                        <p className="pf-d">Dónde está abierta tu cuenta ahora.</p>
                                        {sesiones === null ? <p className="pf-nota">Cargando…</p> : sesiones.length === 0 ? (
                                            <p className="pf-nota">No hay otras sesiones para mostrar. Si entraste hace poco, aparecerá aquí.</p>
                                        ) : (
                                            <ul className="pf-sesiones">
                                                {sesiones.map(s => (
                                                    <li key={s.id}>
                                                        <span className="pf-ico" aria-hidden="true">{/android|iphone/i.test(s.dispositivo || '') ? <Smartphone size={18} /> : <Monitor size={18} />}</span>
                                                        <div className="pf-fila-t">
                                                            <b>{s.dispositivo || 'Dispositivo'}</b>
                                                            <span className={s.actual ? 'actual' : ''}>{s.actual ? 'Este dispositivo' : hace(s.ultimaActividad)}</span>
                                                        </div>
                                                        {!s.actual && <button type="button" className="pf-btn sec" onClick={() => cerrarUna(s.id)} disabled={!!cerrandoSesion}>{cerrandoSesion === s.id ? 'Cerrando…' : 'Cerrar'}</button>}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        {otras > 0 && (
                                            <div className="pf-acciones">
                                                <button type="button" className="pf-btn sec peligro" onClick={cerrarOtras} disabled={!!cerrandoSesion}>{cerrandoSesion === 'todas' ? 'Cerrando…' : 'Cerrar todas las demás sesiones'}</button>
                                            </div>
                                        )}
                                    </section>
                                </div>
                            )}

                            {seccion === 'preferencias' && (
                                <div className="pf-panel" id="pf-p-preferencias" role="tabpanel" aria-labelledby="pf-t-preferencias">
                                    <section className="pf-card">
                                        <h3>Apariencia</h3>
                                        <p className="pf-d">Automático sigue el modo de tu celular o computador.</p>
                                        <div className="pf-seg" role="group" aria-label="Tema de la app">
                                            {[['claro', 'Claro', Sun], ['oscuro', 'Oscuro', Moon], ['auto', 'Automático', Monitor]].map(([k, l, I]) => (
                                                <button key={k} type="button" aria-pressed={tema === k} onClick={() => setTema(k)}><I size={15} aria-hidden="true" /> {l}</button>
                                            ))}
                                        </div>
                                    </section>
                                </div>
                            )}

                            {seccion === 'ayuda' && (
                                <div className="pf-panel" id="pf-p-ayuda" role="tabpanel" aria-labelledby="pf-t-ayuda">
                                    <section className="pf-card">
                                        <h3>Aprende Moventra</h3>
                                        <p className="pf-d">Recorre todos los módulos con una guía paso a paso.</p>
                                        <div className="pf-fila">
                                            <div className="pf-fila-t"><b>Tour guiado</b><span>Dura menos de un minuto</span></div>
                                            <button type="button" className="pf-btn" onClick={onIniciarTour}><PlayCircle size={15} aria-hidden="true" /> Iniciar tour</button>
                                        </div>
                                    </section>
                                    <section className="pf-card">
                                        <h3>Sesión</h3>
                                        <p className="pf-d">Sales de este dispositivo. Tu información queda guardada.</p>
                                        <div className="pf-fila">
                                            <div className="pf-fila-t"><b>Cerrar sesión</b><span>{user.email}</span></div>
                                            <button type="button" className="pf-btn sec peligro" onClick={onLogout}><LogOut size={15} aria-hidden="true" /> Cerrar sesión</button>
                                        </div>
                                    </section>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </div></div>
        </div>
    );
}

export default Perfil;
