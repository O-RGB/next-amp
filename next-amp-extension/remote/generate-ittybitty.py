#!/usr/bin/env python3
import os
import lzma
import base64
import urllib.parse

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    html_path = os.path.join(script_dir, "dos-remote.html")
    
    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()

    # LZMA Compress with preset 9 extreme
    compressed = lzma.compress(
        content.encode("utf-8"),
        format=lzma.FORMAT_ALONE,
        filters=[
            {"id": lzma.FILTER_LZMA1, "preset": 9 | lzma.PRESET_EXTREME}
        ]
    )
    b64_data = base64.b64encode(compressed).decode("ascii")

    title = "NextAmp-DOS"
    # Format according to itty.bitty.site specs:
    # https://itty.bitty.site/#<title>/data:text/html;charset=utf-8;bxze64,<base64>
    url = f"https://itty.bitty.site/#{title}/data:text/html;charset=utf-8;bxze64,{b64_data}"

    print("========================================")
    print("ITTY.BITTY REMOTE ENCODER")
    print("========================================")
    print(f"Source file:       {html_path}")
    print(f"Raw HTML size:     {len(content)} bytes")
    print(f"LZMA Compressed:   {len(compressed)} bytes")
    print(f"Base64 characters: {len(b64_data)}")
    print(f"Full URL length:   {len(url)} characters")
    print(f"Safari limit:      5,000 bytes (Used: {len(url)/5000*100:.1f}%)")
    print("========================================")
    print("URL:")
    print(url)
    print("========================================")

    out_txt = os.path.join(script_dir, "itty-bitty-url.txt")
    with open(out_txt, "w", encoding="utf-8") as out:
        out.write(url)
    print(f"Saved to: {out_txt}")

if __name__ == "__main__":
    main()
