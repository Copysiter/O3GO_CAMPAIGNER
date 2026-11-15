/** Localized manual content is kept separately from its presentation. */
export type ManualText = { ru: string; en: string };

export type ManualBlock =
  | { type: 'paragraph' | 'note'; text: ManualText }
  | { type: 'list' | 'steps'; items: ManualText[] }
  | { type: 'table'; columns: ManualText[]; rows: ManualText[][] }
  | { type: 'code'; code: string; language?: string; title?: ManualText };

export type ManualSection = {
  id: string;
  title: ManualText;
  blocks: ManualBlock[];
};

export const manualLabels = {
  navigation: { ru: 'Разделы руководства', en: 'Guide sections' },
  interface: { ru: 'Интерфейс', en: 'Interface' },
  api: { ru: 'Внешний API', en: 'External API' },
  contents: { ru: 'Содержание', en: 'Contents' },
  copy: { ru: 'Копировать пример', en: 'Copy example' },
  copied: { ru: 'Скопировано', en: 'Copied' },
  copyFailed: {
    ru: 'Не удалось скопировать. Выделите и скопируйте пример вручную.',
    en: 'Could not copy. Select and copy the example manually.',
  },
  interfaceIntro: {
    ru: 'Как загрузить получателей, разделить рассылку по странам, скачать отчёт по ссылкам и проверить доставку сообщений.',
    en: 'Import recipients, split a campaign by country, download the link report and track message delivery.',
  },
  apiIntro: {
    ru: 'Создание рассылок, отправка сообщений и получение результатов через внешний API. В примерах подставьте адрес своего сервера и выданный вам ключ.',
    en: 'Create campaigns, submit messages and receive delivery results through the external API. Use your server address and issued key in the examples.',
  },
} satisfies Record<string, ManualText>;
