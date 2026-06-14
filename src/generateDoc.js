import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { saveAs } from 'file-saver'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { jsPDF } from 'jspdf'
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

function getImageDimensions(base64Str) {
  return new Promise((resolve) => {
    const img = new Image()
    img.src = base64Str
    img.onload = () => {
      resolve({ width: img.width, height: img.height })
    }
    img.onerror = () => {
      resolve({ width: 210, height: 297 })
    }
  })
}

function getImageFormat(base64Str) {
  if (base64Str.startsWith('data:image/png')) return 'PNG'
  if (base64Str.startsWith('data:image/webp')) return 'WEBP'
  return 'JPEG'
}

export async function generateDoc(f, returnBuffer = false) {
  const templatePath = TEMPLATE_MAP[f.docType] || 'template-posada-pryiniav.docx'
  const response = await fetch(templatePath)
  const arrayBuffer = await response.arrayBuffer()

  const zip = new PizZip(arrayBuffer)

  const renderData = {
    zvanna:        (f.zvanniaRyadovyi || '').toLowerCase(),
    zvannaRod:     getZvannaRodovyi(f.zvanniaRyadovyi || ''),
    pib:           f.pib || '',
    pibShort:      getPibShort(f.pib || '').replace(/ /g, '\u00A0'),
    pibRodovyi:    getPibRodovyi(f.pib || ''),
    posada:        f.posada,
    posadaRod:     getPosadaRodovyi(f.posada),
    pidrozdil:     f.pidrozdil,
    pidrozdilRod:  getPidrozdilRodovyi(f.pidrozdil),
    rotaKom:       f.rotaKomandyru,
    vos:           f.vos,
    komTyp:        f.komTyp === 'tvo' ? 'ТВО командира' : 'Командир',
    komZvanna:     (f.komZvanna || '').toLowerCase(),
    komPib:        (f.komPib || '').replace(/ /g, '\u00A0'),
    komZvannaRod:  getZvannaRodovyi(f.komZvanna || ''),
    komPibRodovyi: getPibRodovyi(f.komPib || ''),
    batKomTyp:     f.batKomTyp === 'tvo' ? 'ТВО командира' : 'Командир',
    batKomZvanna:  (f.batKomZvanna || '').toLowerCase(),
    batKomPib:     (f.batKomPib || '').replace(/ /g, '\u00A0'),
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
  }

  // Adjust spacing and styling inside word/document.xml dynamically based on renderData
  let docXml = zip.file('word/document.xml').asText()

  // 1. Strip leading spaces/tabs from the body text paragraph to prevent double indenting
  docXml = docXml.replace(/(<w:t[^>]*>)\s+([Дд]ійсним доповідаю|[Пп]рошу)/g, '$1$2')
  docXml = docXml.replace(/(<w:t[^>]*>)\t+([Дд]ійсним доповідаю|[Пп]рошу)/g, '$1$2')

  // 2. Inject standard first-line paragraph indent (12.5mm = 709 dxa) for the body paragraph
  const pRegex = /<w:p>(?:<w:pPr>((?:(?!<\/w:p>)[\s\S])*?)<\/w:pPr>)?((?:(?!<\/w:p>)[\s\S])*?<w:t[^>]*>(?:[Дд]ійсним доповідаю|[Пп]рошу))/g
  docXml = docXml.replace(pRegex, (match, pPrInner, rest) => {
    if (pPrInner) {
      if (pPrInner.includes('<w:ind')) {
        pPrInner = pPrInner.replace(/<w:ind[^>]*>/, '<w:ind w:firstLine="709"/>')
      } else {
        pPrInner += '<w:ind w:firstLine="709"/>'
      }
      return `<w:p><w:pPr>${pPrInner}</w:pPr>${rest}`
    } else {
      return `<w:p><w:pPr><w:ind w:firstLine="709"/></w:pPr>${rest}`
    }
  })

  // 3. Inject official margins (Left: 35mm, Right: 20mm, Top: 20mm, Bottom: 20mm)
  const sectPr = `<w:sectPr>
    <w:pgSz w:w="11906" w:h="16838"/>
    <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1984" w:header="720" w:footer="720" w:gutter="0"/>
    <w:cols w:space="720"/>
  </w:sectPr>`
  docXml = docXml.replace('</w:body>', `${sectPr}</w:body>`)

  // 4. Adjust signature line spacings dynamically
  const spacingRegex = /(\{([a-zA-Z0-9_]+)\})(\s{10,})(\{([a-zA-Z0-9_]+)\})/g
  docXml = docXml.replace(spacingRegex, (match, tag1Str, tag1, spaces, tag2Str, tag2) => {
    const val1 = (renderData[tag1] || '').toString()
    const val2 = (renderData[tag2] || '').toString()
    
    // Target visual width of 135 space units
    const targetWidth = 135
    const val1Width = val1.length * 2
    const val2Width = val2.length * 2
    
    const newSpaceCount = Math.max(15, targetWidth - val1Width - val2Width)
    const newSpaces = ' '.repeat(newSpaceCount)
    return `${tag1Str}${newSpaces}${tag2Str}`
  })

  zip.file('word/document.xml', docXml)

  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })
  doc.render(renderData)

  const output = doc.getZip().generate({ type: 'arraybuffer' })
  if (returnBuffer) return output

  const fileName = `${FILE_NAMES[f.docType] || 'Рапорт'}.docx`
  const pdfFileName = `${FILE_NAMES[f.docType] || 'Рапорт'}_додаток.pdf`

  if (Capacitor.isNativePlatform()) {
    try {
      const bytes = new Uint8Array(output)
      let binary = ''
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      const base64Data = btoa(binary)

      const docxWriteResult = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      })

      const filesToShare = [docxWriteResult.uri]

      if (f.attachment) {
        const format = getImageFormat(f.attachment)
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        })
        const dims = await getImageDimensions(f.attachment)
        const a4w = 210
        const a4h = 297
        const imgRatio = dims.width / dims.height
        const a4Ratio = a4w / a4h

        let w = a4w
        let h = a4h
        let x = 0
        let y = 0

        if (imgRatio > a4Ratio) {
          w = a4w
          h = a4w / imgRatio
          y = (a4h - h) / 2
        } else {
          h = a4h
          w = a4h * imgRatio
          x = (a4w - w) / 2
        }

        pdf.addImage(f.attachment, format, x, y, w, h)
        const pdfBase64 = pdf.output('datauristring').split(',')[1]

        const pdfWriteResult = await Filesystem.writeFile({
          path: pdfFileName,
          data: pdfBase64,
          directory: Directory.Cache,
        })
        filesToShare.push(pdfWriteResult.uri)
      }

      await Share.share({
        title: f.attachment ? 'Рапорт та додаток' : fileName,
        files: filesToShare,
        dialogTitle: f.attachment ? 'Поділитися рапортом та додатком' : 'Поділитися рапортом',
      })
    } catch (err) {
      alert('Помилка при збереженні або надсиланні файлів: ' + err.message)
    }
  } else {
    const blob = new Blob([output], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    saveAs(blob, fileName)

    if (f.attachment) {
      try {
        const format = getImageFormat(f.attachment)
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        })
        const dims = await getImageDimensions(f.attachment)
        const a4w = 210
        const a4h = 297
        const imgRatio = dims.width / dims.height
        const a4Ratio = a4w / a4h

        let w = a4w
        let h = a4h
        let x = 0
        let y = 0

        if (imgRatio > a4Ratio) {
          w = a4w
          h = a4w / imgRatio
          y = (a4h - h) / 2
        } else {
          h = a4h
          w = a4h * imgRatio
          x = (a4w - w) / 2
        }

        pdf.addImage(f.attachment, format, x, y, w, h)
        const pdfBlob = pdf.output('blob')
        saveAs(pdfBlob, pdfFileName)
      } catch (err) {
        console.error('Помилка генерації PDF: ', err)
      }
    }
  }
}
