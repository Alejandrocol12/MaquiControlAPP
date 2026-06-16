export default function MoneyInput({ value, onChange, name, className, placeholder, style }) {
    const raw = String(value ?? '').replace(/[^0-9]/g, '');
    const display = raw !== '' ? Number(raw).toLocaleString('es-CO') : '';

    const handleChange = (e) => {
        const newRaw = e.target.value.replace(/[^0-9]/g, '');
        onChange({ target: { name: e.target.name, value: newRaw } });
    };

    return (
        <input
            type="text"
            inputMode="numeric"
            className={className}
            name={name}
            value={display}
            onChange={handleChange}
            placeholder={placeholder}
            style={style}
        />
    );
}
