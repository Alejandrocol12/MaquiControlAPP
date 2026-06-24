import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getMaquinas, actualizarUbicacion } from '../../api';
import { useToast } from '../../utils/toast';
import { MapPin, Navigation, Loader, List, X } from 'lucide-react';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const iconPorEstado = (estado) => {
    const color = estado === 'activa' ? '#27ae60' : estado === 'mantenimiento' ? '#f5a623' : '#6b7a8d';
    return L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;background:${color};border:2.5px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
    });
};

function Mapa() {
    const toast = useToast();
    const [maquinas, setMaquinas] = useState([]);
    const [gpsActivo, setGpsActivo] = useState(null);
    const [panelVisible, setPanelVisible] = useState(false);

    useEffect(() => {
        getMaquinas().then(r => setMaquinas(r.data)).catch(() => {});
    }, []);

    const usarGPS = async (maq) => {
        if (!navigator.geolocation) return toast('Tu dispositivo no soporta GPS', 'e');
        setGpsActivo(maq.id);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude: latitud, longitude: longitud } = pos.coords;
                let ubicacionNombre = `${latitud.toFixed(5)}, ${longitud.toFixed(5)}`;
                try {
                    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitud}&lon=${longitud}&format=json`);
                    const d = await r.json();
                    ubicacionNombre = d.display_name?.split(',').slice(0, 3).join(',') || ubicacionNombre;
                } catch { /* usa coordenadas */ }
                try {
                    await actualizarUbicacion(maq.id, { latitud, longitud, ubicacionNombre });
                    setMaquinas(prev => prev.map(m =>
                        m.id === maq.id ? { ...m, latitud, longitud, ubicacionNombre } : m
                    ));
                    toast(`Ubicación de ${maq.nombre} actualizada`, 's');
                } catch {
                    toast('No se pudo guardar la ubicación', 'e');
                } finally { setGpsActivo(null); }
            },
            () => { toast('No se pudo obtener la ubicación', 'e'); setGpsActivo(null); },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const conUbicacion = maquinas.filter(m => m.latitud && m.longitud);
    const centro = conUbicacion.length
        ? [conUbicacion[0].latitud, conUbicacion[0].longitud]
        : [4.7110, -74.0721];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="topbar">
                <div>
                    <h1>Mapa de máquinas</h1>
                    <p>{conUbicacion.length} de {maquinas.length} con ubicación registrada</p>
                </div>
            </div>

            {/* Área principal: mapa + panel */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

                {/* Mapa — siempre ocupa todo el espacio */}
                <MapContainer
                    center={centro}
                    zoom={conUbicacion.length ? 12 : 6}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {conUbicacion.map(m => (
                        <Marker key={m.id} position={[m.latitud, m.longitud]} icon={iconPorEstado(m.estado)}>
                            <Popup>
                                <div style={{ minWidth: '160px' }}>
                                    <strong style={{ fontSize: '14px' }}>{m.nombre}</strong>
                                    <div style={{ fontSize: '12px', color: '#6b7a8d', marginTop: '4px' }}>
                                        {m.tipo} • {m.estado}
                                    </div>
                                    {m.operadorNombre && (
                                        <div style={{ fontSize: '12px', marginTop: '3px' }}>👷 {m.operadorNombre}</div>
                                    )}
                                    {m.ubicacionNombre && (
                                        <div style={{ fontSize: '11px', color: '#9aa5b4', marginTop: '4px' }}>
                                            📍 {m.ubicacionNombre}
                                        </div>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>

                {/* Botón flotante para mostrar/ocultar panel */}
                <button
                    onClick={() => setPanelVisible(v => !v)}
                    style={{
                        position: 'absolute', bottom: '20px', right: '16px', zIndex: 1000,
                        background: '#1a2d42', color: '#fff', border: 'none',
                        borderRadius: '50px', padding: '10px 18px',
                        display: 'flex', alignItems: 'center', gap: '7px',
                        fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                        boxShadow: '0 3px 12px rgba(0,0,0,.35)',
                    }}
                >
                    {panelVisible ? <X size={15} /> : <List size={15} />}
                    {panelVisible ? 'Ocultar' : 'Máquinas'}
                </button>

                {/* Panel lateral — overlay sobre el mapa */}
                {panelVisible && (
                    <div style={{
                        position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 999,
                        width: '270px', background: '#fff',
                        boxShadow: '-4px 0 20px rgba(0,0,0,.15)',
                        overflowY: 'auto', padding: '12px',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <span style={{ fontWeight: 700, fontSize: '13px', color: '#1a2d42' }}>
                                <MapPin size={13} style={{ marginRight: 5 }} />
                                Mis máquinas
                            </span>
                            <button onClick={() => setPanelVisible(false)}
                                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9aa5b4' }}>
                                <X size={16} />
                            </button>
                        </div>

                        {maquinas.map(m => (
                            <div key={m.id} style={{
                                background: '#f8fafc', border: '1px solid #eaf0f8',
                                borderRadius: '10px', padding: '10px 12px', marginBottom: '8px'
                            }}>
                                <div style={{ fontWeight: 700, fontSize: '13px', color: '#1a2d42' }}>{m.nombre}</div>
                                <div style={{ fontSize: '11px', color: '#6b7a8d', marginTop: '2px' }}>
                                    {m.ubicacionNombre
                                        ? <><MapPin size={10} style={{ marginRight: 3 }} />{m.ubicacionNombre}</>
                                        : 'Sin ubicación'}
                                </div>
                                <button onClick={() => usarGPS(m)} disabled={gpsActivo === m.id}
                                    style={{
                                        marginTop: '7px', width: '100%', padding: '5px 0',
                                        background: '#f0f4f8', border: 'none', borderRadius: '6px',
                                        fontSize: '11px', cursor: 'pointer', color: '#1a2d42',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
                                    }}
                                >
                                    {gpsActivo === m.id
                                        ? <><Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> Obteniendo...</>
                                        : <><Navigation size={11} /> Usar mi GPS</>}
                                </button>
                            </div>
                        ))}
                        {maquinas.length === 0 && (
                            <p style={{ fontSize: '12px', color: '#9aa5b4', textAlign: 'center', marginTop: '20px' }}>
                                No hay máquinas registradas
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Mapa;
