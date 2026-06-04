import { defineType, defineField } from 'sanity'

export default defineType({
  name: 'menuCategory',
  title: 'Speisekarte – Kategorie',
  type: 'document',
  icon: () => '🍽️',
  fields: [
    defineField({
      name: 'title',
      title: 'Name der Kategorie',
      type: 'string',
      description: 'z.B. "Fischbrötchen", "Currywurst", "Pommes frites"',
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'slug',
      title: 'Slug (URL-Kürzel)',
      type: 'slug',
      options: { source: 'title' },
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'description',
      title: 'Beschreibung',
      type: 'text',
      rows: 3,
      description: 'Kurzbeschreibung die auf der Kachel erscheint.',
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'image',
      title: 'Kategoriebild',
      type: 'image',
      description: 'Bild das auf der Kachel angezeigt wird (empfohlen: quadratisch oder 4:3).',
      options: { hotspot: true },
    }),

    defineField({
      name: 'emoji',
      title: 'Emoji (optional)',
      type: 'string',
      description: 'Wird angezeigt wenn kein Bild hinterlegt ist, z.B. 🐟 oder 🍟',
    }),

    defineField({
      name: 'badge',
      title: 'Badge',
      type: 'object',
      description: 'Kleines Label auf der Kachel, z.B. "Beliebt" oder "167°C".',
      fields: [
        defineField({
          name: 'label',
          title: 'Text',
          type: 'string',
          description: 'z.B. "Beliebt", "Klassiker", "Neu", "167°C"',
        }),
        defineField({
          name: 'color',
          title: 'Farbe',
          type: 'string',
          description: 'Hex-Farbe des Badge-Hintergrunds',
          options: {
            list: [
              { title: '🔴 Coral (Standard)', value: '#E85D3A' },
              { title: '🟡 Gelb / Sun', value: '#F4A820' },
              { title: '🟢 Grün / Fresh', value: '#3A8C6E' },
              { title: '🔵 Ozean', value: '#1A3A4A' },
              { title: '⚪ Eigene Farbe eingeben', value: 'custom' },
            ],
          },
        }),
        defineField({
          name: 'customColor',
          title: 'Eigene Hex-Farbe',
          type: 'string',
          description: 'Nur ausfüllen wenn oben "Eigene Farbe" gewählt — z.B. #A020F0',
          hidden: ({ parent }) => parent?.color !== 'custom',
        }),
      ],
    }),

    defineField({
      name: 'order',
      title: 'Reihenfolge',
      type: 'number',
      description: 'Niedrigere Zahl = weiter vorne. Kacheln werden aufsteigend sortiert.',
      initialValue: 10,
    }),

    defineField({
      name: 'active',
      title: 'Aktiv / sichtbar',
      type: 'boolean',
      description: 'Deaktivierte Kategorien werden auf der Webseite nicht angezeigt.',
      initialValue: true,
    }),
  ],

  preview: {
    select: {
      title: 'title',
      subtitle: 'description',
      media: 'image',
      badge: 'badge.label',
      active: 'active',
    },
    prepare({ title, subtitle, media, badge, active }) {
      return {
        title: `${active === false ? '🚫 ' : ''}${title}${badge ? ` · ${badge}` : ''}`,
        subtitle,
        media,
      }
    },
  },

  orderings: [
    {
      title: 'Reihenfolge (manuell)',
      name: 'orderAsc',
      by: [{ field: 'order', direction: 'asc' }],
    },
  ],
})
