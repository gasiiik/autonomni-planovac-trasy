import type { PlanResponse } from '../types/api';

// Export plánu do kalendáře (.ics) - každá zastávka jako událost
const escapeIcs = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export function downloadIcs(plan: PlanResponse, date: string) {
    const day = date.replace(/-/g, '');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const events = plan.itinerary
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

    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KrusnoPlan//Planovac vyletu//CS', 'CALSCALE:GREGORIAN',
        `X-WR-CALNAME:Výlet – ${plan.location}`, ...events, 'END:VCALENDAR'].join('\r\n');

    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `vylet-${plan.location.replace(/\s+/g, '-')}-${date}.ics`;
    a.click();
    URL.revokeObjectURL(url);
}
