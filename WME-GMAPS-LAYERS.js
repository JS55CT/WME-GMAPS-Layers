// ==UserScript==
// @name         WME GMAPS Layers
// @namespace    https://github.com/JS55CT
// @version      2024.10.02.01
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
    'use strict';

    // Debug flag
    const isDebugMode = true;

    // Log the URLs of script tags that contain 'maps.googleapis.com'
    if (isDebugMode) {
        document.querySelectorAll('script').forEach(script => {
            const src = script.src;
            if (src && src.includes('maps.googleapis.com')) {
                console.log('WME GMAPS Layers: Google Maps API Script URL:', src);
            }
        });
    }

    // Configuration constants
    const scriptName = GM_info.script.name;
    const scriptVersion = GM_info.script.version;
    const layerEnabledKey = "WMEGoogleMapsLayers-enabled";
    let gmap, trafficLayer, googleMapsDiv;
    let layerEnabled = (localStorage.getItem(layerEnabledKey) ?? 'false') === 'true';
    let programmaticChange = false; // Flag to prevent loops during programmatic changes

    // Elements references
    const elements = {
        toggleSwitch: null,
        tabCheckbox: null,
        checkboxCallback: null
    };

    /**
     * Synchronize the state of the layer toggle across various UI elements
     */
    function syncToggleState() {
        if (isDebugMode) console.log('WME GMAPS Layers: syncToggleState() with value ', layerEnabled);

        // Update toggle switch based on layerEnabled
        if (elements.toggleSwitch) {
            elements.toggleSwitch.classList.toggle('on', layerEnabled);
            if (isDebugMode) console.log('WME GMAPS Layers: toggleSwitch updated to ', layerEnabled);
        }

        // Update the wz-checkbox value based on layerEnabled
        if (elements.tabCheckbox) {
            programmaticChange = true;
            elements.tabCheckbox.checked = layerEnabled;
            elements.tabCheckbox.value = layerEnabled ? "on" : "off";
            if (elements.checkboxCallback) {
                elements.checkboxCallback(layerEnabled);
            }
            programmaticChange = false;
            if (isDebugMode) console.log('WME GMAPS Layers: tabCheckbox updated to ', layerEnabled);
        }

        googleMapsDiv.style.display = layerEnabled ? "block" : "none";
    }

    /**
     * Toggle the visibility and state of the layer
     * @param {boolean|null} checked - Optional state to set the layer to
     */
    function toggleLayer(checked = null) {
        if (!programmaticChange) {
            layerEnabled = checked !== null ? checked : !layerEnabled;
            localStorage.setItem(layerEnabledKey, layerEnabled);
            syncToggleState();
        }
    }

    /**
     * Create header for the script within the settings form
     * @returns {HTMLElement} Header div element
     */
    function createScriptHeader() {
        const headerDiv = document.createElement('div');
        headerDiv.className = 'script-header';

        headerDiv.innerHTML = `
            <span class="script-name">${scriptName}</span>
            <span class="script-version">v${scriptVersion}</span>
        `;
        return headerDiv;
    }

    /**
     * Create toggle input for enabling/disabling the Google Maps layer
     * @returns {HTMLElement} Toggle container div element
     */
    function createLayerToggleInput() {
        const div = document.createElement('div');
        div.className = 'toggle-container';

        const toggleSwitch = document.createElement('div');
        toggleSwitch.className = `toggle-switch${layerEnabled ? ' on' : ''}`;
        toggleSwitch.addEventListener('click', () => toggleLayer());

        const toggleSlider = document.createElement('div');
        toggleSlider.className = 'slider';
        toggleSwitch.appendChild(toggleSlider);

        div.append(toggleSwitch, Object.assign(document.createElement('label'), {
            textContent: 'Google Maps Layers',
            className: 'setting-label'
        }));

        elements.toggleSwitch = toggleSwitch;
        return div;
    }

    /**
     * Create a feature input (checkbox) for layer settings
     * @param {Object} options - The options for the feature input
     * @returns {HTMLElement} Feature input div element
     */
    function createFeatureInput({ featureType, elementType = null, defaultChecked, humanLabel, description }) {
        const div = document.createElement('div');
        const id = featureType.replace('.', '_') + (elementType ? '_' + elementType.replace('.', '_') : '');

        const savedState = localStorage.getItem(id);
        const isChecked = savedState ? savedState === 'true' : defaultChecked;

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'style-input input-space';
        input.checked = isChecked;
        input.id = id;
        input.dataset.featureType = featureType;
        if (elementType) input.dataset.elementType = elementType;
        input.dataset.visibility = 'on';
        input.addEventListener('change', (event) => {
            localStorage.setItem(id, event.target.checked);
            updateMapStyles();
            if (isDebugMode) console.log(`WME GMAPS Layers: ${event.target.dataset.featureType} visibility set to:`, event.target.checked);
        });

        div.innerHTML = `
            <label class='setting-label' for='${id}'>${humanLabel}</label><br>
            <span class='description'>${description}</span>
        `;
        div.prepend(input);

        return div;
    }

    /**
     * Update Google Maps styles based on the checked features
     */
    function updateMapStyles() {
        const baseStyles = [
            { "featureType": "administrative", "stylers": [{ "visibility": "off" }] },
            { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
            { "featureType": "road", "stylers": [{ "visibility": "off" }] },
            { "featureType": "transit", "stylers": [{ "visibility": "off" }] },
            { "featureType": "landscape", "stylers": [{ "visibility": "off" }] },
            { "featureType": "water", "stylers": [{ "visibility": "off" }] }
        ];

        const inputStyles = Array.from(document.querySelectorAll('.style-input'))
        .filter(input => input.checked)
        .map(input => {
            const { featureType, elementType } = input.dataset;
            return {
                "featureType": featureType,
                ...(elementType ? { "elementType": elementType } : {}),
                "stylers": [{ "visibility": "on" }]
            };
        });

        gmap.setOptions({ styles: [...baseStyles, ...inputStyles] });
        updateTrafficLayer();
        if (isDebugMode) console.log('WME GMAPS Layers: Map styles updated');
    }

    /**
     * Update the traffic layer visibility on Google Maps
     */
    function updateTrafficLayer() {
        const roadsTrafficCheckbox = document.querySelector('#road');
        if (roadsTrafficCheckbox && roadsTrafficCheckbox.checked) {
            trafficLayer.setMap(gmap);
            if (isDebugMode) console.log('WME GMAPS Layers: Traffic layer displayed');
        } else {
            trafficLayer.setMap(null);
            if (isDebugMode) console.log('WME GMAPS Layers: Traffic layer hidden');
        }
        googleMapsDiv.style.pointerEvents = 'none';
        if (googleMapsDiv.firstElementChild) {
            googleMapsDiv.firstElementChild.style.backgroundColor = 'rgb(229 227 223 / 0%)';
        }
    }

    /**
     * Transform Waze map coordinates to Google Maps coordinates
     * @returns {Object} Transformed coordinates
     */
    function getTransformedCoordinates() {
        const lonlat = new OpenLayers.LonLat(W.map.getCenter().lon, W.map.getCenter().lat);
        lonlat.transform(
            new OpenLayers.Projection('EPSG:900913'),
            new OpenLayers.Projection('EPSG:4326')
        );
        return lonlat;
    }

    /**
     * Synchronize the position and zoom level of Google Maps with Waze maps
     */
    function synchronizeMapPosition() {
        if (!gmap || !W.map) return;

        const lonlat = getTransformedCoordinates();
        gmap.panTo(new google.maps.LatLng(lonlat.lat, lonlat.lon));
        gmap.setZoom(W.map.getZoom());
        if (isDebugMode) console.log("WME GMAPS Layers: Maps synchronized - Google Maps is set to", lonlat.lat, lonlat.lon);
    }

    /**
     * Initialize the Google Maps layers and UI components
     */
    function initGoogleMapsLayers() {
        const { tabLabel, tabPane } = W.userscripts.registerSidebarTab("Gmaps in WME");
        tabLabel.innerText = 'GMAP';

        W.userscripts.waitForElementConnected(tabPane).then(() => {
            const form = document.createElement('form');
            form.className = 'settings-form';

            form.append(
                createScriptHeader(),
                createLayerToggleInput(),
                ...[
                    { featureType: "road", defaultChecked: true, humanLabel: "Roads & Traffic", description: "" },
                    { featureType: "administrative.land_parcel", defaultChecked: false, humanLabel: "Land Parcels", description: "" },
                    { featureType: "landscape", defaultChecked: false, humanLabel: "General Landscape", description: "" },
                    { featureType: "poi", defaultChecked: false, humanLabel: "Points of Interest", description: "" },
                    { featureType: "transit", defaultChecked: false, humanLabel: "Public Transit Features", description: "" },
                    { featureType: "water", defaultChecked: false, humanLabel: "Water Bodies", description: "" },
                ].map(createFeatureInput)
            );

            tabPane.appendChild(form);

            googleMapsDiv = document.createElement('div');
            googleMapsDiv.id = "googleMapsDiv";
            googleMapsDiv.style.position = 'absolute';
            googleMapsDiv.style.top = '0';
            googleMapsDiv.style.left = '0';
            googleMapsDiv.style.right = '0';
            googleMapsDiv.style.bottom = '0';
            W.map.olMap.getViewport().appendChild(googleMapsDiv);

            const lonlat = getTransformedCoordinates();

            const scriptTag = Array.from(document.querySelectorAll('script')).find(script => script.src.includes('maps.googleapis.com'));
            if (scriptTag) {
                const urlParams = new URL(scriptTag.src);
                const apiKey = urlParams.searchParams.get('key');
                if (isDebugMode) console.log('WME GMAPS Layers: Detected Google Maps API Key:', apiKey);
            }

            gmap = new google.maps.Map(googleMapsDiv, {
                zoom: W.map.getZoom(),
                center: { lat: lonlat.lat, lng: lonlat.lon },
                disableDefaultUI: true,
            });

            google.maps.event.addListenerOnce(gmap, 'tilesloaded', synchronizeMapPosition);

            trafficLayer = new google.maps.TrafficLayer();
            updateMapStyles();

            WazeWrap.Events.register('moveend', null, synchronizeMapPosition);
            WazeWrap.Events.register('zoomend', null, synchronizeMapPosition);

            WazeWrap.Interface.AddLayerCheckbox(
                "display",
                "Google Maps Layers",
                layerEnabled,
                function(checked) {
                    elements.tabCheckbox = document.querySelector('#layer-switcher-item_google_maps_layers');
                    elements.checkboxCallback = toggleLayer;

                    if (isDebugMode) {
                        if (elements.tabCheckbox) {
                            console.log('WME GMAPS Layers: Layer Checkbox found:', elements.tabCheckbox);
                        } else {
                            console.error('WME GMAPS Layers: Layer Checkbox not found.');
                        }
                        console.log('WME GMAPS Layers: Layer Checkbox callback triggered with value: ', checked);
                    }

                    if (layerEnabled !== checked) {
                        toggleLayer(checked);
                    }
                },
                null
            );

            new WazeWrap.Interface.Shortcut(
                'WMEGoogleMapsLayers',
                'Toggle Google Maps Layers',
                'layers',
                'layersToggleWMEGoogleMapsLayers',
                "Alt+G",
                () => toggleLayer(),
                null
            ).add();

            elements.tabCheckbox = document.querySelector('#layer-switcher-item_google_maps_layers');
            if (elements.tabCheckbox) {
                elements.tabCheckbox.checked = layerEnabled;
                elements.tabCheckbox.value = layerEnabled ? "on" : "off";
            }

            syncToggleState();

        }).catch(error => {
            console.error("WME GMAPS Layers: WME GMAPS Layers initialization error:", error);
        });
    }

    // Wait for Waze Map Editor to be ready before initializing
    if (W?.userscripts?.state?.isReady) {
        initGoogleMapsLayers();
    } else {
        document.addEventListener('wme-ready', initGoogleMapsLayers, { once: true });
    }

    // Inject custom CSS styles
    const style = document.createElement('style');
    style.textContent = `
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
            margin-bottom: 10px;
        }
        .script-name {
            font-size: 1.0em;
            font-weight: bold;
            color: #222;
            display: block;
        }
        .script-version {
            font-size: 1em;
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
            background: #ccc;
            border-radius: 20px;
            cursor: pointer;
            margin-right: 10px;
            transition: background 0.3s;
        }
        .toggle-switch.on {
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
            transition: all 0.3s;
        }
        .toggle-switch.on .slider {
            left: 30px;
        }
        .toggle-switch:not(.on) .slider {
            left: 2px;
        }
    `;
    document.head.appendChild(style);
})();
