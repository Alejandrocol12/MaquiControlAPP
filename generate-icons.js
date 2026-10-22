// Genera el logo de Moventra a partir de frontend/public/Logo Nuevo.jpeg:
//   - logo-moventra.png          logo con fondo transparente y sus colores (para fondos claros)
//   - logo-moventra-claro.png    lo oscuro del logo pasado a gris claro (para fondos oscuros)
//   - logo192.png / logo512.png  íconos de la app instalada (logo sobre tarjeta blanca)
//   - favicon.ico / favicon-32.png / apple-touch-icon.png
//   - src/utils/logoMoventra.js  versiones pequeñas en base64 para PDF, Excel y documentos impresos
// Uso: node generate-icons.js
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const pub = path.join(__dirname, 'frontend', 'public');
const origen = path.join(pub, 'Logo Nuevo.jpeg');

// Quita el fondo blanco: solo el blanco conectado con el borde de la imagen (los blancos de adentro, que separan
// las piezas del logo, se quedan). El borde de cada color se suaviza según qué tan cerca esté del blanco.
function quitarFondo(data, w, h) {
    const out = Buffer.alloc(w * h * 4);
    const blanco = (i) => data[i * 3] > 236 && data[i * 3 + 1] > 236 && data[i * 3 + 2] > 236;
    const fondo = new Uint8Array(w * h);
    const pila = [];
    const empujar = (x, y) => { const i = y * w + x; if (!fondo[i] && blanco(i)) { fondo[i] = 1; pila.push(i); } };
    for (let x = 0; x < w; x++) { empujar(x, 0); empujar(x, h - 1); }
    for (let y = 0; y < h; y++) { empujar(0, y); empujar(w - 1, y); }
    while (pila.length) {
        const i = pila.pop(); const x = i % w, y = (i - x) / w;
        if (x > 0) empujar(x - 1, y); if (x < w - 1) empujar(x + 1, y);
        if (y > 0) empujar(x, y - 1); if (y < h - 1) empujar(x, y + 1);
    }
    for (let i = 0; i < w * h; i++) {
        out[i * 4] = data[i * 3]; out[i * 4 + 1] = data[i * 3 + 1]; out[i * 4 + 2] = data[i * 3 + 2];
        out[i * 4 + 3] = fondo[i] ? 0 : 255;
    }
    // suaviza el borde: los píxeles que tocan el fondo y son casi blancos quedan semitransparentes
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (fondo[i]) continue;
        if (fondo[i - 1] || fondo[i + 1] || fondo[i - w] || fondo[i + w]) {
            const claridad = (data[i * 3] + data[i * 3 + 1] + data[i * 3 + 2]) / 3;
            out[i * 4 + 3] = claridad > 200 ? Math.max(0, Math.round((255 - claridad) * 4.6)) : 255;
        }
    }
    return out;
}

// Pasa el gris oscuro del logo a un gris claro y deja el amarillo igual
function aClaro(rgba) {
    const o = Buffer.from(rgba);
    for (let i = 0; i < o.length; i += 4) {
        const r = o[i], g = o[i + 1], b = o[i + 2];
        const esAmarillo = r > 150 && r - b > 60;
        const esBlancoInterno = r > 220 && g > 220 && b > 220;
        if (esBlancoInterno) o[i + 3] = 0; // los blancos que separan las piezas dejan ver el fondo oscuro
        if (!esAmarillo && !esBlancoInterno && r < 120 && g < 120 && b < 130) { o[i] = 229; o[i + 1] = 233; o[i + 2] = 240; }
    }
    return o;
}

const ico = (pngs) => {
    // ICO con imágenes PNG adentro
    const cab = Buffer.alloc(6 + pngs.length * 16);
    cab.writeUInt16LE(0, 0); cab.writeUInt16LE(1, 2); cab.writeUInt16LE(pngs.length, 4);
    let pos = cab.length;
    pngs.forEach(({ size, buf }, k) => {
        const e = 6 + k * 16;
        cab[e] = size >= 256 ? 0 : size; cab[e + 1] = size >= 256 ? 0 : size; cab[e + 2] = 0; cab[e + 3] = 0;
        cab.writeUInt16LE(1, e + 4); cab.writeUInt16LE(32, e + 6);
        cab.writeUInt32LE(buf.length, e + 8); cab.writeUInt32LE(pos, e + 12);
        pos += buf.length;
    });
    return Buffer.concat([cab, ...pngs.map(p => p.buf)]);
};

(async () => {
    const { data, info } = await sharp(origen).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const rgba = quitarFondo(data, info.width, info.height);
    const color = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).trim().png().toBuffer();
    const claro = await sharp(aClaro(rgba), { raw: { width: info.width, height: info.height, channels: 4 } }).trim().png().toBuffer();

    fs.writeFileSync(path.join(pub, 'logo-moventra.png'), await sharp(color).resize({ width: 480 }).png({ palette: true, quality: 90 }).toBuffer());
    fs.writeFileSync(path.join(pub, 'logo-moventra-claro.png'), await sharp(claro).resize({ width: 480 }).png({ palette: true, quality: 90 }).toBuffer());
    console.log('✅ logo-moventra.png y logo-moventra-claro.png');

    // Íconos: el logo centrado sobre una tarjeta blanca con esquinas redondeadas
    const icono = async (size, relleno = 0.18) => {
        const r = Math.round(size * 0.2);
        const caja = Math.round(size * (1 - relleno * 2));
        const logo = await sharp(color).resize({ width: caja, height: caja, fit: 'inside' }).png().toBuffer();
        const fondo = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="#ffffff"/></svg>`);
        return sharp(fondo).composite([{ input: logo, gravity: 'center' }]).png().toBuffer();
    };
    for (const s of [192, 512]) { fs.writeFileSync(path.join(pub, `logo${s}.png`), await icono(s)); console.log(`✅ logo${s}.png`); }
    fs.writeFileSync(path.join(pub, 'apple-touch-icon.png'), await icono(180, 0.14));
    fs.writeFileSync(path.join(pub, 'favicon-32.png'), await icono(32, 0.08));
    fs.writeFileSync(path.join(pub, 'favicon.ico'), ico([
        { size: 16, buf: await icono(16, 0.06) }, { size: 32, buf: await icono(32, 0.08) }, { size: 48, buf: await icono(48, 0.1) },
    ]));
    console.log('✅ apple-touch-icon.png, favicon-32.png y favicon.ico');

    // Versiones pequeñas para PDF, Excel y documentos impresos
    const b64 = async (buf, alto) => 'data:image/png;base64,' + (await sharp(buf).resize({ height: alto }).png({ palette: true, quality: 90, compressionLevel: 9 }).toBuffer()).toString('base64');
    const meta = await sharp(color).metadata();
    const js = `// Generado por generate-icons.js — no editar a mano.
// Logo de Moventra en pequeño: LOGO_CLARO para fondos oscuros y LOGO_COLOR para papel blanco.
export const LOGO_PROPORCION = ${(meta.width / meta.height).toFixed(4)}; // ancho / alto
export const LOGO_CLARO = '${await b64(claro, 112)}';
export const LOGO_COLOR = '${await b64(color, 112)}';
`;
    fs.writeFileSync(path.join(__dirname, 'frontend', 'src', 'utils', 'logoMoventra.js'), js);
    console.log('✅ src/utils/logoMoventra.js');
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
