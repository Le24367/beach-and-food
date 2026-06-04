import { defineType, defineField } from 'sanity'

export default defineType({
  name: 'siteSettings',
  title: 'Einstellungen',
  type: 'document',
  icon: () => '⚙️',
  // Nur ein einziges Dokument soll existieren (Singleton)
  __experimental_actions: ['update', 'publish'],

  fields: [
    // ── Adresse ──────────────────────────────────────────────
    defineField({
      name: 'address',
      title: 'Adresse',
      type: 'object',
      fields: [
        defineField({ name: 'name',     title: 'Name / Ort',    type: 'string', initialValue: 'Campingplatz Sütel' }),
        defineField({ name: 'street',   title: 'Straße',        type: 'string', initialValue: 'Sütel-Strand' }),
        defineField({ name: 'zip',      title: 'PLZ + Stadt',   type: 'string', initialValue: '23779 Neukirchen' }),
        defineField({
          name: 'mapsUrl',
          title: 'Google Maps Link',
          type: 'url',
          initialValue: 'https://maps.google.com/?q=Campingplatz+Sütel+Neukirchen',
        }),
      ],
    }),

    // ── Kontakt ───────────────────────────────────────────────
    defineField({
      name: 'contact',
      title: 'Kontakt',
      type: 'object',
      fields: [
        defineField({ name: 'email',    title: 'E-Mail',        type: 'string', initialValue: 'info@beachandfood.de' }),
        defineField({ name: 'whatsapp', title: 'WhatsApp-Link', type: 'url',    initialValue: 'https://wa.me/4915164652760' }),
        defineField({ name: 'whatsappDisplay', title: 'WhatsApp anzeigen als', type: 'string', initialValue: '0151 64652760' }),
      ],
    }),

    // ── Öffnungszeiten ────────────────────────────────────────
    defineField({
      name: 'openingHours',
      title: 'Öffnungszeiten',
      type: 'array',
      description: 'Jede Zeile erscheint in der Kontakt-Sektion.',
      of: [
        {
          type: 'object',
          name: 'hoursEntry',
          fields: [
            defineField({
              name: 'days',
              title: 'Tage',
              type: 'string',
              description: 'z.B. "Mo – Do" oder "Fr – So"',
            }),
            defineField({
              name: 'hours',
              title: 'Uhrzeit',
              type: 'string',
              description: 'z.B. "11:30 – 20:00" oder "Geschlossen"',
            }),
            defineField({
              name: 'closed',
              title: 'Geschlossen?',
              type: 'boolean',
              description: 'Wenn aktiv, wird der Eintrag grau dargestellt.',
              initialValue: false,
            }),
          ],
          preview: {
            select: { days: 'days', hours: 'hours', closed: 'closed' },
            prepare({ days, hours, closed }) {
              return { title: `${days}: ${hours}`, subtitle: closed ? 'Geschlossen' : 'Geöffnet' }
            },
          },
        },
      ],
      initialValue: [
        { _type: 'hoursEntry', _key: 'mo-do', days: 'Mo – Do', hours: 'Geschlossen', closed: true },
        { _type: 'hoursEntry', _key: 'fr-so', days: 'Fr – So', hours: '11:30 – 20:00', closed: false },
      ],
    }),

    // ── Saison-Hinweis ────────────────────────────────────────
    defineField({
      name: 'seasonNote',
      title: 'Saison-Hinweis (optional)',
      type: 'string',
      description: 'z.B. "Geöffnet Mai – September" — wird unter den Öffnungszeiten angezeigt.',
    }),
  ],

  preview: {
    prepare() {
      return { title: 'Seiteneinstellungen' }
    },
  },
})
