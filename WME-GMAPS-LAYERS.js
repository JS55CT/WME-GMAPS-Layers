// ==UserScript==
// @name         WME GMAPS Layers
// @namespace    https://github.com/JS55CT
// @version      2024.10.28.02
// @description  Adds GMAPS Layers (Roads and Traffic, Landscape, Transit, Water) layers as an overlay in Waze Map Editor
// @downloadURL  https://github.com/JS55CT/WME-GMAPS-Layers/raw/main/WME-GMAPS-LAYERS.js
// @updateURL    https://github.com/JS55CT/WME-GMAPS-Layers/raw/main/WME-GMAPS-LAYERS.js
// @license      MIT
// @match        https://*.waze.com/*/editor*
// @match        https://*.waze.com/editor
// @exclude      https://*.waze.com/user/editor*
// @grant        none
// @require      https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// ==/UserScript==

/* global W, OpenLayers, google, WazeWrap */

(function () {
  "use strict";

  // Configuration
  const debugMode = false; // Debug mode flag
  const scriptMetadata = GM_info.script; // Metadata for the script
  const storageKey = "WMEGMAPSLayerState"; // Key for storing state in localStorage

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

  let googleMap, trafficLayer, gmapsContainer; // Google Maps instances and container
  let layerActive = getItem("layerActive", "false") === "true"; // Layer activation status
  let syncChange = false; // Flag to avoid sync issues during state changes

  const uiElements = {
    toggleButton: null,
    layerCheckbox: null,
    checkboxChangeHandler: null,
  };

   // Function to update UI elements after toggling the layer
  function updateUiAfterToggle() {
    if (debugMode) console.log("WME GMAPS Layers: updateUiAfterToggle() with value", layerActive);
    
    // Update toggle button state
    if (uiElements.toggleButton) {
      if (debugMode) console.log("WME GMAPS Layers: Updating toggle button state to", layerActive);
      uiElements.toggleButton.classList.toggle("active", layerActive);
    }

    // Update layer checkbox state
    if (uiElements.layerCheckbox) {
      syncChange = true;
      if (debugMode) console.log("WME GMAPS Layers: Updating layer checkbox state to", layerActive);
      uiElements.layerCheckbox.checked = layerActive;
      uiElements.layerCheckbox.value = layerActive ? "on" : "off";
      if (uiElements.checkboxChangeHandler) {
        if (debugMode) console.log("WME GMAPS Layers: Invoking checkboxChangeHandler with value", layerActive);
        uiElements.checkboxChangeHandler(layerActive);
      }
      syncChange = false;
    }

    // Update Google Maps container display state
    if (gmapsContainer) {
      if (debugMode) console.log("WME GMAPS Layers: Updating gmapsContainer display to", layerActive ? "block" : "none");
      gmapsContainer.style.display = layerActive ? "block" : "none";
    }
    
    // Update the state of the layer menu checkbox
    const layerMenuCheckbox = document.querySelector("#layer-switcher-item_gmaps_layers input");
    if (layerMenuCheckbox) {
      if (debugMode) console.log("WME GMAPS Layers: Updating layer menu checkbox state to", layerActive);
      layerMenuCheckbox.checked = layerActive;
    }
  }

  // Function to toggle the state of the Google Maps layer
  function toggleLayerState(newState = null) {
    if (!syncChange) {
      if (debugMode) console.log("WME GMAPS Layers: toggleLayerState called with newState:", newState);
      syncChange = true;
      layerActive = newState !== null ? newState : !layerActive;
      setItem("layerActive", layerActive.toString());
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

    uiElements.toggleButton = toggle;
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

   // Function to create and return the map style selector UI
  function createMapStyleSelector() {
    const container = document.createElement("div"); // Container for all elements

    const hr = document.createElement("hr"); // Create the hr element
    container.appendChild(hr); 

    const sectionLabel = document.createElement("div");
    sectionLabel.className = "script-header";
    sectionLabel.textContent = "Map Style";
    container.appendChild(sectionLabel); // Append the section label to the container

    const styles = [
      { label: "Standard", value: "standardMapStyle" },
      { label: "Dark / Night", value: "darkMapStyle" },
      { label: "Silver", value: "silverMapStyle" },
      { label: "Retro", value: "retroMapStyle" },
      { label: "Aubergine", value: "aubergineMapStyle" },
    ];

    const savedStyle = getItem("selectedMapStyle", "standardMapStyle");

    // Create radio buttons for each map style
    styles.forEach((style, index) => {
      const radioContainer = document.createElement("div");
      radioContainer.className = "radio-container";

      const input = document.createElement("input");
      input.type = "radio";
      input.id = `style-${index}`;
      input.name = "mapStyle";
      input.value = style.value;
      input.className = "radio-input";
      input.checked = style.value === savedStyle;
      input.addEventListener("change", function () {
        setItem("selectedMapStyle", this.value);
        updateMapStyles();
      });

      const label = document.createElement("label");
      label.htmlFor = input.id;
      label.textContent = style.label;
      label.className = "radio-label";

      radioContainer.appendChild(input);
      radioContainer.appendChild(label);
      container.appendChild(radioContainer);
    });
    return container;
  }

  const mapStyles = {
    standardMapStyle: [],
    silverMapStyle: [
      { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
      { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
      { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
      { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
      { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
      { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
      { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
      { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadada" }] },
      { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
      { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
      { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] },
      { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
    ],
    retroMapStyle: [
      { elementType: "geometry", stylers: [{ color: "#ebe3cd" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#523735" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#f5f1e6" }] },
      { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#c9b2a6" }] },
      { featureType: "administrative.land_parcel", elementType: "geometry.stroke", stylers: [{ color: "#dcd2be" }] },
      { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#ae9e90" }] },
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
    darkMapStyle: [
      { elementType: "geometry", stylers: [{ color: "#212121" }] },
      { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
      { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#757575" }] },
      { featureType: "poi", elementType: "geometry", stylers: [{ color: "#212121" }] },
      { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#181818" }] },
      { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
      { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
      { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
      { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#4e4e4e" }] },
      { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
      { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
      { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d3d3d" }] },
    ],
    aubergineMapStyle: [
      { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
      { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#4b6878" }] },
      { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#64779e" }] },
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
  };

  function updateMapStyles() {
    // Set all Layers to OFF each time
    const baseMapStyles = [
      { featureType: "administrative", stylers: [{ visibility: "off" }] },
      { featureType: "poi", stylers: [{ visibility: "off" }] },
      { featureType: "road", stylers: [{ visibility: "off" }] },
      { featureType: "transit", stylers: [{ visibility: "off" }] },
      { featureType: "landscape", stylers: [{ visibility: "off" }] },
      { featureType: "water", stylers: [{ visibility: "off" }] },
    ];

    // Get the selected map style from radio buttons
    const selectedStyleType = document.querySelector('input[name="mapStyle"]:checked').value;
    const selectedStyle = mapStyles[selectedStyleType] || [];

    // Collect layers that should be visable from checkboxes
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

    // Adjust gmapsContainer's functionality so you can still interact with WME Layers
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

  function transformCoords() {
    const currentPosition = new OpenLayers.LonLat(W.map.getCenter().lon, W.map.getCenter().lat);
    currentPosition.transform(new OpenLayers.Projection("EPSG:900913"), new OpenLayers.Projection("EPSG:4326"));
    return currentPosition;
  }

  function syncMapPosition() {
    if (!googleMap || !W.map) return;

    const coordinates = transformCoords();
    googleMap.panTo(new google.maps.LatLng(coordinates.lat, coordinates.lon));
    googleMap.setZoom(W.map.getZoom());
    if (debugMode) console.log("WME GMAPS Layers: Maps synchronized - Google Maps is set to", coordinates.lat, coordinates.lon);
  }

  // Initialize the GMAPS Tab and UI elements
  function initializeGMapsLayers() {
    const { tabLabel, tabPane } = W.userscripts.registerSidebarTab("GMaps in WME");
    tabLabel.innerText = "GMAP";

    W.userscripts
      .waitForElementConnected(tabPane)
      .then(() => {
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
          createMapStyleSelector(),
        );

        tabPane.appendChild(settingsForm);
        
        // Create a container for Google Maps
        gmapsContainer = document.createElement("div");
        gmapsContainer.id = "gmapsContainer";
        gmapsContainer.style.position = "absolute";
        gmapsContainer.style.top = "0";
        gmapsContainer.style.left = "0";
        gmapsContainer.style.right = "0";
        gmapsContainer.style.bottom = "0";
        W.map.olMap.getViewport().appendChild(gmapsContainer);

        const coordinates = transformCoords();

        // Detect and log Google Maps API key if available
        const googleScript = Array.from(document.querySelectorAll("script")).find((script) => script.src.includes("maps.googleapis.com"));
        if (googleScript) {
          const urlParams = new URL(googleScript.src);
          const apiKey = urlParams.searchParams.get("key");
          if (debugMode) console.log("WME GMAPS Layers: Detected Google Maps API Key:", apiKey);
        }

        // Initialize Google Map
        googleMap = new google.maps.Map(gmapsContainer, {
          zoom: W.map.getZoom(),
          center: { lat: coordinates.lat, lng: coordinates.lon },
          disableDefaultUI: true,
        });

        google.maps.event.addListenerOnce(googleMap, "tilesloaded", syncMapPosition);

        trafficLayer = new google.maps.TrafficLayer(); // Initialize traffic layer
        updateMapStyles(); // Apply initial map styles

        // Register events to synchronize map positions
        WazeWrap.Events.register("moveend", null, syncMapPosition);
        WazeWrap.Events.register("zoomend", null, syncMapPosition);

        // Add a GMaps Layers checkbox in the WME layer panel
        WazeWrap.Interface.AddLayerCheckbox(
          "display",
          "GMaps Layers",
          layerActive,
          function (checked) {
            uiElements.layerCheckbox = document.querySelector("#layer-switcher-item_gmaps_layers");

            uiElements.checkboxChangeHandler = toggleLayerState;
            if (layerActive !== checked) {
              toggleLayerState(checked);
            }
          },
          null
        );

        // Add a keyboard shortcut for toggling the GMaps layer
        new WazeWrap.Interface.Shortcut("WMEGoogleMapsLayers", "Toggle GMaps Layers", "layers", "layersToggleWMEGoogleMapsLayers", "Alt+G", () => toggleLayerState(), null).add();

        uiElements.layerCheckbox = document.querySelector("#layer-switcher-item_gmaps_layers");
        if (uiElements.layerCheckbox) {
          uiElements.layerCheckbox.checked = layerActive;
          uiElements.layerCheckbox.value = layerActive ? "on" : "off";
        }

        updateUiAfterToggle(); // Update UI to reflect current layer state
      })
      .catch((error) => {
        console.error("WME GMAPS Layers: Initialization error:", error);
      });
  }

  // Initialize the GMaps layers when WME is ready
  if (W?.userscripts?.state?.isReady) {
    initializeGMapsLayers();
  } else {
    document.addEventListener("wme-ready", initializeGMapsLayers, { once: true });
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
    .radio-container {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
    }
    .radio-input {
        display: none;
    }
    .radio-label {
        font-family: Arial, sans-serif;
        font-size: 1em;
        color: #333;
        position: relative;
        cursor: pointer;
        display: flex;
        align-items: center;
    }
    .radio-label::before {
        content: '';
        width: 12px;
        height: 12px;
        border: 2px solid #aaa;
        border-radius: 3px;
        background: white;
        display: inline-block;
        margin-right: 5px;
        box-sizing: border-box;
    }
    .radio-input:checked + .radio-label::before {
        background: #007bff;
        border-color: #007bff;
    }
`;
  document.head.appendChild(customStyles);
})();
