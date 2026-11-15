"""Read a single audience file into an immutable, user-owned import."""
import csv
import io
import json
import math
import shutil
import time
import zipfile
from collections import Counter
from pathlib import Path, PurePosixPath
from uuid import UUID, uuid4

from core.config import settings
from services.phone_geo import normalize_phone


SUPPORTED_FORMATS = {".csv", ".txt", ".xlsx", ".xls", ".zip"}
CONTACT_FIELDS = ["dst_addr", *(f"field_{i}" for i in range(1, 6))]
PHONE_HEADERS = {"phone", "phone number", "telephone", "number", "dst_addr", "телефон", "номер", "номер телефона"}


class CampaignImportError(ValueError):
    def __init__(self, detail: str, status_code: int = 422):
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def limit(name, default):
    return int(getattr(settings, name, default))


def import_root() -> Path:
    return Path(getattr(settings, "CAMPAIGN_IMPORT_DIR", "upload/imports"))


def upload_limit() -> int:
    return limit("CAMPAIGN_IMPORT_MAX_BYTES", 20 * 1024 * 1024)


def _expanded_limit() -> int:
    return limit("CAMPAIGN_IMPORT_MAX_EXPANDED_BYTES", 100 * 1024 * 1024)


def _row_limit() -> int:
    return limit("CAMPAIGN_IMPORT_MAX_ROWS", 200000)


def _text(content: bytes, warnings: list, *, zip_mode=False) -> str:
    if zip_mode:
        decoded = content.decode("utf-8-sig", errors="replace")
        if "\ufffd" in decoded:
            warnings.append("В ZIP обнаружены символы не в UTF-8: они заменены при чтении")
        return decoded
    try:
        return content.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            decoded = content.decode("cp1251")
        except UnicodeDecodeError as exc:
            raise CampaignImportError("Не удалось прочитать кодировку файла; сохраните его в UTF-8") from exc
        warnings.append("Файл прочитан в кодировке Windows-1251")
        return decoded


def _cell(value):
    if value is None:
        return ""
    if isinstance(value, float):
        if math.isnan(value):
            return ""
        if value.is_integer():
            return str(int(value))
    return str(value)


def _rows_from_text(text: str, delimiter=None):
    if delimiter is None:
        try:
            delimiter = csv.Sniffer().sniff(text[:65536], delimiters=";,\t|").delimiter
        except csv.Error:
            delimiter = None
    rows = []
    if delimiter:
        reader = csv.reader(io.StringIO(text, newline=""), delimiter=delimiter, strict=True)
        try:
            for cells in reader:
                if not any(cell.strip() for cell in cells):
                    continue
                if len(cells) > 100:
                    raise CampaignImportError("В источнике больше 100 колонок")
                rows.append({"values": cells, "row": reader.line_num})
                if len(rows) > _row_limit():
                    raise CampaignImportError("Превышено допустимое число строк")
        except csv.Error as exc:
            raise CampaignImportError(f"Ошибка чтения CSV/TXT: {exc}") from exc
    else:
        for line_number, line in enumerate(text.splitlines(), 1):
            if line.strip():
                rows.append({"values": [line], "row": line_number})
                if len(rows) > _row_limit():
                    raise CampaignImportError("Превышено допустимое число строк")
    return rows, delimiter


def _source(source_id, name, rows, **extra):
    if len(rows) > _row_limit():
        raise CampaignImportError("Превышено допустимое число строк")
    return {"id": source_id, "name": name, "rows": rows, **extra}


def _zip_sources(content, warnings):
    all_rows = []
    message = None
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            files = [entry for entry in archive.infolist() if not entry.is_dir()]
            if len(files) > limit("CAMPAIGN_IMPORT_MAX_FILES", 100):
                raise CampaignImportError("В ZIP слишком много файлов")
            if sum(entry.file_size for entry in files) > _expanded_limit():
                raise CampaignImportError("Превышен допустимый распакованный размер ZIP")
            text_files = []
            phone_files = []
            for entry in files:
                name = entry.filename.replace("\\", "/")
                parts = PurePosixPath(name).parts
                if name.startswith("/") or ".." in parts or (parts and ":" in parts[0]):
                    raise CampaignImportError("ZIP содержит недопустимый путь файла")
                if entry.flag_bits & 1:
                    raise CampaignImportError("ZIP с паролем не поддерживается")
                if "__MACOSX" in parts or PurePosixPath(name).name.startswith("."):
                    continue
                if not name.lower().endswith(".txt"):
                    warnings.append(f"Пропущен неподдерживаемый файл: {name}")
                elif PurePosixPath(name).name.lower() == "text.txt":
                    text_files.append(entry)
                else:
                    phone_files.append(entry)
            if len(text_files) > 1:
                warnings.append(f"Найдено несколько text.txt; используется первый: {text_files[0].filename}")
            expanded = 0

            def read(entry):
                nonlocal expanded
                if entry.file_size > upload_limit():
                    raise CampaignImportError(f"Слишком большой файл внутри ZIP: {entry.filename}")
                with archive.open(entry) as handle:
                    body = handle.read(min(upload_limit(), _expanded_limit() - expanded) + 1)
                expanded += len(body)
                if len(body) > upload_limit() or expanded > _expanded_limit():
                    raise CampaignImportError("Превышен допустимый распакованный размер ZIP")
                return _text(body, warnings, zip_mode=True)

            if text_files:
                message = read(text_files[0])
            for entry in phone_files:
                for row_number, line in enumerate(read(entry).splitlines(), 1):
                    if not line.strip():
                        continue
                    all_rows.append({"values": [line], "row": row_number, "source": entry.filename})
                    if len(all_rows) > _row_limit():
                        raise CampaignImportError("Превышено допустимое число строк")
    except CampaignImportError:
        raise
    except (zipfile.BadZipFile, RuntimeError, OSError, NotImplementedError) as exc:
        raise CampaignImportError("Не удалось открыть ZIP: архив повреждён или не поддерживается") from exc
    if not all_rows:
        raise CampaignImportError("В ZIP не найдены непустые TXT-файлы с номерами")
    return [_source("zip-phones", "Номера из ZIP", all_rows)], message


def _excel_sources(content, extension):
    sources = []
    if extension == ".xlsx":
        from openpyxl import load_workbook
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                if sum(entry.file_size for entry in archive.infolist()) > _expanded_limit():
                    raise CampaignImportError("Превышен допустимый распакованный размер Excel")
            workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        except CampaignImportError:
            raise
        except Exception as exc:
            raise CampaignImportError("Не удалось прочитать Excel-файл") from exc
        try:
            total = 0
            for sheet_index, worksheet in enumerate(workbook.worksheets):
                if worksheet.max_column and worksheet.max_column > 100:
                    raise CampaignImportError("В листе Excel больше 100 колонок")
                if worksheet.max_row and worksheet.max_row > _row_limit():
                    raise CampaignImportError("Превышено допустимое число строк листа Excel")
                rows = []
                for row_number, values in enumerate(worksheet.iter_rows(values_only=True), 1):
                    if row_number > _row_limit():
                        raise CampaignImportError("Превышено допустимое число строк листа Excel")
                    cells = [_cell(value) for value in values]
                    while cells and not cells[-1]:
                        cells.pop()
                    if not any(cell.strip() for cell in cells):
                        continue
                    if len(cells) > 100:
                        raise CampaignImportError("В листе Excel больше 100 колонок")
                    rows.append({"values": cells, "row": row_number})
                    total += 1
                    if total > _row_limit():
                        raise CampaignImportError("Превышено допустимое число строк")
                if rows:
                    sources.append(_source(f"sheet-{sheet_index}", worksheet.title, rows))
        except CampaignImportError:
            raise
        except Exception as exc:
            raise CampaignImportError("Не удалось прочитать содержимое Excel-файла") from exc
        finally:
            workbook.close()
    else:
        import xlrd
        try:
            workbook = xlrd.open_workbook(file_contents=content, on_demand=True)
        except Exception as exc:
            raise CampaignImportError("Не удалось прочитать XLS-файл") from exc
        try:
            total = 0
            for sheet_index in range(workbook.nsheets):
                worksheet = workbook.sheet_by_index(sheet_index)
                if worksheet.ncols > 100:
                    raise CampaignImportError("В листе Excel больше 100 колонок")
                rows = []
                for index in range(worksheet.nrows):
                    cells = [_cell(value) for value in worksheet.row_values(index)]
                    if any(cell.strip() for cell in cells):
                        rows.append({"values": cells, "row": index + 1})
                        total += 1
                        if total > _row_limit():
                            raise CampaignImportError("Превышено допустимое число строк")
                if rows:
                    sources.append(_source(f"sheet-{sheet_index}", worksheet.name, rows))
        finally:
            workbook.release_resources()
    return sources


def _source_preview(source, zip_mode=False):
    rows = source["rows"]
    column_count = max((len(row["values"]) for row in rows), default=0)
    header = [value.strip().lower() for value in rows[0]["values"]] if rows else []
    phone_column = next((i for i, value in enumerate(header) if value in PHONE_HEADERS), 0)
    suggested = {field: None for field in CONTACT_FIELDS}
    suggested["dst_addr"] = phone_column
    if not zip_mode:
        remaining = [index for index in range(column_count) if index != phone_column]
        suggested.update({f"field_{i + 1}": column for i, column in enumerate(remaining[:5])})
    return {
        "id": source["id"], "name": source["name"], "row_count": len(rows),
        "sample_rows": [row["values"] for row in rows[:5]], "column_count": column_count,
        "suggested_skip_rows": int(not zip_mode and any(value in PHONE_HEADERS for value in header)),
        "suggested_fields": suggested, "delimiter": source.get("delimiter"),
    }


def create_import(filename: str, content: bytes, user_id: int) -> dict:
    extension = Path(filename).suffix.lower()
    if extension not in SUPPORTED_FORMATS:
        raise CampaignImportError("Выберите файл CSV, TXT, XLS, XLSX или ZIP")
    if not content:
        raise CampaignImportError("Загружен пустой файл")
    if len(content) > upload_limit():
        raise CampaignImportError("Превышен допустимый размер файла", 413)
    cleanup_expired_imports()
    warnings = []
    message = None
    if extension == ".zip":
        sources, message = _zip_sources(content, warnings)
    elif extension in {".xlsx", ".xls"}:
        sources = _excel_sources(content, extension)
    else:
        text = _text(content, warnings)
        rows, delimiter = _rows_from_text(text)
        sources = [_source("file", Path(filename).name, rows, text=text, delimiter=delimiter)]
    if not sources or not any(source["rows"] for source in sources):
        raise CampaignImportError("В файле не найдены непустые строки")
    identifier = str(uuid4())
    manifest = {
        "import_id": identifier, "owner_id": user_id, "created_at": time.time(),
        "format": extension[1:], "original_name": Path(filename).name,
        "sources": sources, "message": message, "warnings": warnings,
        "total_rows": sum(len(source["rows"]) for source in sources),
    }
    directory = import_root() / identifier
    directory.mkdir(parents=True)
    legacy_name = f"{identifier}{extension}"
    legacy_path = import_root().parent / legacy_name
    try:
        legacy_path.write_bytes(content)
        (directory / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
    except Exception:
        shutil.rmtree(directory, ignore_errors=True)
        legacy_path.unlink(missing_ok=True)
        raise
    return {
        "import_id": identifier, "filename": legacy_name,
        "fields": sources[0]["rows"][0]["values"], "format": manifest["format"],
        "sources": [_source_preview(source, extension == ".zip") for source in sources],
        "message": message, "warnings": warnings, "total_rows": manifest["total_rows"],
    }


def load_import(import_id, user_id: int) -> dict:
    try:
        identifier = str(UUID(str(import_id)))
    except (ValueError, TypeError) as exc:
        raise CampaignImportError("Загрузка не найдена", 404) from exc
    try:
        data = json.loads((import_root() / identifier / "manifest.json").read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError) as exc:
        raise CampaignImportError("Загрузка не найдена", 404) from exc
    if data.get("owner_id") != user_id:
        raise CampaignImportError("Загрузка не найдена", 404)
    if time.time() - data["created_at"] > limit("CAMPAIGN_IMPORT_TTL_SECONDS", 86400):
        raise CampaignImportError("Срок хранения загрузки истёк. Загрузите файл повторно", 410)
    return data


def prepare_import(import_id, user_id: int, mappings=None, default_region=None) -> dict:
    data = load_import(import_id, user_id)
    mapping_list = [item.model_dump() if hasattr(item, "model_dump") else item for item in (mappings or [])]
    mapping_by_source = {item["source_id"]: item for item in mapping_list}
    if len(mapping_by_source) != len(mapping_list):
        raise CampaignImportError("Сопоставление источника указано несколько раз")
    if set(mapping_by_source) - {source["id"] for source in data["sources"]}:
        raise CampaignImportError("Указан неизвестный источник данных")
    rows, errors = [], []
    geo_counts = Counter()
    total_rows = 0
    for source in data["sources"]:
        mapping = mapping_by_source.get(source["id"])
        if data["format"] == "zip":
            field_map, skip_rows = {"dst_addr": 0}, 0
        elif mapping:
            field_map, skip_rows = mapping.get("data_fields", {}), mapping.get("skip_rows", 0)
        else:
            defaults = _source_preview(source)
            field_map, skip_rows = defaults["suggested_fields"], defaults["suggested_skip_rows"]
        phone_column = field_map.get("dst_addr")
        if phone_column is None:
            raise CampaignImportError(f"Выберите колонку телефона: {source['name']}")
        if not isinstance(phone_column, int) or phone_column < 0:
            raise CampaignImportError("Некорректная колонка телефона")
        source_rows = source["rows"]
        delimiter = mapping.get("delimiter") if mapping else None
        if delimiter and "text" in source and delimiter != source.get("delimiter"):
            source_rows, _ = _rows_from_text(source["text"], delimiter)
        for original in source_rows[skip_rows:]:
            total_rows += 1
            values = original["values"]
            raw_phone = values[phone_column].strip() if phone_column < len(values) else ""
            try:
                if data["format"] == "zip":
                    raw_phone = raw_phone.replace(" ", "")
                    if not raw_phone.removeprefix("+").isdigit():
                        raise ValueError("В TXT внутри ZIP ожидается только телефон на строке: цифры, начальный + и пробелы")
                phone = normalize_phone(raw_phone, default_region)
            except ValueError as exc:
                errors.append({"source": original.get("source", source["name"]), "row": original["row"], "message": str(exc)})
                continue
            record = {**phone, **{field: None for field in CONTACT_FIELDS if field != "dst_addr"}}
            for field in CONTACT_FIELDS[1:]:
                index = field_map.get(field)
                if isinstance(index, int) and 0 <= index < len(values):
                    record[field] = values[index]
            rows.append(record)
            geo_counts[phone["geo"]] += 1
    return {
        "import_id": data["import_id"], "rows": rows, "message": data["message"],
        "format": data["format"], "total_rows": total_rows,
        "valid_count": len(rows), "invalid_count": len(errors),
        "geo_groups": [{"geo": geo, "count": count} for geo, count in sorted(geo_counts.items(), key=lambda pair: pair[0] or "ZZZ")],
        "errors": errors, "warnings": data["warnings"],
    }


def remove_import(import_id, user_id: int):
    _remove_owned_import(load_import(import_id, user_id))


def _remove_owned_import(data):
    identifier = str(UUID(data["import_id"]))
    extension = "." + data["format"]
    if extension not in SUPPORTED_FORMATS:
        return
    shutil.rmtree(import_root() / identifier, ignore_errors=True)
    (import_root().parent / f"{identifier}{extension}").unlink(missing_ok=True)


def cleanup_expired_imports() -> int:
    """Only remove UUID directories with a recognized import manifest."""
    removed = 0
    cutoff = time.time() - limit("CAMPAIGN_IMPORT_TTL_SECONDS", 86400)
    root = import_root()
    if not root.exists():
        return removed
    for path in root.iterdir():
        if not path.is_dir() or path.is_symlink():
            continue
        try:
            identifier = str(UUID(path.name))
            data = json.loads((path / "manifest.json").read_text(encoding="utf-8"))
            if data.get("import_id") == identifier and data.get("owner_id") is not None and data.get("created_at", time.time()) < cutoff:
                _remove_owned_import(data)
                removed += 1
        except (ValueError, KeyError, OSError, TypeError):
            continue
    return removed
