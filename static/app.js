/**
 * BFlag Converter - YouTube Video & MP3 Converter Frontend Logic
 * Copyright by Berkcan Bayrak
 */

document.addEventListener("DOMContentLoaded", () => {
    // State
    let currentVideoData = null;
    let currentTaskId = null;
    let eventSource = null;
    let selectedMode = "audio"; // 'audio' | 'video' | 'trim'
    let selectedTrimType = "audio"; // 'audio' | 'video'
    let selectedAudioQuality = "320";
    let selectedAudioFormat = "mp3";
    let selectedVideoQuality = "1080";
    let selectedVideoFormat = "mp4";
    let activePlayerUrl = null;
    let cachedHistoryFiles = [];
    let currentHistoryFilter = "all";

    // DOM Elements
    const videoUrlInput = document.getElementById("videoUrlInput");
    const btnPasteUrl = document.getElementById("btnPasteUrl");
    const btnClearUrl = document.getElementById("btnClearUrl");
    const btnFetchVideo = document.getElementById("btnFetchVideo");
    const btnText = btnFetchVideo?.querySelector(".btn-text");
    const btnLoader = btnFetchVideo?.querySelector(".btn-loader");
    const btnArrow = btnFetchVideo?.querySelector(".btn-arrow");

    // Preview Elements
    const previewSection = document.getElementById("previewSection");
    const videoThumb = document.getElementById("videoThumb");
    const videoDuration = document.getElementById("videoDuration");
    const videoTitle = document.getElementById("videoTitle");
    const videoChannel = document.getElementById("videoChannel");
    const videoViews = document.getElementById("videoViews");
    const btnPreviewPlay = document.getElementById("btnPreviewPlay");
    const iframeContainer = document.getElementById("iframeContainer");
    const youtubeIframe = document.getElementById("youtubeIframe");

    // Tabs & Panels
    const modeTabs = document.querySelectorAll(".mode-tab");
    const audioTabPanel = document.getElementById("audioTabPanel");
    const videoTabPanel = document.getElementById("videoTabPanel");
    const trimTabPanel = document.getElementById("trimTabPanel");
    const audioQualityCards = document.querySelectorAll("#audioQualityGrid .quality-card");
    const videoQualityGrid = document.getElementById("videoQualityGrid");
    const bestVideoBadge = document.getElementById("bestVideoBadge");
    const audioFormatChips = document.querySelectorAll("#audioTabPanel .format-chip");
    const videoFormatChips = document.querySelectorAll("#videoTabPanel .format-chip");

    // Trim elements
    const btnTrimTypeAudio = document.getElementById("btnTrimTypeAudio");
    const btnTrimTypeVideo = document.getElementById("btnTrimTypeVideo");
    const trimQualityLabel = document.getElementById("trimQualityLabel");
    const trimQualityBadge = document.getElementById("trimQualityBadge");
    const trimQualityGrid = document.getElementById("trimQualityGrid");
    const trimStartInput = document.getElementById("trimStartInput");
    const trimEndInput = document.getElementById("trimEndInput");
    const trimDurationDisplay = document.getElementById("trimDurationDisplay");
    
    // Trim Steppers & Presets
    const btnStartStepMinus = document.getElementById("btnStartStepMinus");
    const btnStartStepPlus = document.getElementById("btnStartStepPlus");
    const btnEndStepMinus = document.getElementById("btnEndStepMinus");
    const btnEndStepPlus = document.getElementById("btnEndStepPlus");
    const btnPresetFull = document.getElementById("btnPresetFull");
    const btnPreset30s = document.getElementById("btnPreset30s");
    const btnPreset60s = document.getElementById("btnPreset60s");
    const btnPresetChorus = document.getElementById("btnPresetChorus");

    const chkEmbedMetadata = document.getElementById("chkEmbedMetadata");
    const btnStartDownload = document.getElementById("btnStartDownload");
    const downloadBtnText = document.getElementById("downloadBtnText");

    // Progress Modal Elements
    const progressOverlay = document.getElementById("progressOverlay");
    const btnCloseProgressModal = document.getElementById("btnCloseProgressModal");
    const progressStatusTitle = document.getElementById("progressStatusTitle");
    const progressThumb = document.getElementById("progressThumb");
    const progressItemTitle = document.getElementById("progressItemTitle");
    const progressItemFormat = document.getElementById("progressItemFormat");
    const progressBarFill = document.getElementById("progressBarFill");
    const progressStatusMsg = document.getElementById("progressStatusMsg");
    const progressPercent = document.getElementById("progressPercent");
    const statSpeed = document.getElementById("statSpeed");
    const statEta = document.getElementById("statEta");
    const statSize = document.getElementById("statSize");
    const completedActionsRow = document.getElementById("completedActionsRow");
    const btnDownloadFinishedFile = document.getElementById("btnDownloadFinishedFile");
    const btnPlayFinishedFile = document.getElementById("btnPlayFinishedFile");
    const btnOpenFolderFromModal = document.getElementById("btnOpenFolderFromModal");

    // History Elements
    const filesListContainer = document.getElementById("filesListContainer");
    const btnRefreshHistory = document.getElementById("btnRefreshHistory");
    const btnOpenHistoryFolder = document.getElementById("btnOpenHistoryFolder");
    const btnOpenDownloadsFolder = document.getElementById("btnOpenDownloadsFolder");
    const historySearchInput = document.getElementById("historySearchInput");
    const filterAll = document.getElementById("filterAll");
    const filterAudio = document.getElementById("filterAudio");
    const filterVideo = document.getElementById("filterVideo");

    // Floating Media Player
    const floatingMediaPlayer = document.getElementById("floatingMediaPlayer");
    const playerMediaIcon = document.getElementById("playerMediaIcon");
    const playerTrackTitle = document.getElementById("playerTrackTitle");
    const playerTrackMeta = document.getElementById("playerTrackMeta");
    const globalAudioElement = document.getElementById("globalAudioElement");
    const btnPlayerPlayToggle = document.getElementById("btnPlayerPlayToggle");
    const playIconSvg = document.getElementById("playIconSvg");
    const pauseIconSvg = document.getElementById("pauseIconSvg");
    const playerCurrentTime = document.getElementById("playerCurrentTime");
    const playerTotalTime = document.getElementById("playerTotalTime");
    const playerSeekbar = document.getElementById("playerSeekbar");
    const playerVolume = document.getElementById("playerVolume");
    const btnPlayerClose = document.getElementById("btnPlayerClose");
    const btnPlayerBack10 = document.getElementById("btnPlayerBack10");
    const btnPlayerFwd10 = document.getElementById("btnPlayerFwd10");

    // Toast Container
    const toastContainer = document.getElementById("toastContainer");

    // ----------------------------------------------------
    // Utilities & Toast
    // ----------------------------------------------------
    function showToast(message, type = "info") {
        if (!toastContainer) return;
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        
        let icon = "ℹ️";
        if (type === "success") icon = "✨";
        if (type === "error") icon = "❌";

        toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateX(40px)";
            toast.style.transition = "all 0.3s ease";
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    function timeToSeconds(timeStr) {
        if (!timeStr || !timeStr.trim()) return null;
        timeStr = timeStr.trim();
        if (/^\d+$/.test(timeStr)) return parseInt(timeStr, 10);
        
        const parts = timeStr.split(":").map(p => parseInt(p, 10) || 0);
        if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
            return parts[0] * 60 + parts[1];
        }
        return null;
    }

    function formatSecToMinSec(sec) {
        if (sec === null || isNaN(sec)) return "00:00";
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    // ----------------------------------------------------
    // Input & Quick Actions
    // ----------------------------------------------------
    if (videoUrlInput) {
        // Check initial input value
        if (videoUrlInput.value.trim().length > 0 && btnClearUrl) {
            btnClearUrl.style.display = "inline-flex";
        }

        videoUrlInput.addEventListener("input", () => {
            if (videoUrlInput.value.trim().length > 0) {
                if (btnClearUrl) btnClearUrl.style.display = "inline-flex";
            } else {
                if (btnClearUrl) btnClearUrl.style.display = "none";
            }
        });

        videoUrlInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                fetchVideoInfo();
            }
        });
    }

    if (btnClearUrl) {
        btnClearUrl.addEventListener("click", () => {
            videoUrlInput.value = "";
            btnClearUrl.style.display = "none";
            videoUrlInput.focus();
        });
    }

    if (btnPasteUrl) {
        btnPasteUrl.addEventListener("click", async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (text && text.trim()) {
                    videoUrlInput.value = text.trim();
                    if (btnClearUrl) btnClearUrl.style.display = "inline-flex";
                    showToast("Link panodan yapıştırıldı!", "success");
                    fetchVideoInfo();
                } else {
                    showToast("Panoda geçerli bir link bulunamadı.", "error");
                }
            } catch {
                showToast("Lütfen Ctrl+V ile linki yapıştırın.", "info");
            }
        });
    }

    document.querySelectorAll(".quick-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            const url = chip.dataset.url;
            if (url && videoUrlInput) {
                videoUrlInput.value = url;
                if (btnClearUrl) btnClearUrl.style.display = "inline-flex";
                fetchVideoInfo();
            }
        });
    });

    if (btnFetchVideo) {
        btnFetchVideo.addEventListener("click", fetchVideoInfo);
    }

    // ----------------------------------------------------
    // Fetch Video Info API
    // ----------------------------------------------------
    async function fetchVideoInfo() {
        const url = videoUrlInput ? videoUrlInput.value.trim() : "";
        if (!url) {
            showToast("Lütfen bir YouTube linki yapıştırın.", "error");
            if (videoUrlInput) videoUrlInput.focus();
            return;
        }

        if (btnText) btnText.style.display = "none";
        if (btnArrow) btnArrow.style.display = "none";
        if (btnLoader) btnLoader.style.display = "inline-flex";
        if (btnFetchVideo) btnFetchVideo.disabled = true;

        try {
            const response = await fetch("/api/info", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url })
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || "Video bilgileri alınırken bir hata oluştu.");
            }

            currentVideoData = data;
            renderVideoPreview(data);
            showToast("Video analiz edildi ve seçenekler yüklendi!", "success");

        } catch (error) {
            console.error("Fetch Info Error:", error);
            showToast(error.message, "error");
        } finally {
            if (btnText) btnText.style.display = "inline";
            if (btnArrow) btnArrow.style.display = "inline";
            if (btnLoader) btnLoader.style.display = "none";
            if (btnFetchVideo) btnFetchVideo.disabled = false;
        }
    }

    function renderVideoPreview(data) {
        if (!previewSection) return;
        previewSection.style.display = "block";
        previewSection.scrollIntoView({ behavior: "smooth", block: "start" });

        // Reset previous playing iframe if any
        if (youtubeIframe) youtubeIframe.src = "";
        if (iframeContainer) iframeContainer.style.display = "none";
        const thumbWrap = document.querySelector(".thumbnail-wrapper");
        if (thumbWrap) thumbWrap.style.display = "block";

        if (videoThumb) videoThumb.src = data.thumbnail || "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg";
        if (videoDuration) videoDuration.textContent = data.duration || "00:00";
        if (videoTitle) videoTitle.textContent = data.title || "YouTube Videosu";
        if (videoChannel) videoChannel.textContent = data.uploader || "YouTube Kanalı";
        if (videoViews) videoViews.textContent = (data.view_count || "0") + " İzlenme";

        // Setup trim default inputs
        if (trimStartInput) trimStartInput.value = "00:00";
        if (trimEndInput) trimEndInput.value = data.duration || "";
        if (trimDurationDisplay) {
            trimDurationDisplay.textContent = `Aralık: 00:00 - ${data.duration || '00:00'}`;
        }

        // Populate Video Quality Grid
        if (videoQualityGrid) {
            videoQualityGrid.innerHTML = "";
            if (data.video_qualities && data.video_qualities.length > 0) {
                if (bestVideoBadge) bestVideoBadge.textContent = `Maksimum: ${data.video_qualities[0].label}`;
                
                data.video_qualities.forEach((vq, index) => {
                    const card = document.createElement("div");
                    card.className = `quality-card ${index === 0 ? 'active' : ''}`;
                    card.dataset.height = vq.height;
                    card.dataset.format = "mp4";

                    let badgeClass = "standard";
                    let badgeTxt = `${vq.height}p`;
                    if (vq.height >= 2160) { badgeClass = "ultra"; badgeTxt = "4K UHD"; }
                    else if (vq.height >= 1080) { badgeClass = "high"; badgeTxt = "Full HD"; }
                    else if (vq.height >= 720) { badgeClass = "standard"; badgeTxt = "HD"; }
                    else { badgeClass = "fast"; badgeTxt = "SD"; }

                    card.innerHTML = `
                        <div class="card-radio"></div>
                        <div class="card-content">
                            <div class="card-title">${vq.label} <span class="quality-badge ${badgeClass}">${badgeTxt}</span></div>
                            <div class="card-subtitle">Tahmini Boyut: ${vq.filesize_str}</div>
                        </div>
                    `;

                    card.addEventListener("click", () => {
                        document.querySelectorAll("#videoQualityGrid .quality-card").forEach(c => c.classList.remove("active"));
                        card.classList.add("active");
                        selectedVideoQuality = vq.height.toString();
                        updateDownloadButtonText();
                    });

                    videoQualityGrid.appendChild(card);
                });

                selectedVideoQuality = data.video_qualities[0].height.toString();
            } else {
                videoQualityGrid.innerHTML = `
                    <div class="quality-card active" data-height="1080">
                        <div class="card-radio"></div>
                        <div class="card-content">
                            <div class="card-title">1080p Full HD <span class="quality-badge high">Full HD</span></div>
                            <div class="card-subtitle">En yüksek standart kalite</div>
                        </div>
                    </div>
                `;
                selectedVideoQuality = "1080";
            }
        }

        renderTrimQualityOptions();
        updateDownloadButtonText();
    }

    // Render Trim Quality Section (Switches between Audio vs Video presets)
    function renderTrimQualityOptions() {
        if (!trimQualityGrid) return;
        trimQualityGrid.innerHTML = "";

        if (selectedTrimType === "audio") {
            if (trimQualityLabel) trimQualityLabel.textContent = "Kırpılacak Ses Kalitesi:";
            if (trimQualityBadge) trimQualityBadge.textContent = "320 kbps Stüdyo";

            const audioPresets = [
                { quality: "320", title: "320 kbps", sub: "Maksimum Kalite MP3", badge: "ultra", bTxt: "Stüdyo" },
                { quality: "256", title: "256 kbps", sub: "Yüksek Kalite", badge: "high", bTxt: "HQ" },
                { quality: "192", title: "192 kbps", sub: "Standart Kalite", badge: "standard", bTxt: "Normal" },
                { quality: "128", title: "128 kbps", sub: "Hızlı / Düşük Boyut", badge: "fast", bTxt: "Hafif" }
            ];

            audioPresets.forEach(preset => {
                const card = document.createElement("div");
                card.className = `quality-card ${preset.quality === selectedAudioQuality ? 'active' : ''}`;
                card.innerHTML = `
                    <div class="card-radio"></div>
                    <div class="card-content">
                        <div class="card-title">${preset.title} <span class="quality-badge ${preset.badge}">${preset.bTxt}</span></div>
                        <div class="card-subtitle">${preset.sub}</div>
                    </div>
                `;
                card.addEventListener("click", () => {
                    document.querySelectorAll("#trimQualityGrid .quality-card").forEach(c => c.classList.remove("active"));
                    card.classList.add("active");
                    selectedAudioQuality = preset.quality;
                    selectedAudioFormat = "mp3";
                    updateDownloadButtonText();
                });
                trimQualityGrid.appendChild(card);
            });

        } else {
            if (trimQualityLabel) trimQualityLabel.textContent = "Kırpılacak Video Çözünürlüğü:";
            if (trimQualityBadge) trimQualityBadge.textContent = "HD / 1080p";

            if (currentVideoData && currentVideoData.video_qualities && currentVideoData.video_qualities.length > 0) {
                currentVideoData.video_qualities.forEach((vq, index) => {
                    const card = document.createElement("div");
                    const isAct = vq.height.toString() === selectedVideoQuality || (index === 0 && !selectedVideoQuality);
                    card.className = `quality-card ${isAct ? 'active' : ''}`;

                    let badgeClass = "standard";
                    let badgeTxt = `${vq.height}p`;
                    if (vq.height >= 2160) { badgeClass = "ultra"; badgeTxt = "4K UHD"; }
                    else if (vq.height >= 1080) { badgeClass = "high"; badgeTxt = "Full HD"; }
                    else if (vq.height >= 720) { badgeClass = "standard"; badgeTxt = "HD"; }
                    else { badgeClass = "fast"; badgeTxt = "SD"; }

                    card.innerHTML = `
                        <div class="card-radio"></div>
                        <div class="card-content">
                            <div class="card-title">${vq.label} <span class="quality-badge ${badgeClass}">${badgeTxt}</span></div>
                            <div class="card-subtitle">Tahmini Boyut: ${vq.filesize_str}</div>
                        </div>
                    `;

                    card.addEventListener("click", () => {
                        document.querySelectorAll("#trimQualityGrid .quality-card").forEach(c => c.classList.remove("active"));
                        card.classList.add("active");
                        selectedVideoQuality = vq.height.toString();
                        selectedVideoFormat = "mp4";
                        updateDownloadButtonText();
                    });

                    trimQualityGrid.appendChild(card);
                });
            } else {
                trimQualityGrid.innerHTML = `
                    <div class="quality-card active">
                        <div class="card-radio"></div>
                        <div class="card-content">
                            <div class="card-title">1080p Full HD <span class="quality-badge high">Full HD</span></div>
                            <div class="card-subtitle">MP4 Video Formatı</div>
                        </div>
                    </div>
                `;
            }
        }
    }

    // Preview play iframe toggle
    if (btnPreviewPlay) {
        btnPreviewPlay.addEventListener("click", () => {
            if (!currentVideoData || !currentVideoData.id) return;
            if (youtubeIframe) youtubeIframe.src = `https://www.youtube.com/embed/${currentVideoData.id}?autoplay=1`;
            if (iframeContainer) iframeContainer.style.display = "block";
            const thumbWrap = document.querySelector(".thumbnail-wrapper");
            if (thumbWrap) thumbWrap.style.display = "none";
        });
    }

    // ----------------------------------------------------
    // Tab Navigation & Quality Selection
    // ----------------------------------------------------
    modeTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            modeTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            selectedMode = tab.dataset.tab;

            if (audioTabPanel) audioTabPanel.style.display = "none";
            if (videoTabPanel) videoTabPanel.style.display = "none";
            if (trimTabPanel) trimTabPanel.style.display = "none";

            if (selectedMode === "audio" && audioTabPanel) {
                audioTabPanel.style.display = "flex";
            } else if (selectedMode === "video" && videoTabPanel) {
                videoTabPanel.style.display = "flex";
            } else if (selectedMode === "trim" && trimTabPanel) {
                trimTabPanel.style.display = "flex";
                renderTrimQualityOptions();
            }

            updateDownloadButtonText();
        });
    });

    // Trim Type Buttons (Audio vs Video switch inside Trim)
    if (btnTrimTypeAudio && btnTrimTypeVideo) {
        btnTrimTypeAudio.addEventListener("click", () => {
            btnTrimTypeAudio.classList.add("active");
            btnTrimTypeVideo.classList.remove("active");
            selectedTrimType = "audio";
            renderTrimQualityOptions();
            updateDownloadButtonText();
        });

        btnTrimTypeVideo.addEventListener("click", () => {
            btnTrimTypeVideo.classList.add("active");
            btnTrimTypeAudio.classList.remove("active");
            selectedTrimType = "video";
            renderTrimQualityOptions();
            updateDownloadButtonText();
        });
    }

    // Audio Quality Cards
    audioQualityCards.forEach(card => {
        card.addEventListener("click", () => {
            audioQualityCards.forEach(c => c.classList.remove("active"));
            card.classList.add("active");
            selectedAudioQuality = card.dataset.quality;
            selectedAudioFormat = "mp3";
            audioFormatChips.forEach(ch => ch.classList.remove("active"));
            updateDownloadButtonText();
        });
    });

    // Audio Format Chips
    audioFormatChips.forEach(chip => {
        chip.addEventListener("click", () => {
            audioFormatChips.forEach(ch => ch.classList.remove("active"));
            audioQualityCards.forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            selectedAudioFormat = chip.dataset.ext;
            selectedAudioQuality = chip.dataset.quality;
            updateDownloadButtonText();
        });
    });

    // Video Format Chips
    videoFormatChips.forEach(chip => {
        chip.addEventListener("click", () => {
            videoFormatChips.forEach(ch => ch.classList.remove("active"));
            chip.classList.add("active");
            selectedVideoFormat = chip.dataset.ext;
            updateDownloadButtonText();
        });
    });

    // Trim Inputs Watcher & Steppers
    function updateTrimDisplay() {
        const startSec = timeToSeconds(trimStartInput.value) || 0;
        const endSec = timeToSeconds(trimEndInput.value);
        if (trimDurationDisplay) {
            trimDurationDisplay.textContent = `Aralık: ${formatSecToMinSec(startSec)} - ${endSec ? formatSecToMinSec(endSec) : 'Bitiş'}`;
        }
        updateDownloadButtonText();
    }

    if (trimStartInput) trimStartInput.addEventListener("input", updateTrimDisplay);
    if (trimEndInput) trimEndInput.addEventListener("input", updateTrimDisplay);

    function adjustTimeInput(inputElement, delta) {
        if (!inputElement) return;
        let currentSec = timeToSeconds(inputElement.value) || 0;
        currentSec = Math.max(0, currentSec + delta);
        inputElement.value = formatSecToMinSec(currentSec);
        updateTrimDisplay();
    }

    if (btnStartStepMinus) btnStartStepMinus.addEventListener("click", () => adjustTimeInput(trimStartInput, -5));
    if (btnStartStepPlus) btnStartStepPlus.addEventListener("click", () => adjustTimeInput(trimStartInput, +5));
    if (btnEndStepMinus) btnEndStepMinus.addEventListener("click", () => adjustTimeInput(trimEndInput, -5));
    if (btnEndStepPlus) btnEndStepPlus.addEventListener("click", () => adjustTimeInput(trimEndInput, +5));

    // Trim Presets
    if (btnPresetFull) {
        btnPresetFull.addEventListener("click", () => {
            if (trimStartInput) trimStartInput.value = "00:00";
            if (trimEndInput) trimEndInput.value = currentVideoData?.duration || "";
            updateTrimDisplay();
            showToast("Tüm süre seçildi.", "info");
        });
    }

    if (btnPreset30s) {
        btnPreset30s.addEventListener("click", () => {
            if (trimStartInput) trimStartInput.value = "00:00";
            if (trimEndInput) trimEndInput.value = "00:30";
            updateTrimDisplay();
            showToast("İlk 30 saniye seçildi.", "info");
        });
    }

    if (btnPreset60s) {
        btnPreset60s.addEventListener("click", () => {
            if (trimStartInput) trimStartInput.value = "00:00";
            if (trimEndInput) trimEndInput.value = "01:00";
            updateTrimDisplay();
            showToast("İlk 1 dakika seçildi.", "info");
        });
    }

    if (btnPresetChorus) {
        btnPresetChorus.addEventListener("click", () => {
            if (trimStartInput) trimStartInput.value = "01:00";
            if (trimEndInput) trimEndInput.value = "02:00";
            updateTrimDisplay();
            showToast("1:00 - 2:00 arası seçildi.", "info");
        });
    }

    function updateDownloadButtonText() {
        if (!downloadBtnText) return;
        if (selectedMode === "audio") {
            const qualStr = selectedAudioQuality === "best" ? "" : `${selectedAudioQuality}kbps`;
            downloadBtnText.textContent = `${selectedAudioFormat.toUpperCase()} ${qualStr} Ses Olarak İndir`;
        } else if (selectedMode === "video") {
            downloadBtnText.textContent = `${selectedVideoFormat.toUpperCase()} ${selectedVideoQuality}p Video Olarak İndir`;
        } else if (selectedMode === "trim") {
            const startSec = timeToSeconds(trimStartInput.value) || 0;
            const endSec = timeToSeconds(trimEndInput.value);
            const rangeStr = `(${formatSecToMinSec(startSec)} - ${endSec ? formatSecToMinSec(endSec) : 'Son'})`;

            if (selectedTrimType === "audio") {
                const qualStr = selectedAudioQuality === "best" ? "" : `${selectedAudioQuality}kbps`;
                downloadBtnText.textContent = `${selectedAudioFormat.toUpperCase()} ${qualStr} Ses Kırp & İndir ${rangeStr}`;
            } else {
                downloadBtnText.textContent = `${selectedVideoFormat.toUpperCase()} ${selectedVideoQuality}p Video Kırp & İndir ${rangeStr}`;
            }
        }
    }

    // ----------------------------------------------------
    // Download Execution & SSE Stream
    // ----------------------------------------------------
    if (btnStartDownload) {
        btnStartDownload.addEventListener("click", startConversion);
    }

    async function startConversion() {
        if (!currentVideoData) {
            showToast("Lütfen önce bir video linki analiz edin.", "error");
            return;
        }

        const url = videoUrlInput ? videoUrlInput.value.trim() : "";
        let dlType = "audio";
        let quality = "320";
        let fmt = "mp3";
        let cropStart = null;
        let cropEnd = null;

        if (selectedMode === "audio") {
            dlType = "audio";
            quality = selectedAudioQuality;
            fmt = selectedAudioFormat;
        } else if (selectedMode === "video") {
            dlType = "video";
            quality = selectedVideoQuality;
            fmt = selectedVideoFormat;
        } else if (selectedMode === "trim") {
            dlType = selectedTrimType;
            quality = (selectedTrimType === "audio") ? selectedAudioQuality : selectedVideoQuality;
            fmt = (selectedTrimType === "audio") ? selectedAudioFormat : selectedVideoFormat;
            cropStart = timeToSeconds(trimStartInput.value);
            cropEnd = timeToSeconds(trimEndInput.value);

            if (cropStart !== null && cropEnd !== null && cropStart >= cropEnd) {
                showToast("Başlangıç zamanı bitiş zamanından küçük olmalıdır!", "error");
                return;
            }
        }

        const embedThumb = chkEmbedMetadata ? chkEmbedMetadata.checked : true;

        // Show Progress Modal
        openProgressModal(dlType, quality, fmt, cropStart, cropEnd);

        try {
            const response = await fetch("/api/download", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url,
                    type: dlType,
                    quality,
                    format: fmt,
                    crop_start: cropStart,
                    crop_end: cropEnd,
                    embed_thumbnail: embedThumb
                })
            });

            const data = await response.json();
            if (!response.ok || data.error) {
                throw new Error(data.error || "İndirme başlatılamadı.");
            }

            currentTaskId = data.task_id;
            listenToProgress(currentTaskId);

        } catch (error) {
            console.error("Start Download Error:", error);
            showToast(error.message, "error");
            closeProgressModal();
        }
    }

    function openProgressModal(type, quality, fmt, cropStart, cropEnd) {
        if (!progressOverlay) return;
        progressOverlay.style.display = "flex";
        if (completedActionsRow) completedActionsRow.style.display = "none";
        
        if (progressStatusTitle) {
            progressStatusTitle.textContent = cropStart !== null || cropEnd !== null ? "Kırpma & Dönüştürme İşleniyor..." : "Dönüştürme İşleniyor...";
        }
        if (progressThumb) progressThumb.src = currentVideoData?.thumbnail || "";
        if (progressItemTitle) progressItemTitle.textContent = currentVideoData?.title || "YouTube Dosyası";
        
        const typeLabel = type === "audio" ? "Ses (MP3/M4A)" : "Video (MP4/MKV)";
        const trimTag = (cropStart !== null || cropEnd !== null) ? " • ✂️ Kırpılmış Kesit" : "";
        if (progressItemFormat) {
            progressItemFormat.textContent = `${typeLabel} • ${fmt.toUpperCase()} ${quality ? quality + (type === 'audio' ? 'kbps' : 'p') : ''}${trimTag}`;
        }
        
        if (progressBarFill) progressBarFill.style.width = "0%";
        if (progressPercent) progressPercent.textContent = "0%";
        if (progressStatusMsg) progressStatusMsg.textContent = "Sunucu hazırlanıyor...";
        if (statSpeed) statSpeed.textContent = "Hesaplanıyor...";
        if (statEta) statEta.textContent = "Hesaplanıyor...";
        if (statSize) statSize.textContent = "0 / 0 MB";
    }

    function closeProgressModal() {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        if (progressOverlay) progressOverlay.style.display = "none";
    }

    if (btnCloseProgressModal) {
        btnCloseProgressModal.addEventListener("click", closeProgressModal);
    }

    if (progressOverlay) {
        progressOverlay.addEventListener("click", (e) => {
            if (e.target === progressOverlay) {
                closeProgressModal();
            }
        });
    }

    // Global keyboard shortcuts (Escape to close modals)
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (progressOverlay && progressOverlay.style.display !== "none") {
                closeProgressModal();
            } else if (floatingMediaPlayer && floatingMediaPlayer.style.display !== "none") {
                if (globalAudioElement) globalAudioElement.pause();
                floatingMediaPlayer.style.display = "none";
            }
        }
    });

    function listenToProgress(taskId) {
        if (eventSource) {
            eventSource.close();
        }

        eventSource = new EventSource(`/api/progress/${taskId}`);

        eventSource.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);

                if (data.error) {
                    showToast(data.error, "error");
                    if (progressStatusMsg) progressStatusMsg.textContent = `Hata: ${data.error}`;
                    eventSource.close();
                    return;
                }

                // Update UI with stream data
                const percent = Math.min(100, Math.max(0, data.percent || 0));
                if (progressBarFill) progressBarFill.style.width = `${percent}%`;
                if (progressPercent) progressPercent.textContent = `${percent}%`;

                if (data.message && progressStatusMsg) {
                    progressStatusMsg.textContent = data.message;
                }

                if (data.speed_str && statSpeed) statSpeed.textContent = data.speed_str;
                if (data.eta_str && statEta) statEta.textContent = data.eta_str;
                if (data.downloaded_str && data.total_str && statSize) {
                    statSize.textContent = `${data.downloaded_str} / ${data.total_str}`;
                }

                // State handling
                if (data.status === "converting") {
                    if (progressStatusTitle) progressStatusTitle.textContent = "FFmpeg ile İşleniyor & Optimize Ediliyor...";
                } else if (data.status === "completed") {
                    eventSource.close();
                    handleDownloadSuccess(data);
                } else if (data.status === "error") {
                    eventSource.close();
                    showToast(data.message || "İndirme sırasında hata oluştu.", "error");
                    if (progressStatusTitle) progressStatusTitle.textContent = "Hata Oluştu!";
                }

            } catch (err) {
                console.error("SSE parse error:", err);
            }
        };

        eventSource.onerror = (err) => {
            console.error("SSE connection error:", err);
        };
    }

    function handleDownloadSuccess(data) {
        if (progressStatusTitle) progressStatusTitle.textContent = "✨ Dönüştürme Başarıyla Tamamlandı!";
        if (progressBarFill) progressBarFill.style.width = "100%";
        if (progressPercent) progressPercent.textContent = "100%";
        if (progressStatusMsg) progressStatusMsg.textContent = `Dosya hazır: ${data.filename || ''}`;
        
        if (completedActionsRow) completedActionsRow.style.display = "flex";

        if (data.download_url && btnDownloadFinishedFile) {
            btnDownloadFinishedFile.href = `${data.download_url}?download=true`;
            
            if (btnPlayFinishedFile) {
                btnPlayFinishedFile.onclick = () => {
                    playMedia(data.download_url, data.filename, data.type === 'audio');
                    closeProgressModal();
                };
            }
        }

        if (btnOpenFolderFromModal) {
            btnOpenFolderFromModal.onclick = openDownloadsFolder;
        }

        showToast("Tebrikler! Dosyanız hazırlandı ve indirildi.", "success");
        loadHistoryFiles();
    }

    // ----------------------------------------------------
    // History & Downloads Files Manager
    // ----------------------------------------------------
    async function loadHistoryFiles() {
        try {
            const response = await fetch("/api/files");
            const data = await response.json();

            cachedHistoryFiles = data.files || [];
            applyHistoryFilter();

        } catch (err) {
            console.error("Failed to load history:", err);
        }
    }

    function applyHistoryFilter() {
        if (!filesListContainer) return;
        
        const searchQuery = historySearchInput ? historySearchInput.value.toLowerCase().trim() : "";
        
        let filtered = cachedHistoryFiles.filter(file => {
            const matchesSearch = !searchQuery || file.name.toLowerCase().includes(searchQuery);
            if (!matchesSearch) return false;

            if (currentHistoryFilter === "audio") return file.is_audio;
            if (currentHistoryFilter === "video") return file.is_video;
            return true;
        });

        if (filtered.length > 0) {
            renderHistoryFiles(filtered);
        } else {
            filesListContainer.innerHTML = `
                <div class="empty-history-state">
                    <div class="empty-icon">🎧</div>
                    <div class="empty-text">Eşleşen indirilmiş bir dosya bulunamadı.</div>
                    <div class="empty-hint">Yukarıdaki arama kutusuna bir YouTube linki yapıştırarak ilk dönüştürmenizi yapın!</div>
                </div>
            `;
        }
    }

    if (historySearchInput) {
        historySearchInput.addEventListener("input", applyHistoryFilter);
    }

    if (filterAll && filterAudio && filterVideo) {
        [filterAll, filterAudio, filterVideo].forEach(btn => {
            btn.addEventListener("click", () => {
                [filterAll, filterAudio, filterVideo].forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                currentHistoryFilter = btn.dataset.filter;
                applyHistoryFilter();
            });
        });
    }

    function renderHistoryFiles(files) {
        filesListContainer.innerHTML = "";
        
        files.forEach(file => {
            const card = document.createElement("div");
            card.className = "file-item-card";

            const badgeTypeClass = file.is_audio ? "audio" : "video";
            const badgeIcon = file.is_audio ? "MP3" : "MP4";

            card.innerHTML = `
                <div class="file-left-group">
                    <div class="file-type-badge ${badgeTypeClass}">${file.ext || badgeIcon}</div>
                    <div class="file-details">
                        <div class="file-name-txt" title="${file.name}">${file.name}</div>
                        <div class="file-meta-txt">
                            <span>📦 ${file.size_str}</span>
                            <span>🕒 ${file.modified}</span>
                        </div>
                    </div>
                </div>

                <div class="file-actions-group">
                    <button class="file-act-btn play-btn" title="Oynat">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        <span>Oynat</span>
                    </button>
                    <a href="${file.url}?download=true" class="file-act-btn" title="İndir">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        <span>Kaydet</span>
                    </a>
                    <button class="file-act-btn delete-btn" title="Sil">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            `;

            // Play action
            card.querySelector(".play-btn").addEventListener("click", () => {
                playMedia(file.url, file.name, file.is_audio);
            });

            // Delete action
            card.querySelector(".delete-btn").addEventListener("click", async () => {
                if (confirm(`"${file.name}" dosyasını silmek istediğinize emin misiniz?`)) {
                    await deleteFile(file.name);
                }
            });

            filesListContainer.appendChild(card);
        });
    }

    async function deleteFile(filename) {
        try {
            const response = await fetch("/api/delete-file", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename })
            });
            const data = await response.json();
            if (data.status === "deleted") {
                showToast("Dosya silindi.", "info");
                loadHistoryFiles();
            } else {
                showToast(data.error || "Dosya silinemedi.", "error");
            }
        } catch {
            showToast("Silme işlemi başarısız.", "error");
        }
    }

    async function openDownloadsFolder() {
        try {
            const res = await fetch("/api/open-folder", { method: "POST" });
            const data = await res.json();
            if (data.status === "opened") {
                showToast("İndirilenler klasörü açıldı.", "success");
            } else {
                showToast(data.error || "Klasör açılamadı.", "error");
            }
        } catch {
            showToast("Klasör açma isteği başarısız.", "error");
        }
    }

    if (btnOpenDownloadsFolder) btnOpenDownloadsFolder.addEventListener("click", openDownloadsFolder);
    if (btnOpenHistoryFolder) btnOpenHistoryFolder.addEventListener("click", openDownloadsFolder);
    if (btnRefreshHistory) {
        btnRefreshHistory.addEventListener("click", () => {
            loadHistoryFiles();
            showToast("Liste güncellendi.", "info");
        });
    }

    // ----------------------------------------------------
    // Built-in Floating Mini Player
    // ----------------------------------------------------
    function playMedia(url, filename, isAudio = true) {
        activePlayerUrl = url;
        if (!floatingMediaPlayer) return;
        floatingMediaPlayer.style.display = "flex";
        if (playerTrackTitle) playerTrackTitle.textContent = filename || "Bilinmeyen Parça";
        if (playerTrackMeta) playerTrackMeta.textContent = isAudio ? "Ses Dosyası (Yerel)" : "Video Dosyası (Yerel)";
        if (playerMediaIcon) playerMediaIcon.textContent = isAudio ? "🎵" : "🎬";

        if (globalAudioElement) {
            globalAudioElement.src = url;
            globalAudioElement.play().catch(e => console.log("Autoplay prevent:", e));
            updatePlayPauseUI(true);
        }
    }

    function updatePlayPauseUI(isPlaying) {
        if (!playIconSvg || !pauseIconSvg) return;
        if (isPlaying) {
            playIconSvg.style.display = "none";
            pauseIconSvg.style.display = "block";
        } else {
            playIconSvg.style.display = "block";
            pauseIconSvg.style.display = "none";
        }
    }

    if (btnPlayerPlayToggle && globalAudioElement) {
        btnPlayerPlayToggle.addEventListener("click", () => {
            if (globalAudioElement.paused) {
                globalAudioElement.play();
                updatePlayPauseUI(true);
            } else {
                globalAudioElement.pause();
                updatePlayPauseUI(false);
            }
        });
    }

    if (globalAudioElement) {
        globalAudioElement.addEventListener("loadedmetadata", () => {
            const dur = globalAudioElement.duration || 0;
            if (dur > 0 && playerTotalTime) {
                playerTotalTime.textContent = formatSecToMinSec(dur);
            }
        });

        globalAudioElement.addEventListener("timeupdate", () => {
            const cur = globalAudioElement.currentTime || 0;
            const dur = globalAudioElement.duration || 0;
            if (playerCurrentTime) playerCurrentTime.textContent = formatSecToMinSec(cur);
            if (dur > 0) {
                if (playerTotalTime) playerTotalTime.textContent = formatSecToMinSec(dur);
                if (playerSeekbar) playerSeekbar.value = (cur / dur) * 100;
            }
        });

        globalAudioElement.addEventListener("ended", () => {
            updatePlayPauseUI(false);
        });

        globalAudioElement.addEventListener("error", () => {
            showToast("Medya dosyası oynatılamadı veya bulunamadı.", "error");
            updatePlayPauseUI(false);
        });
    }

    if (playerSeekbar && globalAudioElement) {
        playerSeekbar.addEventListener("input", () => {
            const dur = globalAudioElement.duration;
            if (dur) {
                globalAudioElement.currentTime = (playerSeekbar.value / 100) * dur;
            }
        });
    }

    if (playerVolume && globalAudioElement) {
        playerVolume.addEventListener("input", () => {
            globalAudioElement.volume = parseFloat(playerVolume.value);
        });
    }

    if (btnPlayerBack10 && globalAudioElement) {
        btnPlayerBack10.addEventListener("click", () => {
            globalAudioElement.currentTime = Math.max(0, globalAudioElement.currentTime - 10);
        });
    }

    if (btnPlayerFwd10 && globalAudioElement) {
        btnPlayerFwd10.addEventListener("click", () => {
            globalAudioElement.currentTime = Math.min(globalAudioElement.duration || 9999, globalAudioElement.currentTime + 10);
        });
    }

    if (btnPlayerClose && globalAudioElement && floatingMediaPlayer) {
        btnPlayerClose.addEventListener("click", () => {
            globalAudioElement.pause();
            floatingMediaPlayer.style.display = "none";
        });
    }

    // Check system status on boot
    async function checkBackendStatus() {
        try {
            const res = await fetch("/api/status");
            const data = await res.json();
            const pill = document.getElementById("backendStatusPill");
            if (pill) {
                if (data.ffmpeg_available) {
                    pill.innerHTML = `
                        <span class="status-dot online"></span>
                        <span class="status-text">Sistem Hazır (FFmpeg Aktif)</span>
                    `;
                } else {
                    pill.innerHTML = `
                        <span class="status-dot" style="background:#fbbf24;"></span>
                        <span class="status-text">FFmpeg Bekleniyor</span>
                    `;
                }
            }
        } catch (e) {
            console.log("Status check err:", e);
        }
    }

    // Initial boot
    checkBackendStatus();
    loadHistoryFiles();
});
