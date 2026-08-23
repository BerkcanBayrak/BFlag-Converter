import os
import sys
import time
import webbrowser
import threading
from app import app, DOWNLOADS_DIR, FFMPEG_PATH

def open_browser(port):
    time.sleep(1.2)
    url = f"http://127.0.0.1:{port}"
    print(f"[*] Tarayıcı açılıyor: {url}")
    webbrowser.open(url)

if __name__ == "__main__":
    port = 5000
    print("\n" + "="*65)
    print("  🚀 BFlag Converter - YouTube Video & MP3 Dönüştürücü PRO")
    print("  © Copyright by Berkcan Bayrak")
    print(f"  🌐 Yerel Sunucu Adresi : http://127.0.0.1:{port}")
    print(f"  📂 İndirilenler Yolu   : {DOWNLOADS_DIR}")
    print(f"  ⚡ FFmpeg Durumu       : {'Aktif (' + str(FFMPEG_PATH) + ')' if FFMPEG_PATH else 'Bulunamadı'}")
    print("="*65 + "\n")

    # Start browser in background
    threading.Thread(target=open_browser, args=(port,), daemon=True).start()

    # Start Flask server
    app.run(host="127.0.0.1", port=port, debug=False)
