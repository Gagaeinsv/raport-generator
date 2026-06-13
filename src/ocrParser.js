import { ZVANNA, POSADY } from './data';

/**
 * Parses OCR extracted text to find military details.
 * @param {string} text - Raw OCR text
 * @returns {object} Extracted fields
 */
export function parseOCRText(text) {
  if (!text) return {};

  const result = {
    pib: '',
    rank: '',
    posada: '',
    militaryUnit: '',
  };

  // 1. Find Military Unit (Військова частина) - e.g., А4012, В1234, а4123
  // Match Ukrainian А, В, С, etc. or English counterparts
  const unitRegex = /(?:в\/ч|військова частина|в\.ч\.)?\s*([А-Яа-яA-Za-z]\s?\d{4})/i;
  const unitMatch = text.match(unitRegex);
  if (unitMatch) {
    let unit = unitMatch[1].replace(/\s+/g, '').toUpperCase();
    // Normalize English characters to Ukrainian
    unit = unit.replace('A', 'А').replace('B', 'В');
    result.militaryUnit = unit;
  }

  // 2. Find Rank
  const textLower = text.toLowerCase();
  for (const rank of ZVANNA) {
    const rLower = rank.toLowerCase();
    // We search for whole word or exact match
    if (textLower.includes(rLower)) {
      result.rank = rank; // return original casing from ZVANNA
      break;
    }
  }

  // 3. Find Position
  for (const pos of POSADY) {
    const pLower = pos.toLowerCase();
    if (textLower.includes(pLower)) {
      result.posada = pos;
      break;
    }
  }

  // 4. Find PIB (ПІБ - Прізвище Ім'я По Батькові)
  // Let's look for: 3 capitalized Ukrainian words (at least 3 letters each)
  // Ukrainian uppercase: А-Я Є І Ї Ґ
  // Ukrainian lowercase: а-я є і ї ґ
  // Supported apostrophe: ' or ’
  const pibRegexes = [
    // Mixed case (e.g. Петренко Петро Петрович)
    /\b([А-ЯЄІЇҐ][а-яєіїґ'’]+)\s+([А-ЯЄІЇҐ][а-яєіїґ'’]+)\s+([А-ЯЄІЇҐ][а-яєіїґ'’]+)\b/,
    // Upper case (e.g. ПЕТРЕНКО ПЕТРО ПЕТРОВИЧ)
    /\b([А-ЯЄІЇҐ'’]{2,})\s+([А-ЯЄІЇҐ'’]{2,})\s+([А-ЯЄІЇҐ'’]{2,})\b/
  ];

  for (const regex of pibRegexes) {
    const match = text.match(regex);
    if (match) {
      // Reconstruct the full name
      const word1 = match[1];
      const word2 = match[2];
      const word3 = match[3];
      
      // Let's check if the words end with common Ukrainian patronymic endings for the 3rd word, or just assume it is PIB
      // Patronymics: -ович, -івна, -овна, -евич, -євич, -ич, -ічна, -івна
      const w3Lower = word3.toLowerCase();
      const isPatronymic = w3Lower.endsWith('ович') || 
                           w3Lower.endsWith('івна') || 
                           w3Lower.endsWith('евич') || 
                           w3Lower.endsWith('євич') || 
                           w3Lower.endsWith('овна') ||
                           w3Lower.endsWith('ич');
      
      if (isPatronymic || regex === pibRegexes[0]) {
        // Format to capitalized form (e.g., Petrenko Petro Petrovych)
        const formatWord = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        result.pib = `${formatWord(word1)} ${formatWord(word2)} ${formatWord(word3)}`;
        break;
      }
    }
  }

  return result;
}
