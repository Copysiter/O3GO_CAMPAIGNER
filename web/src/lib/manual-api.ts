import type { ManualSection, ManualText } from './manual-content'

const text = (ru: string, en: string): ManualText => ({ ru, en })

export const manualApiSections: ManualSection[] = [
  {
    id: 'api-access',
    title: text('Подключение к внешнему API', 'Connecting to the external API'),
    blocks: [
      {
        type: 'paragraph',
        text: text(
          'Базовый путь внешнего API — /ext/api/v1 на сервере бэкенда. В примерах замените https://YOUR_API_HOST адресом этого сервера. Адрес интерфейса и адрес API могут различаться. Текущая машинная схема находится по /ext/api/v1/openapi.json, Swagger — /ext/api/v1/docs, ReDoc — /ext/api/v1/redoc.',
          'The external API base path is /ext/api/v1 on the backend server. Replace https://YOUR_API_HOST in the examples with that server’s origin. The interface and API may use different hosts. The current machine-readable schema is at /ext/api/v1/openapi.json, Swagger at /ext/api/v1/docs, and ReDoc at /ext/api/v1/redoc.',
        ),
      },
      {
        type: 'table',
        columns: [text('Значение', 'Value'), text('Назначение', 'Purpose')],
        rows: [
          [text('X-Api-Key: USER_EXTERNAL_API_KEY', 'X-Api-Key: USER_EXTERNAL_API_KEY'), text('Внешний ключ пользователя из профиля. Аутентифицирует запросы от имени владельца.', 'The user’s external API key from their profile. Authenticates requests as that owner.')],
          [text('x_api_key', 'x_api_key'), text('Альтернативный query-параметр аутентификации с подчёркиваниями. Если переданы оба варианта, query-параметр имеет приоритет. Предпочтительнее заголовок, чтобы ключ не попадал в URL.', 'Alternative authentication query parameter, with underscores. If both are supplied, the query parameter takes priority. Prefer the header to keep the key out of URLs.')],
          [text('api_key / api_keys', 'api_key / api_keys'), text('Ключи из раздела «API-ключи», назначенные рассылкам или тегам. Используются для выбора потока отправки. Они не заменяют внешний ключ пользователя в X-Api-Key.', 'Keys from the API keys section assigned to campaigns or tags. Used to select a sending stream. They do not replace the user’s external key in X-Api-Key.')],
          [text('JWT Bearer', 'JWT Bearer'), text('Токен входа веб-интерфейса предназначен для внутреннего /api/v1. Примеры внешнего API используют X-Api-Key.', 'The interface’s sign-in token is for the internal /api/v1 API. External API examples use X-Api-Key.')],
        ],
      },
      {
        type: 'note',
        text: text(
          'Для проверки очереди используйте GET /messages/check. Запросы GET к /messages/get, /messages/next, /messages/status, /messages/ban и /messages/reply изменяют сообщения. Отключите для них кэширование и предварительную загрузку.',
          'Use GET /messages/check to check the queue. GET requests to /messages/get, /messages/next, /messages/status, /messages/ban and /messages/reply change messages. Disable caching and prefetching for these routes.',
        ),
      },
      {
        type: 'paragraph',
        text: text(
          'Для новых интеграций используйте написание /messages. Путь /messeges с исторической опечаткой пока зарегистрирован как совместимый вариант тех же методов.',
          'Use /messages for new integrations. The legacy /messeges spelling is still registered as a compatibility route for the same methods.',
        ),
      },
    ],
  },
  {
    id: 'api-campaigns',
    title: text('API · создание и управление рассылкой', 'API · create and control a campaign'),
    blocks: [
      {
        type: 'paragraph',
        text: text(
          'POST /ext/api/v1/campaigns создаёт пустую рассылку текущего пользователя и возвращает HTTP 201. Начальный статус — 0 (CREATED), число сообщений — 0, расписание — все 24 часа каждого дня недели. Получатели добавляются отдельным запросом /messages/send.',
          'POST /ext/api/v1/campaigns creates an empty campaign owned by the authenticated user and returns HTTP 201. Its initial status is 0 (CREATED), its message count is 0, and its schedule allows all 24 hours on every day of the week. Add recipients separately through /messages/send.',
        ),
      },
      {
        type: 'table',
        columns: [text('JSON-поле', 'JSON field'), text('Тип и значение по умолчанию', 'Type and default'), text('Описание', 'Description')],
        rows: [
          [text('name', 'name'), text('string, обязательное', 'string, required'), text('Название. Пробелы по краям удаляются, пустое название не принимается.', 'Name. Leading and trailing whitespace is removed; an empty name is rejected.')],
          [text('msg_template', 'msg_template'), text('string | null, null', 'string | null, null'), text('Шаблон с подстановками {field_1} … {field_5}, если у сообщения нет собственного текста.', 'Template with {field_1} … {field_5} substitutions when a message has no text of its own.')],
          [text('webhook_url', 'webhook_url'), text('HTTP(S) URL | null, null', 'HTTP(S) URL | null, null'), text('Ваш URL для уведомлений о статусах.', 'Your URL for status notifications.')],
          [text('androids', 'androids'), text('string[], []', 'string[], []'), text('Существующие идентификаторы device, а не числовые ID устройств.', 'Existing device identifiers, not numeric device IDs.')],
          [text('api_keys', 'api_keys'), text('string[], []', 'string[], []'), text('Значения существующих ключей доступа к рассылкам, а не их числовые ID.', 'Values of existing campaign access keys, not their numeric IDs.')],
          [text('tags', 'tags'), text('string[], []', 'string[], []'), text('Имена существующих тегов, а не ID. Привязанные к тегам ключи также участвуют в доступе.', 'Names of existing tags, not IDs. Keys associated with the tags also participate in access.')],
          [text('msg_attempts', 'msg_attempts'), text('integer ≥ 1, 1', 'integer ≥ 1, 1'), text('Число попыток отправки сообщения.', 'Number of attempts to send a message.')],
          [text('msg_sending_timeout', 'msg_sending_timeout'), text('integer > 0 | null, null', 'integer > 0 | null, null'), text('Время ожидания отправки в секундах.', 'Sending timeout in seconds.')],
          [text('msg_status_timeout', 'msg_status_timeout'), text('integer > 0 | null, null', 'integer > 0 | null, null'), text('Время ожидания статуса после отправки в секундах.', 'Status timeout after sending, in seconds.')],
        ],
      },
      {
        type: 'note',
        text: text(
          'Это отдельный ограниченный контракт создания. Не передавайте сюда user_id, schedule, status, данные получателей, AI-рерайт или настройки Clicker — дополнительные поля дают HTTP 422. Для создания с импортом, AI-рерайтом или Clicker используйте мастер интерфейса; расписание можно изменить в настройках рассылки. Неизвестные устройства, ключи и теги, а также неоднозначные имена тегов возвращают 422 со списками проблемных значений.',
          'This is a separate, limited creation contract. Do not send user_id, schedule, status, recipient data, AI rewriting or Clicker settings here — extra fields return HTTP 422. Use the interface wizard to create campaigns with imports, AI rewriting or Clicker; scheduling can be changed in campaign settings. Unknown devices, keys or tags and ambiguous tag names return 422 with lists of the problematic values.',
        ),
      },
      {
        type: 'code', language: 'bash', title: text('Создание рассылки с шаблоном и webhook', 'Creating a campaign with a template and webhook'),
        code: `curl --request POST 'https://YOUR_API_HOST/ext/api/v1/campaigns' \\
  --header 'X-Api-Key: USER_EXTERNAL_API_KEY' \\
  --header 'Content-Type: application/json' \\
  --data '{"name":"API campaign","msg_template":"Hello, {field_1}!","msg_attempts":2,"api_keys":["CAMPAIGN_ACCESS_KEY"],"webhook_url":"https://YOUR_CALLBACK_HOST/campaigner/status"}'`,
      },
      {
        type: 'code', language: 'json', title: text('Пример ответа HTTP 201', 'Example HTTP 201 response'),
        code: `{
  "id": 501,
  "name": "API campaign",
  "status": 0,
  "create_ts": "2026-11-09T10:00:00",
  "start_ts": null,
  "stop_ts": null,
  "androids": [],
  "api_keys": ["CAMPAIGN_ACCESS_KEY"],
  "tags": []
}`,
      },
      {
        type: 'table',
        columns: [text('Метод и путь', 'Method and path'), text('Результат', 'Result')],
        rows: [
          [text('POST /campaigns/{campaign_id}/start', 'POST /campaigns/{campaign_id}/start'), text('Запускает созданную или приостановленную рассылку, выставляет start_ts в UTC и очищает stop_ts. При запуске импортированной рассылки начинает отсчёт заданного таймаута отправки для ожидающих сообщений без срока. Повтор для RUNNING возвращает текущее состояние. Для STOPPED и COMPLETE — 409.', 'Starts a created or paused campaign, sets start_ts in UTC and clears stop_ts. For an imported campaign, starting it applies the configured sending timeout to pending messages that have no deadline. Repeating for RUNNING returns its current state. STOPPED and COMPLETE return 409.')],
          [text('POST /campaigns/{campaign_id}/stop', 'POST /campaigns/{campaign_id}/stop'), text('Переводит рассылку в STOPPED и задаёт stop_ts. Повтор для STOPPED возвращает текущее состояние, для COMPLETE — 409. Это остановка, не пауза.', 'Sets STOPPED and stop_ts. Repeating for STOPPED returns the current state; COMPLETE returns 409. This is a stop, not a pause.')],
        ],
      },
      {
        type: 'paragraph',
        text: text(
          'Оба управляющих метода используют префикс /ext/api/v1, не требуют тела и возвращают HTTP 200 с той же структурой, что при создании. Управлять можно только собственными рассылками, иначе 404. Отдельных внешних методов списка, чтения, редактирования, удаления и паузы рассылок сейчас нет.',
          'Both control methods use the /ext/api/v1 prefix, need no body and return HTTP 200 with the same structure as creation. They only operate on campaigns owned by the authenticated user; otherwise they return 404. There are currently no dedicated external methods for listing, reading, editing, deleting or pausing campaigns.',
        ),
      },
    ],
  },
  {
    id: 'api-send',
    title: text('API · добавление сообщений', 'API · submitting messages'),
    blocks: [
      {
        type: 'paragraph',
        text: text(
          'Передайте на POST /ext/api/v1/messages/send JSON-массив из одного или нескольких сообщений. В одном запросе можно указать несколько своих рассылок. После принятия данных сервер отвечает HTTP 200, добавляет сообщения в очередь, увеличивает msg_total и переводит затронутые рассылки в RUNNING. Результат доставки поступает позже.',
          'Send a JSON array of one or more messages to POST /ext/api/v1/messages/send. One request may reference several of your campaigns. On acceptance the server returns HTTP 200, adds the messages to the queue, increases msg_total and sets those campaigns to RUNNING. The delivery outcome arrives later.',
        ),
      },
      {
        type: 'table',
        columns: [text('Поле сообщения', 'Message field'), text('Описание', 'Description')],
        rows: [
          [text('campaign_id', 'campaign_id'), text('Обязательное целое число — ID вашей рассылки.', 'Required integer — your campaign’s ID.')],
          [text('dst_addr', 'dst_addr'), text('Обязательная строка или целое число. Рекомендуется строка с номером в согласованном с отправителем формате, например "12025550100".', 'Required string or integer. Prefer a string in the format agreed with your sender, for example "12025550100".')],
          [text('id', 'id'), text('Необязательное целое число — внешний ID вашей системы. Сохраняется строкой в ext_id и возвращается в исходящих webhook. Это не внутренний ID сообщения. Значение "external-123" не соответствует схеме.', 'Optional integer — the external ID in your system. Stored as a string in ext_id and used in outgoing webhooks. This is not the internal message ID. "external-123" is not valid for this schema.')],
          [text('text', 'text'), text('Необязательный готовый текст. Если не задан, при выдаче сообщения используется msg_template рассылки с подстановкой дополнительных полей.', 'Optional final text. If omitted, the campaign’s msg_template and additional fields are used when the message is issued.')],
          [text('field_1 … field_5', 'field_1 … field_5'), text('Необязательные строки для подстановки в шаблон.', 'Optional strings for template substitution.')],
        ],
      },
      {
        type: 'code', language: 'bash',
        code: `curl --request POST 'https://YOUR_API_HOST/ext/api/v1/messages/send' \\
  --header 'X-Api-Key: USER_EXTERNAL_API_KEY' \\
  --header 'Content-Type: application/json' \\
  --data '[{"id":10001,"campaign_id":501,"dst_addr":"12025550100","field_1":"Alex"}]'`,
      },
      {
        type: 'code', language: 'json', title: text('Пример ответа при двух попытках и без таймаута отправки', 'Example response with two attempts and no sending timeout'),
        code: `[
  {
    "campaign_id": 501,
    "dst_addr": "12025550100",
    "field_1": "Alex",
    "ext_id": "10001",
    "attempts": 2
  }
]`,
      },
      {
        type: 'list',
        items: [
          text('Ответ содержит принятые поля, ext_id, attempts и, если задан таймаут отправки, expire_ts в UTC. Внутренние ID новых строк этот метод не возвращает.', 'The response contains accepted fields, ext_id, attempts and, when a sending timeout is configured, expire_ts in UTC. This method does not return the internal IDs of inserted rows.'),
          text('Повторный запрос создаёт новые сообщения. Дедупликации по внешнему id и ключа идемпотентности нет. Не повторяйте неопределённо завершившийся запрос без сверки результата.', 'Repeating the request creates new messages. There is no deduplication by external id or idempotency key. Reconcile the result before retrying a request with an unknown outcome.'),
          text('Метод не запускает конвейер проверки телефонов, AI-рерайта или сокращения ссылок из мастера интерфейса. Для этого пути передавайте готовый text либо обычный шаблон с {field_1} … {field_5}.', 'This method does not start the interface wizard’s phone-checking, AI rewriting or link-shortening pipeline. For this path, send final text or a plain template using {field_1} … {field_5}.'),
        ],
      },
      {
        type: 'note',
        text: text(
          'В текущей реализации /messages/send активирует рассылку независимо от её предыдущего статуса. Учитывайте это перед добавлением получателей в остановленную или завершённую рассылку. Чтобы только подготовить пустую рассылку без запуска, используйте POST /campaigns.',
          'The current /messages/send implementation activates a campaign regardless of its previous status. Account for this before adding recipients to a stopped or completed campaign. Use POST /campaigns to prepare an empty campaign without starting it.',
        ),
      },
    ],
  },
  {
    id: 'api-processing',
    title: text('API · выдача сообщений отправителю', 'API · issuing messages to a sender'),
    blocks: [
      {
        type: 'paragraph',
        text: text(
          'Интеграция отправителя проверяет очередь через /messages/check и забирает по одному сообщению через /messages/next. Каждый успешный запрос /next расходует одну попытку отправки.',
          'A sender checks the queue through /messages/check and takes one message at a time through /messages/next. Each successful /next request uses one sending attempt.',
        ),
      },
      {
        type: 'table',
        columns: [text('Метод', 'Method'), text('Параметры и поведение', 'Parameters and behavior')],
        rows: [
          [text('GET /messages/check', 'GET /messages/check'), text('Выберите campaign_id, device или api_key. Возвращает {"available":true|false} без изменения сообщений. Приоритет селекторов — campaign_id, затем device, затем api_key.', 'Choose campaign_id, device or api_key. Returns {"available":true|false} without changing messages. Selector priority is campaign_id, then device, then api_key.')],
          [text('GET /messages/next', 'GET /messages/next'), text('Те же селекторы. Выдаёт одно сообщение со статусом CREATED или FAILED и оставшимися попытками. Уменьшает attempts и меняет статус. Параметр status принимает sent (по умолчанию), waiting или delivered.', 'The same selectors. Issues one CREATED or FAILED message with attempts remaining. Decrements attempts and changes status. The status parameter accepts sent (default), waiting or delivered.')],
          [text('GET /messages/get', 'GET /messages/get'), text('Обязательны campaign_id и dst_addr. Переводит ожидающее сообщение WAITING в SENT и возвращает {id, phone, text}. Это подтверждение/выдача ожидающего сообщения, не чтение статуса.', 'Requires campaign_id and dst_addr. Changes a WAITING message to SENT and returns {id, phone, text}. This is issuance/confirmation of a waiting message, not a status lookup.')],
        ],
      },
      {
        type: 'note',
        text: text(
          'По campaign_id методы /check, /next и /get работают только с указанной рассылкой, независимо от её статуса, расписания и способа создания. При исчерпанном лимите переходов /check по campaign_id возвращает available=false, хотя /next может выдать сообщение.',
          'With campaign_id, /check, /next and /get use only the specified campaign, regardless of its status, schedule or how it was created. Once the follow limit is reached, /check by campaign_id returns available=false even if /next can issue a message.',
        ),
      },
      {
        type: 'paragraph',
        text: text(
          'При выборе по api_key или device методы /check и /next ищут среди назначенных рассылок в статусе RUNNING. Текущее время UTC должно попадать в интервал от start_ts до stop_ts или в разрешённый час недельного расписания.',
          'With api_key or device, /check and /next select from the assigned campaigns with RUNNING status. The current UTC time must be within the start_ts to stop_ts interval or an allowed hour of the weekly schedule.',
        ),
      },
      {
        type: 'code', language: 'bash', title: text('Проверка потока по назначенному API-ключу', 'Checking a stream by its assigned API key'),
        code: `curl --get 'https://YOUR_API_HOST/ext/api/v1/messages/check' \\
  --header 'X-Api-Key: USER_EXTERNAL_API_KEY' \\
  --data-urlencode 'api_key=CAMPAIGN_ACCESS_KEY'`,
      },
      {
        type: 'code', language: 'bash', title: text('Получение следующего сообщения с отметкой отправки', 'Getting the next message and marking it sent'),
        code: `curl --get 'https://YOUR_API_HOST/ext/api/v1/messages/next' \\
  --header 'X-Api-Key: USER_EXTERNAL_API_KEY' \\
  --data-urlencode 'api_key=CAMPAIGN_ACCESS_KEY' \\
  --data-urlencode 'status=sent'`,
      },
      {
        type: 'code', language: 'json', title: text('Пример ответа /messages/next', 'Example /messages/next response'),
        code: `{"id":7001,"phone":"12025550100","text":"Hello, Alex!","follow":false}`,
      },
      {
        type: 'paragraph',
        text: text(
          'Сохраните внутренний id из ответа для /messages/status и /messages/reply. follow показывает, был ли доступен дополнительный переход при выдаче сообщения. Если подходящих сообщений нет, /next возвращает 404. Результаты доставки доступны через webhook и в таблице сообщений.',
          'Keep the internal id from the response for /messages/status and /messages/reply. follow indicates whether an additional follow was available when the message was issued. An empty queue returns 404 from /next. Delivery results are available through webhooks and in the message table.',
        ),
      },
    ],
  },
  {
    id: 'api-results',
    title: text('API · статусы, баны и ответы получателей', 'API · delivery status, bans and recipient replies'),
    blocks: [
      {
        type: 'paragraph',
        text: text(
          'GET /ext/api/v1/messages/status записывает результат отправки. Передайте внутренний id и status со значением delivered, undelivered или failed. Необязательный src_addr — адрес отправителя. Если failed приходит при исчерпанных попытках, сервер сохраняет undelivered. Повтор уже сохранённого статуса или недоступная для обновления запись может вернуть 422.',
          'GET /ext/api/v1/messages/status records a delivery outcome. Supply the internal id and status set to delivered, undelivered or failed. Optional src_addr is the sender’s address. If failed is received with no attempts remaining, the server stores undelivered. Repeating an already stored status or updating an unavailable record can return 422.',
        ),
      },
      {
        type: 'code', language: 'bash',
        code: `curl --get 'https://YOUR_API_HOST/ext/api/v1/messages/status' \\
  --header 'X-Api-Key: USER_EXTERNAL_API_KEY' \\
  --data-urlencode 'id=7001' \\
  --data-urlencode 'status=delivered' \\
  --data-urlencode 'src_addr=12025550101'`,
      },
      {
        type: 'code', language: 'json', title: text('Пример ответа /messages/status', 'Example /messages/status response'),
        code: `{"id":7001,"dst_addr":"12025550100","src_addr":"12025550101","text":"Hello, Alex!","status":"delivered"}`,
      },
      {
        type: 'paragraph',
        text: text(
          'GET /ext/api/v1/messages/ban регистрирует один бан WhatsApp по внутреннему id сообщения. Каждый вызов, включая повтор с тем же id, увеличивает на один счётчик сообщения (ban_count) и счётчик кампании (campaign_ban_count). Статус доставки сохраняется. Для старых интеграций доступен тот же метод по адресу /ext/api/v1/messeges/ban.',
          'GET /ext/api/v1/messages/ban records one WhatsApp ban for the internal message id. Each call, including a retry with the same id, adds one to both the message count (ban_count) and the campaign count (campaign_ban_count). The delivery status stays the same. Older integrations can call the same method at /ext/api/v1/messeges/ban.',
        ),
      },
      {
        type: 'paragraph',
        text: text(
          'GET /ext/api/v1/messages/reply сохраняет последний ответ получателя. Обязательный text содержит от 1 до 10 000 символов, включая хотя бы один непробельный. Укажите внутренний id либо пару campaign_id и dst_addr с точным адресом получателя. Оба идентификатора числовые и положительные. Если передан id, он имеет приоритет. Необязательный ts задаёт время ответа в ISO 8601. По умолчанию используется текущее время UTC. Время без часового пояса тоже считается UTC.',
          'GET /ext/api/v1/messages/reply stores the recipient’s latest reply. The required text is 1–10,000 characters long and must include a non-whitespace character. Supply the internal id or the pair campaign_id and dst_addr with the exact recipient address. Both id and campaign_id are positive integers. If supplied, id takes priority. The optional ISO 8601 timestamp ts defaults to the current UTC time. A timestamp without a timezone is treated as UTC.',
        ),
      },
      {
        type: 'list',
        items: [
          text('По id возвращается один объект {id, campaign_id, reply_text, reply_ts}. По паре возвращается массив всех совпадающих сообщений, отсортированный по id, и ответ сохраняется для каждого из них.', 'By id, one {id, campaign_id, reply_text, reply_ts} object is returned. By the pair, an array of all matching messages ordered by id is returned, and the reply is stored for each of them.'),
          text('Более старый ответ не перезаписывает новый. Повтор текста с тем же ts идемпотентен. Другой текст с тем же ts возвращает 409 и отменяет весь запрос, включая обработку нескольких совпадений.', 'An older reply does not overwrite a newer one. Repeating the same text with the same ts is idempotent. Different text at the same ts returns 409 and aborts the entire request, including all matches in a multi-message lookup.'),
          text('Не хватает идентификаторов — 422, нет доступных совпадений — 404. Ответ имеет Cache-Control: no-store. Этот метод не меняет статус доставки.', 'Missing identifiers return 422; no accessible matches return 404. Responses have Cache-Control: no-store. This method does not change delivery status.'),
        ],
      },
      {
        type: 'code', language: 'bash',
        code: `curl --get 'https://YOUR_API_HOST/ext/api/v1/messages/reply' \\
  --header 'X-Api-Key: USER_EXTERNAL_API_KEY' \\
  --data-urlencode 'campaign_id=501' \\
  --data-urlencode 'dst_addr=12025550100' \\
  --data-urlencode 'text=Thank you' \\
  --data-urlencode 'ts=2026-11-09T12:30:00Z'`,
      },
    ],
  },
  {
    id: 'api-webhooks',
    title: text('API · исходящие webhook и коды состояний', 'API · outgoing webhooks and state codes'),
    blocks: [
      {
        type: 'paragraph',
        text: text(
          'Чтобы получать уведомления, задайте webhook_url рассылки и передавайте внешний числовой id при /messages/send. Campaigner отправляет HTTP POST с JSON на ваш URL. Поле id в уведомлении — строковое представление вашего внешнего ID, не внутренний ID сообщения.',
          'To receive notifications, configure the campaign’s webhook_url and supply an external numeric id in /messages/send. Campaigner sends an HTTP POST with JSON to your URL. The notification’s id is the string representation of your external ID, not the internal message ID.',
        ),
      },
      {
        type: 'code', language: 'json', title: text('Пример тела исходящего webhook', 'Example outgoing webhook body'),
        code: `{"id":"10001","status":"delivered"}`,
      },
      {
        type: 'list',
        items: [
          text('Для /messages/status уведомление содержит итоговый delivered или undelivered. Промежуточный failed оставляет сообщение для повторной попытки. /messages/next отправляет уведомление только при status=delivered. В других сценариях отправки обработчик также может получить sent.', 'For /messages/status, the notification carries the final delivered or undelivered outcome. An intermediate failed leaves the message available for another attempt. /messages/next sends a notification only for status=delivered. Other delivery flows can also emit sent.'),
          text('Когда истекает таймаут и попытки исчерпаны, сообщение получает статус UNDELIVERED, а webhook — значение expired. Для этого события сервер находит webhook_url по ext_id сообщения. Присваивайте сообщениям разные внешние id в разных рассылках.', 'When a timeout expires with no attempts left, the message becomes UNDELIVERED and its webhook status is expired. For this event the server looks up the webhook_url by the message’s ext_id. Use distinct external message IDs across campaigns.'),
          text('Доставка webhook выполняется фоновой очередью. В текущем отправителе нет подписи payload и автоматических повторов при ошибке HTTP. Не рассчитывайте на гарантированную повторную доставку; ваш обработчик должен быстро отвечать и сохранять принятые события.', 'Webhook delivery runs through a background queue. The current sender has no payload signature or automatic retries on HTTP errors. Do not rely on guaranteed redelivery; your receiver should respond promptly and persist accepted events.'),
          text('POST /ext/api/v1/webhook/ принимает JSON-объект без авторизации и возвращает его без изменений. Используйте этот тестовый маршрут для проверки тела запроса. Результат доставки записывает /messages/status.', 'POST /ext/api/v1/webhook/ accepts a JSON object without authentication and echoes it back. Use this test route to inspect a request body. Use /messages/status to record a delivery outcome.'),
        ],
      },
      {
        type: 'table',
        columns: [text('Состояния рассылки', 'Campaign states'), text('Код', 'Code'), text('Значение', 'Meaning')],
        rows: [
          [text('PAUSED', 'PAUSED'), text('-1', '-1'), text('Приостановлена', 'Paused')],
          [text('CREATED', 'CREATED'), text('0', '0'), text('Создана', 'Created')],
          [text('RUNNING', 'RUNNING'), text('1', '1'), text('В работе', 'Running')],
          [text('STOPPED', 'STOPPED'), text('2', '2'), text('Остановлена', 'Stopped')],
          [text('COMPLETE', 'COMPLETE'), text('3', '3'), text('Завершена', 'Complete')],
        ],
      },
      {
        type: 'table',
        columns: [text('Состояния сообщения', 'Message states'), text('Код', 'Code'), text('Значение', 'Meaning')],
        rows: [
          [text('WAITING', 'WAITING'), text('-1', '-1'), text('Ожидает обработки/подтверждения, в том числе после выдачи устройству.', 'Waiting for processing/confirmation, including after issuance to a device.')],
          [text('CREATED', 'CREATED'), text('0', '0'), text('Готово к выдаче.', 'Ready to be issued.')],
          [text('SENT', 'SENT'), text('1', '1'), text('Отправлено, ожидается результат доставки.', 'Sent, awaiting a delivery outcome.')],
          [text('DELIVERED', 'DELIVERED'), text('2', '2'), text('Доставлено.', 'Delivered.')],
          [text('UNDELIVERED', 'UNDELIVERED'), text('3', '3'), text('Не доставлено, в том числе после исчерпания попыток.', 'Undelivered, including after attempts are exhausted.')],
          [text('FAILED', 'FAILED'), text('4', '4'), text('Ошибка. При оставшихся попытках сообщение может быть выдано повторно.', 'Failed. A message with attempts remaining can be issued again.')],
        ],
      },
    ],
  },
  {
    id: 'api-callbacks',
    title: text('API · клики и проверка телефонов', 'API · clicks and phone-check callbacks'),
    blocks: [
      {
        type: 'paragraph',
        text: text(
          'POST /ext/api/v1/links/click принимает от сокращателя ссылок JSON {links:[...]}. Нужен X-Api-Key пользователя. Для каждого элемента обязательны short (точная короткая ссылка), ext_id (ID рассылки) и count (целочисленное приращение числа кликов). dst_addr необязателен, но должен совпадать с сохранённой персональной ссылкой. Если dst_addr не указан, ищется общая ссылка без получателя.',
          'POST /ext/api/v1/links/click accepts JSON {links:[...]} from the link shortener. A user’s X-Api-Key is required. Each item requires short (the exact short URL), ext_id (the campaign ID) and count (an integer click-count increment). dst_addr is optional but must match a stored recipient-specific link. Without dst_addr, a shared link with no recipient is matched.',
        ),
      },
      {
        type: 'note',
        text: text(
          'В /links/click поле ext_id означает ID рассылки. Оно не связано с внешним id сообщения из /messages/send. count прибавляется к счётчику, поэтому повторный callback повторно начислит клики.',
          'In /links/click, ext_id means the campaign ID. It is unrelated to a message’s external id from /messages/send. count is added to the counter, so repeating a callback adds the clicks again.',
        ),
      },
      {
        type: 'code', language: 'bash',
        code: `curl --request POST 'https://YOUR_API_HOST/ext/api/v1/links/click' \\
  --header 'X-Api-Key: USER_EXTERNAL_API_KEY' \\
  --header 'Content-Type: application/json' \\
  --data '{"links":[{"short":"https://YOUR_SHORT_LINK_HOST/a1b2c3","ext_id":501,"dst_addr":"12025550100","count":1}]}'`,
      },
      {
        type: 'paragraph',
        text: text(
          'Ответ — {"counts":{"501":1},"success":1,"errors":0}. counts содержит начисленные в этом запросе клики по рассылкам; success — число найденных элементов, errors — число ненайденных. Проверяйте тело даже при HTTP 200. Реальные и Clicker-ссылки обновляют соответствующие отдельные счётчики.',
          'The response is {"counts":{"501":1},"success":1,"errors":0}. counts contains increments applied by this request per campaign; success counts matched items and errors counts unmatched items. Check the body even for HTTP 200. Real and Clicker links update their respective separate counters.',
        ),
      },
      {
        type: 'paragraph',
        text: text(
          'POST /ext/api/v1/hs/result?token=PHONE_CHECKER_WEBHOOK_TOKEN принимает результаты проверки телефонов. Параметр token обязателен и должен совпадать с настройкой сервера. Сервис проверки присылает JSON-объект с job_id, status (progress или completed) и массивом results. Элементы массива содержат phone, score, success и необязательные details. В ответе {"status":"ok","processed":N} число N показывает количество полученных элементов. Запись результатов выполняется в фоне.',
          'POST /ext/api/v1/hs/result?token=PHONE_CHECKER_WEBHOOK_TOKEN receives phone-check results. The required token query parameter must match the server configuration. The checker sends a JSON object with job_id, status (progress or completed) and a results array. Items contain phone, score, success and optional details. In the response {"status":"ok","processed":N}, N is the number of items received. Results are written in the background.',
        ),
      },
      {
        type: 'paragraph',
        text: text(
          'Проверка телефонов сопоставляет номер без ведущего + со всеми строками, у которых score ещё не определён или равен -1. Отсутствующий score сохраняется как -1. Это технический callback проверки, а не метод добавления получателей или получения их статусов.',
          'Phone-check results match the number without a leading + against all rows whose score is unset or -1. An absent score is stored as -1. This is a technical check callback, not an endpoint for submitting recipients or reading their statuses.',
        ),
      },
      {
        type: 'paragraph',
        text: text(
          'POST /ext/api/v1/links/shorten/mock предназначен для локальной проверки сокращения. Принимает {x_api_key, urls:[{url, ext_id, dst_addr?}]} с 1–500 ссылками, возвращает массив с new_url. Не обращается к внешнему сокращателю и не сохраняет ссылки в БД. Поле x_api_key здесь часть тестового тела, а не проверяемая аутентификация.',
          'POST /ext/api/v1/links/shorten/mock is for local link-shortening tests. It accepts {x_api_key, urls:[{url, ext_id, dst_addr?}]} with 1–500 URLs and returns an array including new_url. It neither calls an external shortener nor stores links in the database. Here x_api_key is part of the mock request body, not verified authentication.',
        ),
      },
    ],
  },
  {
    id: 'api-teleraptor',
    title: text('API · отправка через TeleRaptor', 'API · sending with TeleRaptor'),
    blocks: [
      {
        type: 'paragraph',
        text: text(
          'TeleRaptor использует тот же внешний ключ пользователя в X-Api-Key. Все параметры этих GET-запросов передаются в строке запроса. Успешная выдача и запись статуса изменяют сообщения. Необязательный md5 принимается для совместимости.',
          'TeleRaptor uses the same external user key in X-Api-Key. These GET routes accept query parameters. Issuing a message or recording its status changes the message. The optional md5 parameter is accepted for compatibility.',
        ),
      },
      {
        type: 'table',
        columns: [text('Метод и путь', 'Method and path'), text('Запрос', 'Request'), text('Ответ', 'Response')],
        rows: [
          [text('GET /teleraptor/message/next', 'GET /teleraptor/message/next'), text('Укажите целочисленный id_background (ID рассылки), чтобы получить следующее сообщение и отметить его отправленным.', 'Supply the integer id_background (campaign ID) to take the next message and mark it sent.'), text('Массив с id_message (строка), phone, text_sms и error="0". При отсутствии сообщения возвращается [{"id_message":0}].', 'An array with id_message (string), phone, text_sms and error="0". An empty queue returns [{"id_message":0}].')],
          [text('GET /teleraptor/message/status', 'GET /teleraptor/message/status'), text('Укажите внутренний id_message и state. Значения deliver и not_deliver соответствуют delivered и undelivered. Значения not_send и expired передают failed с учётом оставшихся попыток.', 'Supply the internal id_message and state. Use deliver for delivered and not_deliver for undelivered. Both not_send and expired request failed, subject to the remaining attempts.'), text('Массив с переданным id_message и error="0".', 'An array with the supplied id_message and error="0".')],
          [text('GET /teleraptor/message/', 'GET /teleraptor/message/'), text('Совместимый маршрут. Пара id_message и state записывает результат и имеет приоритет. Иначе id_background запрашивает следующее сообщение.', 'Compatibility route. The pair id_message and state takes priority and records an outcome. Otherwise id_background requests the next message.'), text('Ответ выбранного метода. Если параметров недостаточно, возвращается HTTP 422.', 'The response from the selected operation. Insufficient parameters return HTTP 422.')],
        ],
      },
    ],
  },
  {
    id: 'api-errors',
    title: text('API · ошибки и проверка интеграции', 'API · errors and integration checks'),
    blocks: [
      {
        type: 'table',
        columns: [text('HTTP', 'HTTP'), text('Что проверить', 'What to check')],
        rows: [
          [text('401', '401'), text('Переданный внешний ключ не найден. Проверьте ключ пользователя, а не ключ потока рассылки.', 'The supplied external key was not found. Check the user key, not the campaign-stream key.')],
          [text('403', '403'), text('Для основных методов не передана аутентификация. Для /hs/result — неверный или не настроенный token.', 'Authentication is missing for core methods. For /hs/result, the token is invalid or not configured.')],
          [text('404', '404'), text('Рассылка/сообщение недоступны или не найдены. Для /next это также нормальный ответ при отсутствии подходящих сообщений.', 'Campaign/message not found or inaccessible. For /next, this is also the normal response when no eligible message exists.')],
          [text('409', '409'), text('Недопустимый переход состояния рассылки либо конфликт текста ответа при одинаковом ts.', 'An invalid campaign-state transition, or conflicting reply text with the same ts.')],
          [text('422', '422'), text('Неверный тип или пропущенное поле, неизвестные связи рассылки, неподдерживаемый status, либо уже записанный статус сообщения. Смотрите detail.', 'Invalid type or missing field, unknown campaign relations, unsupported status, or an already recorded message status. Inspect detail.')],
          [text('500', '500'), text('Ошибка сервера. Сохраните время запроса, путь и ответ, проверьте логи API и фоновых воркеров.', 'Server error. Record the request time, path and response, and inspect API and background-worker logs.')],
        ],
      },
      {
        type: 'paragraph',
        text: text(
          'Ошибки основных маршрутов обычно имеют JSON {"detail":...}. detail может быть строкой, объектом со списками неизвестных связей или массивом ошибок валидации с loc, msg и type. Не сводите обработку только к HTTP 200 и не предполагайте, что detail всегда строка.',
          'Core-route errors generally have JSON {"detail":...}. detail can be a string, an object listing unknown relations, or a validation-error array with loc, msg and type. Do not treat HTTP 200 as the only success criterion, and do not assume detail is always a string.',
        ),
      },
      {
        type: 'steps',
        items: [
          text('Получите внешний ключ пользователя и проверьте адрес API и схему /ext/api/v1/docs.', 'Obtain the user’s external key and verify the API origin and /ext/api/v1/docs schema.'),
          text('В примере POST /campaigns замените CAMPAIGN_ACCESS_KEY значением существующего ключа рассылки и задайте свой webhook_url. В следующих запросах подставьте полученный ID рассылки вместо 501.', 'In the POST /campaigns example, replace CAMPAIGN_ACCESS_KEY with an existing campaign key and supply your webhook_url. In subsequent requests, replace 501 with the returned campaign ID.'),
          text('Отправьте один контролируемый тестовый номер через /messages/send с числовым внешним id. Этот шаг активирует рассылку.', 'Submit one controlled test recipient through /messages/send with a numeric external id. This activates the campaign.'),
          text('Получите сообщение выбранным отправителем и передайте результат отправки через /messages/status. Убедитесь, что внутренний ID не перепутан с внешним.', 'Issue a message to the selected sender and report the delivery outcome through /messages/status. Make sure internal and external IDs are not confused.'),
          text('Проверьте получение webhook и отображение результата в интерфейсе. Отдельно проверьте пустую очередь, ошибку ключа и обработку повторов.', 'Verify webhook receipt and the outcome in the interface. Separately test an empty queue, an invalid key and repeat handling.'),
        ],
      },
    ],
  },
]
