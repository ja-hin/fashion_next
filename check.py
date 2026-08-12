"""
genie_studio.py — Genie 2.0: conversational art / studio director for AImageGen.

STANDALONE, NON-INVASIVE. Does NOT touch main.py. Mount later with `register(app)`
(same pattern as models.py). `python genie_studio.py` serves the test UI so you can
try the whole flow in isolation.

WHAT IT DOES
------------
Shoot-level assistant. One session per shoot. The MODEL and the GARMENT are always
constant (from the locked hero). Genie owns the CREATIVE spec — Pose, Framing,
Backdrop, Lighting, Mood. It NEVER sets aspect ratio or resolution (those are your
output settings, chosen on the card / set).

Three output modes (the model picks per turn):
  • single   — one shot. intent ∈ {refine_pose, art_direct, match_reference, clarify}.
               refine_pose keeps the hero scene (keep_scene=true).
  • series   — a "shoot set": ONE shared scene + N shots, each varying pose+framing.
               Feeds your batch pipeline. keep_scene may be true (hero scene) or false.
  • ask_count— user asked for a set but gave no number → Genie asks, offering chips.

BILLING
-------
1 credit per Genie usage (per successful turn). Wallet is pluggable — inject your
main.py STATE wallet via `set_wallet(get_balance, charge)`. Image *generation*
(Use this / Generate all / per-shot ▶) is billed separately by your /one and /batch
endpoints, not here.
"""

import os, io, json, re
from typing import Optional, Callable, List, Dict, Any

from fastapi import APIRouter, Form, File, UploadFile, Request, HTTPException
from fastapi.responses import JSONResponse

# ── config / key ──────────────────────────────────────────────────────────────
GEMINI_KEY = ""
try:
    import config as cfg
    GEMINI_KEY = (getattr(cfg, "GEMINI_API_KEY", "") or "").strip()
except Exception:
    cfg = None
GEMINI_KEY = GEMINI_KEY or os.environ.get("GEMINI_API_KEY", "").strip()
PROVIDER = "gemini" if GEMINI_KEY else "mock"

TEXT_MODEL = "gemini-2.5-flash"     # text + vision in one call
MAX_IMG_PX = 1024
CHARGE_PER_TURN = 1                 # credits per Genie usage
DEFAULT_SET_SIZE = 4               # only used if the model returns series w/o a count
MAX_SET_SIZE = 12

# ── creative vocabulary (framing kept in sync with main.py FRAMING; NO aspect) ──
FRAMING_KEYS = ["full_body", "three_quarter", "knee_up", "waist_up", "portrait", "close_up"]
FRAMING_LABEL = {"full_body": "Full-body", "three_quarter": "Three-quarter", "knee_up": "Knee-up",
                 "waist_up": "Waist-up", "portrait": "Portrait", "close_up": "Close-up"}

STYLE_PHRASE = {
    "european": "a European/Western woman", "indian": "an Indian woman (warm medium-brown skin, dark hair)",
    "east_asian": "an East Asian woman", "southeast_asian": "a Southeast Asian woman",
    "middle_eastern": "a Middle-Eastern woman", "african": "a Black African woman",
    "latina": "a Latina/Hispanic woman", "diverse": "a naturally diverse woman",
}

# ── pluggable wallet + auth ───────────────────────────────────────────────────
_WALLET = {"n": 200.0}
_get_balance: Callable[[], float] = lambda: _WALLET["n"]
def _default_charge(a): _WALLET["n"] -= a; return _WALLET["n"]
_charge: Callable[[float], float] = _default_charge
_authed: Optional[Callable[[Request], bool]] = None
_get_anchor: Optional[Callable[[str], Dict[str, Any]]] = None

def set_wallet(get_balance, charge):
    global _get_balance, _charge; _get_balance, _charge = get_balance, charge
def set_auth(fn):
    global _authed; _authed = fn
def set_anchor_source(fn):
    global _get_anchor; _get_anchor = fn

# ── the art-director brain (system prompt) ────────────────────────────────────
_JSON_SHAPE = """{
  "reply": "<short chat message to show the user>",
  "mode": "single | series | ask_count",

  // when mode = single:
  "intent": "refine_pose | art_direct | match_reference | clarify",
  "ready": <true if a usable spec is included>,
  "spec": {
    "pose": "<vivid, concise pose + gesture + expression, 1-2 sentences>",
    "framing": "<one of: full_body, three_quarter, knee_up, waist_up, portrait, close_up>",
    "keep_scene": <true to reuse the hero backdrop/lighting/mood, false to change them>,
    "backdrop": "<short phrase; '' when keep_scene>",
    "lighting": "<short phrase; '' when keep_scene>",
    "mood": "<short phrase; '' when keep_scene>",
    "notes": "<one-line rationale>"
  },

  // when mode = series (a shoot set): ONE shared scene + N shots
  "set": {
    "keep_scene": <true to reuse the hero scene for every shot, false for a new shared scene>,
    "backdrop": "<short phrase; '' when keep_scene>",
    "lighting": "<short phrase; '' when keep_scene>",
    "mood": "<short phrase; '' when keep_scene>",
    "shots": [ { "pose": "<...>", "framing": "<one of the framing values>" } ]
  },

  // when mode = ask_count:
  "suggested_counts": [3,4,6,8],

  "suggestions": ["<short follow-up idea>", "<short follow-up idea>"]
}"""

def _anchor_line(a: Dict[str, Any]) -> str:
    a = a or {}
    style = (a.get("style") or a.get("ethnicity") or "").strip()
    cat = (a.get("category") or "").strip()
    who = STYLE_PHRASE.get(style, "the locked model")
    if cat == "menswear": who = who.replace("woman", "man")
    elif cat == "kidswear": who = "the locked child model (age-appropriate, fully clothed)"
    garment = (a.get("garment_desc") or "").strip() or "the exact uploaded product garment"
    sc = a.get("scene") or {}
    scene = ", ".join([x for x in [sc.get("backdrop"), sc.get("lighting"), sc.get("mood")] if x]) or "as in the hero image"
    return (f"MODEL (locked, never change): {who}.\n"
            f"GARMENT (locked, never change): {garment} — preserve colour, print, logo, cut, fabric.\n"
            f"Category: {cat or 'unspecified'}. Hero scene: {scene}.")

def director_system(anchor: Dict[str, Any]) -> str:
    return (
        "You are Genie — an expert fashion art director, studio photographer and prompt engineer inside "
        "an on-model fashion image generator (AImageGen). You help a brand's team turn plain-language ideas "
        "into precise, photo-ready generation specs for a whole shoot.\n\n"
        "ALWAYS CONSTANT — NEVER CHANGE: (1) the MODEL (person, face, body, hair, ethnicity); "
        "(2) the GARMENT (exact product — colour, print, logo, cut, fabric). Both come from the locked hero. "
        "Every shot is the SAME model in the SAME garment.\n\n"
        "YOU CONTROL (creative): POSE & expression, FRAMING (camera crop), and the SCENE (backdrop, lighting, "
        "mood). You do NOT control aspect ratio or resolution — the user sets those. Never mention or set them.\n\n"
        "THE HERO ANCHOR:\n" + _anchor_line(anchor) + "\n\n"
        "CHOOSE A MODE each turn:\n"
        "• SINGLE — one shot. If the user says 'improve/refine/make this pose better' with no new scene, keep the "
        "hero scene (keep_scene=true, blank backdrop/lighting/mood) and elevate only pose+framing "
        "(intent=refine_pose). If they give a vibe/campaign feel, design a new scene (intent=art_direct). If an "
        "IMAGE is attached, read its art direction and recreate the LOOK with our model+garment constant "
        "(intent=match_reference) — never copy the reference's person or clothing.\n"
        "• SERIES — the user wants several shots / a set / a catalog AND has given a number (e.g. '4 shots', "
        "'a 6-image catalog'): return a shoot set with ONE shared scene and exactly that many shots, each a "
        "DIFFERENT, complementary pose+framing (think like a photographer: establishing full-body, a hero "
        "three-quarter, movement/walking, a waist-up or close-up detail, etc.). Use keep_scene=true only if they "
        "asked to keep the hero background.\n"
        "• ASK_COUNT — the user wants a set/catalog but gave NO number: return mode=ask_count with a short "
        "question and suggested_counts [3,4,6,8]. Do NOT invent a set yet.\n\n"
        "FRAMING must be one of: " + ", ".join(FRAMING_KEYS) + ". POSE = vivid but concise (body, weight, hands, "
        "expression). Scene phrases are short. Be specific and production-ready; keep the garment the hero of the "
        "frame.\n\n"
        "OUTPUT: reply with a SINGLE JSON object in EXACTLY this shape, nothing else (no markdown/code fence). "
        "Include only the keys relevant to the chosen mode:\n" + _JSON_SHAPE
    )

# ── helpers ───────────────────────────────────────────────────────────────────
def _to_jpeg(raw: bytes) -> bytes:
    from PIL import Image
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    w, h = img.size
    if max(w, h) > MAX_IMG_PX:
        s = MAX_IMG_PX / max(w, h); img = img.resize((int(w*s), int(h*s)), Image.LANCZOS)
    buf = io.BytesIO(); img.save(buf, "JPEG", quality=90); return buf.getvalue()

def _transcript(messages, has_image):
    lines = []
    for m in messages or []:
        role = "User" if (m.get("role") in ("user", "human")) else "Genie"
        t = (m.get("text") or "").strip()
        if t: lines.append(f"{role}: {t}")
    if has_image:
        lines.append("User: [attached a reference image — analyse it as the art direction to match]")
    return "\n".join(lines) if lines else "User: (no message)"

def _extract_json(text):
    if not text: return None
    t = re.sub(r"^```(?:json)?\s*", "", text.strip()); t = re.sub(r"\s*```$", "", t)
    try: return json.loads(t)
    except Exception: pass
    m = re.search(r"\{.*\}", t, re.DOTALL)
    if m:
        try: return json.loads(m.group(0))
        except Exception: return None
    return None

def _clean_framing(f):
    return f if f in FRAMING_KEYS else ""

def _coerce_scene(keep, bd, lt, md):
    keep = bool(keep)
    if keep: return True, "", "", ""
    return False, (bd or "").strip(), (lt or "").strip(), (md or "").strip()

def _coerce(out, anchor):
    """Normalise the model's JSON into a safe, app-ready response."""
    out = out or {}
    reply = (out.get("reply") or "").strip() or "Here's a direction for your shot."
    mode = out.get("mode") if out.get("mode") in ("single", "series", "ask_count") else None
    sugg = [str(s).strip() for s in (out.get("suggestions") or []) if str(s).strip()][:4]

    # infer mode if missing
    if not mode:
        mode = "series" if out.get("set") else ("ask_count" if out.get("suggested_counts") else "single")

    if mode == "ask_count":
        counts = [c for c in (out.get("suggested_counts") or [3, 4, 6, 8]) if isinstance(c, int) and 2 <= c <= MAX_SET_SIZE]
        return {"mode": "ask_count", "reply": reply, "suggested_counts": counts or [3, 4, 6, 8], "suggestions": sugg}

    if mode == "series":
        s = out.get("set") or {}
        keep, bd, lt, md = _coerce_scene(s.get("keep_scene"), s.get("backdrop"), s.get("lighting"), s.get("mood"))
        shots = []
        for sh in (s.get("shots") or [])[:MAX_SET_SIZE]:
            pose = (sh.get("pose") or "").strip()
            if not pose: continue
            shots.append({"pose": pose, "framing": _clean_framing(sh.get("framing")) or "three_quarter"})
        if not shots:
            return {"mode": "single", "reply": reply, "intent": "clarify", "ready": False,
                    "spec": _blank_spec(), "suggestions": sugg}
        return {"mode": "series", "reply": reply,
                "set": {"keep_scene": keep, "backdrop": bd, "lighting": lt, "mood": md, "shots": shots},
                "count": len(shots), "suggestions": sugg}

    # single
    intent = out.get("intent") if out.get("intent") in ("refine_pose", "art_direct", "match_reference", "clarify") else "art_direct"
    sp = out.get("spec") or {}
    keep, bd, lt, md = _coerce_scene(sp.get("keep_scene", intent == "refine_pose"), sp.get("backdrop"), sp.get("lighting"), sp.get("mood"))
    spec = {"pose": (sp.get("pose") or "").strip(), "framing": _clean_framing(sp.get("framing")) or "three_quarter",
            "keep_scene": keep, "backdrop": bd, "lighting": lt, "mood": md, "notes": (sp.get("notes") or "").strip()}
    ready = bool(out.get("ready", intent != "clarify")) and bool(spec["pose"])
    return {"mode": "single", "reply": reply, "intent": intent, "ready": ready, "spec": spec, "suggestions": sugg}

def _blank_spec():
    return {"pose": "", "framing": "three_quarter", "keep_scene": True, "backdrop": "", "lighting": "", "mood": "", "notes": ""}

# ── core call ─────────────────────────────────────────────────────────────────
def run_director(messages, anchor, image_bytes=None):
    if PROVIDER == "mock":
        parsed = _mock_director(messages, anchor, bool(image_bytes))
    else:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=GEMINI_KEY)
        prompt = director_system(anchor) + "\n\nCONVERSATION SO FAR:\n" + _transcript(messages, bool(image_bytes)) + "\n\nRespond now with the JSON object."
        parts = []
        if image_bytes: parts.append(types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"))
        parts.append(types.Part.from_text(text=prompt))
        try:
            resp = client.models.generate_content(model=TEXT_MODEL, contents=parts,
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.7))
            raw = getattr(resp, "text", "") or ""
        except Exception as e:
            raise HTTPException(502, f"Genie failed: {e}")
        parsed = _extract_json(raw) or {"reply": (raw.strip()[:400] or "Let's try that again — tell me the vibe."),
                                        "mode": "single", "intent": "clarify", "ready": False, "spec": {}}
    if image_bytes:
        parsed = _enforce_reference(parsed)
    return _coerce(parsed, anchor)

def _enforce_reference(parsed):
    """A reference image => match a look. Never collapse to 'pose only'."""
    parsed = parsed or {}
    if parsed.get("mode") == "series":
        parsed.setdefault("set", {})["keep_scene"] = False
        return parsed
    parsed["mode"] = "single"; parsed["intent"] = "match_reference"
    sp = parsed.get("spec") or {}; sp["keep_scene"] = False; parsed["spec"] = sp
    parsed["ready"] = bool(sp.get("pose"))
    return parsed

# ── mock brain (no key needed — keeps demo + tests runnable) ──────────────────
_SERIES_POOL = [
    ("Straight front, weight even, arms relaxed at sides — clean establishing shot", "full_body"),
    ("Contrapposto, one hand on hip, shoulders open to camera, easy confident smile", "three_quarter"),
    ("Mid-stride walking toward camera, natural arm swing, hair with a touch of motion", "full_body"),
    ("Hands adjusting a sleeve, chin slightly down — fabric and detail focus", "waist_up"),
    ("Side profile, chin lifted, calm editorial gaze", "three_quarter"),
    ("Seated on a stool, forward lean, elbows on knees, engaged expression", "waist_up"),
    ("Tight portrait, soft smile, direct eye contact", "portrait"),
    ("Full turn showing the back of the garment, glancing over the shoulder", "full_body"),
    ("Leaning a shoulder against a wall, ankles crossed, relaxed", "three_quarter"),
    ("Close crop on the neckline and print, hands lightly framing the fabric", "close_up"),
    ("Arms crossed, grounded stance, assured expression", "three_quarter"),
    ("Twirl with slight skirt/dupatta movement, joyful energy", "full_body"),
]

def _last_user(messages):
    for m in reversed(messages or []):
        if m.get("role") in ("user", "human") and (m.get("text") or "").strip():
            return m["text"].strip()
    return ""

def _find_count(text):
    words = {"two":2,"three":3,"four":4,"five":5,"six":6,"seven":7,"eight":8,"nine":9,"ten":10,"a couple":2,"couple":2}
    t = text.lower()
    m = re.search(r"\b(\d{1,2})\b", t)
    if m:
        n = int(m.group(1))
        if 2 <= n <= MAX_SET_SIZE: return n
    for w, n in words.items():
        if w in t: return n
    return None

def _mentions_set(text_all):
    t = text_all.lower()
    return any(k in t for k in ["set","catalog","catalogue","series","multiple","few poses","several","collection","shoot set","bunch"])

def _mock_director(messages, anchor, has_image):
    last = _last_user(messages)
    all_text = " ".join(m.get("text","") for m in (messages or []))
    lastl = last.lower()

    # reference image → match look (single by default in mock)
    if has_image or "like this" in lastl or "match" in lastl:
        return {"mode":"single","intent":"match_reference","ready":True,
                "reply":("⚠ MOCK MODE — I can't truly see images without a Gemini key, so this is a fixed sample. "
                         "Set GEMINI_API_KEY for real reference analysis." if has_image else
                         "Recreating that look with your model and garment kept constant."),
                "spec":{"pose":"Relaxed three-quarter turn toward camera, weight on the back leg, one hand grazing the hip, calm confident gaze",
                        "framing":"three_quarter","keep_scene":False,
                        "backdrop":"[sample] sunlit terrace, white columns, green climbing vines" if has_image else "sunlit terrace, greenery",
                        "lighting":"soft warm daylight","mood":"relaxed, editorial"},
                "suggestions":["Turn it into a 4-shot set","Punchier catalog version","Full-body silhouette"]}

    # series requests
    if _mentions_set(all_text) or _find_count(last) is not None and _mentions_set(all_text):
        n = _find_count(all_text)
        if n is None:
            return {"mode":"ask_count","reply":"Love it — how many shots should the set have? They'll share one scene, with your model & garment constant.",
                    "suggested_counts":[3,4,6,8],"suggestions":["A quick 3","Standard 4","Full 6"]}
        keep = any(k in all_text.lower() for k in ["same background","keep the background","keep background","hero scene","same scene","same bg"])
        shots = [{"pose":p,"framing":f} for (p,f) in _SERIES_POOL[:max(2,min(n,MAX_SET_SIZE))]]
        scene = ({} if keep else {"backdrop":"clean studio seamless","lighting":"soft bright daylight","mood":"fresh, upbeat catalog"})
        return {"mode":"series","reply":f"Here's a {len(shots)}-shot set — one consistent scene, {len(shots)} complementary poses & framings. Same model & garment throughout.",
                "set":{"keep_scene":keep,**scene,"shots":shots},
                "suggestions":["Make it 6 shots","Add a seated pose","Try an outdoor scene"]}

    # bare number as an answer to ask_count
    if _find_count(last) is not None and _mentions_set(all_text) is False and len(last) <= 12:
        n=_find_count(last)
        shots=[{"pose":p,"framing":f} for (p,f) in _SERIES_POOL[:max(2,min(n,MAX_SET_SIZE))]]
        return {"mode":"series","reply":f"Great — a {len(shots)}-shot set on one shared scene.",
                "set":{"keep_scene":False,"backdrop":"clean studio seamless","lighting":"soft bright daylight","mood":"fresh, upbeat catalog","shots":shots},
                "suggestions":["Make it 6 shots","Keep the hero background instead","Add a close-up detail"]}

    # refine pose (scene kept)
    if any(k in lastl for k in ["better","improve","refine","sharpen","pose"]) and not any(k in lastl for k in ["catalog","campaign","vibe","editorial","background","backdrop","scene"]):
        return {"mode":"single","intent":"refine_pose","ready":True,
                "reply":"Kept your background, lighting, garment and model as the hero — I elevated the pose and set the framing that flatters it.",
                "spec":{"pose":"Confident contrapposto, weight on one leg, shoulders open, one hand loosely in pocket, natural half-smile with engaged eyes",
                        "framing":"three_quarter","keep_scene":True,"backdrop":"","lighting":"","mood":""},
                "suggestions":["Turn it into a 4-shot set","More dynamic / mid-motion","Waist-up crop"]}

    # default: art-direct a single new scene
    return {"mode":"single","intent":"art_direct","ready":True,
            "reply":"Bright, fresh and energetic — new scene, same model and garment.",
            "spec":{"pose":"Energetic mid-stride toward camera, arms with a light swing, bright open smile",
                    "framing":"full_body","keep_scene":False,"backdrop":"clean pastel seamless (soft sky-blue)",
                    "lighting":"bright even high-key commercial","mood":"upbeat, fresh, summery"},
            "suggestions":["Make it a 4-shot set","More premium / editorial","Match a reference image"]}

# ── payload helpers for your existing endpoints ───────────────────────────────
def spec_to_one_payload(spec):
    """Fields for POST /api/product/{pid}/one (NO aspect — user sets that on the card)."""
    spec = spec or {}
    p = {"custom": spec.get("pose", ""), "framing": spec.get("framing", "")}
    if not spec.get("keep_scene"):
        p["backdrop"] = spec.get("backdrop", ""); p["mood"] = spec.get("mood", ""); p["lighting"] = spec.get("lighting", "")
    return p

def set_to_batch_rows(sset):
    """Rows for POST /api/product/{pid}/batch — one row per shot, sharing the set scene.
    keep_scene => omit scene (batch keeps the hero background)."""
    sset = sset or {}; keep = sset.get("keep_scene")
    rows = []
    for sh in sset.get("shots", []):
        row = {"pose": sh.get("pose", ""), "framing": sh.get("framing", "")}
        if not keep:
            row["backdrop"] = sset.get("backdrop", ""); row["mood"] = sset.get("mood", ""); row["lighting"] = sset.get("lighting", "")
        rows.append(row)
    return rows

# ── router ────────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/api/genie2", tags=["genie-studio"])

@router.get("/ping")
async def ping(request: Request):
    if _authed and not _authed(request): raise HTTPException(401, "Not authenticated")
    return {"ok": True, "provider": PROVIDER, "balance": _get_balance(),
            "charge_per_turn": CHARGE_PER_TURN, "framings": FRAMING_KEYS}

@router.post("/chat")
async def chat(request: Request, messages: str = Form("[]"), anchor: str = Form("{}"),
               pid: str = Form(""), image: Optional[UploadFile] = File(None)):
    if _authed and not _authed(request): raise HTTPException(401, "Not authenticated")
    try:
        msgs = json.loads(messages or "[]"); assert isinstance(msgs, list)
    except Exception:
        raise HTTPException(400, "Bad 'messages' — expected a JSON array of {role,text}.")
    try:
        anc = json.loads(anchor or "{}"); assert isinstance(anc, dict)
    except Exception:
        anc = {}
    if pid and _get_anchor:
        try: anc = _get_anchor(pid) or anc
        except Exception: pass

    img = None
    if image is not None:
        try: img = _to_jpeg(await image.read())
        except Exception: raise HTTPException(400, "Could not read that reference image (use JPG/PNG/WebP).")

    charged = 0.0
    if CHARGE_PER_TURN > 0:
        if _get_balance() < CHARGE_PER_TURN: raise HTTPException(402, "Not enough credits for Genie.")
        _charge(CHARGE_PER_TURN); charged = float(CHARGE_PER_TURN)

    try:
        result = run_director(msgs, anc, img)
    except HTTPException:
        if charged: _charge(-charged)
        raise

    # attach ready-to-post payloads for your existing endpoints
    if result.get("mode") == "single" and result.get("ready"):
        result["one_payload"] = spec_to_one_payload(result.get("spec", {}))
    elif result.get("mode") == "series":
        result["batch_rows"] = set_to_batch_rows(result.get("set", {}))

    result["balance"] = _get_balance(); result["charged"] = charged; result["provider"] = PROVIDER
    return JSONResponse(result)

def register(app, authed=None, get_anchor=None, wallet=None):
    if authed: set_auth(authed)
    if get_anchor: set_anchor_source(get_anchor)
    if wallet: set_wallet(wallet[0], wallet[1])
    app.include_router(router)
    return router

# ── standalone runner ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    from pathlib import Path
    import uvicorn
    from fastapi import FastAPI
    from fastapi.responses import HTMLResponse
    demo = FastAPI(title="Genie Studio — standalone")
    register(demo)
    DEMO = Path(__file__).parent / "genie_studio_demo.html"
    @demo.get("/", response_class=HTMLResponse)
    async def _index():
        return DEMO.read_text(encoding="utf-8") if DEMO.exists() else "<h1>genie_studio_demo.html not found</h1>"
    port = int(os.environ.get("GENIE_PORT", "8011"))
    print("\n" + "=" * 56 + f"\n  Genie Studio (standalone)   provider: {PROVIDER.upper()}" +
          ("  (MOCK — set GEMINI_API_KEY for live)" if PROVIDER == "mock" else "") +
          f"\n  Test UI : http://localhost:{port}\n" + "=" * 56 + "\n")
    uvicorn.run(demo, host="0.0.0.0", port=port, log_level="warning")
