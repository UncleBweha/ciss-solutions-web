// Generates the development placeholder product artwork in public/images/products.
// These are original vector illustrations (no manufacturer imagery). Replace them
// with real product photos uploaded through Admin -> Products.
//
// Usage: node scripts/seed/images.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const outDir = join(root, 'public', 'images', 'products')
mkdirSync(outDir, { recursive: true })

const INK = { black: '#1f2937', cyan: '#06b6d4', magenta: '#db2777', yellow: '#facc15' }

const defs = (id, body = '#f8fafc', bodyEnd = '#cbd5e1') => `
  <defs>
    <linearGradient id="${id}-body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${body}"/><stop offset="1" stop-color="${bodyEnd}"/>
    </linearGradient>
    <linearGradient id="${id}-dark" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#334155"/><stop offset="1" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="${id}-glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".9"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="${id}-shadow" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
  </defs>`

const svg = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" role="img">${inner}</svg>\n`

const shadow = (id, cx = 400, cy = 640, rx = 300, ry = 34) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${id}-shadow)"/>`

function inkTankPrinter(id, { body = '#f8fafc', bodyEnd = '#cbd5e1', accent = '#168cff', tanks = true } = {}) {
  return svg(`${defs(id, body, bodyEnd)}
  ${shadow(id)}
  <rect x="130" y="300" width="540" height="300" rx="38" fill="url(#${id}-body)"/>
  <rect x="150" y="250" width="500" height="90" rx="30" fill="url(#${id}-body)" stroke="#94a3b8" stroke-opacity=".35"/>
  <rect x="190" y="268" width="420" height="30" rx="12" fill="url(#${id}-dark)" opacity=".85"/>
  <path d="M250 255 L280 160 L520 160 L550 255 Z" fill="#e2e8f0" stroke="#94a3b8" stroke-opacity=".5"/>
  <rect x="300" y="175" width="200" height="70" rx="6" fill="#fff"/>
  <rect x="210" y="430" width="380" height="26" rx="13" fill="url(#${id}-dark)"/>
  <rect x="220" y="460" width="360" height="90" rx="14" fill="#e2e8f0" stroke="#94a3b8" stroke-opacity=".4"/>
  <circle cx="610" cy="360" r="10" fill="${accent}"/><circle cx="610" cy="360" r="20" fill="${accent}" opacity=".2"/>
  <rect x="180" y="355" width="120" height="14" rx="7" fill="#94a3b8" opacity=".5"/>
  ${tanks ? `<g transform="translate(600 410)">
    <rect width="60" height="150" rx="12" fill="#e2e8f0" stroke="#94a3b8" stroke-opacity=".5"/>
    <rect x="8" y="40" width="9" height="100" rx="4" fill="${INK.black}"/>
    <rect x="20" y="55" width="9" height="85" rx="4" fill="${INK.cyan}"/>
    <rect x="32" y="48" width="9" height="92" rx="4" fill="${INK.magenta}"/>
    <rect x="44" y="62" width="9" height="78" rx="4" fill="${INK.yellow}"/>
  </g>` : ''}
  <rect x="130" y="300" width="540" height="80" rx="38" fill="url(#${id}-glass)" opacity=".5"/>`)
}

function laserPrinter(id, { body = '#f1f5f9', bodyEnd = '#94a3b8', accent = '#168cff' } = {}) {
  return svg(`${defs(id, body, bodyEnd)}
  ${shadow(id)}
  <rect x="160" y="220" width="480" height="390" rx="34" fill="url(#${id}-body)"/>
  <rect x="160" y="220" width="480" height="110" rx="34" fill="url(#${id}-dark)"/>
  <rect x="215" y="250" width="300" height="30" rx="10" fill="#0b1220"/>
  <path d="M215 250 h300 v12 h-300z" fill="#fff" opacity=".85"/>
  <rect x="540" y="245" width="70" height="44" rx="8" fill="#0b1220" stroke="${accent}" stroke-opacity=".7"/>
  <circle cx="575" cy="267" r="6" fill="${accent}"/>
  <rect x="200" y="380" width="400" height="16" rx="8" fill="#64748b" opacity=".45"/>
  <rect x="200" y="470" width="400" height="110" rx="16" fill="#e2e8f0" stroke="#64748b" stroke-opacity=".35"/>
  <rect x="350" y="515" width="100" height="14" rx="7" fill="#64748b" opacity=".5"/>
  <rect x="160" y="330" width="480" height="40" fill="url(#${id}-glass)" opacity=".35"/>`)
}

function dotMatrix(id) {
  return svg(`${defs(id, '#f5f5f4', '#a8a29e')}
  ${shadow(id)}
  <rect x="120" y="330" width="560" height="260" rx="30" fill="url(#${id}-body)"/>
  <rect x="150" y="290" width="500" height="80" rx="20" fill="#d6d3d1"/>
  <rect x="190" y="200" width="420" height="120" rx="6" fill="#fff" stroke="#a8a29e"/>
  ${Array.from({ length: 7 }, (_, i) => `<line x1="215" x2="585" y1="${222 + i * 14}" y2="${222 + i * 14}" stroke="#16a34a" stroke-opacity=".25" stroke-width="6"/>`).join('')}
  ${Array.from({ length: 12 }, (_, i) => `<circle cx="${172 + i * 0}" cy="${215 + i * 9}" r="3" fill="#a8a29e"/><circle cx="${628}" cy="${215 + i * 9}" r="3" fill="#a8a29e"/>`).join('')}
  <rect x="200" y="420" width="400" height="22" rx="11" fill="url(#${id}-dark)"/>
  <rect x="560" y="480" width="80" height="60" rx="10" fill="url(#${id}-dark)"/>
  <circle cx="585" cy="510" r="7" fill="#22c55e"/><circle cx="615" cy="510" r="7" fill="#f59e0b"/>`)
}

function inkBottle(id, color, label = '') {
  return svg(`${defs(id, '#ffffff', '#e2e8f0')}
  ${shadow(id, 400, 670, 150, 22)}
  <rect x="335" y="120" width="130" height="80" rx="14" fill="url(#${id}-dark)"/>
  <rect x="355" y="190" width="90" height="40" rx="8" fill="#334155"/>
  <path d="M290 260 q0 -40 40 -40 h140 q40 0 40 40 v360 q0 40 -40 40 h-140 q-40 0 -40 -40z" fill="url(#${id}-body)" stroke="#cbd5e1"/>
  <path d="M300 420 h200 v190 q0 34 -34 34 h-132 q-34 0 -34 -34z" fill="${color}" opacity=".92"/>
  <rect x="320" y="300" width="160" height="90" rx="10" fill="${color}"/>
  <text x="400" y="358" text-anchor="middle" font-family="Arial, sans-serif" font-size="40" font-weight="700" fill="#fff">${label}</text>
  <path d="M305 250 q0 -20 22 -20 h20 v390 h-20 q-22 0 -22 -22z" fill="#fff" opacity=".55"/>`)
}

function inkBottleSet(id) {
  const colors = [INK.black, INK.cyan, INK.magenta, INK.yellow]
  return svg(`${defs(id, '#ffffff', '#e2e8f0')}
  ${shadow(id, 400, 660, 300, 26)}
  ${colors.map((c, i) => {
    const x = 150 + i * 130
    return `<g transform="translate(${x} 0)">
      <rect x="25" y="200" width="70" height="50" rx="10" fill="url(#${id}-dark)"/>
      <rect x="0" y="250" width="120" height="390" rx="26" fill="url(#${id}-body)" stroke="#cbd5e1"/>
      <rect x="10" y="390" width="100" height="240" rx="20" fill="${c}" opacity=".92"/>
      <rect x="18" y="300" width="84" height="60" rx="8" fill="${c}"/>
      <rect x="10" y="262" width="14" height="360" rx="7" fill="#fff" opacity=".55"/>
    </g>`
  }).join('')}`)
}

function tonerCartridge(id, { band = '#168cff', body = '#334155', bodyEnd = '#0f172a' } = {}) {
  return svg(`${defs(id, body, bodyEnd)}
  ${shadow(id, 400, 600, 320, 30)}
  <path d="M110 330 q0 -40 40 -40 h470 q50 0 60 40 l20 160 q4 40 -36 40 h-514 q-40 0 -40 -40z" fill="url(#${id}-body)"/>
  <rect x="140" y="300" width="380" height="18" rx="9" fill="#fff" opacity=".18"/>
  <rect x="150" y="380" width="250" height="70" rx="10" fill="${band}"/>
  <rect x="170" y="400" width="140" height="10" rx="5" fill="#fff" opacity=".85"/>
  <rect x="170" y="420" width="90" height="10" rx="5" fill="#fff" opacity=".6"/>
  <rect x="560" y="360" width="80" height="120" rx="16" fill="#0b1220"/>
  <circle cx="600" cy="420" r="22" fill="#1e293b" stroke="#64748b"/>
  <rect x="120" y="520" width="560" height="20" rx="10" fill="#020617" opacity=".6"/>`)
}

function drumUnit(id) {
  return svg(`${defs(id, '#475569', '#0f172a')}
  ${shadow(id, 400, 600, 320, 30)}
  <rect x="110" y="300" width="580" height="220" rx="40" fill="url(#${id}-body)"/>
  <rect x="140" y="470" width="520" height="44" rx="22" fill="#16a34a" opacity=".85"/>
  <rect x="140" y="478" width="520" height="10" rx="5" fill="#fff" opacity=".3"/>
  <rect x="170" y="340" width="220" height="60" rx="10" fill="#168cff"/>
  <rect x="190" y="360" width="120" height="10" rx="5" fill="#fff" opacity=".85"/>
  <circle cx="610" cy="380" r="34" fill="#0b1220" stroke="#64748b" stroke-width="4"/>`)
}

function roller(id) {
  return svg(`${defs(id, '#94a3b8', '#334155')}
  ${shadow(id, 400, 560, 300, 26)}
  <rect x="90" y="380" width="620" height="22" rx="11" fill="url(#${id}-body)"/>
  ${[220, 400, 580].map((x) => `
    <g>
      <rect x="${x - 70}" y="310" width="140" height="160" rx="70" fill="#0f172a"/>
      <rect x="${x - 70}" y="310" width="140" height="160" rx="70" fill="url(#${id}-dark)"/>
      ${Array.from({ length: 6 }, (_, i) => `<line x1="${x - 55}" x2="${x + 55}" y1="${335 + i * 22}" y2="${335 + i * 22}" stroke="#475569" stroke-width="4"/>`).join('')}
      <ellipse cx="${x}" cy="390" rx="22" ry="22" fill="#e2e8f0"/>
    </g>`).join('')}
  <rect x="90" y="383" width="620" height="6" rx="3" fill="#fff" opacity=".4"/>`)
}

function fuser(id) {
  return svg(`${defs(id, '#e2e8f0', '#64748b')}
  ${shadow(id, 400, 610, 330, 28)}
  <path d="M90 330 h620 l-30 220 h-560z" fill="url(#${id}-body)"/>
  <rect x="90" y="300" width="620" height="60" rx="16" fill="url(#${id}-dark)"/>
  <rect x="140" y="400" width="520" height="70" rx="35" fill="#1f2937"/>
  <rect x="140" y="410" width="520" height="14" rx="7" fill="#f59e0b" opacity=".75"/>
  <rect x="130" y="490" width="120" height="40" rx="8" fill="#ef4444" opacity=".85"/>
  <text x="190" y="518" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#fff">HOT</text>
  <rect x="560" y="490" width="110" height="40" rx="8" fill="#0f172a"/>`)
}

function printhead(id) {
  return svg(`${defs(id, '#e2e8f0', '#94a3b8')}
  ${shadow(id, 400, 600, 250, 26)}
  <rect x="200" y="240" width="400" height="300" rx="28" fill="url(#${id}-body)"/>
  <rect x="200" y="240" width="400" height="70" rx="28" fill="url(#${id}-dark)"/>
  ${[INK.black, INK.cyan, INK.magenta, INK.yellow].map((c, i) => `<rect x="${240 + i * 85}" y="340" width="60" height="120" rx="12" fill="${c}"/>`).join('')}
  <rect x="230" y="490" width="340" height="24" rx="6" fill="#0f172a"/>
  ${Array.from({ length: 16 }, (_, i) => `<rect x="${242 + i * 20}" y="497" width="8" height="10" rx="2" fill="#f59e0b"/>`).join('')}
  <path d="M600 300 q80 0 80 80 v120" stroke="#f59e0b" stroke-width="18" fill="none" stroke-linecap="round"/>`)
}

function maintenanceKit(id) {
  return svg(`${defs(id, '#ffffff', '#cbd5e1')}
  ${shadow(id, 400, 620, 300, 28)}
  <rect x="140" y="250" width="520" height="350" rx="26" fill="url(#${id}-body)" stroke="#cbd5e1"/>
  <rect x="140" y="250" width="520" height="90" rx="26" fill="#168cff"/>
  <rect x="180" y="280" width="200" height="16" rx="8" fill="#fff" opacity=".9"/>
  <rect x="180" y="305" width="130" height="12" rx="6" fill="#fff" opacity=".6"/>
  <rect x="190" y="380" width="180" height="180" rx="14" fill="#f8fafc" stroke="#94a3b8" stroke-opacity=".5"/>
  <rect x="210" y="400" width="140" height="140" rx="8" fill="#e2e8f0"/>
  <rect x="220" y="410" width="120" height="120" rx="6" fill="#cbd5e1" opacity=".6"/>
  <rect x="400" y="380" width="220" height="70" rx="35" fill="url(#${id}-dark)"/>
  <rect x="400" y="480" width="220" height="70" rx="35" fill="url(#${id}-dark)"/>`)
}

function scanner(id) {
  return svg(`${defs(id, '#f1f5f9', '#64748b')}
  ${shadow(id, 400, 610, 330, 28)}
  <path d="M100 420 l40 -120 h520 l40 120z" fill="url(#${id}-dark)"/>
  <path d="M150 312 h500 l26 100 h-552z" fill="#0b1220"/>
  <path d="M160 320 h480 l20 80 h-520z" fill="url(#${id}-glass)" opacity=".25"/>
  <rect x="100" y="420" width="600" height="150" rx="22" fill="url(#${id}-body)"/>
  <rect x="140" y="470" width="420" height="10" rx="5" fill="#168cff" opacity=".8"/>
  <rect x="140" y="470" width="420" height="10" rx="5" fill="#38bdf8" opacity=".4" transform="translate(0 6)"/>
  <circle cx="630" cy="495" r="12" fill="#168cff"/>`)
}

function paperReam(id, { band = '#168cff', label = 'A4' } = {}) {
  return svg(`${defs(id, '#ffffff', '#e2e8f0')}
  ${shadow(id, 400, 620, 320, 30)}
  <path d="M130 360 l270 -110 l270 110 v190 l-270 110 l-270 -110z" fill="#f8fafc" stroke="#cbd5e1"/>
  <path d="M130 360 l270 110 l270 -110 l-270 -110z" fill="#ffffff" stroke="#cbd5e1"/>
  <path d="M400 470 v190 l270 -110 v-190z" fill="#e2e8f0"/>
  <path d="M130 410 l270 110 v60 l-270 -110z" fill="${band}"/>
  <path d="M400 520 l270 -110 v60 l-270 110z" fill="${band}" opacity=".8"/>
  <text x="260" y="350" font-family="Arial, sans-serif" font-size="56" font-weight="800" fill="${band}" transform="rotate(-22 260 350) skewX(20)">${label}</text>`)
}

function photoPaper(id) {
  return svg(`${defs(id, '#ffffff', '#e2e8f0')}
  ${shadow(id, 400, 640, 280, 26)}
  <rect x="180" y="170" width="440" height="460" rx="18" fill="#1e293b"/>
  <rect x="210" y="200" width="380" height="300" rx="10" fill="#38bdf8"/>
  <path d="M210 440 l110 -110 l90 90 l60 -60 l120 120 v20 q0 0 -10 0 h-370z" fill="#16a34a"/>
  <circle cx="520" cy="270" r="34" fill="#facc15"/>
  <rect x="210" y="530" width="230" height="22" rx="11" fill="#fff" opacity=".9"/>
  <rect x="210" y="566" width="150" height="16" rx="8" fill="#fff" opacity=".55"/>
  <rect x="180" y="170" width="440" height="80" rx="18" fill="url(#${id}-glass)" opacity=".35"/>`)
}

function usbCable(id) {
  return svg(`${defs(id, '#64748b', '#0f172a')}
  ${shadow(id, 400, 640, 260, 22)}
  <path d="M220 300 C 220 560, 600 560, 580 330 C 570 200, 300 200, 330 420 C 350 560, 560 520, 560 600" stroke="#334155" stroke-width="22" fill="none" stroke-linecap="round"/>
  <rect x="170" y="220" width="100" height="90" rx="12" fill="url(#${id}-body)"/>
  <rect x="190" y="160" width="60" height="70" rx="6" fill="#cbd5e1"/>
  <rect x="200" y="175" width="40" height="14" rx="3" fill="#475569"/>
  <rect x="510" y="590" width="100" height="90" rx="12" fill="url(#${id}-body)"/>
  <path d="M525 670 h70 v50 l-12 14 h-46 l-12 -14z" fill="#cbd5e1"/>`)
}

const images = {
  'printer-inktank-black': inkTankPrinter('a', { body: '#334155', bodyEnd: '#0f172a' }),
  'printer-inktank-white': inkTankPrinter('b'),
  'printer-inktank-grey': inkTankPrinter('c', { body: '#e2e8f0', bodyEnd: '#64748b', accent: '#8b5cf6' }),
  'printer-photo': inkTankPrinter('d', { body: '#1e293b', bodyEnd: '#020617', accent: '#ec4899' }),
  'printer-laser-white': laserPrinter('e'),
  'printer-laser-dark': laserPrinter('f', { body: '#475569', bodyEnd: '#0f172a', accent: '#38bdf8' }),
  'printer-dot-matrix': dotMatrix('g'),
  'ink-bottle-black': inkBottle('h', INK.black, 'BK'),
  'ink-bottle-cyan': inkBottle('i', INK.cyan, 'C'),
  'ink-bottle-magenta': inkBottle('j', INK.magenta, 'M'),
  'ink-bottle-yellow': inkBottle('k', INK.yellow, 'Y'),
  'ink-bottle-set': inkBottleSet('l'),
  'toner-black': tonerCartridge('m'),
  'toner-blue-band': tonerCartridge('n', { band: '#0ea5e9', body: '#1e293b', bodyEnd: '#020617' }),
  'toner-light': tonerCartridge('o', { band: '#8b5cf6', body: '#cbd5e1', bodyEnd: '#64748b' }),
  'drum-unit': drumUnit('p'),
  'pickup-roller': roller('q'),
  'fuser-unit': fuser('r'),
  printhead: printhead('s'),
  'maintenance-kit': maintenanceKit('t'),
  scanner: scanner('u'),
  'paper-ream': paperReam('v'),
  'paper-ream-a3': paperReam('w', { band: '#8b5cf6', label: 'A3' }),
  'photo-paper': photoPaper('x'),
  'usb-cable': usbCable('y'),
}

for (const [name, content] of Object.entries(images)) {
  writeFileSync(join(outDir, `${name}.svg`), content)
}
console.log(`Wrote ${Object.keys(images).length} images to ${outDir}`)
