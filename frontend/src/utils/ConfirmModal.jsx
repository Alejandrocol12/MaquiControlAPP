// Modal de confirmación reutilizable — reemplaza window.confirm()
// Uso: const { confirm, ConfirmUI } = useConfirm();
//      await confirm('¿Eliminar?') → true/false

import { useState, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';

export function useConfirm() {
    const [state, setState] = useState(null); // { msg, resolve }

    const confirm = useCallback((msg) => new Promise(resolve => {
        setState({ msg, resolve });
    }), []);

    const responder = (val) => {
        if (state) state.resolve(val);
        setState(null);
    };

    const ConfirmUI = state ? (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(13,27,42,.55)',
            zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <div style={{
                background: '#fff', borderRadius: '14px', padding: '28px 28px 22px',
                maxWidth: '360px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,.25)',
                animation: 'toastIn .2s ease',
            }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}><AlertTriangle size={28} color="#e8941a" /></div>
                <p style={{ fontSize: '14px', fontWeight: '600', color: '#1a2d42', textAlign: 'center', marginBottom: '22px', lineHeight: '1.5' }}>
                    {state.msg}
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => responder(false)}
                        style={{ flex: 1, padding: '9px', background: '#f0f4f8', border: '1px solid #dde4ed', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', fontFamily: 'Barlow, sans-serif' }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => responder(true)}
                        style={{ flex: 1, padding: '9px', background: '#e74c3c', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', color: '#fff', fontFamily: 'Barlow, sans-serif' }}
                    >
                        Eliminar
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    return { confirm, ConfirmUI };
}
