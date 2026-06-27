import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, CheckCircle, BarChart2, DollarSign, Users, Wrench, Fuel, ClipboardList, MapPin, Settings } from 'lucide-react';
import { GiBulldozer } from 'react-icons/gi';

const PASOS = [
    {
        modulo: 'dashboard',
        titulo: 'Dashboard',
        Icono: BarChart2,
        desc: 'Vista general de tu flota: máquinas activas, gastos del mes, ingresos y utilidad neta de un vistazo rápido.',
    },
    {
        modulo: 'maquinaria',
        titulo: 'Maquinaria',
        Icono: GiBulldozer,
        desc: 'Registra y gestiona tus máquinas. Agrega gastos, ingresos por obra, combustible, horas trabajadas y adjunta facturas PDF.',
    },
    {
        modulo: 'finanzas',
        titulo: 'Finanzas',
        Icono: DollarSign,
        desc: 'Controla todos los gastos e ingresos de tu flota. Filtra por máquina, categoría o rango de fechas.',
    },
    {
        modulo: 'operadores',
        titulo: 'Operadores',
        Icono: Users,
        desc: 'Gestiona operadores, registra sus horas trabajadas, salarios y periodos. Los operadores también pueden reportar horas por WhatsApp.',
    },
    {
        modulo: 'mantenimientos',
        titulo: 'Mantenimientos',
        Icono: Wrench,
        desc: 'Programa y registra mantenimientos preventivos y correctivos. El sistema muestra alertas cuando se acerca el próximo servicio.',
    },
    {
        modulo: 'combustible',
        titulo: 'Combustible',
        Icono: Fuel,
        desc: 'Lleva el control de cada carga de combustible por máquina: galones, valor, fecha y acumulado total.',
    },
    {
        modulo: 'reportes',
        titulo: 'Reportes',
        Icono: ClipboardList,
        desc: 'Genera reportes en PDF o Excel de gastos, ingresos, horas y rentabilidad por máquina o por periodo de tiempo.',
    },
    {
        modulo: 'mapa',
        titulo: 'Mapa',
        Icono: MapPin,
        desc: 'Ve dónde está cada máquina en tiempo real. Actualiza la ubicación con el GPS de tu celular con un solo toque.',
    },
    {
        modulo: 'perfil',
        titulo: 'Perfil y seguridad',
        Icono: Settings,
        desc: 'Configura tu cuenta, cambia contraseña con política de seguridad, activa el PIN de acceso rápido y personaliza los requisitos.',
    },
];

export default function TourGuiado({ onCerrar, onIrModulo }) {
    const [paso, setPaso] = useState(0);
    const actual = PASOS[paso];
    const esUltimo = paso === PASOS.length - 1;
    const ModuloIcono = actual.Icono;

    const siguiente = () => {
        if (esUltimo) { terminar(); return; }
        const sig = paso + 1;
        setPaso(sig);
        onIrModulo(PASOS[sig].modulo);
    };

    const anterior = () => {
        if (paso === 0) return;
        const ant = paso - 1;
        setPaso(ant);
        onIrModulo(PASOS[ant].modulo);
    };

    const terminar = () => {
        localStorage.setItem('mc_tour_done', '1');
        onCerrar();
    };

    return (
        <>
            {/* Fondo semitransparente */}
            <div style={{
                position: 'fixed', inset: 0, background: 'rgba(10,20,35,0.45)',
                zIndex: 9000, pointerEvents: 'none',
            }} />

            {/* Tarjeta del tour */}
            <div style={{
                position: 'fixed', bottom: '28px', right: '28px', zIndex: 9001,
                width: '320px', background: '#fff', borderRadius: '16px',
                boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
                fontFamily: 'Inter, sans-serif', overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{ background: '#1a2d42', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <GiBulldozer size={18} color="#f5a623" />
                        <span style={{ color: '#fff', fontWeight: '700', fontSize: '14px' }}>
                            Tour de <span style={{ color: '#f5a623' }}>MaquiControl</span>
                        </span>
                    </div>
                    <button onClick={terminar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa5b4', display: 'flex' }}>
                        <X size={16} />
                    </button>
                </div>

                {/* Indicador de pasos */}
                <div style={{ display: 'flex', gap: '4px', padding: '12px 18px 0' }}>
                    {PASOS.map((_, i) => (
                        <div key={i} style={{
                            flex: 1, height: '3px', borderRadius: '2px',
                            background: i <= paso ? '#f5a623' : '#e2e8f0',
                            transition: 'background .3s',
                        }} />
                    ))}
                </div>

                {/* Contenido */}
                <div style={{ padding: '16px 18px 20px' }}>
                    <div style={{ marginBottom: '8px' }}><ModuloIcono size={32} color="#1a2d42" /></div>
                    <div style={{ fontWeight: '700', fontSize: '16px', color: '#1a2d42', marginBottom: '6px' }}>
                        {actual.titulo}
                    </div>
                    <p style={{ fontSize: '13px', color: '#6b7a8d', lineHeight: '1.55', margin: 0 }}>
                        {actual.desc}
                    </p>

                    <div style={{ fontSize: '11px', color: '#9aa5b4', marginTop: '12px' }}>
                        Paso {paso + 1} de {PASOS.length}
                    </div>
                </div>

                {/* Botones */}
                <div style={{ display: 'flex', gap: '8px', padding: '0 18px 18px' }}>
                    {paso > 0 && (
                        <button onClick={anterior} className="bs" style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1 }}>
                            <ChevronLeft size={14} /> Anterior
                        </button>
                    )}
                    <button onClick={siguiente} className="bp" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', flex: 2 }}>
                        {esUltimo
                            ? <><CheckCircle size={14} /> Finalizar tour</>
                            : <>Siguiente <ChevronRight size={14} /></>
                        }
                    </button>
                </div>

                {/* Saltar */}
                {!esUltimo && (
                    <div style={{ textAlign: 'center', paddingBottom: '14px' }}>
                        <button onClick={terminar} style={{ background: 'none', border: 'none', color: '#9aa5b4', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
                            Saltar tour
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
