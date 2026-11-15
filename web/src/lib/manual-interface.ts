import type { ManualSection, ManualText } from './manual-content'

const text = (ru: string, en: string): ManualText => ({ ru, en })

export const manualInterfaceSections: ManualSection[] = [
  {
    id: 'ui-workspace',
    title: text('Начало работы и навигация', 'Getting started and navigation'),
    blocks: [
      {
        type: 'paragraph',
        text: text(
          'Войдите с логином и паролем своей учётной записи. В боковом меню доступны «Рассылки», «Теги», «API-ключи», «Руководство» и, для администратора, «Пользователи». Видимость разделов, полей и действий зависит от выданных прав.',
          'Sign in with your account login and password. The sidebar contains Campaigns, Tags, API keys and Guide. Administrators also have Users. Your permissions determine which sections, fields and actions are available.',
        ),
      },
      {
        type: 'steps',
        items: [
          text('Откройте «Рассылки» и нажмите «Новая рассылка» справа над таблицей. На телефоне это кнопка «+».', 'Open Campaigns and select New campaign on the right above the table. On a phone, use the + button.'),
          text('Пройдите четыре шага мастера — аудитория, сообщение, расписание и необязательный Clicker. На последнем шаге нажмите «Создать».', 'Complete the four wizard steps — Audience, Message, Schedule and optional Clicker. Select Create on the last step.'),
          text('Откройте рассылку по её названию, проверьте получателей, тексты и часы отправки. Когда будете готовы к отправке, нажмите «Запустить» и подтвердите действие.', 'Open the campaign by name and check the recipients, messages and sending hours. When you are ready to send, select Start and confirm.'),
          text('Следите за статистикой и статусами сообщений. При необходимости поставьте рассылку на паузу, измените настройки или скачайте отчёт Excel.', 'Monitor statistics and message statuses. Pause the campaign, change its settings or download an Excel report when needed.'),
        ],
      },
      {
        type: 'paragraph',
        text: text(
          'Верхняя строка показывает текущий раздел и название открытой рассылки. На компьютере боковое меню можно раскрыть или свернуть, на телефоне его открывает кнопка меню. Профиль находится внизу боковой панели, настройки внешнего вида — по кнопке с ползунками в верхней панели.',
          'The top bar shows the current section and the name of the open campaign. Expand or collapse the sidebar on desktop, or use the menu button on a phone. Your profile is at the bottom of the sidebar; the sliders button in the top bar opens appearance settings.',
        ),
      },
      {
        type: 'note',
        text: text(
          'После импорта файла результат содержит ссылки на созданные рассылки. Каждая из них получает статус «Создана» и запускается отдельно. Чтобы запустить несколько сразу, отметьте их в списке и нажмите «Запустить».',
          'After a file import, the result window links to each new campaign. Each has the Created status and can be started independently. To start several together, select them in the campaign list and choose Start.',
        ),
      },
    ],
  },
  {
    id: 'ui-tables',
    title: text('Таблицы, колонки и сенсорный экран', 'Tables, columns and touch controls'),
    blocks: [
      {
        type: 'table',
        columns: [text('Элемент', 'Control'), text('Как пользоваться', 'How to use it')],
        rows: [
          [text('Компактно', 'Compact'), text('В меню «Колонки» отметьте приоритетные поля. Последнее добавленное поле выводится первым. Таблица учитывает ширину заголовков и содержимого и показывает от одной до пяти колонок в порядке приоритета. Остальные поля откройте через ⋯ → «Все поля и подробности».', 'Choose priority fields under Columns. The last field you add comes first. The table fits one to five columns in priority order, depending on the available width, headings and contents. Open ⋯ → All fields and details for the rest.')],
          [text('Прокрутка', 'Scroll'), text('Показывает выбранные видимые колонки с горизонтальной прокруткой внутри таблицы. Используйте переключатель рядом с «Колонки» или выберите режим в самом меню.', 'Shows the selected visible columns with horizontal scrolling inside the table. Use the button next to Columns or select the mode in that menu.')],
          [text('Автоматически', 'Automatic'), text('На ширине меньше 768 px включает компактный режим, на более широком экране — прокрутку. Ручной выбор режима и колонок сохраняется для этой таблицы в браузере.', 'Uses compact view below 768 px and scrolling view on wider screens. Manual mode and column choices are saved for this table in the browser.')],
          [text('Заголовок колонки', 'Column heading'), text('Нажмите заголовок со стрелкой, чтобы отсортировать всю выборку. Повторное нажатие меняет направление. По умолчанию рассылки идут от большего ID к меньшему, сообщения — от меньшего к большему.', 'Select a heading with a sort arrow to sort the full result. Select it again to reverse the order. Campaigns default to descending ID order and messages to ascending ID order.')],
          [text('⋯ в строке', 'Row ⋯ menu'), text('Открывает подробности и доступные действия. Для рассылки можно перейти к сообщениям. На компьютере контекстное меню также открывается правой кнопкой, на сенсорном экране — долгим нажатием на строку.', 'Opens details and available actions. For a campaign, you can open its messages. Right-click a row on desktop or long-press it on a touch screen to open the context menu.')],
          [text('Флажки строк', 'Row checkboxes'), text('Позволяют выбрать несколько записей. Флажок в шапке выбирает текущую страницу. После выбора появляется панель групповых действий. Выделение сбрасывается при смене страницы, размера страницы, сортировки или фильтров.', 'Select multiple records. The header checkbox selects the current page. A bulk action bar appears after selection. Selection resets when the page, page size, sorting or filters change.')],
          [text('Обновить', 'Refresh'), text('Запрашивает данные заново. Во время ручного обновления и смены выборки поверх таблицы появляется «Загрузка...». На телефоне текст кнопки скрыт, остаётся круговая стрелка.', 'Fetches the data again. Manual refreshes and result changes display a Loading... overlay. On a phone, the button shows only a circular arrow.')],
          [text('Подвал таблицы', 'Table footer'), text('Задаёт количество строк и переключает страницы. Для сообщений доступны 100, 250, 500 и 1000 строк, в остальных таблицах также есть 20 и 50.', 'Controls page size and pagination. Message tables offer 100, 250, 500 and 1000 rows; other tables also offer 20 and 50.')],
        ],
      },
      {
        type: 'paragraph',
        text: text(
          'В компактном режиме ID показан под названием рассылки или номером получателя. В полном режиме его можно включить отдельной колонкой. Настройки колонок можно вернуть командой «Сбросить колонки». Строки прокручиваются внутри таблицы, её инструменты и подвал остаются доступны.',
          'Compact view shows the ID below the campaign name or recipient number. In full view, enable it as a separate column. Use Reset columns to restore the default columns. Rows scroll inside the table while its controls and footer remain available.',
        ),
      },
    ],
  },
  {
    id: 'ui-filters',
    title: text('Фильтры', 'Filters'),
    blocks: [
      {
        type: 'steps',
        items: [
          text('Нажмите «Фильтры» над таблицей. На широком экране можно также открыть фильтр кнопкой в заголовке нужной колонки.', 'Select Filters above the table. On a wider screen, you can also use the filter button in the desired column heading.'),
          text('Для каждого условия выберите колонку, оператор и значение. Кнопка «+» слева внизу окна добавляет условие, крестик рядом с условием удаляет его.', 'For each condition, choose a column, operator and value. The + button at the bottom left adds a condition; the cross next to a condition removes it.'),
          text('Нажмите «Применить». «Отмена» закрывает окно без изменения действующих фильтров. Для полного сброса удалите все условия и примените пустой список.', 'Select Apply. Cancel closes the dialog without changing the active filters. To clear all filters, remove every condition and apply the empty list.'),
        ],
      },
      {
        type: 'table',
        columns: [text('Тип поля', 'Field type'), text('Доступные сравнения', 'Available comparisons')],
        rows: [
          [text('Текст', 'Text'), text('Равно, не равно, содержит, не содержит, начинается с, заканчивается на. Также проверки NULL, пустой строки и их сочетаний.', 'Equals, not equal, contains, does not contain, starts with and ends with. Also checks for NULL, empty strings and their combinations.')],
          [text('Число или дата', 'Number or date'), text('Равно, не равно, больше, больше или равно, меньше, меньше или равно, задано или NULL. Даты и время указываются в UTC.', 'Equals, not equal, greater than, greater than or equal, less than, less than or equal, set or NULL. Dates and times use UTC.')],
          [text('Статус рассылки, теги, API-ключи', 'Campaign status, tags, API keys'), text('«Любое из выбранных» — отметьте одно или несколько значений. Для тегов и API-ключей достаточно одного совпадения в соответствующем поле.', 'Any selected value — choose one or more values. For tags and API keys, one match in the corresponding field is enough.')],
          [text('Статус сообщения', 'Message status'), text('Отметьте нужные статусы в «Любое из выбранных». Чтобы включить сообщения без статуса, добавьте «Не задано (NULL)» в тот же список. Для одного условия также доступны «Равно», «Не равно», «Задано» и «Не задано (NULL)».', 'Under Any selected value, choose the statuses to include. Add Not set (NULL) to the same selection to include messages with no status. You can also use Equals, Not equal, Set or Not set (NULL).')],
          [text('Другие перечисления', 'Other enumerations'), text('Равно, не равно, в списке, задано или NULL.', 'Equals, not equal, in list, set or NULL.')],
          [text('Да / Нет', 'Yes / No'), text('Да, нет, задано или NULL. Дополнительное значение не требуется.', 'Yes, no, set or NULL. No additional value is needed.')],
        ],
      },
      {
        type: 'paragraph',
        text: text(
          'В фильтре рассылок откройте список значений, найдите нужные теги или API-ключи по названию и отметьте их. Например, если выбрать два ключа и статус «В работе», таблица покажет работающие рассылки хотя бы с одним из этих ключей. Кнопка «Сбросить» в списке значений снимает все отметки этого поля.',
          'In a campaign filter, open the value list and search for the tags or API keys you need. For example, choosing two keys and the Running status shows running campaigns assigned either key. Reset in the value list clears all selections for that field.',
        ),
      },
      {
        type: 'note',
        text: text(
          'Фильтры, сортировка и страницы запрашиваются у сервера. Счётчик записей таблицы учитывает фильтры. Сводные блоки над списком рассылок показывают все доступные рассылки и от фильтров таблицы не зависят.',
          'Filtering, sorting and pagination are performed by the server. The table record count reflects the filters. Summary cards above the campaign list cover all accessible campaigns and are independent of table filters.',
        ),
      },
    ],
  },
  {
    id: 'ui-audience',
    title: text('Создание рассылки — аудитория и импорт', 'Creating a campaign — audience and import'),
    blocks: [
      {
        type: 'paragraph',
        text: text(
          'На шаге «Аудитория» укажите название. При необходимости заполните Webhook URL для получения статусов во внешней системе. В зависимости от прав доступны назначение API-ключей, Android-устройств и тегов. Администратор может выбрать владельца.',
          'In Audience, enter a name. Optionally set a Webhook URL to receive statuses in an external system. Depending on your permissions, you can assign API keys, Android devices and tags. Administrators can choose an owner.',
        ),
      },
      {
        type: 'table',
        columns: [text('Источник', 'Source'), text('Подготовка', 'Preparation')],
        rows: [
          [text('Вставить текст', 'Paste text'), text('По умолчанию один получатель занимает строку, колонки разделяются точкой с запятой. Можно выбрать другие разделители строк и колонок. Пустые строки пропускаются. Если есть заголовок, укажите число начальных строк в «Пропустить строк».', 'By default, each recipient occupies one line and columns are separated by semicolons. You can change both separators. Empty lines are ignored. If the data has a header, set the number of leading rows under Skip rows.')],
          [text('CSV / TXT', 'CSV / TXT'), text('Загрузите один файл с телефонами и дополнительными колонками. Разделитель определяется автоматически из точки с запятой, запятой, табуляции и вертикальной черты. Подойдёт и список с одним телефоном на строке.', 'Upload one file with phone numbers and optional additional columns. The importer detects semicolons, commas, tabs and vertical bars. A single column with one phone number per line also works.')],
          [text('XLS / XLSX', 'XLS / XLSX'), text('Загрузите одну книгу. Импорт включает все непустые листы. На шаге «Сообщение» проверьте сопоставление колонок и заголовок каждого листа отдельно. Телефоны могут находиться в разных колонках на разных листах.', 'Upload one workbook. All non-empty sheets are included. In Message, check each sheet’s column mapping and header separately. The phone column can differ between sheets.')],
          [text('ZIP', 'ZIP'), text('Сложите в архив TXT-списки в UTF-8, по одному телефону на строку. Допускаются цифры, начальный + и пробелы. Импорт объединяет списки, в том числе из вложенных папок. Файлы других форматов пропускаются с предупреждением.', 'Add UTF-8 TXT lists to the archive, with one phone number per line. Use digits, an optional leading + and spaces. The importer merges the lists, including those in subfolders. Other file formats are skipped with a warning.')],
          [text('text.txt внутри ZIP', 'text.txt inside a ZIP'), text('В этот необязательный файл поместите общий текст сообщения. Мастер переносит его в шаблон вместе с переносами строк. Если таких файлов несколько, используется первый. Шаблон можно изменить или ввести вручную, если файла нет.', 'Use this optional file for the shared message. The wizard copies it into the template and keeps line breaks. If there are several files named text.txt, it uses the first. Edit the template or enter it manually if you omit the file.')],
        ],
      },
      {
        type: 'code',
        title: text('Пример текста без заголовка — телефон, имя, ссылка', 'Headerless text example — phone, name, link'),
        code: '79990000001;Alex;https://example.com/offer/1\n79990000002;Sam;https://example.com/offer/2',
        language: 'text',
      },
      {
        type: 'steps',
        items: [
          text('На шаге «Сообщение» проверьте образец. Для текста и таблиц выберите колонку телефона и до пяти полей {field_1} … {field_5}. Для остальных полей оставьте «Не использовать». Для TXT-списков внутри ZIP колонка телефона уже выбрана.', 'In Message, check the sample. For pasted text and tabular files, choose the phone column and up to five fields, {field_1} … {field_5}. Leave unused fields set to Do not use. For TXT lists inside a ZIP, the phone column is already selected.'),
          text('Для CSV, TXT и листов Excel проверьте отметку «Первая строка — названия колонок». Отмеченная строка зачёркивается в образце и пропускается при создании.', 'For CSV, TXT and Excel sheets, check The first row contains column names. A checked header is crossed out in the sample and excluded when the campaign is created.'),
          text('При загрузке файла оставьте «Страна для местных номеров» пустой для номеров с кодом страны, с плюсом или без него. Для местного формата укажите двухбуквенный код, например RU или KZ. Мастер проверит формат номера и определит страну.', 'For file uploads, leave Country for national-format numbers blank when each number includes a country code, with or without a leading +. For national numbers, enter a two-letter country code such as RU or KZ. The wizard validates the number format and identifies the country.'),
          text('В предпросмотре сверьте количество принятых строк и ошибок. Исправьте источник и загрузите файл повторно либо отметьте «Пропустить строки с ошибками». Для создания нужен хотя бы один корректный номер. Каждая принятая строка создаёт сообщение, включая строки с повторяющимися номерами.', 'Check the accepted row count and errors in the preview. Correct and re-upload the source file or select Skip rows with errors. At least one valid number is required. Each accepted row creates a message, including rows with duplicate numbers.'),
        ],
      },
      {
        type: 'note',
        text: text(
          'Дополнительный переключатель «Проверить номера получателей» на шаге «Аудитория» запускает фоновую проверку после создания. Её результат появится в колонке «Оценка» таблицы сообщений.',
          'The optional Check recipient numbers switch in Audience starts a background check after creation. Its result appears in the Score column of the message table.',
        ),
      },
    ],
  },
  {
    id: 'ui-import-geo',
    title: text('Разделение по GEO и отчёт по ссылкам', 'Splitting by GEO and the link report'),
    blocks: [
      {
        type: 'steps',
        items: [
          text('При вставке номеров в текстовое поле мастер создаёт одну рассылку. При загрузке файла по умолчанию создаётся одна рассылка для всех стран. Чтобы управлять каждой страной отдельно, включите «Разделить по GEO» на шаге «Сообщение».', 'Pasting numbers into the text field creates one campaign. When uploading a file, keep one campaign for all countries or enable Split by GEO in the Message step to manage each country separately.'),
          text('В предпросмотре появятся названия и количество сообщений для каждой страны, например «[ru] Акция» и «[kz] Акция». Корректные номера без определённой страны попадают в группу [unknown]. На последнем шаге кнопка «Создать» показывает количество рассылок.', 'The preview shows a campaign name and message count for each country, such as “[ru] Offer” and “[kz] Offer”. Valid numbers without an identified country go in the [unknown] group. On the last step, the Create button shows how many campaigns it will create.'),
          text('В окне «Рассылки созданы» нажмите «Ссылки по GEO — Excel» до перехода к рассылкам. Один файл охватывает все рассылки этой загрузки. Он доступен и при выключенном разделении по GEO.', 'In Campaigns created, select Links by GEO — Excel before opening a campaign or returning to the list. One workbook covers the whole upload, including when Split by GEO is off.'),
        ],
      },
      {
        type: 'table',
        columns: [text('В отчёте', 'In the report'), text('Как читать', 'How to read it')],
        rows: [
          [text('Гео и ссылка', 'Country and link'), text('Для каждого сообщения берётся первая HTTP(S)-ссылка в [short]…[/short], а если такой нет — первая HTTP(S)-ссылка в тексте. Используется исходный адрес после подстановки полей, до сокращения и AI-рерайта. Номера без ссылки попадают в строку «Без ссылки».', 'For each message, the report uses the first HTTP(S) link marked with [short]…[/short], or the first HTTP(S) link in the text if none is marked. It uses the original URL after field substitution and before shortening or AI rewriting. Messages without a URL are grouped under «Без ссылки» (no link).')],
          [text('Количество и итог', 'Count and total'), text('В каждой паре «страна и ссылка» телефон учитывается один раз. В строке «ИТОГО» он учитывается один раз за всю загрузку, даже если встречается с разными ссылками.', 'A phone number counts once for each country and link pair. In the «ИТОГО» (total) row it counts once across the upload, even if it appeared with different links.')],
        ],
      },
    ],
  },
  {
    id: 'ui-message',
    title: text('Шаблон сообщения, ссылки и AI-рерайт', 'Message template, links and AI rewriting'),
    blocks: [
      {
        type: 'paragraph',
        text: text(
          'Шаблон обязателен при создании через интерфейс. Подстановки {field_1} … {field_5} берут значения из сопоставленных колонок каждого получателя. Проверьте предпросмотр и число символов под шаблоном.',
          'The interface requires a message template for creation. Placeholders {field_1} … {field_5} take values from each recipient’s mapped columns. Check the preview and character count below the template.',
        ),
      },
      {
        type: 'code',
        title: text('Шаблон для примера импорта', 'Template for the import example'),
        code: 'Hello, {field_1}! Your offer: [short]{field_2}[/short]',
        language: 'text',
      },
      {
        type: 'list',
        items: [
          text('Чтобы сократить конкретную ссылку, заключите её в [short]…[/short]. Внутри можно указать URL напрямую или подстановку поля. Переключатель автоматического сокращения обрабатывает ссылки без ручных меток, если это разрешено вашей учётной записи.', 'Wrap a specific link in [short]…[/short] to shorten it. Put a URL or a field placeholder inside. Automatic link shortening handles unmarked links when your account is allowed to use it.'),
          text('«Отдельная короткая ссылка для каждого получателя» включает индивидуальные короткие ссылки. Это полезно, когда нужно различать переходы получателей.', 'Separate short link for each recipient enables individual short links. Use it when recipient-level click tracking is needed.'),
          text('Для AI-рерайта выберите «Включён», провайдера OpenRouter или Ollama и, если доступно, модель. Пустой системный промпт означает использование настройки сервера.', 'For AI rewriting, select On, choose OpenRouter or Ollama and, when available, a model. Leaving the system prompt empty uses the server setting.'),
          text('Предпросмотр подставляет данные образца, но не вызывает AI и сервис сокращения. Окончательный текст появляется после серверной подготовки. Сообщения, ожидающие этой обработки, имеют статус «Подготовка».', 'The preview inserts sample values but does not call AI or the shortening service. Final text becomes available after server-side preparation. Messages waiting for it have the Preparing status.'),
        ],
      },
      {
        type: 'note',
        text: text(
          'Редактирование шаблона в настройках существующей рассылки не пересоздаёт уже подготовленные тексты сообщений. Перед отправкой проверяйте текст в таблице сообщений. Загрузка новой аудитории и параметры AI/Clicker доступны в мастере создания, а не в форме редактирования.',
          'Editing an existing campaign’s template does not regenerate message texts that have already been prepared. Check the message table before sending. Importing a new audience and configuring AI/Clicker are available in the creation wizard, not in the edit form.',
        ),
      },
    ],
  },
  {
    id: 'ui-schedule',
    title: text('Расписание и параметры отправки', 'Schedule and sending settings'),
    blocks: [
      {
        type: 'table',
        columns: [text('Параметр', 'Setting'), text('Значение', 'Meaning')],
        rows: [
          [text('Приоритет', 'Priority'), text('При автоматическом выборе рассылки меньшее число выбирается раньше. При равном приоритете учитывается число уже отправленных сообщений.', 'Automatic campaign selection prefers a smaller number. With equal priority, the number of messages already sent is considered.')],
          [text('Попытки отправки', 'Sending attempts'), text('Целое число не меньше 1. Попытки расходуются при выдаче сообщения отправляющей интеграции. Изменение настройки обновляет оставшиеся попытки сообщений, которые ещё не завершены доставкой или недоставкой.', 'A whole number of at least 1. Attempts are consumed when a message is handed to a sending integration. Changing this setting updates remaining attempts for messages that have not reached Delivered or Undelivered.')],
          [text('Таймаут отправки, сек.', 'Sending timeout, sec'), text('Для сообщений из файла отсчёт начинается при первом запуске рассылки или с указанного времени начала, если оно ещё впереди. Для получателей из вставленного текста и для повторной рассылки [Retry] отсчёт начинается при создании. Значение 0 отключает таймаут.', 'For messages imported from a file, the countdown begins at first campaign start or at the configured start time if it is still in the future. For pasted recipients and [Retry] campaigns, the countdown begins at creation. A value of 0 disables the timeout.')],
          [text('Таймаут статуса, сек.', 'Status timeout, sec'), text('Срок ожидания результата после отправки. Истечение таймаутов обрабатывается сервером в фоне, поэтому статусы меняются не обязательно в ту же секунду.', 'Time allowed for a result after sending. The server processes expiration in the background, so a status may not change at the exact second the timeout expires.')],
          [text('Лимит переходов', 'Follow limit'), text('Количество выдач сообщений с признаком follow для поддерживающих его отправляющих интеграций. Это отдельная настройка, не ограничение обычного открытия ссылки получателем.', 'The number of message handoffs carrying the follow flag for sending integrations that support it. This is separate from recipients opening a link normally.')],
          [text('Начало и завершение', 'Start and finish'), text('Абсолютный интервал дат и времени в UTC. Чтобы он участвовал в автоматическом выборе сообщений, должны быть заданы обе границы.', 'An absolute date and time interval in UTC. Both boundaries must be set for it to participate in automatic message selection.')],
        ],
      },
      {
        type: 'paragraph',
        text: text(
          'Недельная сетка задаёт повторяющиеся рабочие часы по дням недели, а не даты конкретной недели. Одна ячейка — один час UTC. Например, ячейка «ПН, 9» разрешает час с 09:00 до 09:59 UTC каждого понедельника.',
          'The weekly grid defines recurring working hours by weekday, not dates in a specific week. Each cell represents one UTC hour. For example, MON, 9 enables 09:00–09:59 UTC every Monday.',
        ),
      },
      {
        type: 'list',
        items: [
          text('Нажмите ячейку для переключения или протяните по ячейкам для выбора диапазона. На телефоне выделение также работает пальцем.', 'Select a cell to toggle it, or drag across cells to select a range. Touch dragging works on a phone too.'),
          text('Нажмите название дня, чтобы переключить весь день, или номер часа, чтобы переключить этот час на всю неделю. Заголовки AM и PM переключают соответствующую половину суток. «Очистить» снимает выделение.', 'Select a weekday to toggle the entire day, or an hour heading to toggle that hour for the whole week. AM and PM toggle the corresponding half of the day. Clear removes the selection.'),
          text('На узком экране прокручивайте сетку свайпом по верхним или левым заголовкам. Движение по самим часовым ячейкам предназначено для выделения.', 'On a narrow screen, swipe the top or left headers to scroll the grid. Moving across the hour cells is reserved for selection.'),
        ],
      },
      {
        type: 'note',
        text: text(
          'Для автоматической отправки по устройству или API-ключу достаточно одного совпадения — текущий момент входит в интервал дат или текущий час выбран в недельной сетке. Чтобы отправлять только в рабочие часы, задайте их в сетке и оставьте даты пустыми. Для непрерывной отправки в конкретный период задайте обе даты и оставьте сетку пустой.',
          'For automatic sending by device or API key, either the date interval or a selected weekly hour must match. To send only during working hours, select those hours and leave the dates blank. To send throughout a specific period, set both dates and leave the grid empty.',
        ),
      },
    ],
  },
  {
    id: 'ui-clicker',
    title: text('Clicker и завершение создания', 'Clicker and completing creation'),
    blocks: [
      {
        type: 'paragraph',
        text: text(
          'Чтобы заказать дополнительные переходы через Clicker, укажите целевой HTTP(S) URL. При необходимости задайте количество кликов, тип «Мобильные», двухбуквенный код страны, UTM-источник, период в UTC и «Распределять клики». Чтобы пропустить настройку, оставьте целевой URL пустым.',
          'To request additional visits through Clicker, enter the target HTTP(S) URL. Optional settings include the click count, Mobile type, two-letter country code, UTM source, UTC period and Distribute clicks. Leave the target URL blank to skip Clicker.',
        ),
      },
      {
        type: 'paragraph',
        text: text(
          'На последнем шаге проверьте название и источник аудитории, затем нажмите «Создать». При ошибке заполнения мастер вернёт вас к соответствующему шагу. Серверная подготовка ссылок и AI выполняется после создания и может занять время.',
          'On the last step, review the name and audience source, then select Create. If validation fails, the wizard returns to the relevant step. Server-side link and AI preparation runs after creation and can take time.',
        ),
      },
      {
        type: 'note',
        text: text(
          'Clicker доступен при создании одной рассылки. При включённом «Разделить по GEO» его поля отключены. Если задан целевой URL, запрос в настроенный сервис Clicker отправляется при создании рассылки, до её запуска.',
          'Clicker is available when creating a single campaign. Enabling Split by GEO disables its fields. If you set a target URL, the request to the configured Clicker service is submitted when the campaign is created, before you start sending.',
        ),
      },
    ],
  },
  {
    id: 'ui-monitoring',
    title: text('Контроль рассылки и сообщений', 'Monitoring campaigns and messages'),
    blocks: [
      {
        type: 'paragraph',
        text: text(
          'В списке рассылок сводные карточки показывают общее количество, работающие и остановленные рассылки. Внутри конкретной рассылки порядок другой — «Всего», «Отправлено», «Клики», «Доставлено», «Не доставлено», «Ошибки». Полоса «Всего» всегда заполнена, остальные полосы показывают отношение к общему количеству, ограниченное 100%. Это не набор взаимоисключающих категорий — доставленное сообщение уже было отправлено.',
          'The campaign list summary shows total, running and stopped campaigns. Inside a campaign, the cards are Total, Sent, Clicks, Delivered, Undelivered and Errors. Total is always full; the other bars show their ratio to the total, capped at 100%. These are not mutually exclusive categories — a delivered message has already been sent.',
        ),
      },
      {
        type: 'table',
        columns: [text('Статус рассылки', 'Campaign status'), text('Что означает', 'Meaning')],
        rows: [
          [text('Создана · 0', 'Created · 0'), text('Создана в интерфейсе, обычная автоматическая отправка ещё не разрешена.', 'Created in the interface; normal automatic sending has not yet been enabled.')],
          [text('В работе · 1', 'Running · 1'), text('Участвует в автоматической выдаче сообщений при подходящем расписании и доступном отправителе.', 'Participates in automatic message handoff when the schedule matches and a sender is available.')],
          [text('На паузе · −1', 'Paused · −1'), text('Пауза обычной автоматической выдачи. Можно возобновить кнопкой «Запустить».', 'Normal automatic handoff is paused. Use Start to resume.')],
          [text('Остановлена · 2', 'Stopped · 2'), text('Обычная автоматическая выдача остановлена. При остановке сервер заполняет дату завершения, если она была пустой.', 'Normal automatic handoff is stopped. Stopping fills the finish timestamp if it was empty.')],
          [text('Завершена · 3', 'Complete · 3'), text('Сервер завершил рассылку по итоговым счётчикам доставленных и недоставленных сообщений.', 'The server completed the campaign based on its delivered and undelivered message counters.')],
        ],
      },
      {
        type: 'table',
        columns: [text('Статус сообщения', 'Message status'), text('Что означает', 'Meaning')],
        rows: [
          [text('Подготовка · −1', 'Preparing · −1'), text('Сообщение ожидает подготовки или находится в промежуточном состоянии интеграции.', 'The message is waiting for preparation or is in an intermediate integration state.')],
          [text('Создано · 0', 'Created · 0'), text('Готово к выдаче отправляющей интеграции.', 'Ready to be handed to a sending integration.')],
          [text('Отправлено · 1', 'Sent · 1'), text('Выдано отправляющей интеграции или получен соответствующий статус. Это ещё не подтверждение доставки.', 'Handed to a sending integration, or the corresponding status was received. This is not delivery confirmation.')],
          [text('Доставлено · 2', 'Delivered · 2'), text('Получен успешный итоговый статус доставки.', 'A successful final delivery status was received.')],
          [text('Не доставлено · 3', 'Undelivered · 3'), text('Итоговая недоставка. Именно эти записи используются действием «Повторить недоставленные».', 'Final non-delivery. These are the records used by Retry undelivered.')],
          [text('Ошибка · 4', 'Error · 4'), text('Зафиксирована ошибка или истёк срок ожидания при оставшихся попытках. При наличии попыток сообщение может участвовать в следующей выдаче.', 'An error occurred, or a timeout expired while attempts remained. With attempts remaining, the message can be handed off again.')],
        ],
      },
      {
        type: 'paragraph',
        text: text(
          'В таблице сообщений доступны получатель, текст, отправитель, внешний ID, попытки, баны, переход по ссылке, ответ и время ответа, дополнительные поля, оценка, ошибка и временные отметки. Скрытые поля открываются через ⋯. Изменять текст отдельного сообщения в этой таблице нельзя, удаление доступно при наличии прав.',
          'The message table includes recipient, text, sender, external ID, attempts, bans, link click, reply and reply time, additional fields, score, error and timestamps. Open hidden fields through ⋯. Individual message text cannot be edited in this table; deletion is available with permission.',
        ),
      },
      {
        type: 'paragraph',
        text: text(
          'Списки рассылок и сообщений, а также карточка конкретной рассылки периодически обновляются примерно раз в минуту. «Обновить» над таблицей обновляет строки, а «Обновить» в меню действий рассылки — её сводку. Экспорт Excel выгружает отчёт всей рассылки и не ограничивается текущей страницей или фильтрами таблицы сообщений.',
          'Campaign and message lists, and campaign details, refresh periodically about once a minute. Refresh above the table updates its rows; Refresh in the campaign action menu updates its summary. Excel export downloads the whole campaign report, not only the current page or filtered message result.',
        ),
      },
    ],
  },
  {
    id: 'ui-actions',
    title: text('Действия, редактирование и повторная отправка', 'Actions, editing and retrying'),
    blocks: [
      {
        type: 'table',
        columns: [text('Действие', 'Action'), text('Результат', 'Result')],
        rows: [
          [text('Запустить / Пауза / Остановить', 'Start / Pause / Stop'), text('Меняет состояние рассылки после подтверждения. В списке эти действия можно применить к нескольким выбранным строкам. Уже выданные сообщения не отзываются у отправляющей интеграции.', 'Changes the campaign state after confirmation. In the list, these actions can apply to multiple selected rows. Messages already handed to a sending integration are not recalled.')],
          [text('Настройки рассылки', 'Campaign settings'), text('Редактирует название, webhook, доступные назначения, шаблон, приоритет, попытки, лимит переходов, таймауты, даты и недельные часы. Изменения применяются по кнопке «Сохранить».', 'Edits the name, webhook, available assignments, template, priority, attempts, follow limit, timeouts, dates and weekly hours. Select Save to apply changes.')],
          [text('Повторить недоставленные', 'Retry undelivered'), text('Создаёт отдельную рассылку [Retry] из записей со статусом «Не доставлено», сохраняя их готовые тексты. Исходные сообщения остаются на месте. Новая рассылка получает статус «Создана», сброшенные счётчики и пустые даты начала/завершения; расписание и назначения копируются. Проверьте настройки и запустите её отдельно.', 'Creates a separate [Retry] campaign from Undelivered records, preserving their prepared texts. The source messages remain unchanged. The new campaign is Created with reset counters and empty start/finish dates; its weekly schedule and assignments are copied. Review its settings and start it separately.')],
          [text('Проверить номера', 'Check numbers'), text('Запускает фоновую проверку получателей существующей рассылки.', 'Starts a background check of the existing campaign’s recipient numbers.')],
          [text('Скачать Excel / Отчёт Excel', 'Download Excel / Excel report'), text('Скачивает отчёт по сообщениям выбранной рассылки.', 'Downloads a message report for the selected campaign.')],
          [text('Очистить сообщения', 'Clear messages'), text('После подтверждения удаляет все сообщения рассылки, в том числе скрытые фильтрами таблицы.', 'After confirmation, deletes all messages in the campaign, including messages hidden by table filters.')],
          [text('Удалить рассылку / Удалить сообщение', 'Delete campaign / Delete message'), text('Удаляет выбранные записи после подтверждения. Восстановление через интерфейс не предусмотрено.', 'Deletes the selected records after confirmation. The interface does not provide restoration.')],
        ],
      },
      {
        type: 'paragraph',
        text: text(
          'Все действия доступны через ⋯ в строке списка и в меню конкретной рассылки. На широком экране запуск/пауза и настройки вынесены рядом со статусом, на телефоне дополнительные команды находятся в меню. Если групповая операция выполнена частично, окно покажет ошибки и оставит для повторения только неудачные записи.',
          'Use the row ⋯ menu in the list or the campaign action menu. On wider screens, start/pause and settings sit beside the status; phones place additional commands in the menu. If a bulk operation partially succeeds, the dialog shows errors and keeps only failed records for another attempt.',
        ),
      },
    ],
  },
  {
    id: 'ui-access',
    title: text('Теги, API-ключи и права доступа', 'Tags, API keys and permissions'),
    blocks: [
      {
        type: 'table',
        columns: [text('Раздел', 'Section'), text('Возможности', 'Capabilities')],
        rows: [
          [text('Теги', 'Tags'), text('Нажмите «Добавить», укажите название и при необходимости задайте описание, цвета и API-ключи. Если назначить тег при создании рассылки, его ключи добавятся к выбранным вручную. По тегу можно отфильтровать список рассылок.', 'Select Add, enter a name and optionally set a description, colors and API keys. Assigning a tag when creating a campaign adds its keys alongside the ones selected manually. Use tag filters to find campaigns.')],
          [text('API-ключи', 'API keys'), text('Укажите значение ключа и описание. При наличии права управления ключами новый ключ можно создать прямо в поле выбора ключей рассылки, тега или пользователя. Введите полное значение в строке поиска и нажмите кнопку добавления.', 'Enter a key value and a description. With permission to manage keys, you can also create one in the key selector for a campaign, tag or user. Type the full value in the search box and select the add button.')],
          [text('Пользователи', 'Users'), text('Для создания учётной записи администратор нажимает «Добавить» и указывает уникальный логин и пароль. В форме также можно изменить имя, роль, активность, права, API-ключи по умолчанию и персональный внешний API-ключ. При редактировании пустой пароль сохраняет текущий.', 'To create an account, an administrator selects Add and enters a unique login and password. The form also controls the name, role, active status, permissions, default API keys and personal external API key. When editing, leave the password blank to keep the current one.')],
        ],
      },
      {
        type: 'paragraph',
        text: text(
          'Права просмотра и управления выдаются отдельно. Например, для запуска и паузы нужно право запуска/остановки, а для назначения тегов, устройств и ключей — права на соответствующие поля. Если пользователь не может назначать ключи, при создании рассылки используются ключи по умолчанию её владельца.',
          'Read and manage permissions are granted separately. For example, starting or pausing requires start/stop permission, and assigning tags, devices or keys requires permission for the corresponding field. When a user cannot assign keys, a new campaign uses its owner’s default keys.',
        ),
      },
      {
        type: 'note',
        text: text(
          'Список устройств открывается по адресу /android при наличии права просмотра устройств. Администратору также доступны страницы /accounts для WA-аккаунтов и /versions для версий APK. Эти страницы открываются по прямому адресу.',
          'Open /android directly to view devices if you have device read permission. Administrators can also open /accounts for WhatsApp accounts and /versions for APK versions.',
        ),
      },
    ],
  },
  {
    id: 'ui-profile-appearance',
    title: text('Профиль, язык и внешний вид', 'Profile, language and appearance'),
    blocks: [
      {
        type: 'paragraph',
        text: text(
          'Нажмите значок пользователя внизу бокового меню, чтобы изменить имя, логин или пароль. Оставьте новый пароль пустым, чтобы сохранить прежний. Назначенный администратором персональный внешний API-ключ скрыт в поле доступа к интеграциям. Скопируйте его кнопкой рядом с полем. Для выхода из учётной записи раскройте меню и нажмите значок выхода рядом с профилем.',
          'Select the user icon at the bottom of the sidebar to change your name, login or password. Leave the new password blank to keep the current one. The personal external API key assigned by your administrator is masked under integration access. Use the adjacent button to copy it. To sign out, expand the menu and select the sign-out icon next to your profile.',
        ),
      },
      {
        type: 'list',
        items: [
          text('«Внешний вид» открывается кнопкой с ползунками в верхней панели, а также доступен на странице входа. Выберите тёмную или светлую тему. Кнопка солнца/луны в верхней панели переключает их сразу.', 'Open Appearance using the sliders button in the top bar; it is also available on the sign-in page. Choose Dark or Light. The sun/moon button in the top bar switches between them directly.'),
          text('Четыре прямоугольных образца выбирают основной цвет. Для тёмной и светлой темы используются разные согласованные оттенки. Цвета статусов фиксированы и не меняются вместе с основным цветом.', 'Four rectangular swatches select the primary color. Dark and light themes use different coordinated shades. Status colors are fixed and do not change with the primary color.'),
          text('«Режим таблиц» задаёт автоматический, компактный режим или прокрутку. Изменение этой общей настройки сбрасывает ранее выбранные режимы отдельных таблиц, сохраняя выбор колонок.', 'Table layout selects Automatic, Compact or Scroll. Changing this global setting resets previously chosen per-table modes while preserving column choices.'),
          text('«Язык» переключает интерфейс и руководство между Русским и English. Настройки применяются сразу и сохраняются только в текущем браузере.', 'Language switches the interface and guide between Русский and English. Changes apply immediately and are saved only in the current browser.'),
          text('«Сбросить» возвращает параметры внешнего вида по умолчанию, сохраняя выбранный язык. По умолчанию используется тёмная тема.', 'Reset restores default appearance settings while keeping the selected language. The default theme is dark.'),
        ],
      },
    ],
  },
]
