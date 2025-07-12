// map-logic.js

function initializeMap() {
  let map = L.map("map").setView([20, 0], 2);

  const unknownIcon = L.icon({
     iconUrl: "https://cdn-icons-png.flaticon.com/512/1828/1828774.png", // question mark icon
     iconSize: [32, 32],
     iconAnchor: [16, 32],
  });
       
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
  let animationFrameId = null;
  let tripSpeed = 1500;
  let showPhotosOnTrip = true;
  let tripLine = null;
  let galleryVisible = false; // Turn gallery off by default
  const sound = document.getElementById("tripSound");

  gallery.classList.add("hidden");
  const toggleBtn = document.getElementById("toggleGalleryBtn");
  if (toggleBtn) {
    toggleBtn.textContent = "Show Gallery";
    toggleBtn.onclick = function () {
    galleryVisible = !galleryVisible;
    if (galleryVisible) {
      gallery.innerHTML = ""; // Clear any existing images
      loadMarkers(photos, document.getElementById("allYearsCheckbox").checked ? null : document.getElementById("yearFilter").value);
      gallery.classList.remove("hidden");
      toggleBtn.textContent = "Hide Gallery";
     } else {
      gallery.classList.add("hidden");
      toggleBtn.textContent = "Show Gallery";
     }
    };
    }

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

  function isValidCoordinate(lat, lng) {
    return (
      typeof lat === 'number' && typeof lng === 'number' &&
      !isNaN(lat) && !isNaN(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180
    );
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
    gallery.innerHTML = "";
  }
     
  function loadMarkers(photoFiles, filterYear = null) {
  return new Promise((resolve) => {
    clearMarkers();
    yearSet.clear();
    const bounds = [];

  for (const photo of photoFiles) {
  const { path: file, caption = "", lat, lon, datetime } = photo;

  // Skip if photo doesn't match the selected year
  if (filterYear && (!datetime || !datetime.startsWith(filterYear))) {
    continue;
  }

  const year = datetime?.slice(0, 4);
  if (year) yearSet.add(year);

  let markerLat = lat;
  let markerLon = lon;
  let useUnknownIcon = false;

  // If invalid or missing coords, use fallback near Jacksonville
  if (
    lat == null || lon == null ||
    !isValidCoordinate(lat, lon) ||
    (lat === 0 && lon === 0)
  ) {
    markerLat = 30.3;
    markerLon = -81.5;
    useUnknownIcon = true;
    console.warn("Missing or invalid coordinates:", { file, lat, lon });
  }

  bounds.push([markerLat, markerLon]);

  const markerOptions = {};
  if (useUnknownIcon) {
    markerOptions.icon = unknownIcon;
  }
  const marker = L.marker([markerLat, markerLon], markerOptions);

const popupHtml = `
  <div style="width: 220px; word-wrap: break-word;">
    <img src="${file}" style="width: 100%; height: auto; display:block; margin-bottom:4px; border-radius:4px;">
    <div>${caption}</div>
    ${useUnknownIcon ? "<div style='color:red'><em>Location Unknown</em></div>" : ""}
  </div>
`;
  marker.bindPopup(popupHtml);
  (useClustering ? clusterGroup : plainGroup).addLayer(marker);

  let parsedDate = null;
  if (datetime) {
    // Convert "2024:09:04 19:22:46" → "2024-09-04T19:22:46"
    const cleaned = datetime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3').replace(' ', 'T');
    parsedDate = new Date(cleaned);
  }
if (parsedDate && !isNaN(parsedDate)) {
  tripPath.push({
    latLng: L.latLng(markerLat, markerLon),
    date: parsedDate,
    file: file,
    caption: caption,
    dateStr: datetime
  });
  console.log("Added to trip:", file);
}

  if (galleryVisible) {
    const gridImg = document.createElement("img");
    gridImg.src = file;
    gridImg.alt = caption;
    gallery.appendChild(gridImg);
  }
}


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
  console.log("Total photos:", photoFiles.length);
  console.log("Trip path built with", tripPath.length, "entries");
}

  function cancelAnimation() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function animateMarker(startLatLng, endLatLng, duration, callback) {
    let startTime = null;
    function animate(time) {
      if (!startTime) startTime = time;
      let progress = Math.min((time - startTime) / duration, 1);
      let currentLat = startLatLng.lat + (endLatLng.lat - startLatLng.lat) * progress;
      let currentLng = startLatLng.lng + (endLatLng.lng - startLatLng.lng) * progress;
      tripMarker.setLatLng([currentLat, currentLng]);
      map.panTo([currentLat, currentLng]);
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        animationFrameId = null;
        callback();
      }
    }
    animationFrameId = requestAnimationFrame(animate);
  }

  function drawTripLine() {
    if (tripLine) map.removeLayer(tripLine);
    if (tripPath.length > 1) {
      tripLine = L.polyline(tripPath.map(p => p.latLng), {
        color: "blue",
        weight: 3,
        opacity: 0.7,
        smoothFactor: 1
      }).addTo(map);
    }
  }

  function updateTimeline(dateStr) {
    document.getElementById("timeline").textContent = dateStr ? `Date: ${dateStr}` : "";
  }

    
  let soundPlayed = false;

function playSoundOnce() {
  if (!soundPlayed && sound) {
    soundPlayed = true;
    sound.currentTime = 0;
    sound.play().catch(err => {
      console.warn("Sound playback failed:", err);
    });
  }
}

  function playTrip() {
    console.log("Trip path length:", tripPath.length);
    if (tripIndex === 0) {
      drawTripLine();
      playSoundOnce();  // Play music once when trip starts
    }
    //if (tripIndex === 0) drawTripLine();
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
        //tripMarker.bindPopup(`<img src="${step.file}" style="max-width: 200px; max-height: 150px; display:block; margin-bottom:4px;"><div>${step.caption}</div><div>${step.date.toISOString().slice(0,19).replace('T',' ')}</div>`);
        tripMarker.bindPopup(`
           <div style="width: 220px; word-wrap: break-word;">
           <img src="${step.file}" style="width: 100%; height: auto; display:block; margin-bottom:4px; border-radius:4px;">
           <div>${step.caption}</div>
           <div>${step.date.toISOString().slice(0,19).replace('T',' ')}</div>
           </div>
           `);
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

  const allYearsCheckbox = document.createElement("label");
  allYearsCheckbox.innerHTML = '<input type="checkbox" id="allYearsCheckbox" checked /> All Years';
  const yearFilter = document.getElementById("yearFilter");
  yearFilter.parentNode.insertBefore(allYearsCheckbox, yearFilter);

  document.getElementById("allYearsCheckbox").addEventListener("change", function () {
    const selectedYear = this.checked ? null : yearFilter.value;
    loadMarkers(photos, selectedYear);
  });

  document.getElementById("yearFilter").addEventListener("change", function () {
    const allYearsChecked = document.getElementById("allYearsCheckbox").checked;
    const selectedYear = allYearsChecked ? null : this.value;
    loadMarkers(photos, selectedYear);
  });

  function toggleGallery() {
    galleryVisible = !galleryVisible;
    const galleryEl = document.getElementById("galleryContainer");
    const toggleBtn = document.getElementById("toggleGalleryBtn");
    galleryEl.classList.toggle("hidden", !galleryVisible);
    toggleBtn.textContent = galleryVisible ? "Hide Gallery" : "Show Gallery";
    document.getElementById("map").style.height = galleryVisible ? "calc(100% - 250px)" : "100%";
    map.invalidateSize();
  }

  document.getElementById("galleryContainer").classList.add("hidden");
  document.getElementById("map").style.height = "100%";

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
      document.getElementById("toggleGalleryBtn").addEventListener("click", toggleGallery);
    })
    .catch((error) => console.error("Error loading photos:", error));
}
