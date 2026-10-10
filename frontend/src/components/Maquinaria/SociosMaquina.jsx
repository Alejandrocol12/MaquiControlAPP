import { useState, useEffect, useMemo, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Users, Plus, Trash2, Download, Check } from 'lucide-react';
import { getFaenas, getCortes, getIngresos, getGastos, getPagos, guardarSociosMaquina } from '../../api';
import { useToast } from '../../utils/toast';
import { useConfirm } from '../../utils/ConfirmModal';
import MoneyInput from '../../utils/MoneyInput';
import { fmtFecha } from '../../utils/fmtFecha';
import { fmtHoras } from '../../utils/cortes';
import { leerSocios, sumaPct, armarTramos, repartirTramo, cuentaSocios } from '../../utils/socios';
import './Socios.css';

const fmt = (v) => (Number(v) < -0.5 ? '−' : '') + '$' + Math.round(Math.abs(Number(v) || 0)).toLocaleString('es-CO');
const COL = ['#2471a3', '#8e44ad', '#1c8a4b', '#d9731a', '#5c7086'];
const pctTxt = (n) => String(Math.round((Number(n) || 0) * 100) / 100).replace('.', ',') + '%';
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Socios de una máquina: a cada uno su porcentaje. Cada corte se reparte entre ellos
// (ingresos − gastos) y la cuenta muestra quién le debe plata a quién.
function SociosMaquina({ maq, onGuardado }) {
    const toast = useToast();
    const { confirm, ConfirmUI } = useConfirm();
    const [faenas, setFaenas] = useState([]);
    const [cortes, setCortes] = useState([]);
    const [ingresos, setIngresos] = useState([]);
    const [gastos, setGastos] = useState([]);
    const [pagos, setPagos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const cfg = useMemo(() => leerSocios(maq.sociosJson), [maq.sociosJson]);
    const configurado = cfg.socios.length >= 2;
    const [vista, setVista] = useState('rep');
    const [editando, setEditando] = useState(false);
    const [borrador, setBorrador] = useState([]);
    const [errConf, setErrConf] = useState('');
    const [clave, setClave] = useState('');
    const [entrega, setEntrega] = useState(null);
    const [guardando, setGuardando] = useState(false);

    const cargar = useCallback(async () => {
        try {
            const [f, c, i, g, p] = await Promise.all([getFaenas(), getCortes(), getIngresos(), getGastos(), getPagos()]);
            const fm = (f.data || []).filter(x => x.maquinaNombre === maq.nombre);
            const ids = new Set(fm.map(x => String(x.id)));
            setFaenas(fm);
            setCortes((c.data || []).filter(x => ids.has(String(x.faenaId))));
            setIngresos((i.data || []).filter(x => x.maquinaNombre === maq.nombre));
            setGastos((g.data || []).filter(x => x.maquinaNombre === maq.nombre));
            setPagos((p.data || []).filter(x => x.maquinaNombre === maq.nombre));
        } catch (e) { console.error(e); }
        setCargando(false);
    }, [maq.nombre]);
    useEffect(() => { cargar(); }, [cargar]);

    const cronologico = useMemo(() => armarTramos(faenas, cortes, ingresos, gastos), [faenas, cortes, ingresos, gastos]);
    const tramos = useMemo(() => [...cronologico].reverse(), [cronologico]);
    const cobrado = pagos.reduce((a, p) => a + (Number(p.valorPagado) || 0), 0);
    const cuenta = useMemo(() => configurado ? cuentaSocios(cronologico, cfg, cobrado) : null, [cronologico, cfg, cobrado, configurado]);
    const tramo = tramos.find(t => t.clave === clave) || tramos[0];
    const rep = tramo && configurado ? repartirTramo(tramo, cfg) : null;

    const guardar = async (nuevo, msg) => {
        setGuardando(true);
        try {
            const json = JSON.stringify(nuevo);
            const r = await guardarSociosMaquina(maq.id, json);
            onGuardado?.({ ...maq, sociosJson: r.data?.sociosJson ?? json });
            if (msg) toast(msg);
            return true;
        } catch { toast('No se pudo guardar. Intenta de nuevo.', 'e'); return false; }
        finally { setGuardando(false); }
    };

    const abrirConfig = () => {
        setBorrador(configurado ? cfg.socios.map(s => ({ ...s })) : [{ n: '', pct: 50 }, { n: maq.operadorNombre || '', pct: 50 }]);
        setErrConf(''); setEditando(true);
    };
    const guardarConfig = async () => {
        if (borrador.some(s => !String(s.n).trim())) { setErrConf('Escribe el nombre de cada socio.'); return; }
        if (Math.abs(sumaPct(borrador) - 100) > 0.01) { setErrConf(`Los porcentajes suman ${pctTxt(sumaPct(borrador))}. Tienen que sumar 100%.`); return; }
        const socios = borrador.map(s => ({ n: String(s.n).trim(), pct: Number(s.pct) || 0 }));
        // Si cambió la cantidad de socios, lo que dependía de la posición ya no vale
        const igual = configurado && socios.length === cfg.socios.length;
        const ok = await guardar({ socios, recibe: igual ? cfg.recibe : 0, entregas: igual ? cfg.entregas : [], pagoGasto: igual ? cfg.pagoGasto : {} }, 'Socios guardados');
        if (ok) setEditando(false);
    };
    const cambiarRecibe = (i) => guardar({ ...cfg, recibe: i }, 'Listo');
    const pagoGasto = (id, v) => {
        const pg = { ...cfg.pagoGasto };
        if (v === 'caja') delete pg[id]; else pg[id] = Number(v);
        guardar({ ...cfg, pagoGasto: pg });
    };
    const guardarEntrega = async () => {
        const v = Number(entrega.v) || 0;
        if (entrega.de === entrega.a || v <= 0) { toast('Escribe un monto y dos socios distintos', 'e'); return; }
        const ok = await guardar({ ...cfg, entregas: [...cfg.entregas, { id: Date.now(), de: entrega.de, a: entrega.a, v, f: hoyISO() }] }, 'Entrega registrada');
        if (ok) setEntrega(null);
    };
    const borrarEntrega = async (e) => {
        if (!await confirm('¿Borrar esta entrega? La cuenta vuelve a contarla como pendiente.')) return;
        guardar({ ...cfg, entregas: cfg.entregas.filter(x => x.id !== e.id) }, 'Entrega borrada');
    };

    const nom = (i) => cfg.socios[i]?.n || '—';

    const pdf = () => {
        const doc = new jsPDF();
        const AZUL = [13, 27, 42];
        doc.setFontSize(15); doc.setFont('helvetica', 'bold'); doc.setTextColor(...AZUL);
        doc.text(`Rendición de cuentas a socios · ${maq.nombre}`, 14, 16);
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(90);
        doc.text(`Generado el ${fmtFecha(hoyISO())} · ${cfg.socios.map(s => `${s.n} ${pctTxt(s.pct)}`).join(' · ')}`, 14, 22);
        let y = 28;
        cronologico.forEach(t => {
            const r = repartirTramo(t, cfg);
            if (y > 235) { doc.addPage(); y = 16; }
            doc.setFontSize(10.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...AZUL);
            doc.text(`${t.faena} · ${t.nombre} (${t.desde ? fmtFecha(t.desde) : 'inicio'} a ${t.hasta ? fmtFecha(t.hasta) : 'hoy'})`, 14, y);
            autoTable(doc, {
                startY: y + 2, theme: 'plain', styles: { fontSize: 8.5, cellPadding: 1.2 }, margin: { left: 14, right: 14 },
                body: [['Ingresos', fmt(t.ingresos)], ['− Gastos', fmt(t.gastosTotal)], ['= Utilidad a repartir', fmt(r.util)]],
                columnStyles: { 1: { halign: 'right' } }, didParseCell: d => { if (d.row.index === 2) d.cell.styles.fontStyle = 'bold'; },
            });
            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 1, theme: 'grid', styles: { fontSize: 8 }, headStyles: { fillColor: [245, 166, 35], textColor: AZUL }, margin: { left: 14, right: 14 },
                head: [['Socio', '%', 'Su parte', '+ Gastos que pagó', 'Le corresponde']],
                body: r.filas.map(f => [f.s.n, pctTxt(f.s.pct), fmt(f.parte), f.reem ? fmt(f.reem) : '—', fmt(f.corr)]),
                columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
            });
            y = doc.lastAutoTable.finalY + 8;
        });
        if (y > 200) { doc.addPage(); y = 16; }
        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...AZUL);
        doc.text('Cuenta entre socios (todos los cortes)', 14, y);
        autoTable(doc, {
            startY: y + 2, theme: 'grid', styles: { fontSize: 8 }, headStyles: { fillColor: [245, 166, 35], textColor: AZUL }, margin: { left: 14, right: 14 },
            head: [['Socio', 'Le corresponde', 'Plata del negocio que tiene', 'Saldo']],
            body: cuenta.filas.map(f => [f.s.n, fmt(f.corr), fmt(f.tiene), f.saldo > 1 ? `Debe entregar ${fmt(f.saldo)}` : f.saldo < -1 ? `Debe recibir ${fmt(-f.saldo)}` : 'A mano']),
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        });
        y = doc.lastAutoTable.finalY + 6;
        doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(30);
        const lineas = cuenta.trans.length ? cuenta.trans.map(t => `${nom(t.de)} entrega ${fmt(t.v)} a ${nom(t.a)}`) : ['Las cuentas están a mano.'];
        lineas.forEach(l => { doc.text(l, 14, y); y += 5; });
        if (cuenta.porCobrar > 1) { doc.setFont('helvetica', 'normal'); doc.text(`Falta por cobrar al cliente: ${fmt(cuenta.porCobrar)}`, 14, y + 1); }
        doc.save(`Rendicion-socios-${maq.nombre.replace(/\s+/g, '-')}.pdf`);
    };

    if (cargando) return <p className="so-vacio">Cargando…</p>;

    // ── Primera vez: explicar y pedir los socios ──
    if (!configurado && !editando) {
        return (
            <div className="so-box">
                <div className="so-head"><b><Users size={15} /> Socios de {maq.nombre}</b></div>
                <p className="so-p">Aquí se reparte lo que deja cada corte entre los socios de la máquina, según el porcentaje de cada uno, y se ve quién le debe plata a quién. Se calcula con los periodos, ingresos y gastos que ya están registrados.</p>
                <button className="bp" onClick={abrirConfig}><Plus size={14} style={{ verticalAlign: 'middle' }} /> Configurar socios</button>
            </div>
        );
    }

    // ── Configurar o editar los socios ──
    if (editando) {
        const total = sumaPct(borrador);
        return (
            <div className="so-box">
                <div className="so-head"><b><Users size={15} /> Socios de {maq.nombre}</b></div>
                <p className="so-p">Escribe cada socio con su porcentaje. Tienen que sumar 100%.</p>
                {borrador.map((s, i) => (
                    <div className="so-fila-cfg" key={i}>
                        <i className="so-dot" style={{ background: COL[i] }} />
                        <input className="fi" aria-label={`Nombre del socio ${i + 1}`} placeholder="Nombre" value={s.n} onChange={e => { const b = [...borrador]; b[i] = { ...s, n: e.target.value }; setBorrador(b); setErrConf(''); }} />
                        <div className="so-pct"><input className="fi" aria-label={`Porcentaje de ${s.n || 'socio ' + (i + 1)}`} inputMode="decimal" value={s.pct} onChange={e => { const b = [...borrador]; b[i] = { ...s, pct: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') }; setBorrador(b); setErrConf(''); }} /><span>%</span></div>
                        <button className="so-x" aria-label={`Quitar a ${s.n || 'socio'}`} disabled={borrador.length <= 2} onClick={() => setBorrador(borrador.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
                    </div>
                ))}
                <div className={`so-total ${Math.abs(total - 100) < 0.01 ? 'ok' : 'mal'}`}>Suman {pctTxt(total)}</div>
                {errConf && <p className="so-error" role="alert">{errConf}</p>}
                <div className="fa">
                    {borrador.length < 5 && <button className="bs" onClick={() => setBorrador([...borrador, { n: '', pct: 0 }])}><Plus size={14} /> Agregar socio</button>}
                    <button className="bs" onClick={() => setEditando(false)}>Cancelar</button>
                    <button className="bp" onClick={guardarConfig} disabled={guardando}><Check size={14} /> {guardando ? 'Guardando…' : 'Guardar'}</button>
                </div>
            </div>
        );
    }

    const VISTAS = [['rep', 'Reparto del corte'], ['cta', 'Cuenta entre socios'], ['soc', 'Socios']];
    return (
        <div className="so-wrap">
            {ConfirmUI}
            <div className="so-sub" role="tablist" aria-label="Vista de socios">
                {VISTAS.map(([k, l]) => <button key={k} className={vista === k ? 'on' : ''} onClick={() => setVista(k)}>{l}</button>)}
                <button className="so-pdf" onClick={pdf} disabled={tramos.length === 0}><Download size={13} /> PDF</button>
            </div>

            {vista === 'rep' && (tramos.length === 0
                ? <p className="so-vacio">Todavía no hay ingresos ni gastos en periodos de esta máquina.</p>
                : <>
                    <div className="so-chips">
                        {tramos.map(t => <button key={t.clave} className={t.clave === tramo.clave ? 'on' : ''} onClick={() => setClave(t.clave)}>{t.faena} · {t.nombre}</button>)}
                    </div>
                    <div className="so-box">
                        <div className="so-head"><b>{tramo.faena} · {tramo.nombre}</b><span className="so-sub2">{tramo.desde ? fmtFecha(tramo.desde) : 'Inicio'} a {tramo.hasta ? fmtFecha(tramo.hasta) : 'hoy'} · {fmtHoras(tramo.horas)} h</span></div>
                        <div className="so-casc">
                            <div><span>Ingresos</span><b className="pos">{fmt(tramo.ingresos)}</b></div>
                            <div><span>− Gastos</span><b className="neg">{fmt(tramo.gastosTotal)}</b></div>
                            <div className="u"><span>= Utilidad a repartir</span><b className={rep.util >= 0 ? 'pos' : 'neg'}>{fmt(rep.util)}</b></div>
                        </div>
                        <div className="so-barra" aria-hidden="true">{cfg.socios.map((s, i) => <i key={i} style={{ width: `${s.pct}%`, background: COL[i] }}>{s.pct >= 12 ? pctTxt(s.pct) : ''}</i>)}</div>
                        <div className="so-socios">
                            {rep.filas.map(f => (
                                <div className="so-soc" key={f.i}>
                                    <b><i className="so-dot" style={{ background: COL[f.i] }} />{f.s.n} <span>{pctTxt(f.s.pct)}</span></b>
                                    <div><span>Su parte</span><b>{fmt(f.parte)}</b></div>
                                    {f.reem > 0 && <div><span>+ Gastos que pagó</span><b>{fmt(f.reem)}</b></div>}
                                    <div className="k"><span>Le corresponde</span><b>{fmt(f.corr)}</b></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="so-box">
                        <div className="so-head"><b>Gastos de este corte</b><span className="so-sub2">Marca quién pagó cada uno</span></div>
                        {tramo.gastos.length === 0 ? <p className="so-vacio">No hay gastos en este corte.</p> : tramo.gastos.map(g => (
                            <div className="so-gasto" key={g.id}>
                                <span className="so-gd"><b>{g.d}</b><small>{g.f ? fmtFecha(g.f) : ''}{g.cat ? ` · ${g.cat}` : ''}</small></span>
                                <select className="fsel" aria-label={`Quién pagó ${g.d}`} value={cfg.pagoGasto[g.id] !== undefined ? String(cfg.pagoGasto[g.id]) : 'caja'} onChange={e => pagoGasto(g.id, e.target.value)}>
                                    <option value="caja">Caja del negocio</option>
                                    {cfg.socios.map((s, i) => <option key={i} value={i}>{s.n} (su bolsillo)</option>)}
                                </select>
                                <b className="so-gm">{fmt(g.m)}</b>
                            </div>
                        ))}
                    </div>
                </>)}

            {vista === 'cta' && cuenta && (
                <>
                    <div className="so-box">
                        <div className="so-head"><b>Cuenta de {maq.nombre}</b><span className="so-sub2">Todos los periodos juntos</span></div>
                        <div className="so-casc">
                            <div><span>Ingresos facturados</span><b className="pos">{fmt(cuenta.ingresos)}</b></div>
                            <div><span>− Gastos</span><b className="neg">{fmt(cuenta.gastos)}</b></div>
                            <div className="u"><span>= Utilidad total</span><b className={cuenta.util >= 0 ? 'pos' : 'neg'}>{fmt(cuenta.util)}</b></div>
                            <div><span>Cobrado al cliente (Pagos Clientes)</span><b>{fmt(cobrado)}</b></div>
                        </div>
                        <div className="so-recibe">
                            <label className="fl" htmlFor="so-recibe">¿A quién le entra la plata de los cobros?</label>
                            <select id="so-recibe" className="fsel" value={cfg.recibe} onChange={e => cambiarRecibe(Number(e.target.value))}>
                                {cfg.socios.map((s, i) => <option key={i} value={i}>{s.n}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="so-socios">
                        {cuenta.filas.map(f => (
                            <div className="so-soc" key={f.i}>
                                <b><i className="so-dot" style={{ background: COL[f.i] }} />{f.s.n} <span>{pctTxt(f.s.pct)}</span></b>
                                <div><span>Le corresponde</span><b>{fmt(f.corr)}</b></div>
                                {f.cobros > 0 && <div><span>Cobros que recibió</span><b>{fmt(f.cobros)}</b></div>}
                                {f.gcaja > 0 && <div><span>− Gastos pagados con esa plata</span><b>{fmt(-f.gcaja)}</b></div>}
                                {f.ent !== 0 && <div><span>± Entregas entre socios</span><b>{fmt(f.ent)}</b></div>}
                                <div><span>Plata del negocio que tiene</span><b>{fmt(f.tiene)}</b></div>
                                <div className="k"><span>Saldo</span>{f.saldo > 1 ? <b className="neg">Debe entregar {fmt(f.saldo)}</b> : f.saldo < -1 ? <b className="pos">Debe recibir {fmt(-f.saldo)}</b> : <b>A mano</b>}</div>
                            </div>
                        ))}
                    </div>
                    {cuenta.trans.length > 0
                        ? <div className="so-entrega"><span className="l">Para quedar a mano</span>{cuenta.trans.map((t, i) => <div className="big" key={i}>{nom(t.de)} entrega <b>{fmt(t.v)}</b> a {nom(t.a)}</div>)}</div>
                        : cuenta.filas.some(f => Math.abs(f.saldo) > 1)
                            ? <div className="so-ok wr">Todavía no hay plata de sobra para entregar{cuenta.porCobrar > 1 ? ': falta cobrar al cliente' : ''}.</div>
                            : <div className="so-ok">✓ Las cuentas están a mano.</div>}
                    {cuenta.porCobrar > 1 && <p className="so-nota">Falta por cobrar al cliente {fmt(cuenta.porCobrar)}. Cuando pague, las cuentas se acomodan.</p>}
                    {!entrega && <div><button className="bp" onClick={() => setEntrega({
                        de: cuenta.trans[0]?.de ?? cfg.recibe,
                        a: cuenta.trans[0]?.a ?? Math.max(0, cfg.socios.findIndex((_, i) => i !== cfg.recibe)),
                        v: cuenta.trans[0] ? Math.round(cuenta.trans[0].v) : '',
                    })}>Registrar una entrega</button></div>}
                    {entrega && (
                        <div className="so-box">
                            <div className="so-head"><b>Registrar una entrega</b></div>
                            <div className="fg2-keep">
                                <div><label className="fl" htmlFor="so-de">De</label><select id="so-de" className="fsel" value={entrega.de} onChange={e => setEntrega({ ...entrega, de: Number(e.target.value) })}>{cfg.socios.map((s, i) => <option key={i} value={i}>{s.n}</option>)}</select></div>
                                <div><label className="fl" htmlFor="so-a">Para</label><select id="so-a" className="fsel" value={entrega.a} onChange={e => setEntrega({ ...entrega, a: Number(e.target.value) })}>{cfg.socios.map((s, i) => <option key={i} value={i}>{s.n}</option>)}</select></div>
                            </div>
                            <label className="fl">Monto ($)</label>
                            <MoneyInput className="fi" value={entrega.v} onChange={e => setEntrega({ ...entrega, v: e.target.value })} />
                            <div className="fa"><button className="bs" onClick={() => setEntrega(null)}>Cancelar</button><button className="bp" onClick={guardarEntrega} disabled={guardando}><Check size={14} /> Guardar entrega</button></div>
                        </div>
                    )}
                    {cfg.entregas.length > 0 && (
                        <div className="so-box">
                            <div className="so-head"><b>Entregas hechas</b></div>
                            {cfg.entregas.map(e => (
                                <div className="so-gasto ent" key={e.id}>
                                    <span className="so-gd"><b>{nom(e.de)} → {nom(e.a)}</b><small>{e.f ? fmtFecha(e.f) : ''}</small></span>
                                    <b className="so-gm">{fmt(e.v)}</b>
                                    <button className="so-x" aria-label="Borrar entrega" onClick={() => borrarEntrega(e)}><Trash2 size={14} /></button>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {vista === 'soc' && (
                <div className="so-box">
                    <div className="so-head"><b><Users size={15} /> Socios de {maq.nombre}</b><button className="bs ct-btn" onClick={abrirConfig}>Editar socios</button></div>
                    <div className="so-barra" aria-hidden="true">{cfg.socios.map((s, i) => <i key={i} style={{ width: `${s.pct}%`, background: COL[i] }}>{s.pct >= 12 ? pctTxt(s.pct) : ''}</i>)}</div>
                    {cfg.socios.map((s, i) => (
                        <div className="so-gasto" key={i}>
                            <span className="so-gd"><b><i className="so-dot" style={{ background: COL[i] }} />{s.n}</b>{i === cfg.recibe && <small>Recibe los cobros</small>}</span>
                            <b className="so-gm">{pctTxt(s.pct)}</b>
                        </div>
                    ))}
                    <p className="so-nota">El reparto se calcula con los ingresos y gastos que ya están en la app, de todos los periodos de esta máquina, incluso los anteriores. Si cambias los porcentajes, se recalcula todo.</p>
                </div>
            )}
        </div>
    );
}

export default SociosMaquina;
