import { useState, useEffect } from 'react'
import { generateDoc } from './generateDoc'
import mammoth from 'mammoth'
import { ZVANNA, POSADY, VOS_MAP, PIDROZDILY, ROTY_ADRESAT } from './data'
import { QRCodeSVG } from 'qrcode.react'
import { Html5Qrcode } from 'html5-qrcode'
import Tesseract from 'tesseract.js'
import { parseOCRText } from './ocrParser'
import './App.css'

const STORAGE_KEY = 'raport_form_v3'

const INIT = {
  docType:         'posada_pryiniav',
  rotaKomandyru:   ROTY_ADRESAT[0].value,
  unitCode:        'А7224',
  pib:             '',
  zvanniaRyadovyi: 'Солдат',
  posada:          'Кулеметник',
  pidrozdil:       PIDROZDILY[0].value,
  vos:             VOS_MAP['Кулеметник'],
  komTyp:          'tvo',
  komZvanna:       'Молодший лейтенант',
  komPib:          '',
  batKomTyp:       'kom',
  batKomZvanna:    'Старший лейтенант',
  batKomPib:       'Валерій САУЛЯК',
  dateStart:       '',
  dateEnd:         '',
  days:            '',
  address:         '',
  phone:           '',
  year:            new Date().getFullYear().toString(),
  medZaklad:       '',
  country:         '',
  weapon:          '',
  attachment:      null,
}

const VIDPUSTKA_IN  = ['vidpustka15_in', 'vidpustka30_in', 'zakordon_in', 'vlk_vidpustka']
const VIDPUSTKA_OUT = ['vidpustka15_out', 'vidpustka30_out', 'zakordon_out']
const MED_TYPES     = ['vlk_in', 'vlk_out', 'shpytal_in', 'shpytal_out']

export default function App() {
  const [form, setForm] = useState(INIT)
  const [previewHtml, setPreviewHtml] = useState(null)
  const [loading, setLoading] = useState(false)

  const [activeTab, setActiveTab] = useState('form')
  const [scanning, setScanning] = useState(false)
  const [qrInstance, setQrInstance] = useState(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setForm(prev => ({ ...INIT, ...parsed, attachment: null }))
      } catch (e) {}
    }
  }, [])

  const set = (field) => (e) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handlePosada = (e) => {
    const posada = e.target.value
    setForm(prev => ({ ...prev, posada, vos: VOS_MAP[posada] || '' }))
  }

  const handleSave = () => {
    const toSave = { ...form }
    delete toSave.attachment
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
    alert('✅ Збережено!')
  }

  const validate = () => {
    if (!form.pib)    { alert('Заповніть ПІБ солдата!'); return false }
    if (!form.komPib) { alert("Заповніть ім'я командира роти!"); return false }
    return true
  }

  const handlePreview = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const arrayBuffer = await generateDoc(form, true)
      const result = await mammoth.convertToHtml({ arrayBuffer })
      setPreviewHtml(result.value)
      if (window.innerWidth <= 768) {
        setActiveTab('preview')
      }
    } catch (e) {
      alert('Помилка: ' + e.message)
    }
    setLoading(false)
  }

  const handleDownload = async () => {
    if (!validate()) return
    await generateDoc(form, false)
  }

  const handleAttachment = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setForm(prev => ({ ...prev, attachment: reader.result }))
    }
    reader.readAsDataURL(file)
  }

  const removeAttachment = () => {
    setForm(prev => ({ ...prev, attachment: null }))
    const input = document.getElementById('attachment-input')
    if (input) input.value = ''
  }

  const parseQRData = (text) => {
    if (text.startsWith('{')) {
      try {
        return JSON.parse(text)
      } catch (e) {}
    }
    if (text.startsWith('v1:')) {
      const parts = text.slice(3).split('|')
      return {
        pib: parts[0] || '',
        zvanniaRyadovyi: parts[1] || 'Солдат',
        posada: parts[2] || 'Кулеметник',
        vos: parts[3] || '',
        unitCode: parts[4] || 'А7224',
        pidrozdil: parts[5] || '',
      }
    }
    return null
  }

  const getQRString = () => {
    return `v1:${form.pib || ''}|${form.zvanniaRyadovyi || ''}|${form.posada || ''}|${form.vos || ''}|${form.unitCode || ''}|${form.pidrozdil || ''}`
  }

  const startScanning = async () => {
    setScanning(true)
    try {
      setTimeout(async () => {
        const html5QrCode = new Html5Qrcode("qr-reader")
        setQrInstance(html5QrCode)
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          (qrText) => {
            const parsed = parseQRData(qrText)
            if (parsed) {
              setForm(prev => ({ ...prev, ...parsed }))
              alert('✅ Дані бійця успішно зчитано з QR-коду!')
              stopScanning(html5QrCode)
            } else {
              alert('Невірний формат QR-коду. Текст: ' + qrText)
            }
          },
          (err) => {
            // quiet error logs
          }
        )
      }, 100)
    } catch (err) {
      alert('Помилка камери: ' + err.message)
      setScanning(false)
    }
  }

  const stopScanning = async (instance = qrInstance) => {
    if (instance) {
      try {
        if (instance.isScanning) {
          await instance.stop()
        }
      } catch (e) {
        console.error(e)
      }
    }
    setScanning(false)
    setQrInstance(null)
  }

  const handleOCR = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setOcrLoading(true)
    setOcrProgress(0)
    try {
      const result = await Tesseract.recognize(
        file,
        'ukr+eng',
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.round(m.progress * 100))
            }
          }
        }
      )
      const parsed = parseOCRText(result.data.text)
      setForm(prev => {
        const updated = { ...prev }
        if (parsed.pib) updated.pib = parsed.pib
        if (parsed.rank) updated.zvanniaRyadovyi = parsed.rank
        if (parsed.posada) {
          updated.posada = parsed.posada
          updated.vos = VOS_MAP[parsed.posada] || ''
        }
        if (parsed.militaryUnit) updated.unitCode = parsed.militaryUnit
        return updated
      })
      alert('✅ Документ успішно розпізнано та поля заповнено!')
    } catch (err) {
      alert('Помилка розпізнавання тексту: ' + err.message)
    } finally {
      setOcrLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      if (qrInstance) {
        stopScanning(qrInstance)
      }
    }
  }, [qrInstance])

  return (
    <div className="layout">

      <div className="col-soldier">
        <h2>📋 Генератор документів</h2>

        <div className="tabs-header">
          <button className={`tab-btn ${activeTab === 'form' ? 'active' : ''}`} onClick={() => { setActiveTab('form'); stopScanning(); }}>
            📄 Рапорт
          </button>
          <button className={`tab-btn ${activeTab === 'scan' ? 'active' : ''}`} onClick={() => { setActiveTab('scan'); stopScanning(); }}>
            📷 Сканувати
          </button>
          <button className={`tab-btn ${activeTab === 'myqr' ? 'active' : ''}`} onClick={() => { setActiveTab('myqr'); stopScanning(); }}>
            🔑 Мій QR
          </button>
          <button className={`tab-btn tab-btn-preview-only ${activeTab === 'preview' ? 'active' : ''}`} onClick={() => { setActiveTab('preview'); stopScanning(); }}>
            👁 Перегляд
          </button>
        </div>

        {/* ===== СКРОЛАБЕЛЬНА ФОРМА ===== */}
        {activeTab === 'form' && (
          <>
            <div className="form-scroll">

              {/* Загальні поля */}
              <div className="form-grid">
                <div className="field-group span2">
                  <label>Тип документу</label>
                  <select value={form.docType} onChange={set('docType')}>
                    <optgroup label="Посада">
                      <option value="posada_pryiniav">Прийняв посаду</option>
                      <option value="posada_zdav">Здав посаду</option>
                    </optgroup>
                    <optgroup label="Відпустка ЧШВ (15 діб)">
                      <option value="vidpustka15_in">У відпустку 15 ЧШВ</option>
                      <option value="vidpustka15_out">З відпустки 15 ЧШВ</option>
                    </optgroup>
                    <optgroup label="Відпустка СЗ (30 діб)">
                      <option value="vidpustka30_in">У відпустку 30 СЗ</option>
                      <option value="vidpustka30_out">З відпустки 30 СЗ</option>
                    </optgroup>
                    <optgroup label="ВЛК">
                      <option value="vlk_in">На ВЛК</option>
                      <option value="vlk_out">З ВЛК</option>
                    </optgroup>
                    <optgroup label="Шпиталь">
                      <option value="shpytal_in">У шпиталь</option>
                      <option value="shpytal_out">З шпиталю</option>
                    </optgroup>
                    <optgroup label="Закордон">
                      <option value="zakordon_in">У відпустку за кордон</option>
                      <option value="zakordon_out">З відпустки за кордон</option>
                    </optgroup>
                    <optgroup label="Інші рапорти та доповідні">
                      <option value="vlk_vidpustka">Відпустка для лікування після ВЛК (60 діб)</option>
                      <option value="vybuv_ppd">Вибув на ППД</option>
                      <option value="szch">Доповідь про СЗЧ</option>
                    </optgroup>
                  </select>
                </div>
                <div className="field-group">
                  <label>Кому адресовано</label>
                  <select value={form.rotaKomandyru} onChange={set('rotaKomandyru')}>
                    {ROTY_ADRESAT.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <label>Номер частини</label>
                  <input type="text" value={form.unitCode} onChange={set('unitCode')}
                    placeholder="А7224" />
                </div>
              </div>

              <hr className="divider" />
              <h3>📎 Додаток до рапорту</h3>
              <div className="form-grid">
                <div className="field-group span2">
                  <label>Фото виписки / довідки (для PDF)</label>
                  <input type="file" accept="image/*" onChange={handleAttachment} id="attachment-input" style={{ display: 'none' }} />
                  <label htmlFor="attachment-input" className="btn-attachment-label">
                    📷 {form.attachment ? 'Змінити фото' : 'Прикріпити фото'}
                  </label>
                </div>
                {form.attachment && (
                  <div className="field-group span2 attachment-preview-container">
                    <div className="attachment-preview">
                      <img src={form.attachment} alt="Attachment Preview" />
                      <button type="button" className="btn-remove-attachment" onClick={removeAttachment}>
                        ❌ Видалити
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <hr className="divider" />
              <h3>Військовослужбовець</h3>

              <div className="form-grid">
                <div className="field-group full">
                  <label>ПІБ</label>
                  <input type="text" value={form.pib} onChange={set('pib')}
                    placeholder="КОСТЕНКО Станіслав Віталійович" />
                </div>
                <div className="field-group">
                  <label>Звання</label>
                  <select value={form.zvanniaRyadovyi} onChange={set('zvanniaRyadovyi')}>
                    {ZVANNA.map(z => <option key={z}>{z}</option>)}
                  </select>
                </div>
                <div className="field-group">
                  <label>Посада</label>
                  <select value={form.posada} onChange={handlePosada}>
                    {POSADY.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="field-group">
                  <label>Підрозділ</label>
                  <select value={form.pidrozdil} onChange={set('pidrozdil')}>
                    {PIDROZDILY.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <label>ВОС</label>
                  <input type="text" value={form.vos} onChange={set('vos')}
                    placeholder="автоматично" />
                </div>
              </div>

              {/* Відпустка — вхід */}
              {VIDPUSTKA_IN.includes(form.docType) && (
                <>
                  <hr className="divider" />
                  <h3>Відпустка</h3>
                  <div className="form-grid">
                    <div className="field-group">
                      <label>Дата початку</label>
                      <input type="date" value={form.dateStart} onChange={set('dateStart')} />
                    </div>
                    <div className="field-group">
                      <label>Кількість діб</label>
                      <input type="number" value={form.days} onChange={set('days')}
                        placeholder="15" />
                    </div>
                    <div className="field-group span2">
                      <label>Адреса вибуття</label>
                      <input type="text" value={form.address} onChange={set('address')}
                        placeholder="м. Київ, вул. Хрещатик 1" />
                    </div>
                    {(form.docType === 'vidpustka15_in' || form.docType === 'vidpustka30_in' || form.docType === 'vlk_vidpustka') && (
                      <>
                        <div className="field-group">
                          <label>Рік відпустки</label>
                          <input type="text" value={form.year} onChange={set('year')}
                            placeholder={new Date().getFullYear().toString()} />
                        </div>
                        <div className="field-group">
                          <label>Телефон зв'язку</label>
                          <input type="text" value={form.phone} onChange={set('phone')}
                            placeholder="+380XXXXXXXXX" />
                        </div>
                      </>
                    )}
                    {form.docType === 'zakordon_in' && (
                      <div className="field-group span2">
                        <label>Країна</label>
                        <input type="text" value={form.country} onChange={set('country')}
                          placeholder="Польща" />
                      </div>
                    )}
                    {form.docType === 'vlk_vidpustka' && (
                      <div className="field-group span2">
                        <label>Реквізити довідки ВЛК</label>
                        <input type="text" value={form.medZaklad} onChange={set('medZaklad')}
                          placeholder="від 27.03.2026 року №2026-0327-1421-3125-7" />
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Відпустка — вихід */}
              {VIDPUSTKA_OUT.includes(form.docType) && (
                <>
                  <hr className="divider" />
                  <h3>Повернення</h3>
                  <div className="form-grid">
                    <div className="field-group span2">
                      <label>Дата повернення</label>
                      <input type="date" value={form.dateEnd} onChange={set('dateEnd')} />
                    </div>
                  </div>
                </>
              )}

              {/* Вибуття на ППД */}
              {form.docType === 'vybuv_ppd' && (
                <>
                  <hr className="divider" />
                  <h3>Вибуття на ППД</h3>
                  <div className="form-grid">
                    <div className="field-group">
                      <label>Дата вибуття</label>
                      <input type="date" value={form.dateStart} onChange={set('dateStart')} />
                    </div>
                    <div className="field-group span2">
                      <label>Пункт дислокації ППД</label>
                      <input type="text" value={form.address} onChange={set('address')}
                        placeholder="м. КРИВИЙ РІГ" />
                    </div>
                  </div>
                </>
              )}

              {/* СЗЧ */}
              {form.docType === 'szch' && (
                <>
                  <hr className="divider" />
                  <h3>Самовільне залишення частини (СЗЧ)</h3>
                  <div className="form-grid">
                    <div className="field-group">
                      <label>Дата нез'явлення</label>
                      <input type="date" value={form.dateStart} onChange={set('dateStart')} />
                    </div>
                    <div className="field-group">
                      <label>Рік відпустки</label>
                      <input type="text" value={form.year} onChange={set('year')}
                        placeholder={new Date().getFullYear().toString()} />
                    </div>
                    <div className="field-group span2">
                      <label>Місце розташування підрозділу</label>
                      <input type="text" value={form.address} onChange={set('address')}
                        placeholder="НИЖНЯ СИРОВАТКА Сумського району Сумської області" />
                    </div>
                    <div className="field-group span2">
                      <label>Марка та номер зброї</label>
                      <input type="text" value={form.weapon} onChange={set('weapon')}
                        placeholder="АК-74 №6757506" />
                    </div>
                  </div>
                </>
              )}

              {/* ВЛК / Шпиталь */}
              {MED_TYPES.includes(form.docType) && (
                <>
                  <hr className="divider" />
                  <h3>Медичний заклад</h3>
                  <div className="form-grid">
                    <div className="field-group full">
                      <label>Назва закладу</label>
                      <input type="text" value={form.medZaklad} onChange={set('medZaklad')}
                        placeholder="Військовий госпіталь №1" />
                    </div>
                    <div className="field-group span2">
                      <label>Дата</label>
                      <input type="date" value={form.dateStart} onChange={set('dateStart')} />
                    </div>
                  </div>
                </>
              )}

              <hr className="divider" />
              <h3>Командир роти</h3>

              <div className="form-grid">
                <div className="field-group">
                  <label>Тип</label>
                  <select value={form.komTyp} onChange={set('komTyp')}>
                    <option value="tvo">ТВО командира</option>
                    <option value="kom">Командир</option>
                  </select>
                </div>
                <div className="field-group">
                  <label>Звання</label>
                  <select value={form.komZvanna} onChange={set('komZvanna')}>
                    {ZVANNA.map(z => <option key={z}>{z}</option>)}
                  </select>
                </div>
                <div className="field-group span2">
                  <label>Ім'я та прізвище</label>
                  <input type="text" value={form.komPib} onChange={set('komPib')}
                    placeholder="Сергій СЕРГЄЄВ" />
                </div>
              </div>

              <hr className="divider" />
              <h3>Командир батальйону</h3>

              <div className="form-grid">
                <div className="field-group">
                  <label>Тип</label>
                  <select value={form.batKomTyp} onChange={set('batKomTyp')}>
                    <option value="kom">Командир</option>
                    <option value="tvo">ТВО командира</option>
                  </select>
                </div>
                <div className="field-group">
                  <label>Звання</label>
                  <select value={form.batKomZvanna} onChange={set('batKomZvanna')}>
                    {ZVANNA.map(z => <option key={z}>{z}</option>)}
                  </select>
                </div>
                <div className="field-group span2">
                  <label>Ім'я та прізвище</label>
                  <input type="text" value={form.batKomPib} onChange={set('batKomPib')}
                    placeholder="Валерій САУЛЯК" />
                </div>
              </div>

            </div>

            {/* ===== КНОПКИ ЗАВЖДИ ВНИЗУ ===== */}
            <div className="col-soldier-footer">
              <button className="btn-save" onClick={handleSave}>
                💾 Запам'ятати
              </button>
              <div className="btn-row">
                <button className="btn-preview" onClick={handlePreview} disabled={loading}>
                  {loading ? '⏳' : '👁 Переглянути'}
                </button>
                <button className="btn-generate" onClick={handleDownload}>
                  📄 Завантажити
                </button>
              </div>
            </div>
          </>
        )}

        {/* ===== СКАНЕРИ ТА КАМЕРА ===== */}
        {activeTab === 'scan' && (
          <div className="form-scroll">
            <div className="scanner-container">
              <h3>📷 Сканування та розпізнавання</h3>
              <p className="scanner-desc">
                Ви можете відсканувати QR-код іншого бійця для швидкого заповнення або розпізнати текст військового квитка чи посвідчення за допомогою фото.
              </p>

              {/* QR Scanner Block */}
              <div className="scanner-section">
                <h4>1. Сканувати QR-код іншого бійця</h4>
                {scanning ? (
                  <div className="qr-reader-container">
                    <div id="qr-reader" className="qr-reader-view"></div>
                    <button className="btn-stop-scan" onClick={() => stopScanning()}>
                      🛑 Зупинити камеру
                    </button>
                  </div>
                ) : (
                  <button className="btn-start-scan" onClick={startScanning}>
                    🔍 Запустити камеру для QR
                  </button>
                )}
              </div>

              <hr className="divider" />

              {/* OCR Document Scanner Block */}
              <div className="scanner-section">
                <h4>2. Розпізнати військовий квиток / Посвідчення (OCR)</h4>
                <div className="ocr-upload-box">
                  <input type="file" accept="image/*" onChange={handleOCR} id="ocr-input" style={{ display: 'none' }} disabled={ocrLoading} />
                  <label htmlFor="ocr-input" className={`btn-ocr-label ${ocrLoading ? 'disabled' : ''}`}>
                    {ocrLoading ? '⏳ Сканування документа...' : '📷 Зробити фото або вибрати файл'}
                  </label>
                  {ocrLoading && (
                    <div className="ocr-progress-container">
                      <div className="ocr-progress-bar" style={{ width: `${ocrProgress}%` }}></div>
                      <span className="ocr-progress-text">Обробка зображення... {ocrProgress}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== МІЙ QR КОД ===== */}
        {activeTab === 'myqr' && (
          <div className="form-scroll my-qr-container">
            <h3>🔑 Мій персональний QR-код</h3>
            <p className="scanner-desc">
              Інші військовослужбовці можуть зчитати цей код камерою свого додатка, щоб миттєво перенести ваші дані (ПІБ, звання, посаду, частину тощо) до себе.
            </p>

            <div className="qr-code-box">
              <QRCodeSVG value={getQRString()} size={200} level="M" includeMargin={true} />
            </div>

            <div className="qr-details-box edit-mode">
              <div className="field-group">
                <label>ПІБ бійця</label>
                <input type="text" value={form.pib} onChange={set('pib')} placeholder="КОСТЕНКО Станіслав Віталійович" />
              </div>
              <div className="field-group">
                <label>Звання</label>
                <select value={form.zvanniaRyadovyi} onChange={set('zvanniaRyadovyi')}>
                  {ZVANNA.map(z => <option key={z}>{z}</option>)}
                </select>
              </div>
              <div className="field-group">
                <label>Посада</label>
                <select value={form.posada} onChange={handlePosada}>
                  {POSADY.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="field-group">
                <label>ВОС</label>
                <input type="text" value={form.vos} onChange={set('vos')} placeholder="Код ВОС" />
              </div>
              <div className="field-group">
                <label>Номер частини</label>
                <input type="text" value={form.unitCode} onChange={set('unitCode')} placeholder="А7224" />
              </div>
              <div className="field-group">
                <label>Підрозділ</label>
                <select value={form.pidrozdil} onChange={set('pidrozdil')}>
                  {PIDROZDILY.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <button className="btn-save" onClick={handleSave} style={{ marginTop: '10px', width: '100%' }}>
              💾 Зберегти зміни профілю
            </button>
          </div>
        )}

        {/* ===== ПОПЕРЕДНІЙ ПЕРЕГЛЯД (Мобільний) ===== */}
        {activeTab === 'preview' && (
          <div className="form-scroll mobile-preview-tab">
            <h3>👁 Попередній перегляд рапорту</h3>
            {previewHtml ? (
              <div className="doc-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <div className="doc-placeholder-mobile">
                <p>Немає згенерованого прев'ю.</p>
                <button className="btn-preview" onClick={handlePreview} disabled={loading}>
                  {loading ? '⏳ Генерується...' : '👁 Згенерувати прев\'ю'}
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Превью */}
      <div className="col-preview">
        <h2>Попередній перегляд</h2>
        {previewHtml
          ? <div className="doc-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          : <div className="doc-placeholder">Заповніть форму і натисніть "Переглянути"</div>
        }
      </div>

    </div>
  )
}
