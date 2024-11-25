// ==UserScript==
// @name         WME GMAPS Layers
// @namespace    https://greasyfork.org/en/users/1366579-js55ct
// @version      2024.11.25.01
// @description  Adds GMAPS Layers (Roads and Traffic, Landscape, Transit, Water) layers as an overlay in Waze Map Editor
// @license      MIT
// @match        https://*.waze.com/*/editor*
// @match        https://*.waze.com/editor
// @exclude      https://*.waze.com/user/editor*
// @grant        none
// @require      https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @downloadURL  https://update.greasyfork.org/scripts/518808/WME%20GMAPS%20Layers.user.js
// @updateURL    https://update.greasyfork.org/scripts/518808/WME%20GMAPS%20Layers.meta.js
// ==/UserScript==

(function () {
  "use strict";

  // Configuration
  const debugMode = false; // Debug mode flag
  const scriptMetadata = GM_info.script; // Metadata for the script
  const storageKey = "WMEGMAPSLayerState"; // Key for storing state in localStorage
  let wmeSDK, googleMap, trafficLayer, gmapsContainer;
  let layerActive = getItem("layerActive", "false") === "true"; // Layer activation status
  let syncChange = false; // Flag to avoid sync issues during state changes
  let toggleButton = null;

  // Utility functions for localStorage management
  function getStorageData() {
    return JSON.parse(localStorage.getItem(storageKey) ?? "{}");
  }

  function setStorageData(data) {
    localStorage.setItem(storageKey, JSON.stringify(data));
  }

  function setItem(key, value) {
    const data = getStorageData();
    data[key] = value;
    setStorageData(data);
  }

  function getItem(key, defaultValue = null) {
    const data = getStorageData();
    return data[key] ?? defaultValue;
  }

  // Function to update UI elements after toggling the layer
  function updateUiAfterToggle() {
    // Update toggle button state
    if (toggleButton) {
      if (debugMode) console.log("WME GMAPS Layers: Updating toggle button state to", layerActive);
      toggleButton.classList.toggle("active", layerActive);
    }

    // Update Google Maps container display state
    if (gmapsContainer) {
      if (debugMode) console.log("WME GMAPS Layers: Updating gmapsContainer display to", layerActive ? "block" : "none");
      gmapsContainer.style.display = layerActive ? "block" : "none";

      if (layerActive) {
        syncMapPosition();
      }
    }
  }

  // Function to toggle the state of the Google Maps layer
  function toggleLayerState(newState = null) {
    if (!syncChange) {
      if (debugMode) console.log("WME GMAPS Layers: toggleLayerState called with newState:", newState);
      syncChange = true;
      layerActive = newState !== null ? newState : !layerActive;
      setItem("layerActive", layerActive ? "true" : "false");
      updateUiAfterToggle();
      syncChange = false;
    }
  }

  // Function to create and return the header for the script
  function createScriptHeader() {
    const header = document.createElement("div");
    header.className = "script-header";

    header.innerHTML = `
          <span class="script-name">${scriptMetadata.name}</span>
          <span class="script-version">v${scriptMetadata.version}</span>
      `;
    return header;
  }

  // Function to create and return the toggle switch UI
  function createToggleSwitch() {
    const container = document.createElement("div");
    container.className = "toggle-container";

    const toggle = document.createElement("div");
    toggle.className = `toggle-switch${layerActive ? " active" : ""}`;
    toggle.addEventListener("click", () => {
      toggleLayerState();
    });

    const slider = document.createElement("div");
    slider.className = "slider";
    toggle.appendChild(slider);

    container.append(
      toggle,
      Object.assign(document.createElement("label"), {
        textContent: "Toggle Layers",
        className: "setting-label",
      })
    );

    toggleButton = toggle;
    return container;
  }

  // Function to create and return a feature checkbox UI
  function createFeatureCheckbox({ featureType, elementType = null, defaultChecked, label, description }) {
    const wrapper = document.createElement("div");
    const id = featureType.replace(".", "_") + (elementType ? "_" + elementType.replace(".", "_") : "");

    const savedState = getItem(id, defaultChecked ? "true" : "false");
    const isChecked = savedState === "true";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "style-checkbox";
    checkbox.checked = isChecked;
    checkbox.id = id;
    checkbox.dataset.featureType = featureType;
    if (elementType) checkbox.dataset.elementType = elementType;
    checkbox.dataset.visibility = "on";
    checkbox.addEventListener("change", (event) => {
      setItem(id, event.target.checked.toString());
      updateMapStyles();
      if (debugMode) console.log(`WME GMAPS Layers: ${event.target.dataset.featureType} visibility set to:`, event.target.checked);
    });

    wrapper.innerHTML = `
          <label class='setting-label' for='${id}'>${label}</label><br>
          <span class='description'>${description}</span>
      `;
    wrapper.prepend(checkbox);

    return wrapper;
  }

  function createMapStyleSelector() {
    // Container for all elements
    const container = document.createElement("div");

    // Create and append the hr element
    const hr = document.createElement("hr");
    container.appendChild(hr);

    // Create and append the section label
    const sectionLabel = document.createElement("div");
    sectionLabel.className = "script-header";
    sectionLabel.textContent = "Map Style";
    container.appendChild(sectionLabel);

    // Define available styles
    const styles = [
      { label: "Standard", value: "standardMapStyle" },
      { label: "Night", value: "nightMapStyle" },
      { label: "Gray", value: "grayMapStyle" },
      { label: "Retro", value: "retroMapStyle" },
      { label: "Aubergine", value: "aubergineMapStyle" },
      { label: "Neon", value: "neonMapStyle" },
    ];

    const savedStyle = getItem("selectedMapStyle", "standardMapStyle");

    // Create the select element (combo box)
    const select = document.createElement("select");
    select.className = "style-selector";
    //select.style.backgroundColor = "transparent";
    select.addEventListener("change", function () {
      setItem("selectedMapStyle", this.value);
      updateMapStyles();
    });

    // Populate the select element with options
    styles.forEach((style) => {
      const option = document.createElement("option");
      option.value = style.value;
      option.textContent = style.label;
      option.selected = style.value === savedStyle;
      //option.style.backgroundColor = "#D3D3D3";
      select.appendChild(option);
    });

    // Append the select element to the container
    container.appendChild(select);

    return container;
  }

  const mapStyles = {
    standardMapStyle: [{ featureType: "administrative.land_parcel", elementType: "geometry", stylers: [{ lightness: 10 }, { weight: 2.5 }] }],
    retroMapStyle: [
      { elementType: "geometry", stylers: [{ color: "#ebe3cd" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#523735" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#f5f1e6" }] },
      { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#c9b2a6" }] },
      { featureType: "administrative.land_parcel", elementType: "geometry.stroke", stylers: [{ color: "#dcd2be" }] },
      { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#ae9e90" }] },
      { featureType: "administrative.land_parcel", elementType: "geometry", stylers: [{ lightness: 0 }, { weight: 2.5 }] },
      { featureType: "poi", elementType: "geometry", stylers: [{ color: "#dfd2ae" }] },
      { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#93817c" }] },
      { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#a5b076" }] },
      { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#447530" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#f5f1e6" }] },
      { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#fdfcf8" }] },
      { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#f8c967" }] },
      { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#e9bc62" }] },
      { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#e98d58" }] },
      { featureType: "road.highway.controlled_access", elementType: "geometry.stroke", stylers: [{ color: "#db8555" }] },
      { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#806b63" }] },
      { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#dfd2ae" }] },
      { featureType: "transit.line", elementType: "labels.text.fill", stylers: [{ color: "#8f7d77" }] },
      { featureType: "transit.line", elementType: "labels.text.stroke", stylers: [{ color: "#ebe3cd" }] },
      { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#dfd2ae" }] },
      { featureType: "water", elementType: "geometry.fill", stylers: [{ color: "#b9d3c2" }] },
      { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#92998d" }] },
    ],
    nightMapStyle: [
      { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
      { featureType: "administrative", stylers: [{ visibility: "on" }] },
      { featureType: "administrative.land_parcel", elementType: "geometry", stylers: [{ lightness: 30 }, { weight: 2.5 }] },
      { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
      { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
      { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
      { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
      { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
      { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
      { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
      { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
      { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
      { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
      { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
      { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
      { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
    ],
    aubergineMapStyle: [
      { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
      { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#4b6878" }] },
      { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#64779e" }] },
      { featureType: "administrative.land_parcel", elementType: "geometry", stylers: [{ lightness: 10 }, { weight: 2.5 }] },
      { featureType: "landscape.man_made", elementType: "geometry.stroke", stylers: [{ color: "#334e87" }] },
      { featureType: "poi", elementType: "geometry", stylers: [{ color: "#283d6a" }] },
      { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#6f9ba5" }] },
      { featureType: "poi", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },
      { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#023e58" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
      { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
      { featureType: "road", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },
      { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2c6675" }] },
      { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#255763" }] },
      { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#4e6d70" }] },
      { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#61688b" }] },
      { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
      { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#3a536b" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
      { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4e6d70" }] },
    ],
    grayMapStyle: [
      { featureType: "administrative", elementType: "all", stylers: [{ saturation: "-100" }] },
      { featureType: "administrative.land_parcel", elementType: "geometry", stylers: [{ lightness: 0 }, { weight: 2.5 }] },
      { featureType: "landscape", elementType: "all", stylers: [{ saturation: -100 }, { lightness: 65 }, { visibility: "on" }] },
      { featureType: "poi", elementType: "all", stylers: [{ saturation: -100 }, { lightness: "50" }, { visibility: "simplified" }] },
      { featureType: "road", elementType: "all", stylers: [{ saturation: "-100" }] },
      { featureType: "road.highway", elementType: "all", stylers: [{ visibility: "simplified" }] },
      { featureType: "road.arterial", elementType: "all", stylers: [{ lightness: "30" }] },
      { featureType: "road.local", elementType: "all", stylers: [{ lightness: "40" }] },
      { featureType: "transit", elementType: "all", stylers: [{ saturation: -100 }, { visibility: "simplified" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ hue: "#ffff00" }, { lightness: -25 }, { saturation: -97 }] },
      { featureType: "water", elementType: "labels", stylers: [{ lightness: -25 }, { saturation: -100 }] },
    ],
    neonMapStyle: [{ stylers: [{ saturation: 100 }, { gamma: 0.6 }] }],
  };

  const baseMapStyles = [
    { featureType: "administrative", stylers: [{ visibility: "off" }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "road", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "landscape", stylers: [{ visibility: "off" }] },
    { featureType: "water", stylers: [{ visibility: "off" }] },
  ];

  function updateMapStyles() {
    // Get the selected map style from radio buttons
    const selectedStyleType = document.querySelector(".style-selector").value;
    const selectedStyle = mapStyles[selectedStyleType] || [];

    // Collect layers that should be visible from checkboxes
    const customStyles = Array.from(document.querySelectorAll(".style-checkbox"))
      .filter((checkbox) => checkbox.checked)
      .filter((checkbox) => checkbox.dataset.featureType !== "traffic") // Exclude traffic as it's not a GMAPS Base feature type
      .map((checkbox) => {
        const { featureType, elementType } = checkbox.dataset;
        return {
          featureType: featureType,
          ...(elementType ? { elementType: elementType } : {}),
          stylers: [{ visibility: "on" }],
        };
      });

    // Apply all Map Layers & styles to the Google Map
    googleMap.setOptions({ styles: [...selectedStyle, ...baseMapStyles, ...customStyles] });

    // Turn off gmapsContainer's interactions so we can still interact with WME Layers
    gmapsContainer.style.pointerEvents = "none";
    if (gmapsContainer.firstElementChild) {
      gmapsContainer.firstElementChild.style.backgroundColor = "rgb(229 227 223 / 0%)";
    }

    addRemoveTrafficLayer();
    if (debugMode) console.log("WME GMAPS Layers: Map styles updated");
  }

  function addRemoveTrafficLayer() {
    const trafficCheckbox = document.querySelector("#traffic");
    if (trafficCheckbox && trafficCheckbox.checked) {
      trafficLayer.setMap(googleMap);
      if (debugMode) console.log("WME GMAPS Layers: Traffic layer displayed");
    } else {
      trafficLayer.setMap(null);
      if (debugMode) console.log("WME GMAPS Layers: Traffic layer hidden");
    }
  }

  function syncMapPosition() {
    // Check if both Google Map and WME Map SDK are initialized
    if (!layerActive) return;
    if (!googleMap || !wmeSDK.Map) return;
    const center = wmeSDK.Map.getMapCenter(); // Get the current center coordinates of the WME map in WGS84 format
    const zoom = wmeSDK.Map.getZoomLevel(); // Get the current zoom level of the WME map
    googleMap.setZoom(zoom); // Set Google Map zoom level to match WME map
    googleMap.panTo(new google.maps.LatLng(center.lat, center.lon)); // Pan Google Map to the new coordinates

    // Log the synchronization operation in debug mode
    if (debugMode) {
      console.log("WME GMAPS Layers: Maps synchronized - Google Maps is set to", center.lat, center.lon, "with zoom level", zoom);
    }
  }

  // Check if the SDK and required methods are loaded
  function isSdkLoaded() {
    return window.getWmeSdk && wmeSDK && wmeSDK.Sidebar && wmeSDK.LayerSwitcher && wmeSDK.Shortcuts && wmeSDK.Events;
  }

  // Initialize the GMAPS Tab and UI elements
  function initializeGMapsLayers() {
    console.log("WME GMAPS Layers: initializeGMapsLayers() started");

    window.SDK_INITIALIZED.then(() => {
      // Initialize the SDK
      wmeSDK = getWmeSdk({ scriptId: "wme-gmaps-layers", scriptName: "WME GMAPS Layers" });

      // Check if the SDK and the necessary methods are loaded
      if (!isSdkLoaded()) {
        console.error("WME GMAPS Layers: SDK or required methods are not loaded correctly.");
        return;
      }
      console.log("WME GMAPS Layers: wmeSDK initialized");

      // Register a new tab in the sidebar
      wmeSDK.Sidebar.registerScriptTab("GMaps in WME")
        .then(({ tabLabel, tabPane }) => {
          tabLabel.innerText = "GMAP";

          console.log("WME GMAPS Layers: GMAP Sidebar Tab successfully created");
          const settingsForm = document.createElement("form");
          settingsForm.className = "settings-form";

          settingsForm.append(
            createScriptHeader(),
            createToggleSwitch(),
            ...[
              { featureType: "road", defaultChecked: true, label: "Roads", description: "" },
              { featureType: "traffic", defaultChecked: true, label: "Traffic", description: "" },
              { featureType: "administrative.land_parcel", defaultChecked: false, label: "Land Parcels", description: "" },
              { featureType: "landscape", defaultChecked: false, label: "General Landscape", description: "" },
              { featureType: "poi", defaultChecked: false, label: "Points of Interest", description: "" },
              { featureType: "transit", defaultChecked: false, label: "Public Transit Features", description: "" },
              { featureType: "water", defaultChecked: false, label: "Water Bodies", description: "" },
            ].map(createFeatureCheckbox),
            createMapStyleSelector()
          );
          tabPane.appendChild(settingsForm);

          console.log("WME GMAPS Layers: HTML elements loaded into Sidebar");

          // Create a container for Google Maps
          gmapsContainer = document.createElement("div");
          gmapsContainer.id = "gmapsContainer";
          gmapsContainer.style.position = "absolute";
          gmapsContainer.style.top = "0";
          gmapsContainer.style.left = "0";
          gmapsContainer.style.right = "0";
          gmapsContainer.style.bottom = "0";

          const viewportElement = wmeSDK.Map.getMapViewportElement();
          viewportElement.appendChild(gmapsContainer); // Append the gmapsContainer to the new viewport element

          // Detect and log Google Maps API key if available
          if (debugMode) {
            const googleScript = Array.from(document.querySelectorAll("script")).find((script) => script.src.includes("maps.googleapis.com"));
            if (googleScript) {
              const urlParams = new URL(googleScript.src);
              const apiKey = urlParams.searchParams.get("key");
              if (apiKey) console.log("WME GMAPS Layers: Detected Google Maps API Key:", apiKey);
            }
          }

          const center = wmeSDK.Map.getMapCenter();
          const zoom = wmeSDK.Map.getZoomLevel();

          // Initialize Google Map
          googleMap = new google.maps.Map(gmapsContainer, {
            zoom: zoom,
            center: { lat: center.lat, lng: center.lon },
            disableDefaultUI: true,
          });

          google.maps.event.addListenerOnce(googleMap, "tilesloaded", syncMapPosition);
          console.log("WME GMAPS Layers: Google Map via API initialized");

          trafficLayer = new google.maps.TrafficLayer(); // Initialize traffic layer
          updateMapStyles(); // Apply initial map styles

          // Register events to synchronize map positions
          wmeSDK.Events.on({ eventName: "wme-map-move", eventHandler: syncMapPosition });
          wmeSDK.Events.on({ eventName: "wme-map-zoom-changed", eventHandler: syncMapPosition });

          // Add a keyboard shortcut for toggling the GMaps layer using the SDK method
          wmeSDK.Shortcuts.createShortcut({
            shortcutId: "WMEGoogleMapsLayersToggle",
            description: "Toggle GMaps Layers",
            shortcutKeys: "A+G",
            callback: () => {
              const checked = !layerActive;
              toggleLayerState(checked);
            },
          });

          updateUiAfterToggle(); // Update UI to reflect current layer state
          console.log("WME GMAPS Layers: Fully initialized");
        })
        .catch((error) => {
          console.error("WME GMAPS Layers: Could not register sidebar tab:", error);
        });
    }).catch((error) => {
      console.error("WME GMAPS Layers: SDK initialization error:", error);
    });
  }

  const customStyles = document.createElement("style");
  customStyles.textContent = `
  .input-space {
      margin-right: 10px;
  }
  .description {
      display: block;
      font-size: 0.9em;
      color: #666;
      margin-left: 18px;
      margin-bottom: 1px;
  }
  .setting-label {
      font-family: Arial, sans-serif;
      font-weight: bold;
      font-size: 1.0em;
      color: #333;
      background-color: transparent;
      padding: 2px;
      border-radius: 5px;
      margin-bottom: 2px;
      display: inline-block;
  }
  .settings-form {
      margin: 5px;
      padding: 10px;
      background-color: transparent;
      border: 2px solid #ddd;
      border-radius: 10px;
      box-shadow: 2px 2px 10px rgba(0,0,0,0.1);
  }
  .script-header {
      text-align: center;
      margin-bottom: 5px;
      font-family: Arial, sans-serif;
      font-size: 1.0em;
      font-weight: bold;
      color: #333;
  }
  .script-name {
      font-size: 1.0em;
      font-weight: bold;
      color: #222;
      display: block;
  }
  .script-version {
      font-size: .9em;
      color: #555;
      display: block;
  }
  .toggle-container {
      display: flex;
      align-items: center;
      margin-bottom: 10px;
  }
  .toggle-switch {
      position: relative;
      width: 50px;
      height: 20px;
      background: #aaa;
      border-radius: 20px;
      cursor: pointer;
      margin-right: 10px;
      transition: background 0.3s;
  }
  .toggle-switch.active {
      background: #4CAF50;
  }
  .toggle-switch .slider {
      position: absolute;
      width: 15px;
      height: 15px;
      background: white;
      border-radius: 50%;
      top: 2px;
      left: 2px;
      margin-top: 0px;
      transition: all 0.3s;
  }
  .toggle-switch.active .slider {
      left: 30px;
  }
  .toggle-switch:not(.active) .slider {
      left: 2px;
  }
   .style-selector {
      width: 100%;
      padding: 5px;
      font-size: 1em;
      font-weight: bold;
      font-family: Arial, sans-serif;
      color: #333;
      border-radius: 10px;
      border: 2px solid #aaa;
      box-sizing: border-box;
      margin-bottom: 10px;
      background-color: transparent;
  }
  .style-selector option {
  background-color: #F0F0F0;
}
`;
  document.head.appendChild(customStyles);

  // Initialize the GMaps layers when WME is ready
  if (window.SDK_INITIALIZED) {
    window.addEventListener("load", initializeGMapsLayers);
  } else {
    document.addEventListener("wme-initialized", initializeGMapsLayers, { once: true });
  }
})();
