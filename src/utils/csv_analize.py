import csv


def get_separator(file_path: str):
    with open(file_path, 'r') as file:
        sample = file.read(1024)
        sniffer = csv.Sniffer()
        try:
            dialect = sniffer.sniff(sample, delimiters=' ,;:\n')
            return dialect.delimiter
        except csv.Error:
            return '[\s+|,;:]'