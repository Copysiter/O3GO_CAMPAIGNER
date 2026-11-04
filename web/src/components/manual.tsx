'use client'

import { useI18n } from '@/lib/i18n'
export function Manual() {
  const { t } = useI18n()
  return (
    <div className="resource-page">
      <div className="resource-body scroll-content">
        <article className="max-w-4xl space-y-4 text-sm leading-relaxed">
          <section className="panel space-y-3 p-4">
            <h2 className="text-sm font-semibold">
              {t('Таблицы и сенсорный экран')}
            </h2>
            <p>
              {t(
                'Компактный режим показывает основные колонки. Кнопка ⋯ открывает все поля и действия строки. Контекстное меню доступно правой кнопкой мыши или долгим нажатием.',
              )}
            </p>
            <p>
              {t(
                'В меню «Колонки» можно выбрать видимые поля или включить полную таблицу с внутренней горизонтальной прокруткой. Мультивыбор действует на текущую страницу и сбрасывается при смене страницы или фильтров.',
              )}
            </p>
          </section>
          <section className="panel space-y-3 p-4">
            <h2 className="text-sm font-semibold">{t('Создание кампании')}</h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                {t(
                  'Аудитория: название, владелец, webhook, API-ключи, устройства и теги. Вставьте контакты или загрузите CSV/TXT/XLS/XLSX; сопоставьте телефон и пять дополнительных полей.',
                )}
              </li>
              <li>
                {t(
                  'Сообщение: шаблон, сокращение ссылок и AI-рерайт. Доступные параметры зависят от прав пользователя.',
                )}
              </li>
              <li>
                {t(
                  'Расписание: приоритет, попытки, таймауты, даты и часы отправки по UTC. Выбранные часы можно скопировать на всю неделю.',
                )}
              </li>
              <li>
                {t(
                  'Clicker: необязательные URL, количество кликов, география, UTM и период.',
                )}
              </li>
            </ol>
            <p>
              {t(
                'Создание не запускает отправку. Нажмите «Запустить» и подтвердите действие. «Повторить недоставленные» создаёт отдельную кампанию.',
              )}
            </p>
          </section>
          <section className="panel space-y-3 p-4">
            <h2 className="text-sm font-semibold">{t('Шаблоны и ссылки')}</h2>
            <pre className="overflow-auto rounded-sm bg-background p-3 text-xs">
              {'Hello, {field_1}!\nYour offer: [short]{field_2}[/short]'}
            </pre>
            <p>
              {t(
                'Поддерживаются поля {field_1} … {field_5}. Для сокращения ссылки используйте [short]https://example.com[/short]. Предпросмотр использует первую строку контактов; окончательный текст подготавливает сервер.',
              )}
            </p>
          </section>
          <section className="panel space-y-3 p-4">
            <h2 className="text-sm font-semibold">{t('Фильтры')}</h2>
            <p>
              {t(
                'Условия добавляются над таблицей или из заголовка колонки. Поддерживаются сравнения, строковые операторы, пустые значения и NULL. Разные поля объединяются через И. Статусы и теги позволяют выбрать несколько значений «любое из».',
              )}
            </p>
            <p>
              {t(
                'Сортировка, фильтрация и пагинация выполняются сервером и работают со всей базой.',
              )}
            </p>
          </section>
          <section className="panel space-y-3 p-4">
            <h2 className="text-sm font-semibold">{t('Внешний API')}</h2>
            <p>
              {t(
                'Передавайте выданный API-ключ в заголовке X-Api-Key. Внешний id связывает сообщение с вашей системой; webhook кампании получает изменения статуса.',
              )}
            </p>
            <pre className="overflow-auto rounded-sm bg-background p-3 text-xs leading-relaxed">{`curl -X POST 'http://YOUR_API_HOST:5001/ext/api/v1/messages/send' \\
  -H 'Content-Type: application/json' \\
  -H 'X-Api-Key: YOUR_API_KEY' \\
  -d '[{"id":"external-123","campaign_id":1,"dst_addr":"79990000000","text":"Message","field_1":"Name"}]'`}</pre>
            <p>{t('Актуальная схема API доступна в Swagger: :5001/docs.')}</p>
          </section>
          <section className="panel space-y-3 p-4">
            <h2 className="text-sm font-semibold">{t('Действия и доступ')}</h2>
            <p>
              {t(
                'Удаление и запуск требуют подтверждения. При частичной ошибке массовой операции повторяются только неуспешные записи. Отчёт Excel доступен в кампании.',
              )}
            </p>
            <p>
              {t(
                'Пользователи, WA-аккаунты и версии APK доступны администратору. Остальные действия зависят от назначенных прав. Тема, цвета и язык настраиваются в меню «Внешний вид».',
              )}
            </p>
          </section>
        </article>
      </div>
    </div>
  )
}
