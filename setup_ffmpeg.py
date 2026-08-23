import os
import sys
import shutil
import zipfile
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
BIN_DIR = BASE_DIR / "bin"
FFMPEG_EXE = BIN_DIR / "ffmpeg.exe"
FFPROBE_EXE = BIN_DIR / "ffprobe.exe"

FFMPEG_ZIP_URL = "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"

def log(msg):
    print(f"[*] {msg}", flush=True)

def _add_to_path():
    bin_str = str(BIN_DIR)
    if bin_str not in os.environ.get("PATH", ""):
        os.environ["PATH"] = bin_str + os.pathsep + os.environ.get("PATH", "")

def ensure_ffmpeg():
    """
    Ensures that both ffmpeg.exe and ffprobe.exe are available locally in the `bin` directory.
    Returns the Path to ffmpeg.exe or raises an error.
    """
    BIN_DIR.mkdir(exist_ok=True)

    # 1. Check if both local bin/ffmpeg.exe and bin/ffprobe.exe exist
    has_ffmpeg = FFMPEG_EXE.exists() and FFMPEG_EXE.stat().st_size > 1000000
    has_ffprobe = FFPROBE_EXE.exists() and FFPROBE_EXE.stat().st_size > 1000000

    if has_ffmpeg and has_ffprobe:
        _add_to_path()
        return str(FFMPEG_EXE)

    log("FFmpeg veya FFprobe eksik. Otomatik yapılandırma başlatılıyor...")

    # 2. Try static_ffmpeg package (fetches both ffmpeg and ffprobe)
    try:
        import static_ffmpeg
        static_ffmpeg.add_paths()
        paths = static_ffmpeg.run.get_or_fetch_platform_executables_else_raise()
        if paths:
            src_ffmpeg, src_ffprobe = paths
            if not has_ffmpeg and os.path.exists(src_ffmpeg):
                shutil.copyfile(src_ffmpeg, FFMPEG_EXE)
                log(f"FFmpeg kopyalandı -> {FFMPEG_EXE}")
            if not has_ffprobe and os.path.exists(src_ffprobe):
                shutil.copyfile(src_ffprobe, FFPROBE_EXE)
                log(f"FFprobe kopyalandı -> {FFPROBE_EXE}")
            _add_to_path()
            return str(FFMPEG_EXE)
    except Exception as e:
        log(f"static_ffmpeg denendi: {e}")

    # 3. Try imageio_ffmpeg for ffmpeg
    try:
        import imageio_ffmpeg
        src_exe = imageio_ffmpeg.get_ffmpeg_exe()
        if src_exe and os.path.exists(src_exe) and not has_ffmpeg:
            shutil.copyfile(src_exe, FFMPEG_EXE)
            log(f"imageio_ffmpeg kopyalandı -> {FFMPEG_EXE}")
    except Exception as e:
        log(f"imageio_ffmpeg denendi: {e}")

    # 4. Try system PATH
    which_ff = shutil.which("ffmpeg")
    which_probe = shutil.which("ffprobe")
    if which_ff and os.path.exists(which_ff) and not has_ffmpeg:
        try:
            shutil.copyfile(which_ff, FFMPEG_EXE)
        except Exception:
            pass
    if which_probe and os.path.exists(which_probe) and not has_ffprobe:
        try:
            shutil.copyfile(which_probe, FFPROBE_EXE)
        except Exception:
            pass

    if FFMPEG_EXE.exists() and FFPROBE_EXE.exists():
        _add_to_path()
        return str(FFMPEG_EXE)

    # 5. Auto-Download from official static build if still missing
    log("İnternetten FFmpeg & FFprobe (Windows 64-bit) otomatik indiriliyor...")
    zip_path = BIN_DIR / "ffmpeg_temp.zip"
    try:
        def download_progress(count, block_size, total_size):
            if total_size > 0:
                percent = int(count * block_size * 100 / total_size)
                mb_downloaded = (count * block_size) / (1024 * 1024)
                total_mb = total_size / (1024 * 1024)
                sys.stdout.write(f"\r[+] İndiriliyor: %{percent} ({mb_downloaded:.1f} MB / {total_mb:.1f} MB)")
                sys.stdout.flush()

        urllib.request.urlretrieve(FFMPEG_ZIP_URL, str(zip_path), reporthook=download_progress)
        print("\n[+] İndirme tamamlandı. Arşivden çıkartılıyor...", flush=True)

        with zipfile.ZipFile(str(zip_path), 'r') as zip_ref:
            for member in zip_ref.namelist():
                filename = os.path.basename(member)
                if filename.lower() == "ffmpeg.exe":
                    source = zip_ref.open(member)
                    target = open(str(FFMPEG_EXE), "wb")
                    with source, target:
                        shutil.copyfileobj(source, target)
                    log(f"ffmpeg.exe çıkartıldı -> {FFMPEG_EXE}")
                elif filename.lower() == "ffprobe.exe":
                    source = zip_ref.open(member)
                    target = open(str(FFPROBE_EXE), "wb")
                    with source, target:
                        shutil.copyfileobj(source, target)
                    log(f"ffprobe.exe çıkartıldı -> {FFPROBE_EXE}")

        if zip_path.exists():
            zip_path.unlink()

        log("✅ FFmpeg ve FFprobe başarıyla hazırlandı!")
        _add_to_path()
        return str(FFMPEG_EXE)

    except Exception as e:
        log(f"❌ Otomatik indirme hatası: {e}")
        if zip_path.exists():
            try: zip_path.unlink()
            except: pass
        return str(FFMPEG_EXE) if FFMPEG_EXE.exists() else None

if __name__ == "__main__":
    res = ensure_ffmpeg()
    print(f"\n[OK] FFmpeg Durumu: {res}")
