// map-logic.js

function loadMarkers(photoFiles, filterYear = null) {
  return new Promise((resolve) => {
    clearMarkers();
    yearSet.clear();
    const bounds = [];

    let loadPromises = photoFiles.map((entry) => {
      return new Promise((res) => {
        const file = typeof entry === "string" ? entry : entry.path;
        const caption = typeof entry === "string" ? "" : entry.caption || "";
        const img = new Image();
        img.src = file;
        img.crossOrigin = "anonymous";
        img.onload = () => {
          EXIF.getData(img, function () {
            const lat = EXIF.getTag(this, "GPSLatitude");
            const lng = EXIF.getTag(this, "GPSLongitude");
            const latRef = EXIF.getTag(this, "GPSLatitudeRef");
            const lngRef = EXIF.getTag(this, "GPSLongitudeRef");
            const dateStr = EXIF.getTag(this, "DateTimeOriginal");
            const photoYear = formatExifYear(dateStr);
            if (photoYear) yearSet.add(photoYear);
            if (filterYear && photoYear !== filterYear) return res();
            const latitude = convertToDecimal(lat, latRef);
            const longitude = convertToDecimal(lng, lngRef);
            if (!isValidCoordinate(latitude, longitude)) return res();
            bounds.push([latitude, longitude]);
            const marker = L.marker([latitude, longitude]);
            const popupHtml = `<img src="${file}" style="max-width: 200px; max-height: 150px; display:block; margin-bottom:4px;"><div>${caption}</div>`;
            marker.bindPopup(popupHtml);
            (useClustering ? clusterGroup : plainGroup).addLayer(marker);
            const parsedDate = parseExifDate(dateStr);
            if (parsedDate) tripPath.push({ latLng: L.latLng(latitude, longitude), date: parsedDate, file: file, caption: caption, dateStr });
            if (galleryVisible) {
              const gridImg = document.createElement("img");
              gridImg.src = file;
              gridImg.alt = caption;
              gridImg.className = "gallery-image";
              gallery.appendChild(gridImg);
            }
            res();
          });
        };
        img.onerror = () => res();
      });
    });

    Promise.all(loadPromises).then(() => {
      tripPath.sort((a, b) => a.date - b.date);
      if (bounds.length) map.fitBounds(bounds);
      const yearSelect = document.getElementById("yearFilter");
      yearSelect.innerHTML = '<option value="">All Years</option>';
      Array.from(yearSet).sort().forEach((y) => {
        const option = document.createElement("option");
        option.value = y;
        option.textContent = y;
        yearSelect.appendChild(option);
      });
      map.addLayer(useClustering ? clusterGroup : plainGroup);
      resolve();
    });
  });
}

function initializeMap() {
  map = L.map("map").setView([20, 0], 2);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  clusterGroup = L.markerClusterGroup();
  plainGroup = L.layerGroup();
  useClustering = true;
  gallery = document.getElementById("galleryContainer");
  yearSet = new Set();
  const carIcon = L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/744/744465.png",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    className: "flipped-icon"
  });

  tripPath = [];
  tripIndex = 0;
  tripMarker = null;
  tripTimer = null;
  animationFrameId = null;
  tripSpeed = 1500;
  showPhotosOnTrip = true;
  tripLine = null;
  galleryVisible = false;
  const sound = document.getElementById("tripSound");

  gallery.classList.add("hidden");
  const toggleBtn = document.getElementById("toggleGalleryBtn");
  if (toggleBtn) {
    toggleBtn.textContent = "Show Gallery";
    toggleBtn.onclick = function () {
      galleryVisible = !galleryVisible;
      if (galleryVisible) {
        gallery.classList.remove("hidden");
        toggleBtn.textContent = "Hide Gallery";
      } else {
        gallery.classList.add("hidden");
        toggleBtn.textContent = "Show Gallery";
      }
    };
  }

  function pauseAudio() {
    if (sound && !sound.paused) {
      sound.pause();
    }
  }

  function resumeAudio() {
    if (sound && sound.paused) {
      sound.play().catch(err => console.warn("Sound playback failed:", err));
    }
  }

  function pauseTrip() {
    if (tripTimer) clearTimeout(tripTimer);
    cancelAnimation();
    document.getElementById("playTripBtn").disabled = false;
    const pauseBtn = document.getElementById("pauseTripBtn");
    pauseBtn.disabled = false;
    pauseBtn.textContent = "Resume Trip";
    pauseAudio();
    pauseBtn.onclick = () => {
      pauseBtn.textContent = "Pause Trip";
      pauseBtn.onclick = pauseTrip;
      document.getElementById("playTripBtn").disabled = true;
      resumeAudio();
      playTrip();
    };
  }

  function playTrip() {
    if (tripIndex === 0 && sound) {
      sound.currentTime = 0;
      sound.play().catch(err => console.warn("Sound playback failed:", err));
    }

    if (tripIndex >= tripPath.length) return resetTrip();
    const step = tripPath[tripIndex];
    if (!tripMarker) {
      tripMarker = L.marker(step.latLng, { icon: carIcon }).addTo(map);
      map.panTo(step.latLng);
      tripMarker.openPopup();
      tripIndex++;
      tripTimer = setTimeout(playTrip, tripSpeed);
      return;
    }
    const start = tripMarker.getLatLng();
    const end = step.latLng;
    animateMarker(start, end, tripSpeed, () => {
      if (showPhotosOnTrip) {
        tripMarker.bindPopup(`<img src="${step.file}" style="max-width: 200px; max-height: 150px; display:block; margin-bottom:4px;"><div>${step.caption}</div><div>${step.date.toISOString().slice(0,19).replace('T',' ')}</div>`);
        tripMarker.openPopup();
      } else {
        tripMarker.closePopup();
      }
      updateTimeline(step.date.toISOString().slice(0,10));
      document.getElementById("progressBar").style.width = `${((tripIndex + 1) / tripPath.length) * 100}%`;
      tripIndex++;
      tripTimer = setTimeout(playTrip, tripSpeed);
    });
  }

  function resetTrip() {
    pauseTrip();
    tripIndex = 0;
    if (tripMarker) map.removeLayer(tripMarker);
    tripMarker = null;
    if (tripLine) map.removeLayer(tripLine);
    tripLine = null;
    updateTimeline("");
    document.getElementById("progressBar").style.width = "0%";
    document.getElementById("playTripBtn").disabled = false;
    document.getElementById("pauseTripBtn").disabled = true;
  }

  document.getElementById("allYearsCheckbox").addEventListener("change", function () {
    const selectedYear = this.checked ? null : document.getElementById("yearFilter").value;
    loadMarkers(photos, selectedYear);
  });

  document.getElementById("yearFilter").addEventListener("change", function () {
    const allYearsChecked = document.getElementById("allYearsCheckbox").checked;
    const selectedYear = allYearsChecked ? null : this.value;
    loadMarkers(photos, selectedYear);
  });

  document.getElementById("galleryContainer").classList.add("hidden");
  document.getElementById("map").style.height = "100%";

  fetch("photos.json")
    .then((response) => {
      if (!response.ok) throw new Error("Photo list JSON not found");
      return response.json();
    })
    .then((data) => {
      photos = data;
      return loadMarkers(photos);
    })
    .then(() => {
      document.getElementById("toggleCluster").addEventListener("change", (e) => {
        useClustering = e.target.checked;
        const selectedYear = document.getElementById("allYearsCheckbox").checked ? null : document.getElementById("yearFilter").value;
        loadMarkers(photos, selectedYear);
      });

      document.getElementById("playTripBtn").addEventListener("click", () => {
        document.getElementById("playTripBtn").disabled = true;
        document.getElementById("pauseTripBtn").disabled = false;
        playTrip();
      });

      document.getElementById("pauseTripBtn").addEventListener("click", pauseTrip);
      document.getElementById("resetTripBtn").addEventListener("click", resetTrip);
      document.getElementById("showPhotosOnTrip").addEventListener("change", (e) => {
        showPhotosOnTrip = e.target.checked;
      });
      document.getElementById("speedRange").addEventListener("input", (e) => {
        tripSpeed = +e.target.value;
      });
    })
    .catch((error) => console.error("Error loading photos:", error));
}
