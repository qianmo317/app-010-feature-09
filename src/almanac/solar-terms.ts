import { SOLAR_TERMS } from './constants';
import { getSolarTermDates } from './lunar';
import { gregorianToJDN } from '../utils/date';

// 某年某节气的公历日
export interface TermDate {
  term: string;
  year: number;
  month: number;
  day: number;
  jdn: number;
}

// 取若干年份内全部节气（按日先后排序，可跨年）
export function getTermDateList(fromYear: number, toYear: number): TermDate[] {
  const list: TermDate[] = [];
  for (let year = fromYear; year <= toYear; year++) {
    const days = getSolarTermDates(year);
    for (let i = 0; i < 24; i++) {
      const month = Math.floor(i / 2) + 1;
      const day = days[i];
      list.push({
        term: SOLAR_TERMS[i],
        year,
        month,
        day,
        jdn: gregorianToJDN(year, month, day)
      });
    }
  }
  return list.sort((a, b) => a.jdn - b.jdn);
}

// 某日恰逢哪个节气（非节气日返回 undefined）
export function findTermOn(jdn: number, terms: TermDate[]): TermDate | undefined {
  return terms.find(t => t.jdn === jdn);
}

// 从某日之后找第一个满足条件的节气日（不含当天）
export function findNextTerm(
  fromJdn: number,
  terms: TermDate[],
  predicate: (term: TermDate) => boolean,
  maxJdn: number = fromJdn + 90
): TermDate | undefined {
  return terms.find(t => t.jdn > fromJdn && t.jdn <= maxJdn && predicate(t));
}

// 距某日最近的前一个、后一个节气（用于「距芒种还有几天」之类的提示）
export function findNearestTerms(jdn: number, terms: TermDate[]): { prev?: TermDate; next?: TermDate } {
  let prev: TermDate | undefined;
  let next: TermDate | undefined;
  for (const t of terms) {
    if (t.jdn < jdn) prev = t;
    if (t.jdn > jdn && !next) next = t;
    if (t.jdn > jdn) break;
  }
  return { prev, next };
}
