import { useState, useEffect } from 'react'
import { generateDoc } from './generateDoc'
import mammoth from 'mammoth'
import { ZVANNA, POSADY, VOS_MAP, PIDROZDILY, ROTY_ADRESAT } from './data'
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
}

const VIDPUSTKA_IN  = ['vidpustka15_in', 'vidpustka30_in', 'zakordon_in', 'vlk_vidpustka']
const VIDPUSTKA_OUT = ['vidpustka15_out', 'vidpustka30_out', 'zakordon_out']
const MED_TYPES     = ['vlk_in', 'vlk_out', 'shpytal_in', 'shpytal_out']

export default function App() {
  const [form, setForm] = useState(INIT)
  const [previewHtml, setPreviewHtml] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setForm(prev => ({ ...INIT, ...parsed }))
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form))
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
    } catch (e) {
      alert('Помилка: ' + e.message)
    }
    setLoading(false)
  }

  const handleDownload = async () => {
    if (!validate()) return
    await generateDoc(form, false)
  }

  return (
    <div className="layout">

      <div className="col-soldier">
        <h2>📋 Генератор документів</h2>

        {/* ===== СКРОЛАБЕЛЬНА ФОРМА ===== */}
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
                  <input type="text" value={form.medZaklad} onChange={set('medZaklad')}
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
        {/* ===== КІНЕЦЬ ФОРМИ ===== */}

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
