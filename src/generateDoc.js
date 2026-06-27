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

// ---------------------------------------------------------------------------
// POST-RENDER PARAGRAPH FORMATTER
// Walks every <w:p>...</w:p> in the rendered XML and applies proper Word
// alignment/indent based on the text content of each paragraph.
// Must run AFTER docxtemplater.render() so placeholders are already replaced.
// ---------------------------------------------------------------------------
function fixSingleParagraph(para) {
  // Extract all text content from the paragraph
  const allTextMatches = [...para.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
  if (allTextMatches.length === 0) return para

  const fullText = allTextMatches.map(m => m[1]).join('')
  const trimmed = fullText.trim()

  // Determine paragraph type and alignment
  let align = null
  let addIndent = false

  if (/^(Дійсним\s+доповідаю|Дійсним\s+рапортую|Прошу)/ui.test(trimmed)) {
    align = 'both'  // justified body text with first-line indent
    addIndent = true
  } else if (/^Клопочу/ui.test(trimmed)) {
    align = 'center' // resolution paragraph — always centered, no indent
  } else {
    // Check leading whitespace in the first text chunk
    const firstText = allTextMatches[0][1]
    const leadingMatch = firstText.match(/^(\s+)/)
    const leadingText = leadingMatch ? leadingMatch[1] : ''
    const hasLeadingWS = leadingText.includes('\t') || leadingText.length >= 3

    if (/^Командиру/ui.test(trimmed)) {
      align = 'right'
    } else if (/^(Рапорт|РАПОРТ|Доповідна)/ui.test(trimmed)) {
      align = 'center'
    } else if (hasLeadingWS && /^військової\s+частини/ui.test(trimmed)) {
      align = 'right'
    }
  }

  if (!align) return para

  // Strip leading whitespace from all <w:t> tags
  let fixed = para
  let isFirst = true
  fixed = fixed.replace(/<w:t([^>]*)>([\s\S]*?)<\/w:t>/g, (m, attrs, content) => {
    if (isFirst) {
      isFirst = false
      return `<w:t${attrs}>${content.replace(/^\s+/, '')}</w:t>`
    }
    return m
  })

  // Insert or overwrite <w:jc>
  let pPrContent = `<w:jc w:val="${align}"/>`
  if (addIndent) pPrContent += '<w:ind w:firstLine="709"/>'

  if (fixed.includes('<w:pPr>')) {
    // Replace existing <w:jc> or insert new one
    if (fixed.includes('<w:jc ')) {
      fixed = fixed.replace(/<w:jc[^>]*\/>/g, `<w:jc w:val="${align}"/>`)
    } else {
      fixed = fixed.replace('<w:pPr>', `<w:pPr><w:jc w:val="${align}"/>`)
    }
    
    // Manage indentation
    if (addIndent) {
      if (fixed.includes('<w:ind ')) {
        fixed = fixed.replace(/<w:ind[^>]*\/>/g, '<w:ind w:firstLine="709"/>')
      } else {
        fixed = fixed.replace('<w:pPr>', `<w:pPr><w:ind w:firstLine="709"/>`)
      }
    } else {
      // Remove any unwanted first line indent for non-body paragraphs
      fixed = fixed.replace(/<w:ind[^>]*\/>/g, '')
    }
  } else {
    fixed = fixed.replace('<w:p>', `<w:p><w:pPr>${pPrContent}</w:pPr>`)
  }

  return fixed
}

function fixDocumentParagraphs(xml) {
  let result = ''
  let pos = 0
  const open = '<w:p>'
  const close = '</w:p>'

  while (pos < xml.length) {
    const pStart = xml.indexOf(open, pos)
    if (pStart === -1) { result += xml.substring(pos); break }

    result += xml.substring(pos, pStart)

    const pEnd = xml.indexOf(close, pStart)
    if (pEnd === -1) { result += xml.substring(pStart); break }

    const paraEnd = pEnd + close.length
    result += fixSingleParagraph(xml.substring(pStart, paraEnd))
    pos = paraEnd
  }

  return result
}

// ---------------------------------------------------------------------------
// POST-RENDER SPACING ADJUSTER
// Inserts extra blank paragraphs to create proper vertical spacing:
//   - 2 blank lines after the report body text
//   - 2 blank lines before the last signature block
// Must run AFTER fixDocumentParagraphs so paragraph text is already clean.
// ---------------------------------------------------------------------------
function applyDocumentSpacing(xml) {
  // Blank paragraph matching document font style
  const BLANK_PARA = '<w:p><w:r><w:rPr>' +
    '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>' +
    '<w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="uk-UA"/>' +
    '</w:rPr><w:t xml:space="preserve"> </w:t></w:r></w:p>'

  // Extract all text runs from a paragraph XML string
  function getText(paraXml) {
    return [...paraXml.matchAll(/<w:t[^>]*>([\'\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('').trim()
  }

  // Parse XML into interleaved gap/paragraph segments
  const segments = []
  let pos = 0
  while (pos < xml.length) {
    const pStart = xml.indexOf('<w:p>', pos)
    if (pStart === -1) { segments.push({ para: false, xml: xml.substring(pos) }); break }
    if (pStart > pos) segments.push({ para: false, xml: xml.substring(pos, pStart) })
    const pEnd = xml.indexOf('</w:p>', pStart)
    if (pEnd === -1) { segments.push({ para: false, xml: xml.substring(pStart) }); break }
    const paraXml = xml.substring(pStart, pEnd + 6)
    segments.push({ para: true, xml: paraXml, text: getText(paraXml) })
    pos = pEnd + 6
  }

  // Pattern: body paragraphs = Дійсним/Прошу/Клопочу (paragraph text starters)
  const isBodyText = t => /^(Дійсним\s+доповідаю|Дійсним\s+рапортую|Прошу|Клопочу)/ui.test(t)
  const isEmpty    = t => t === '' || /^\s+$/.test(t)

  // Get indices (in segments[]) of all body-text paragraphs
  const bodySegIdxs = segments.reduce((acc, seg, i) => {
    if (seg.para && isBodyText(seg.text)) acc.push(i)
    return acc
  }, [])

  if (bodySegIdxs.length === 0) return xml

  // Find next *paragraph* segment index after a given index
  function nextPara(afterIdx) {
    for (let i = afterIdx + 1; i < segments.length; i++) {
      if (segments[i].para) return i
    }
    return -1
  }

  // Collect positions (segment indices) after which to insert an extra blank
  const extraBlanksAfter = new Set()

  // 1. After first body paragraph (the report body text) — want 2 blank lines
  const firstBodyIdx = bodySegIdxs[0]
  const nextAfterFirst = nextPara(firstBodyIdx)
  if (nextAfterFirst !== -1 && isEmpty(segments[nextAfterFirst].text)) {
    extraBlanksAfter.add(nextAfterFirst) // insert AFTER the existing blank
  }

  // 2. After LAST body paragraph (last Клопочу) — want 2 blank lines before final sig block
  const lastBodyIdx = bodySegIdxs[bodySegIdxs.length - 1]
  if (lastBodyIdx !== firstBodyIdx) {
    const nextAfterLast = nextPara(lastBodyIdx)
    if (nextAfterLast !== -1 && isEmpty(segments[nextAfterLast].text)) {
      extraBlanksAfter.add(nextAfterLast)
    }
  }

  // Rebuild XML with extra blank paragraphs inserted
  const parts = []
  for (let i = 0; i < segments.length; i++) {
    parts.push(segments[i].xml)
    if (extraBlanksAfter.has(i)) parts.push(BLANK_PARA)
  }

  return parts.join('')
}

// ---------------------------------------------------------------------------
// FIX ALL PARAGRAPHS: spacing after=0 AND default justify
// Runs on every <w:p>...</w:p> paragraph to:
//   - Zero out Word's default "space after paragraph" (w:after / w:before)
//   - Add <w:jc w:val="both"/> (justify) to paragraphs without explicit align
// ---------------------------------------------------------------------------
function fixParaXml(xml) {
  // Step 1: update any existing <w:spacing .../> — zero out after/before
  xml = xml.replace(/<w:spacing([^>]*?)\/>/ , (m, attrs) => {
    attrs = attrs.replace(/\s*w:after="[^"]*"/g, '').replace(/\s*w:before="[^"]*"/g, '')
    return `<w:spacing w:after="0" w:before="0"${attrs}/>`
  })
  // (global replace for all occurrences)
  xml = xml.replace(/<w:spacing([^>]*?)\/>/g, (m, attrs) => {
    attrs = attrs.replace(/\s*w:after="[^"]*"/g, '').replace(/\s*w:before="[^"]*"/g, '')
    return `<w:spacing w:after="0" w:before="0"${attrs}/>`
  })

  // Step 2: paragraph walk — inject spacing + default justify where missing
  const CLOSE = '</w:p>'
  const OPEN  = '<w:p>'
  let result = ''
  let pos = 0
  while (pos < xml.length) {
    const pStart = xml.indexOf(OPEN, pos)
    if (pStart === -1) { result += xml.substring(pos); break }
    result += xml.substring(pos, pStart)
    const pEnd = xml.indexOf(CLOSE, pStart)
    if (pEnd === -1) { result += xml.substring(pStart); break }
    let para = xml.substring(pStart, pEnd + CLOSE.length)

    const hasPPr    = para.includes('<w:pPr>')
    const hasSpacing = para.includes('<w:spacing')
    const hasJc     = para.includes('<w:jc ')

    let toInsert = ''
    if (!hasSpacing) toInsert += '<w:spacing w:after="0" w:before="0"/>'
    // NOTE: do NOT add default justify here — position/date lines should stay LEFT.

    if (toInsert) {
      if (hasPPr) {
        para = para.replace('<w:pPr>', `<w:pPr>${toInsert}`)
      } else {
        para = para.replace(OPEN, `${OPEN}<w:pPr>${toInsert}</w:pPr>`)
      }
    }

    result += para
    pos = pEnd + CLOSE.length
  }
  return result
}

// ---------------------------------------------------------------------------
// FIX SIGNATURE LINES
// Converts "rank[spaces]name" paragraphs into proper Word tab-stop layout:
//   left run: rank  |  <w:tab/>  |  right-aligned run: name
// This makes the name always sit at the RIGHT margin regardless of rank length.
// Tab stop position = content area width (A4 - 35mm left - 10mm right = 165mm).
// ---------------------------------------------------------------------------
function fixSignatureLines(xml) {
  const CLOSE   = '</w:p>'
  const OPEN    = '<w:p>'
  const TAB_POS = 9350  // twips: 165mm * (1440/25.4) ≈ 9353, rounded to 9350

  let result = ''
  let pos = 0
  while (pos < xml.length) {
    const pStart = xml.indexOf(OPEN, pos)
    if (pStart === -1) { result += xml.substring(pos); break }
    result += xml.substring(pos, pStart)
    const pEnd = xml.indexOf(CLOSE, pStart)
    if (pEnd === -1) { result += xml.substring(pStart); break }
    let para = xml.substring(pStart, pEnd + CLOSE.length)

    // Collect full text from all <w:t> elements
    const allT = [...para.matchAll(/<w:t[^>]*>([\'\s\S]*?)<\/w:t>/g)]
    const fullText = allT.map(m => m[1]).join('')

    // Detect signature line: non-space + 5+ regular spaces + non-space
    const sigMatch = fullText.match(/^(\S[\s\S]*?) {5,}(\S[\s\S]*)$/)
    if (sigMatch) {
      const leftText  = sigMatch[1]
      const rightText = sigMatch[2]

      // Skip known structural paragraphs
      const isKnown = /^(Командиру|Командир\s|Рапорт|РАПОРТ|Дійсним|Прошу|Клопочу|Доповідна|___)/ui.test(leftText.trim())

      if (!isKnown) {
        // Grab run properties from the first <w:rPr> in this paragraph
        const rPrMatch = para.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/)
        const rPr = rPrMatch ? `<w:rPr>${rPrMatch[1]}</w:rPr>` : ''

        para =
          `<w:p>` +
          `<w:pPr>` +
          `<w:jc w:val="left"/>` +
          `<w:spacing w:after="0" w:before="0"/>` +
          `<w:tabs><w:tab w:val="right" w:pos="${TAB_POS}"/></w:tabs>` +
          `</w:pPr>` +
          `<w:r>${rPr}<w:t xml:space="preserve">${leftText}</w:t></w:r>` +
          `<w:r><w:tab/></w:r>` +
          `<w:r>${rPr}<w:t xml:space="preserve">${rightText}</w:t></w:r>` +
          `</w:p>`
      }
    }

    result += para
    pos = pEnd + CLOSE.length
  }
}

// ---------------------------------------------------------------------------

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

  // PRE-RENDER: Only signature spacing must happen before render (it uses {placeholder} names)
  let docXml = zip.file('word/document.xml').asText()

  // Adjust signature line spacings dynamically (must be pre-render since it reads {placeholders})
  // LINE_WIDTH_CHARS: safe approximate character count per line in 12pt Times New Roman
  // on A4 with 35mm left / 10mm right margins (~165mm content width ≈ 70 Cyrillic chars).
  // Using simple subtraction (no *2) keeps the total ≤ LINE_WIDTH_CHARS for any name length.
  const LINE_WIDTH_CHARS = 68
  const MIN_SIG_SPACES = 5
  const spacingRegex = /(\.?\{([a-zA-Z0-9_]+)\})(\s{3,})(\{([a-zA-Z0-9_]+)\})/g
  docXml = docXml.replace(spacingRegex, (match, tag1Str, tag1, spaces, tag2Str, tag2) => {
    const val1 = (renderData[tag1] || '').toString()
    const val2 = (renderData[tag2] || '').toString()
    const newSpaceCount = Math.max(MIN_SIG_SPACES, LINE_WIDTH_CHARS - val1.length - val2.length)
    return `${tag1Str}${' '.repeat(newSpaceCount)}${tag2Str}`
  })
  zip.file('word/document.xml', docXml)

  // RENDER: docxtemplater replaces all {placeholders} with actual values
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })
  doc.render(renderData)

  // POST-RENDER: Apply all formatting to the rendered XML.
  // This ensures docxtemplater cannot overwrite our paragraph structure changes.
  const renderedZip = doc.getZip()
  let outXml = renderedZip.file('word/document.xml').asText()

  // Walk each <w:p>...</w:p> block and fix alignment + indent
  outXml = fixDocumentParagraphs(outXml)

  // Insert extra blank lines at key positions (2 blanks after body, 2 before last sig block)
  outXml = applyDocumentSpacing(outXml)

  // Convert rank+spaces+name signature lines to proper right-tab layout
  outXml = fixSignatureLines(outXml)

  // Remove inter-paragraph spacing and add default justify to all paragraphs
  outXml = fixParaXml(outXml)

  // Remove all color overrides from template placeholder runs (makes red text black)
  outXml = outXml.replace(/<w:color\s[^>]*\/>/g, '')

  // Inject official margins:
  //   Left: 35mm (1984 twips) — binding margin
  //   Right: 10mm  (567 twips)
  //   Top/Bottom: 20mm (1134 twips)
  const sectPr = `<w:sectPr>
    <w:pgSz w:w="11906" w:h="16838"/>
    <w:pgMar w:top="1134" w:right="567" w:bottom="1134" w:left="1984" w:header="720" w:footer="720" w:gutter="0"/>
    <w:cols w:space="720"/>
  </w:sectPr>`
  outXml = outXml.replace('</w:body>', `${sectPr}</w:body>`)

  renderedZip.file('word/document.xml', outXml)
  const output = renderedZip.generate({ type: 'arraybuffer' })
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
