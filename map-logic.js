// map-logic.js

function initializeMap() {
  let map = L.map("map").setView([20, 0], 2);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  let clusterGroup = L.markerClusterGroup();
  let plainGroup = L.layerGroup();
  let useClustering = true;
  let gallery = document.getElementById("galleryContainer");
  let yearSet = new Set();
  const carIcon = L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/744/744465.png",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    className: "flipped-icon"
  });

  let tripPath = [];
  let tripIndex = 0;
  let tripMarker = null;
  let tripTimer = null;
  let tripSpeed = 1500;
  let showPhotosOnTrip = true;
  let tripLine = null;

  let galleryVisible = true;
  const sound = document.getElementById("tripSound");

  function parseExifDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split(" ");
    if (parts.length !== 2) return null;
    const dateParts = parts[0].split(":"), timeParts = parts[1].split(":");
    return new Date(+dateParts[0], +dateParts[1] - 1, +dateParts[2], +timeParts[0], +timeParts[1], +timeParts[2]);
  }

  function formatExifYear(dateStr) {
    const d = parseExifDate(dateStr);
    return d ? d.getFullYear().toString() : null;
  }

  function convertToDecimal(coord, ref) {
    if (!coord || !ref) return null;
    let dec = coord[0] + coord[1] / 60 + coord[2] / 3600;
    if (ref === "S" || ref === "W") dec = -dec;
    return dec;
  }

  function clearMarkers() {
    clusterGroup.clearLayers();
    plainGroup.clearLayers();
    if (tripMarker) map.removeLayer(tripMarker);
    tripPath = [];
    tripIndex = 0;
    document.getElementById("timeline").textContent = "";
    document.getElementById("progressBar").style.width = "0%";
    if (tripLine) map.removeLayer(tripLine);
  }

  function loadMarkers(photoFiles, filterYear = null) {
    return new Promise((resolve) => {
      clearMarkers();
      gallery.innerHTML = "";
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
              if (lat && lng && latRef && lngRef) {
                const latitude = convertToDecimal(lat, latRef);
                const longitude = convertToDecimal(lng, lngRef);
                if (latitude == null || longitude == null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return res();
                bounds.push([latitude, longitude]);
                const marker = L.marker([latitude, longitude]);
                const popupHtml = `<img src="${file}" style="max-width: 200px; max-height: 150px; display:block; margin-bottom:4px;"><div>${caption}</div>`;
                marker.bindPopup(popupHtml);
                (useClustering ? clusterGroup : plainGroup).addLayer(marker);
                const parsedDate = parseExifDate(dateStr);
                if (parsedDate) tripPath.push({ latLng: L.latLng(latitude, longitude), date: parsedDate, file: file, caption: caption, dateStr });
                const gridImg = document.createElement("img");
                gridImg.src = file;
                gridImg.alt = caption;
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

  function drawTripLine() {
    if (tripLine) map.removeLayer(tripLine);
    if (tripPath.length > 1) {
      tripLine = L.polyline(tripPath.map(p => p.latLng), { color: "blue", weight: 3, opacity: 0.7, smoothFactor: 1 }).addTo(map);
    }
  }

  function updateTimeline(dateStr) {
    document.getElementById("timeline").textContent = dateStr ? `Date: ${dateStr}` : "";
  }

  function playTrip() {
    if (tripIndex === 0) drawTripLine();
    if (tripIndex >= tripPath.length) return resetTrip();
    const step = tripPath[tripIndex];
    if (!tripMarker) tripMarker = L.marker(step.latLng, { icon: carIcon }).addTo(map);
    else tripMarker.setLatLng(step.latLng);
    map.panTo(step.latLng);
    if (showPhotosOnTrip) {
      tripMarker.bindPopup(`<img src="${step.file}" style="max-width: 200px; max-height: 150px; display:block; margin-bottom:4px;"><div>${step.caption}</div><div>${step.date.toISOString().slice(0,19).replace('T',' ')}</div>`);
      tripMarker.openPopup();
    } else {
      tripMarker.closePopup();
    }
    updateTimeline(step.date.toISOString().slice(0,10));
    document.getElementById("progressBar").style.width = `${((tripIndex + 1) / tripPath.length) * 100}%`;
    if (sound) {
      sound.currentTime = 0;
      sound.play().catch(err => console.warn("Sound playback failed:", err));
    }
    tripIndex++;
    tripTimer = setTimeout(playTrip, tripSpeed);
  }

  function pauseTrip() {
    if (tripTimer) clearTimeout(tripTimer);
    document.getElementById("playTripBtn").disabled = false;
    document.getElementById("pauseTripBtn").disabled = true;
  }

  function resetTrip() {
    pauseTrip();
    tripIndex = 0;
    if (tripMarker) map.removeLayer(tripMarker);
    if (tripLine) map.removeLayer(tripLine);
    updateTimeline("");
    document.getElementById("progressBar").style.width = "0%";
    document.getElementById("playTripBtn").disabled = false;
    document.getElementById("pauseTripBtn").disabled = true;
  }

  function toggleGallery() {
    galleryVisible = !galleryVisible;
    const galleryEl = document.getElementById("galleryContainer");
    const toggleBtn = document.getElementById("toggleGalleryBtn");
    galleryEl.classList.toggle("hidden", !galleryVisible);
    toggleBtn.textContent = galleryVisible ? "Hide Gallery" : "Show Gallery";
    document.getElementById("map").style.height = galleryVisible ? "calc(100% - 250px)" : "100%";
    map.invalidateSize();
  }

  document.getElementById("map").style.height = "calc(100% - 250px)";

  let photos = [];
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
        loadMarkers(photos, document.getElementById("yearFilter").value);
      });

      document.getElementById("yearFilter").addEventListener("change", (e) => {
        loadMarkers(photos, e.target.value);
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
      document.getElementById("toggleGalleryBtn").addEventListener("click", toggleGallery);
    })
    .catch((error) => console.error("Error loading photos:", error));
}
