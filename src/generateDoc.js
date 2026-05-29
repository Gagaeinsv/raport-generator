import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { saveAs } from 'file-saver'
import {
  getPibRodovyi,
  getZvannaRodovyi,
  getPosadaRodovyi,
  getPibShort,
  getPidrozdilRodovyi,
} from './declension'

const TEMPLATE_MAP = {
  posada_pryiniav: 'template-posada-pryiniav.docx',
  posada_zdav:     'template-posada-zdav.docx',
  vidpustka15_in:  'template-vidpustka15-in.docx',
  vidpustka15_out: 'template-vidpustka15-out.docx',
  vidpustka30_in:  'template-vidpustka30-in.docx',
  vidpustka30_out: 'template-vidpustka30-out.docx',
  vlk_in:          'template-vlk-in.docx',
  vlk_out:         'template-vlk-out.docx',
  shpytal_in:      'template-shpytal-in.docx',
  shpytal_out:     'template-shpytal-out.docx',
  zakordon_in:     'template-zakordon-in.docx',
  zakordon_out:    'template-zakordon-out.docx',
  vlk_vidpustka:   'template-vlk-vidpustka.docx',
  vybuv_ppd:       'template-vybuv-ppd.docx',
  szch:            'template-szch.docx',
}

const FILE_NAMES = {
  posada_pryiniav: 'Рапорт_прийняв_посаду',
  posada_zdav:     'Рапорт_здав_посаду',
  vidpustka15_in:  'Рапорт_у_відпустку_15_ЧШВ',
  vidpustka15_out: 'Рапорт_з_відпустки_15_ЧШВ',
  vidpustka30_in:  'Рапорт_у_відпустку_30_СЗ',
  vidpustka30_out: 'Рапорт_з_відпустки_30_СЗ',
  vlk_in:          'Рапорт_на_ВЛК',
  vlk_out:         'Рапорт_з_ВЛК',
  shpytal_in:      'Рапорт_у_шпиталь',
  shpytal_out:     'Рапорт_з_шпиталю',
  zakordon_in:     'Рапорт_у_відпустку_за_кордон',
  zakordon_out:    'Рапорт_з_відпустки_за_кордон',
  vlk_vidpustka:   'Рапорт_відпустка_лікування_ВЛК',
  vybuv_ppd:       'Доповідна_вибуття_на_ППД',
  szch:            'Доповідна_СЗЧ',
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  if (dateStr.includes('.')) return dateStr
  const [y, m, d] = dateStr.split('-')
  return `${d}.${m}.${y}`
}

export async function generateDoc(f, returnBuffer = false) {
  const templatePath = TEMPLATE_MAP[f.docType] || 'template-posada-pryiniav.docx'
  const response = await fetch(templatePath)
  const arrayBuffer = await response.arrayBuffer()

  const zip = new PizZip(arrayBuffer)
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })

  doc.render({
    zvanna:        f.zvanniaRyadovyi,
    zvannaRod:     getZvannaRodovyi(f.zvanniaRyadovyi),
    pib:           f.pib || '',
    pibShort:      getPibShort(f.pib || ''),
    pibRodovyi:    getPibRodovyi(f.pib || ''),
    posada:        f.posada,
    posadaRod:     getPosadaRodovyi(f.posada),
    pidrozdil:     f.pidrozdil,
    pidrozdilRod:  getPidrozdilRodovyi(f.pidrozdil),
    rotaKom:       f.rotaKomandyru,
    vos:           f.vos,
    komTyp:        f.komTyp === 'tvo' ? 'ТВО командира' : 'Командир',
    komZvanna:     f.komZvanna,
    komPib:        f.komPib,
    komZvannaRod:  getZvannaRodovyi(f.komZvanna || ''),
    komPibRodovyi: getPibRodovyi(f.komPib || ''),
    batKomTyp:     f.batKomTyp === 'tvo' ? 'ТВО командира' : 'Командир',
    batKomZvanna:  f.batKomZvanna,
    batKomPib:     f.batKomPib,
    unitCode:      f.unitCode || 'А7224',
    dateStart:     formatDate(f.dateStart),
    dateEnd:       formatDate(f.dateEnd),
    days:          f.days || '',
    address:       f.address || '',
    phone:         f.phone || '',
    year:          f.year || new Date().getFullYear().toString(),
    medZaklad:     f.medZaklad || '',
    country:       f.country || '',
    weapon:        f.weapon || '',
  })

  const output = doc.getZip().generate({ type: 'arraybuffer' })
  if (returnBuffer) return output

  const fileName = FILE_NAMES[f.docType] || 'Рапорт'
  const blob = new Blob([output], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
  saveAs(blob, `${fileName}.docx`)
}
