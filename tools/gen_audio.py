#!/usr/bin/env python3
"""Generuje MP3 nahrávky pro všechny německé věty v data/items.json pomocí Piper TTS.

Použití:
  pip install piper-tts        (+ ffmpeg v systému)
  python3 tools/gen_audio.py --voices /cesta/k/hlasum

Hlasy (Piper v0.0.2, *-low): https://github.com/rhasspy/piper/releases/tag/v0.0.2
  voice-de-thorsten-low, voice-de-karlsson-low, voice-de-kerstin-low, voice-de-ramona-low

Generuje jen chybějící soubory (název = hash textu + hlasu), staré nepoužité smaže
a zapíše audio/manifest.json  { "text": "soubor.mp3" }.
"""
import argparse, hashlib, json, subprocess, sys, wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VOICES = ["thorsten", "karlsson", "kerstin", "ramona"]


def texts_for(item):
    """Vrátí seznam (text, klíč pro výběr hlasu) k namluvení."""
    t = item["type"]
    if t == "gap":
        return [(item["de"].replace("{", "").replace("}", ""), item["id"])]
    if t == "pair":
        return [(item["a"], item["id"]), (item["b"], item["id"])]
    return [(item["de"], item["id"])]


def pick_voice(key):
    h = int(hashlib.sha1(key.encode()).hexdigest(), 16)
    return VOICES[h % len(VOICES)]


def fix_phonemes(sentences):
    # starší modely znají „ç“ jako jeden znak, novější espeak vrací c + kombinující cedilu
    out = []
    for ph in sentences:
        fixed = []
        for p in ph:
            if p == "̧" and fixed and fixed[-1] == "c":
                fixed[-1] = "ç"
            else:
                fixed.append(p)
        out.append(fixed)
    return out


def synth(voice, text, wav_path):
    import numpy as np
    from piper import SynthesisConfig
    cfg = SynthesisConfig(length_scale=1.08, noise_scale=0.5, noise_w_scale=0.6)
    chunks = []
    for ph in fix_phonemes(voice.phonemize(text)):
        if not ph:
            continue
        audio = voice.phoneme_ids_to_audio(voice.phonemes_to_ids(ph), cfg)
        if isinstance(audio, tuple):
            audio = audio[0]
        audio = audio / max(1e-8, float(np.max(np.abs(audio))))
        chunks.append(audio)
        chunks.append(np.zeros(int(voice.config.sample_rate * 0.25), dtype=np.float32))
    pcm = (np.clip(np.concatenate(chunks), -1, 1) * 32000).astype("<i2")
    with wave.open(str(wav_path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(voice.config.sample_rate)
        w.writeframes(pcm.tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voices", required=True, help="adresář s de-<hlas>-low.onnx")
    ap.add_argument("--keep", action="store_true", help="nemazat nepoužité soubory")
    a = ap.parse_args()

    items = json.loads((ROOT / "data/items.json").read_text())["items"]
    audio_dir = ROOT / "audio"; audio_dir.mkdir(exist_ok=True)
    wanted = {}
    for it in items:
        for text, key in texts_for(it):
            v = it.get("voice") or pick_voice(key)
            name = hashlib.sha1(f"{v}|{text}".encode()).hexdigest()[:12] + ".mp3"
            wanted[text] = (name, v)

    from piper import PiperVoice
    loaded = {}
    todo = [(t, n, v) for t, (n, v) in wanted.items() if not (audio_dir / n).exists()]
    print(f"{len(wanted)} vět, k vygenerování {len(todo)}")
    tmp = audio_dir / "_tmp.wav"
    for i, (text, name, v) in enumerate(todo, 1):
        if v not in loaded:
            loaded[v] = PiperVoice.load(str(Path(a.voices) / f"de-{v}-low.onnx"))
        synth(loaded[v], text, tmp)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(tmp),
                        "-af", "silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-16:TP=-1.5",
                        "-ar", "22050", "-ac", "1", "-b:a", "48k", str(audio_dir / name)], check=True)
        print(f"[{i}/{len(todo)}] {v}: {text}")
    tmp.unlink(missing_ok=True)

    names = {n for n, _ in wanted.values()}
    if not a.keep:
        for f in audio_dir.glob("*.mp3"):
            if f.name not in names:
                f.unlink(); print("smazáno", f.name)
    manifest = {t: n for t, (n, _) in sorted(wanted.items())}
    (audio_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=0))
    print("hotovo")


if __name__ == "__main__":
    sys.exit(main())
