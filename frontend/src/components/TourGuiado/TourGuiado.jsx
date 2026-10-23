import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, CheckCircle, BarChart2, DollarSign, Users, Wrench, Fuel, ClipboardList, MapPin, Settings, Briefcase, Sparkles, Check } from 'lucide-react';
import { GiBulldozer } from 'react-icons/gi';
import { moduloVisible } from '../../utils/modulosOcultos';
import './TourGuiado.css';

// Cada paso explica un módulo con lo que de verdad se puede hacer ahí. Si el módulo tiene un botón en el menú
// (data-modulo), se resalta mientras se explica.
const TODOS_LOS_PASOS = [
    {
        modulo: null, titulo: 'Bienvenido a Moventra', Icono: Sparkles,
        desc: 'Finanzas y control de tu maquinaria pesada. En menos de un minuto te muestro dónde está cada cosa.',
        puntos: ['Puedes moverte con las flechas del teclado o con los botones.', 'Si quieres repetirlo después, lo encuentras en tu Perfil.'],
    },
    {
        modulo: 'dashboard', titulo: 'Dashboard', Icono: BarChart2,
        desc: 'Tu resumen del día: cómo va el negocio de un vistazo.',
        puntos: [
            'Ingresos, egresos y utilidad del periodo que elijas (este mes, este año o todo).',
            '"En campo ahora" y "Requiere atención": lo que necesita una decisión tuya.',
            'En la barra de arriba escribe lo que pasó, como "le metí 8 horas a la retro", y Moventra lo registra.',
        ],
    },
    {
        modulo: 'maquinaria', titulo: 'Maquinaria', Icono: GiBulldozer,
        desc: 'Cada máquina tiene su ficha completa.',
        puntos: [
            'El calendario muestra las horas de cada día. Toca un día para llenar el parte diario: horómetro inicial y final, y cómo operó (trabajo, lluvia, mantenimiento o descanso).',
            'Pronóstico a fin de mes y tu meta de horas.',
            'Pestañas de Trabajo, Ingresos, Gastos, Periodo, Pagos de clientes e Historia.',
        ],
    },
    {
        modulo: 'finanzas', titulo: 'Finanzas', Icono: DollarSign,
        desc: 'Todo el dinero de tu flota en un solo lugar.',
        puntos: [
            'Ingresos, egresos, salarios y pagos, con filtros por máquina y por fechas.',
            'Registra un gasto con proveedor y factura, y adjunta el PDF. También puedes leer la factura con IA.',
        ],
    },
    {
        modulo: 'faenas', titulo: 'Periodos', Icono: Briefcase,
        desc: 'Un periodo reúne el trabajo de una máquina en una obra.',
        puntos: [
            'Dentro van los cortes: lo cobrado, lo que falta por cobrar y el corte en curso.',
            'Cada corte tiene su Acta (reporte) y su Acta de horas, listas para el cliente.',
            'Al terminar la obra, cierras el periodo y queda archivado con su resumen.',
        ],
    },
    {
        modulo: 'operadores', titulo: 'Operadores', Icono: Users,
        desc: 'Tu personal, lo que ha ganado y lo que le debes.',
        puntos: [
            'Paga desde la lista o desde su ficha: monto, método y referencia. Cada pago queda también en Gastos.',
            'Imprime su certificado o su comprobante.',
            'Vincula su Telegram para que reporte las horas desde el celular.',
        ],
    },
    {
        modulo: 'mantenimientos', titulo: 'Mantenimientos', Icono: Wrench,
        desc: 'Programa y registra los mantenimientos preventivos y correctivos.',
        puntos: ['Cada uno queda con su fecha, su costo y su estado, y el costo cuenta en los gastos de la máquina.'],
    },
    {
        modulo: 'combustible', titulo: 'Combustible', Icono: Fuel,
        desc: 'Cada carga de combustible por máquina.',
        puntos: ['Galones, valor, fecha y acumulado. La carga se suma sola a los gastos.'],
    },
    {
        modulo: 'reportes', titulo: 'Reportes', Icono: ClipboardList,
        desc: 'Elige un reporte, ajusta lo que necesitas y descárgalo.',
        puntos: [
            'Mensual, por máquina, por periodo, ingresos, gastos y por corte.',
            'En PDF o en Excel, con el logo y la marca de agua de Moventra.',
        ],
    },
    {
        modulo: 'mapa', titulo: 'Mapa', Icono: MapPin,
        desc: 'Dónde está cada máquina.',
        puntos: ['Actualiza la ubicación con el GPS de tu celular con un solo toque.'],
    },
    {
        modulo: 'perfil', titulo: 'Tu perfil y seguridad', Icono: Settings,
        desc: 'Tu cuenta, tu contraseña y el acceso rápido.',
        puntos: [
            'Cambia tu contraseña y activa el PIN de acceso rápido.',
            'Instala Moventra como app en tu celular o computador.',
            'Aquí también puedes volver a ver este tour cuando quieras.',
        ],
    },
];

// El recorrido no pasa por los módulos que estén ocultos
const PASOS = TODOS_LOS_PASOS.filter(p => !p.modulo || moduloVisible(p.modulo));

// pasos: lista propia (mini-tours); clave: dónde se recuerda que ya se vio; titulo: texto de la cabecera
export default function TourGuiado({ onCerrar, onIrModulo, pasos, clave = 'mc_tour_done', titulo = 'Tour de' }) {
    const lista = pasos || PASOS;
    const [paso, setPaso] = useState(0);
    const [marco, setMarco] = useState(null); // dónde está el botón del menú que se explica
    const botonSiguiente = useRef(null);
    const actual = lista[paso];
    const esUltimo = paso === lista.length - 1;
    const Icono = actual.Icono || Sparkles;

    const terminar = useCallback(() => {
        try { localStorage.setItem(clave, '1'); } catch (e) { /* sin almacenamiento */ }
        onCerrar();
    }, [onCerrar, clave]);

    const irA = useCallback((n) => {
        if (n < 0 || n >= lista.length) return;
        setPaso(n);
        if (lista[n].modulo && onIrModulo) onIrModulo(lista[n].modulo);
    }, [onIrModulo, lista]);

    const siguiente = () => (esUltimo ? terminar() : irA(paso + 1));
    const anterior = () => irA(paso - 1);

    // Teclado: flechas para moverse y Escape para salir
    useEffect(() => {
        const alTeclear = (e) => {
            if (e.key === 'ArrowRight') { e.preventDefault(); siguiente(); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); anterior(); }
            else if (e.key === 'Escape') terminar();
        };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    }); // se vuelve a registrar en cada paso para ver el paso actual

    // El foco va al botón principal en cada paso
    useEffect(() => { botonSiguiente.current?.focus({ preventScroll: true }); }, [paso]);

    // Resalta el botón del menú del módulo que se explica (si está a la vista)
    useEffect(() => {
        const buscar = () => actual.selector
            ? document.querySelector(actual.selector)
            : actual.modulo ? document.querySelector(`[data-modulo="${actual.modulo}"]`) : null;
        const medir = () => {
            const el = buscar();
            if (!el) return setMarco(null);
            const r = el.getBoundingClientRect();
            const visible = r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= window.innerWidth && r.bottom > 0 && r.top < window.innerHeight;
            setMarco(visible ? { top: r.top - 4, left: r.left - 4, width: r.width + 8, height: r.height + 8 } : null);
        };
        // Un elemento de la pantalla se acerca a la vista antes de resaltarlo (en el celular, arriba para que no lo tape la tarjeta)
        const t = setTimeout(() => {
            const el = actual.selector ? buscar() : null;
            if (el) el.scrollIntoView({ block: window.innerWidth <= 640 ? 'start' : 'center', behavior: 'smooth' });
            medir();
        }, 160); // el módulo nuevo se está abriendo
        const t2 = setTimeout(medir, 600); // y otra vez cuando termina de desplazarse
        window.addEventListener('resize', medir);
        window.addEventListener('scroll', medir, true);
        return () => { clearTimeout(t); clearTimeout(t2); window.removeEventListener('resize', medir); window.removeEventListener('scroll', medir, true); };
    }, [actual]);

    return (
        <>
            <div className="tg-velo" aria-hidden="true" />
            {marco && <div className="tg-marco" style={marco} aria-hidden="true" />}

            <div className="tg-card" role="dialog" aria-modal="false" aria-labelledby="tg-titulo">
                <header className="tg-cab">
                    <img src={`${process.env.PUBLIC_URL}/logo-moventra-claro.png`} alt="" />
                    <span>{titulo} <b>Moventra</b></span>
                    <button type="button" className="tg-x" onClick={terminar} aria-label="Cerrar el tour"><X size={16} /></button>
                </header>

                <nav className="tg-pasos" aria-label="Pasos del tour">
                    {lista.map((p, i) => (
                        <button key={i} type="button" className={i <= paso ? 'on' : ''} aria-label={`Paso ${i + 1}: ${p.titulo}`} aria-current={i === paso ? 'step' : undefined} onClick={() => irA(i)} />
                    ))}
                </nav>

                <div className="tg-cuerpo">
                    <span className="tg-ico" aria-hidden="true"><Icono size={24} /></span>
                    <h3 id="tg-titulo">{actual.titulo}</h3>
                    <p>{actual.desc}</p>
                    {actual.puntos && <ul>
                        {(actual.puntos || []).map((t, i) => <li key={i}><Check size={14} aria-hidden="true" /><span>{t}</span></li>)}
                    </ul>}
                    <div className="tg-n">Paso {paso + 1} de {lista.length}</div>
                </div>

                <footer className="tg-pie">
                    {paso > 0 && <button type="button" className="tg-sec" onClick={anterior}><ChevronLeft size={15} aria-hidden="true" /> Anterior</button>}
                    <button type="button" className="tg-pri" ref={botonSiguiente} onClick={siguiente}>
                        {esUltimo ? <><CheckCircle size={15} aria-hidden="true" /> Finalizar tour</> : <>Siguiente <ChevronRight size={15} aria-hidden="true" /></>}
                    </button>
                </footer>
                {!esUltimo && lista.length > 1 && <button type="button" className="tg-saltar" onClick={terminar}>Saltar tour</button>}
            </div>
        </>
    );
}

// Guías cortas dentro de cada pantalla: señalan elementos concretos (data-tour) la primera vez que se entra
export const MINI_TOURS = {
    dashboard: [
        { selector: '[data-tour="registro-rapido"]', titulo: 'Registra sin salir del inicio', desc: 'Escribe lo que pasó, por ejemplo "8 horas con la retro", y Moventra lo anota por ti.' },
        { selector: '.db-filtros', titulo: 'Cambia el periodo', desc: 'Todas las cifras de esta pantalla siguen el filtro: este mes, este año, todo o fechas a tu medida.' },
    ],
    maquinaria: [
        { selector: '[data-tour="calendario"]', titulo: 'Tu calendario de trabajo', desc: 'Cada día muestra las horas trabajadas. Toca un día para llenar el parte diario: horómetro inicial y final, y cómo operó la máquina.' },
    ],
    faenas: [
        { selector: '[data-tour="acta-horas"]', titulo: 'Acta de horas', desc: 'Cada día del corte con sus horas y el horómetro de inicio y fin, lista para el cliente.' },
        { selector: '[data-tour="acta"]', titulo: 'Acta del corte', desc: 'El reporte con ingresos y gastos del corte, en PDF con el logo de Moventra.' },
    ],
};

// Recorrido del operador: su portal es distinto al de quien administra
export const TOUR_OPERADOR = [
    { titulo: 'Bienvenido a Moventra', Icono: Sparkles, desc: 'Aquí reportas tu trabajo y el estado de tu máquina.', puntos: ['Puedes moverte con las flechas del teclado o con los botones.'] },
    { selector: '[data-tour="op-jornada"]', titulo: 'Mi jornada', Icono: ClipboardList, desc: 'Tus horas y tu trabajo del día.' },
    { selector: '[data-tour="op-maquina"]', titulo: 'Mi máquina', Icono: Wrench, desc: 'Estado, mantenimientos y ubicación de la máquina que operas. Actualiza la ubicación con tu GPS.' },
    { selector: '[data-tour="op-novedades"]', titulo: 'Novedades', Icono: Settings, desc: 'Avisa de un daño o una falla y mira las respuestas que recibes.' },
];
