import type { PlanResponse } from '../types/api';

// Export plánu do kalendáře (.ics) - každá zastávka jako událost
const escapeIcs = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

function dayEvents(plan: PlanResponse, date: string, stamp: string) {
    const day = date.replace(/-/g, '');
    return plan.itinerary
        .filter(i => i.type === 'poi')
        .map((i, idx) => [
            'BEGIN:VEVENT',
            `UID:krusnoplan-${day}-${idx}-${i.poi_id ?? idx}@krusnoplan`,
            `DTSTAMP:${stamp}`,
            `DTSTART;TZID=Europe/Prague:${day}T${i.start.replace(':', '')}00`,
            `DTEND;TZID=Europe/Prague:${day}T${i.end.replace(':', '')}00`,
            `SUMMARY:${escapeIcs(i.title ?? 'Zastávka')}`,
            i.address ? `LOCATION:${escapeIcs(i.address)}` : `GEO:${i.lat};${i.lng}`,
            i.description ? `DESCRIPTION:${escapeIcs(i.description.slice(0, 500))}` : '',
            i.website ? `URL:${i.website}` : '',
            'END:VEVENT',
        ].filter(Boolean).join('\r\n'));
}

function saveIcs(name: string, events: string[], fileName: string) {
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KrusnoPlan//Planovac vyletu//CS', 'CALSCALE:GREGORIAN',
        `X-WR-CALNAME:${escapeIcs(name)}`, ...events, 'END:VCALENDAR'].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
}

const stampNow = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const slug = (s: string) => s.replace(/\s+/g, '-');

export function downloadIcs(plan: PlanResponse, date: string) {
    saveIcs(`Výlet – ${plan.location}`, dayEvents(plan, date, stampNow()), `vylet-${slug(plan.location)}-${date}.ics`);
}

// Celá dovolená v jednom souboru - všechny dny za sebou
export function downloadTripIcs(days: { plan: PlanResponse; date: string }[], title: string) {
    const stamp = stampNow();
    const events = days.flatMap(d => dayEvents(d.plan, d.date, stamp));
    saveIcs(`Dovolená – ${title}`, events, `dovolena-${slug(title)}-${days[0]?.date ?? ''}.ics`);
}
