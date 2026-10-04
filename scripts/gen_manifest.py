import argparse
import hashlib
import json
import re
from pathlib import Path

VIDEO_EXT = {".mp4", ".webm", ".mov", ".m4v", ".mkv"}
IMAGE_EXT = (".jpg", ".jpeg", ".png", ".webp")
SEP = re.compile(r"\s*[-_—–|]\s*")


def make_id(text):
    return hashlib.md5(text.encode("utf-8")).hexdigest()[:12]


def split_name(stem):
    parts = SEP.split(stem, maxsplit=1)
    if len(parts) == 2 and parts[0].strip() and parts[1].strip():
        return parts[0].strip(), parts[1].strip()
    return "未知UP主", stem.strip() or "未命名"


def find_cover(video):
    for ext in IMAGE_EXT:
        candidate = video.parent / (video.stem + ext)
        if candidate.is_file():
            return candidate
    return None


def load_json(path):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    if isinstance(data, dict):
        data = data.get("videos", [data])
    if not isinstance(data, list):
        return []
    return [d for d in data if isinstance(d, dict) and d.get("url")]


def collect(src, prefix):
    items = []
    seen = set()

    def push(url, author, title, cover="", desc=""):
        if not url or url in seen:
            return
        seen.add(url)
        items.append({
            "id": make_id(url),
            "author": author or "未知UP主",
            "title": title or "未命名",
            "url": url,
            "cover": cover or "",
            "desc": desc or "",
        })

    if not src.is_dir():
        return items

    for path in sorted(src.rglob("*")):
        if not path.is_file():
            continue
        suffix = path.suffix.lower()

        if suffix in VIDEO_EXT:
            rel = path.relative_to(src)
            if len(rel.parts) > 1:
                author, title = rel.parts[0], path.stem
            else:
                author, title = split_name(path.stem)
            cover = find_cover(path)
            cover_url = ""
            if cover:
                cover_url = f"{prefix}/{cover.relative_to(src).as_posix()}"
            push(f"{prefix}/{rel.as_posix()}", author, title, cover_url)

        elif suffix == ".json":
            for entry in load_json(path):
                push(
                    str(entry["url"]),
                    entry.get("author"),
                    entry.get("title"),
                    entry.get("cover", ""),
                    entry.get("desc", ""),
                )

    return items


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", default="videos")
    parser.add_argument("--out", default="dist/videos.json")
    parser.add_argument("--url-prefix")
    args = parser.parse_args()

    src = Path(args.src)
    prefix = (args.url_prefix or src.name).strip("/")
    items = collect(src, prefix)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(items)} video(s) -> {out}")


if __name__ == "__main__":
    main()
