import { X, Printer, Award } from 'lucide-react';
import { fmtFecha } from '../../utils/fmtFecha';
import { LOGO_GRANDE } from '../../utils/logoMoventra';
import { empresaActual, lineaEmpresa } from '../../utils/empresa';

const fmt = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('es-CO');
const horas = (n) => String(Math.round((Number(n) || 0) * 10) / 10).replace('.', ',') + ' h';
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function empresaYFirma() {
    try {
        const u = JSON.parse(localStorage.getItem('mc_auth_user') || '{}');
        return { firma: u.nombre || 'Gerencia de Operaciones', empresa: u.empresa || 'Moventra' };
    } catch { return { firma: 'Gerencia de Operaciones', empresa: 'Moventra' }; }
}

// Constancia del operador con las horas y los pagos del periodo en curso, lista para imprimir
export default function CertificadoOperadorModal({ operador, desde, saldo, onCerrar }) {
    const { firma, empresa } = empresaYFirma();
    const hoy = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
    const ref = `CERT-OP-${new Date().getFullYear()}-${String(operador.id).padStart(3, '0')}`;
    const pagado = operador.anticipos || 0;
    const filas = [
        ['Horas certificadas del periodo', horas(operador.horasPeriodo)],
        ['Tarifa pactada por hora', `${fmt(operador.valorHora)}/h`],
        ['Valor bruto devengado', fmt(operador.salarioBruto)],
        ['Pagado a la fecha', fmt(pagado)],
    ];
    const maqTexto = operador.maq ? `${operador.maq.nombre}${operador.maq.placa ? ` (${operador.maq.tipo || 'Máquina'} · placa ${operador.maq.placa})` : ''}` : 'sin máquina asignada';

    const imprimir = () => {
        const w = window.open('', '_blank');
        if (!w) return;
        const lineas = filas.map(([k, v]) => `<tr><td>${esc(k)}</td><td style="text-align:right"><b>${esc(v)}</b></td></tr>`).join('');
        w.document.write(`<html><head><title>${esc(ref)}</title><style>.marca{position:fixed;top:50%;left:50%;width:60%;transform:translate(-50%,-50%);opacity:.08;z-index:-1}body{font-family:Arial,sans-serif;color:#111;padding:48px;max-width:760px;margin:auto}h1{font-size:22px;margin:0}small{color:#666}table{width:100%;border-collapse:collapse;margin:22px 0}td{padding:9px 6px;border-bottom:1px solid #ddd;font-size:14px}.firmas{display:flex;gap:60px;margin-top:80px;text-align:center}.firmas div{flex:1;border-top:1px solid #444;padding-top:8px;font-size:13px}</style></head><body>
<img class="marca" src="${LOGO_GRANDE}" alt="">
<div style="display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:12px"><div style="display:flex;gap:12px;align-items:center">${empresaActual()?.logo ? `<img src="${empresaActual().logo}" alt="" style="max-height:48px;max-width:120px;object-fit:contain">` : ''}<div><h1>${esc(empresa.toUpperCase())}</h1>${lineaEmpresa(empresaActual(), 120) ? `<small>${esc(lineaEmpresa(empresaActual(), 120))}</small><br>` : ''}<small>Constancia de operación y estado de cuenta del operador</small></div></div><div style="text-align:right;font-size:12px"><div>Fecha: ${esc(hoy)}</div><div>Ref: ${esc(ref)}</div></div></div>
<p style="margin-top:24px;line-height:1.6;font-size:14px">Por medio de la presente se certifica que <b>${esc(operador.nombre.toUpperCase())}</b>${operador.cedula ? `, identificado con cédula de ciudadanía <b>${esc(operador.cedula)}</b>,` : ''} se desempeña como <b>operador de maquinaria pesada</b> asignado al equipo <b>${esc(maqTexto)}</b>${desde ? ` desde el <b>${esc(fmtFecha(desde))}</b>` : ''}.</p>
<table>${lineas}<tr><td><b>Saldo pendiente de liquidación</b></td><td style="text-align:right"><b>${esc(fmt(saldo))}</b></td></tr></table>
<div class="firmas"><div><b>${esc(operador.nombre.toUpperCase())}</b><br>${operador.cedula ? `C.C. ${esc(operador.cedula)}` : 'Operador'}</div><div><b>${esc(firma)}</b><br>${esc(empresa)}</div></div></body></html>`);
        w.document.close(); w.focus(); w.print();
    };

    return (
        <div className="opm-fondo" onMouseDown={e => { if (e.target === e.currentTarget) onCerrar(); }}>
            <div className="opm-modal ancho" role="dialog" aria-modal="true" aria-labelledby="opm-cert-t">
                <header className="opm-cab">
                    <span className="opm-ico" aria-hidden="true"><Award size={20} /></span>
                    <div>
                        <h3 id="opm-cert-t">Certificado de operación</h3>
                        <p>Constancia con las horas y los pagos del periodo en curso</p>
                    </div>
                    <button type="button" className="opm-x" aria-label="Cerrar" onClick={onCerrar}><X size={18} /></button>
                </header>

                <div className="opm-cuerpo opm-cert">
                    <div className="opm-cert-cab">
                        <div><b>{empresa.toUpperCase()}</b><small>Control operativo de equipos pesados</small></div>
                        <div className="der"><span>Fecha: {hoy}</span><span>Ref: {ref}</span></div>
                    </div>
                    <p>
                        Se certifica que <b>{operador.nombre.toUpperCase()}</b>{operador.cedula ? <>, cédula <b className="mono">{operador.cedula}</b>,</> : null} se desempeña como <b>operador de maquinaria pesada</b> asignado al equipo <b>{maqTexto}</b>{desde ? <> desde el <b>{fmtFecha(desde)}</b></> : null}.
                    </p>
                    <div className="opm-cert-tabla">
                        {filas.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}
                        <div className="tot"><span>Saldo pendiente de liquidación</span><b>{fmt(saldo)}</b></div>
                    </div>
                    <div className="opm-cert-firmas">
                        <div><b>{operador.nombre.toUpperCase()}</b><small>{operador.cedula ? `C.C. ${operador.cedula}` : 'Operador'}</small></div>
                        <div><b>{firma}</b><small>{empresa}</small></div>
                    </div>
                </div>

                <footer className="opm-pie">
                    <button type="button" className="opm-cancelar" onClick={onCerrar}>Cerrar</button>
                    <button type="button" className="opm-guardar" onClick={imprimir}><Printer size={16} aria-hidden="true" /> Imprimir certificado</button>
                </footer>
            </div>
        </div>
    );
}
