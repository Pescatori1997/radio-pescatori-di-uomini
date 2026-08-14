"""Image payload optimizer.

Base64 images are stored inline in documents. Returning them inside LIST
endpoints makes responses several MB heavy → slow first paint on the PWA.

This module rewrites those inline data-URIs into lightweight, cacheable image
URLs (served by GET /api/img/...). The URL carries a content-hash version
(?v=...) so:
  * the browser/PWA can cache the bytes forever (immutable),
  * yet the URL changes automatically the moment an admin edits the image,
    busting the cache without any manual step.

No data migration: the DB keeps the base64; only the JSON responses change.
The frontend already renders these fields via <Image source={{uri}}>, so a
data-URI or an https URL are interchangeable — nothing changes visually.
"""

import base64
import hashlib

# Whitelisted collections -> scalar image fields to lighten (also acts as the
# access whitelist for the /img endpoint).
IMG_FIELDS = {
    "podcasts": ("artwork",),
    "news": ("image",),
    "showcase": ("image",),
    "crew": ("portrait",),
    "meditations": ("thumbnail",),
    "reading_plans": ("cover",),
    "contents": ("thumbnail",),
    "settings": ("about_image",),
    "programs": ("hero_image",),  # scalar; presenter/images arrays handled specially below
}

# Collections that carry image arrays.
_PROGRAM_ARRAYS = ("images", "presenters")


def is_data_uri(v) -> bool:
    return isinstance(v, str) and v.startswith("data:image/")


def _ver(v: str) -> str:
    return hashlib.md5(v.encode("utf-8")).hexdigest()[:10]


def _abs(path: str) -> str:
    # Return a RELATIVE path (/api/img/...). The backend can't reliably know its
    # public host behind the ingress (the Host header is the internal cluster
    # host), so the frontend prepends its known EXPO_PUBLIC_BACKEND_URL. Works on
    # both web (same-origin) and native.
    return path


def img_url(coll: str, doc_id: str, field: str, value: str, idx=None) -> str:
    if not is_data_uri(value) or not doc_id:
        return value
    path = f"/api/img/{coll}/{doc_id}/{field}?v={_ver(value)}"
    if idx is not None:
        path += f"&i={idx}"
    return _abs(path)


def lighten(coll: str, doc):
    """Return a shallow copy of doc with inline base64 images replaced by URLs."""
    if not doc:
        return doc
    d = dict(doc)
    did = d.get("id")
    for f in IMG_FIELDS.get(coll, ()):  # scalar fields
        if is_data_uri(d.get(f)):
            d[f] = img_url(coll, did, f, d[f])
    if coll == "programs":
        imgs = d.get("images")
        if isinstance(imgs, list):
            d["images"] = [img_url(coll, did, "images", v, idx=i) if is_data_uri(v) else v for i, v in enumerate(imgs)]
        pres = d.get("presenters")
        if isinstance(pres, list):
            new = []
            for i, p in enumerate(pres):
                if isinstance(p, dict) and is_data_uri(p.get("image")):
                    p = {**p, "image": img_url(coll, did, "presenters", p["image"], idx=i)}
                new.append(p)
            d["presenters"] = new
    return d


def lighten_list(coll: str, docs):
    return [lighten(coll, x) for x in (docs or [])]


def resolve_image(doc, coll: str, field: str, idx):
    """Extract the raw data-URI value for a given field/index from a doc."""
    val = doc.get(field)
    if coll == "programs" and field == "images" and isinstance(val, list):
        val = val[idx] if (idx is not None and 0 <= idx < len(val)) else None
    elif coll == "programs" and field == "presenters" and isinstance(val, list):
        entry = val[idx] if (idx is not None and 0 <= idx < len(val)) else None
        val = (entry or {}).get("image") if isinstance(entry, dict) else None
    return val


def decode_data_uri(v: str):
    """('data:image/png;base64,....') -> (mime, raw_bytes)."""
    header, _, data = v.partition(",")
    mime = "image/jpeg"
    if header.startswith("data:") and ";" in header:
        mime = header[5:header.index(";")] or mime
    return mime, base64.b64decode(data)


def field_allowed(coll: str, field: str) -> bool:
    if coll not in IMG_FIELDS:
        return False
    if coll == "programs":
        return field in _PROGRAM_ARRAYS
    return field in IMG_FIELDS[coll]
