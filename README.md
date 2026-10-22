# Albert

Poslechová cvičení z němčiny pro pokročilé. Zaměřuje se na rody, pády, vazby sloves a typické české pasti. Albertův průvodce je milý pán kolem padesátky. Aplikace je offline PWA pro iPhone (Safari → Sdílet → Přidat na plochu).

## Obsah

- `data/items.json` – banka vět. Typy úloh: `gap` (doplň, správná možnost je v `{}` a první v `options`), `errorhunt` (`error`: chybné slovo nebo `null`, `fix`: oprava, `""` = slovo navíc), `pair` (věty `a`/`b`, otázka `q`, `answer`), `dictation`, `gender` (`noun`, `cz`, `answer`, ukázková věta `de`). První štítek v `tags` je hlavní kategorie, `cz` = česká past.
- `data/albert.json` – kategorie a Albertovy hlášky.

## Nahrávky

Po úpravě vět je potřeba přegenerovat audio (generují se jen nové věty). Nejjednodušší je spustit workflow **Actions → Nahrávky → Run workflow**: stáhne hlas Piper (výchozí `thorsten-high`), vygeneruje chybějící MP3, uloží je do repa a znovu nasadí aplikaci.

Lokálně:

```
pip install piper-tts      # + ffmpeg
python3 tools/gen_audio.py --voices /cesta/k/hlasum --names thorsten-high
```

Hlasy: https://huggingface.co/rhasspy/piper-voices/tree/main/de/de_DE

## Nasazení

Push do `main` → GitHub Actions nasadí na Pages (jen kopíruje soubory, trvá pár desítek sekund).
