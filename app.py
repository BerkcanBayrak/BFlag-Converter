import os
import re
import sys
import json
import time
import uuid
import shutil
import threading
import subprocess
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify, Response, send_from_directory, send_file
from flask_cors import CORS
import yt_dlp

# Auto-configure local FFmpeg & FFprobe
from setup_ffmpeg import ensure_ffmpeg, BIN_DIR, FFMPEG_EXE, FFPROBE_EXE

# Paths
BASE_DIR = Path(__file__).resolve().parent
DOWNLOADS_DIR = BASE_DIR / "downloads"
DOWNLOADS_DIR.mkdir(exist_ok=True)
STATIC_DIR = BASE_DIR / "static"

app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="")
CORS(app)

FFMPEG_PATH = ensure_ffmpeg()
print(f"[*] FFMPEG & FFprobe Ready at: {BIN_DIR}")

# In-memory storage for active download tasks and progress
tasks = {}
tasks_lock = threading.Lock()

def strip_ansi(text):
    if not text:
        return ""
    return re.sub(r'(\x1b\[[0-9;]*[a-zA-Z]|\033\[[0-9;]*[a-zA-Z])', '', str(text)).strip()

def format_bytes(bytes_val):
    if not bytes_val or bytes_val <= 0:
        return "0 B"
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_val < 1024.0:
            return f"{bytes_val:.1f} {unit}"
        bytes_val /= 1024.0
    return f"{bytes_val:.1f} TB"

def format_duration(seconds):
    if not seconds:
        return "00:00"
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h:02d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"

@app.route("/")
def index():
    return send_from_directory(str(STATIC_DIR), "index.html")

@app.route("/api/status", methods=["GET"])
def api_status():
    global FFMPEG_PATH
    if not FFMPEG_PATH or not os.path.exists(FFMPEG_PATH):
        FFMPEG_PATH = ensure_ffmpeg()
        
    return jsonify({
        "status": "ok",
        "ffmpeg_available": FFMPEG_PATH is not None and os.path.exists(FFMPEG_PATH),
        "ffmpeg_path": FFMPEG_PATH,
        "ffprobe_available": FFPROBE_EXE.exists(),
        "downloads_dir": str(DOWNLOADS_DIR)
    })

@app.route("/api/info", methods=["POST"])
def get_video_info():
    global FFMPEG_PATH
    if not FFMPEG_PATH:
        FFMPEG_PATH = ensure_ffmpeg()

    data = request.get_json() or {}
    url = (data.get("url") or "").strip()

    if not url:
        return jsonify({"error": "Lütfen geçerli bir YouTube URL'si girin."}), 400

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'extract_flat': False,
        'ffmpeg_location': str(BIN_DIR),
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            if not info:
                return jsonify({"error": "Video bilgileri alınamadı."}), 404

            # Handle playlists
            if 'entries' in info and info['entries']:
                first = info['entries'][0]
                return jsonify({
                    "is_playlist": True,
                    "title": info.get("title", "YouTube Çalma Listesi"),
                    "playlist_count": len(info['entries']),
                    "thumbnail": first.get("thumbnail") or (info.get("thumbnails") and info["thumbnails"][-1]["url"]),
                    "entries": [{
                        "id": e.get("id"),
                        "title": e.get("title"),
                        "duration": format_duration(e.get("duration")),
                        "duration_sec": e.get("duration", 0),
                        "url": e.get("webpage_url") or f"https://www.youtube.com/watch?v={e.get('id')}",
                        "thumbnail": e.get("thumbnail")
                    } for e in info['entries'][:30]]
                })

            # Single Video Analysis - Full Resolution Spectrum
            formats = info.get("formats", [])
            video_qualities = []
            seen_resolutions = set()

            for f in formats:
                height = f.get("height")
                vcodec = f.get("vcodec", "none")
                if height and vcodec != "none":
                    # Standard resolution labels
                    if height not in seen_resolutions:
                        seen_resolutions.add(height)
                        res_label = f"{height}p"
                        fps = f.get("fps")
                        if fps and fps > 30:
                            res_label += f" {fps}fps"

                        filesize = f.get("filesize") or f.get("filesize_approx") or 0
                        video_qualities.append({
                            "format_id": f.get("format_id"),
                            "height": height,
                            "label": res_label,
                            "ext": "mp4",
                            "filesize": filesize,
                            "filesize_str": format_bytes(filesize) if filesize else "Otomatik",
                            "fps": fps
                        })

            # Sort by resolution descending (2160p, 1440p, 1080p, 720p, 480p, 360p, ...)
            video_qualities.sort(key=lambda x: x["height"], reverse=True)

            # Available Audio presets
            audio_presets = [
                {"quality": "320", "label": "320 kbps (Ultra Yüksek Stüdyo)", "ext": "mp3"},
                {"quality": "256", "label": "256 kbps (Yüksek Kalite)", "ext": "mp3"},
                {"quality": "192", "label": "192 kbps (Standart Kalite)", "ext": "mp3"},
                {"quality": "128", "label": "128 kbps (Hızlı / Düşük Boyut)", "ext": "mp3"},
                {"quality": "best", "label": "M4A Orijinal Ses (AAC)", "ext": "m4a"},
                {"quality": "wav", "label": "WAV Kayıpsız Ses", "ext": "wav"},
                {"quality": "flac", "label": "FLAC Kayıpsız Ses", "ext": "flac"}
            ]

            best_thumb = info.get("thumbnail")
            if info.get("thumbnails"):
                best_thumb = info["thumbnails"][-1].get("url") or best_thumb

            return jsonify({
                "is_playlist": False,
                "id": info.get("id"),
                "title": info.get("title"),
                "uploader": info.get("uploader") or info.get("channel") or "Bilinmeyen Kanal",
                "channel_url": info.get("channel_url") or info.get("uploader_url"),
                "duration_sec": info.get("duration", 0),
                "duration": format_duration(info.get("duration")),
                "view_count": f"{info.get('view_count', 0):,}".replace(",", "."),
                "like_count": f"{info.get('like_count', 0):,}".replace(",", ".") if info.get('like_count') else None,
                "thumbnail": best_thumb,
                "upload_date": info.get("upload_date"),
                "description": (info.get("description") or "")[:200] + ("..." if len(info.get("description") or "") > 200 else ""),
                "video_qualities": video_qualities,
                "audio_presets": audio_presets,
                "webpage_url": info.get("webpage_url", url)
            })

    except Exception as e:
        err_msg = strip_ansi(str(e))
        print(f"Error fetching info: {err_msg}")
        return jsonify({"error": f"Video bilgisi alınırken hata oluştu: {err_msg}"}), 500

def run_download_thread(task_id, url, dl_type, quality, fmt, crop_start, crop_end, embed_thumb):
    global FFMPEG_PATH
    if not FFMPEG_PATH:
        FFMPEG_PATH = ensure_ffmpeg()

    with tasks_lock:
        tasks[task_id]["status"] = "starting"
        tasks[task_id]["message"] = "İndirme başlatılıyor..."

    def progress_hook(d):
        with tasks_lock:
            if task_id not in tasks:
                return

            if d['status'] == 'downloading':
                downloaded = d.get('downloaded_bytes', 0)
                total = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
                speed = d.get('speed', 0)
                eta = d.get('eta', 0)
                
                percent = 0.0
                if total and total > 0:
                    percent = round((downloaded / total) * 100, 1)
                elif d.get('_percent_str'):
                    try:
                        clean_p = d['_percent_str'].replace('%', '').strip()
                        percent = float(clean_p)
                    except:
                        pass

                tasks[task_id]["status"] = "downloading"
                tasks[task_id]["percent"] = percent
                tasks[task_id]["downloaded_bytes"] = downloaded
                tasks[task_id]["total_bytes"] = total
                tasks[task_id]["downloaded_str"] = format_bytes(downloaded)
                tasks[task_id]["total_str"] = format_bytes(total)
                tasks[task_id]["speed_str"] = f"{format_bytes(speed)}/s" if speed else "Hesaplanıyor..."
                tasks[task_id]["eta_str"] = f"{eta} sn" if eta else "Hesaplanıyor..."
                tasks[task_id]["message"] = f"İndiriliyor: %{percent} ({tasks[task_id]['speed_str']})"

            elif d['status'] == 'finished':
                tasks[task_id]["status"] = "converting"
                tasks[task_id]["percent"] = 99.0
                tasks[task_id]["message"] = "Dosya FFmpeg ile dönüştürülüyor ve birleştiriliyor..."

    outtmpl = str(DOWNLOADS_DIR / "%(title)s [%(id)s].%(ext)s")
    
    ydl_opts = {
        'outtmpl': outtmpl,
        'progress_hooks': [progress_hook],
        'quiet': True,
        'no_warnings': True,
        'nocheckcertificate': True,
        'ffmpeg_location': str(BIN_DIR),
    }

    postprocessors = []

    # Audio Download Setup
    if dl_type == "audio":
        preferred_codec = fmt if fmt in ["mp3", "m4a", "wav", "flac", "aac"] else "mp3"
        
        ydl_opts['format'] = 'bestaudio/best'
        
        audio_pp = {
            'key': 'FFmpegExtractAudio',
            'preferredcodec': preferred_codec,
        }
        if quality in ["320", "256", "192", "128"]:
            audio_pp['preferredquality'] = quality
        
        postprocessors.append(audio_pp)

        if embed_thumb and preferred_codec in ["mp3", "m4a"]:
            ydl_opts['writethumbnail'] = True
            postprocessors.append({'key': 'FFmpegThumbnailsConvertor', 'format': 'jpg'})
            postprocessors.append({'key': 'FFmpegMetadata'})
            postprocessors.append({'key': 'EmbedThumbnail', 'already_have_thumbnail': False})
        else:
            postprocessors.append({'key': 'FFmpegMetadata'})

    # Video Download Setup
    else:
        video_fmt = fmt if fmt in ["mp4", "mkv", "webm"] else "mp4"
        
        if quality and quality.isdigit():
            ydl_opts['format'] = f"bestvideo[height<={quality}]+bestaudio/best[height<={quality}]/best"
        else:
            ydl_opts['format'] = 'bestvideo+bestaudio/best'

        ydl_opts['merge_output_format'] = video_fmt

        if embed_thumb:
            ydl_opts['writethumbnail'] = True
            postprocessors.append({'key': 'FFmpegThumbnailsConvertor', 'format': 'jpg'})
            postprocessors.append({'key': 'FFmpegMetadata'})
            postprocessors.append({'key': 'EmbedThumbnail', 'already_have_thumbnail': False})
        else:
            postprocessors.append({'key': 'FFmpegMetadata'})

    if postprocessors:
        ydl_opts['postprocessors'] = postprocessors

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            with tasks_lock:
                tasks[task_id]["message"] = "Video akışları ayrıştırılıyor..."
            
            info = ydl.extract_info(url, download=True)
            
            final_filename = None
            if info:
                expected = ydl.prepare_filename(info)
                expected_p = Path(expected)
                base_stem = expected_p.stem
                
                matched_files = list(DOWNLOADS_DIR.glob(f"{base_stem}.*"))
                valid_files = [f for f in matched_files if f.suffix.lower() not in ['.part', '.ytdl', '.jpg', '.webp', '.png', '.temp']]
                if valid_files:
                    valid_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
                    final_filename = valid_files[0].name
                else:
                    final_filename = expected_p.name

            # Optional Post-trim if user requested crop
            if final_filename and (crop_start is not None or crop_end is not None):
                target_path = DOWNLOADS_DIR / final_filename
                if target_path.exists():
                    with tasks_lock:
                        tasks[task_id]["message"] = "Belirlenen aralık kesiliyor..."
                    
                    cropped_name = f"trim_{final_filename}"
                    cropped_path = DOWNLOADS_DIR / cropped_name
                    
                    cmd = [str(FFMPEG_EXE), "-y"]
                    if crop_start is not None:
                        cmd.extend(["-ss", str(crop_start)])
                    cmd.extend(["-i", str(target_path)])
                    if crop_end is not None and crop_start is not None:
                        cmd.extend(["-t", str(crop_end - crop_start)])
                    elif crop_end is not None:
                        cmd.extend(["-to", str(crop_end)])
                    cmd.extend(["-c", "copy", str(cropped_path)])
                    
                    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                    if proc.returncode == 0 and cropped_path.exists():
                        target_path.unlink()
                        cropped_path.rename(target_path)

            with tasks_lock:
                tasks[task_id]["status"] = "completed"
                tasks[task_id]["percent"] = 100.0
                tasks[task_id]["message"] = "Dönüştürme başarıyla tamamlandı!"
                tasks[task_id]["filename"] = final_filename
                if final_filename and (DOWNLOADS_DIR / final_filename).exists():
                    fpath = DOWNLOADS_DIR / final_filename
                    tasks[task_id]["filesize_str"] = format_bytes(fpath.stat().st_size)
                    tasks[task_id]["download_url"] = f"/api/file/{final_filename}"
                tasks[task_id]["completed_at"] = datetime.now().isoformat()

    except Exception as e:
        err_clean = strip_ansi(str(e))
        print(f"[Error in task {task_id}]: {err_clean}")
        with tasks_lock:
            tasks[task_id]["status"] = "error"
            tasks[task_id]["percent"] = 0.0
            tasks[task_id]["error"] = err_clean
            tasks[task_id]["message"] = f"Hata: {err_clean}"

@app.route("/api/download", methods=["POST"])
def start_download():
    data = request.get_json() or {}
    url = (data.get("url") or "").strip()
    dl_type = data.get("type", "audio")
    quality = str(data.get("quality", "320"))
    fmt = data.get("format", "mp3" if dl_type == "audio" else "mp4").lower()
    crop_start = data.get("crop_start")
    crop_end = data.get("crop_end")
    embed_thumb = bool(data.get("embed_thumbnail", True))

    if not url:
        return jsonify({"error": "Geçerli bir YouTube linki gereklidir."}), 400

    task_id = str(uuid.uuid4())

    with tasks_lock:
        tasks[task_id] = {
            "id": task_id,
            "url": url,
            "type": dl_type,
            "quality": quality,
            "format": fmt,
            "status": "pending",
            "percent": 0.0,
            "speed_str": "",
            "eta_str": "",
            "downloaded_str": "0 B",
            "total_str": "Hesaplanıyor...",
            "message": "İşlem kuyruğa alındı...",
            "filename": None,
            "error": None,
            "started_at": datetime.now().isoformat()
        }

    t = threading.Thread(
        target=run_download_thread,
        args=(task_id, url, dl_type, quality, fmt, crop_start, crop_end, embed_thumb),
        daemon=True
    )
    t.start()

    return jsonify({"task_id": task_id, "status": "started"})

@app.route("/api/progress/<task_id>", methods=["GET"])
def stream_progress(task_id):
    def event_stream():
        while True:
            with tasks_lock:
                task_data = tasks.get(task_id)

            if not task_data:
                yield f"data: {json.dumps({'error': 'Görev bulunamadı'})}\n\n"
                break

            yield f"data: {json.dumps(task_data)}\n\n"

            if task_data.get("status") in ["completed", "error"]:
                break

            time.sleep(0.4)

    return Response(event_stream(), mimetype="text/event-stream")

@app.route("/api/files", methods=["GET"])
def list_downloaded_files():
    files = []
    for p in DOWNLOADS_DIR.iterdir():
        if p.is_file() and p.suffix.lower() not in ['.part', '.ytdl', '.temp', '.jpg', '.webp', '.png']:
            stat = p.stat()
            ext = p.suffix.lower().replace(".", "")
            is_audio = ext in ['mp3', 'm4a', 'wav', 'flac', 'aac', 'ogg']
            is_video = ext in ['mp4', 'mkv', 'webm', 'avi', 'mov']
            
            files.append({
                "name": p.name,
                "size_bytes": stat.st_size,
                "size_str": format_bytes(stat.st_size),
                "modified": datetime.fromtimestamp(stat.st_mtime).strftime("%d.%m.%Y %H:%M"),
                "mtime": stat.st_mtime,
                "ext": ext,
                "is_audio": is_audio,
                "is_video": is_video,
                "url": f"/api/file/{p.name}"
            })
    
    files.sort(key=lambda x: x["mtime"], reverse=True)
    return jsonify({"files": files, "count": len(files)})

@app.route("/api/file/<path:filename>", methods=["GET"])
def get_file(filename):
    as_attachment = request.args.get("download", "false").lower() == "true"
    file_path = DOWNLOADS_DIR / filename
    if not file_path.exists():
        return jsonify({"error": "Dosya bulunamadı"}), 404
    return send_from_directory(str(DOWNLOADS_DIR), filename, as_attachment=as_attachment)

@app.route("/api/delete-file", methods=["POST"])
def delete_file():
    data = request.get_json() or {}
    filename = data.get("filename")
    if not filename:
        return jsonify({"error": "Dosya adı belirtilmedi"}), 400
    
    file_path = DOWNLOADS_DIR / filename
    if file_path.exists():
        try:
            file_path.unlink()
            return jsonify({"status": "deleted", "filename": filename})
        except Exception as e:
            return jsonify({"error": f"Silme hatası: {str(e)}"}), 500
    return jsonify({"error": "Dosya bulunamadı"}), 404

@app.route("/api/open-folder", methods=["POST"])
def open_folder():
    try:
        if sys.platform == "win32":
            os.startfile(str(DOWNLOADS_DIR))
        elif sys.platform == "darwin":
            subprocess.run(["open", str(DOWNLOADS_DIR)])
        else:
            subprocess.run(["xdg-open", str(DOWNLOADS_DIR)])
        return jsonify({"status": "opened", "path": str(DOWNLOADS_DIR)})
    except Exception as e:
        return jsonify({"error": f"Klasör açılamadı: {str(e)}"}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"\n" + "="*60)
    print(f"🚀 BFlag Converter - YouTube Video & MP3 Dönüştürücü")
    print(f"© Copyright by Berkcan Bayrak")
    print(f"🌐 Tarayıcınızda açın: http://127.0.0.1:{port}")
    print(f"📁 İndirme Klasörü: {DOWNLOADS_DIR}")
    print(f"="*60 + "\n")
    app.run(host="127.0.0.1", port=port, debug=False)
