"""Regenerate licensed English frequency data; requires msgpack==1.1.2."""

import gzip
import hashlib
import json
import re
from pathlib import Path
from urllib.request import urlopen

import msgpack

REVISION = "372f6dbb3bd2ad4b675a3b18b94d44d0dd5fea8b"
BASE = f"https://raw.githubusercontent.com/rspeer/wordfreq/{REVISION}"
ROOT = Path(__file__).resolve().parents[1]
VOCABULARY_REVISION = "5ef55f9c42730ebe4394a78b77855468a6f15dd2"
VOCABULARY_BASE = f"https://raw.githubusercontent.com/en-wl/wordlist/{VOCABULARY_REVISION}"


def download(name, base=BASE):
    with urlopen(f"{base}/{name}", timeout=60) as response:
        return response.read()


packed = download("wordfreq/data/large_en.msgpack.gz")
data = msgpack.unpackb(gzip.decompress(packed), raw=False)
if data[0] != {"format": "cB", "version": 1}:
    raise ValueError("Unexpected wordfreq data format")
dictionary = json.loads((ROOT / "src" / "solver" / "data" / "words.json").read_text())
allowed = set(dictionary)
esl = download("alt12dicts/3esl.txt", VOCABULARY_BASE).decode().splitlines()
entries = download("alt12dicts/2of12full.txt", VOCABULARY_BASE).decode().splitlines()
common = {word.upper() for word in esl if re.fullmatch("[a-z]{5}", word)}
for entry in entries:
    match = re.fullmatch(r"\s*(\d+):.*?=\s+([a-z]{5})", entry)
    if match and int(match[1]) >= 8:
        common.add(match[2].upper())
answers = sorted(common & allowed)
if not 2000 <= len(answers) <= 5000:
    raise ValueError("Unexpected common-answer vocabulary")
frequencies = {
    word.upper(): round(9 - index / 100, 2)
    for index, words in enumerate(data[1:])
    for word in words
    if word.isascii() and word.upper() in allowed
}
output = {
    "source": f"https://github.com/rspeer/wordfreq/tree/{REVISION}",
    "sha256": hashlib.sha256(packed).hexdigest(),
    "attribution": "English frequencies by Robyn Speer et al., wordfreq 3.0.2; "
    "SUBTLEX by Marc Brysbaert et al. See public/solver-data-LICENSE.txt.",
    "license": "CC-BY-SA-4.0",
    "changes": "Five-letter ASCII subset intersected with dwyl/english-words; "
    "centibel bins converted to Zipf frequencies. Not NYT answer data.",
    "answerSource": f"https://github.com/en-wl/wordlist/tree/{VOCABULARY_REVISION}/alt12dicts",
    "answerPolicy": "Public-domain 3esl plus lowercase single-word entries in "
    "at least 8 of 12 dictionaries; intersected with the five-letter dictionary.",
    "answers": answers,
    "zipf": dict(sorted(frequencies.items())),
}
if len(frequencies) < 8000:
    raise ValueError("Unexpected frequency coverage")
(ROOT / "src" / "solver" / "data" / "frequencies.json").write_text(
    json.dumps(output, separators=(",", ":")) + "\n", encoding="utf-8"
)
readme = download("README.md").decode()
mit = download("MIT-LICENSE.txt").decode()
notice = (
    "English frequency data used by the local Wordle solver\n"
    f"Source: {output['source']}\n"
    f"Source SHA-256: {output['sha256']}\n"
    f"Adaptations: {output['changes']}\n"
    "frequencies.json and adaptations of that data are CC BY-SA 4.0.\n"
    "The application code is separately licensed.\n\n"
    f"Common answer vocabulary: {output['answerSource']}\n"
    f"Policy: {output['answerPolicy']}\n"
    "Alternate 12Dicts by Alan Beale, packaged by Kevin Atkinson; explicitly "
    "placed in the public domain. Proper names and phrases are excluded.\n\n"
    + readme[readme.index("## License"):]
    + "\n\nwordfreq code license:\n"
    + mit
    + "\n\nFrequency data license: https://creativecommons.org/licenses/by-sa/4.0/\n"
)
(ROOT / "public" / "solver-data-LICENSE.txt").write_text(notice, encoding="utf-8")
print(f"Generated {len(answers)} common answers and {len(frequencies)} frequencies")
