// ==UserScript==
// @name         WME GMAPS Layers
// @namespace    https://github.com/JS55CT
// @version      2024.09.21
// @description  Adds GMAPS Layers (Roads and Traffic, Landscape, Transit, Water) layers as an overlay in Waze Map Editor
// @downloadURL  https://github.com/JS55CT/WME-GMAPS-Layers/raw/main/WME-GMAPS-LAYERS.js
// @updateURL    hhttps://github.com/JS55CT/WME-GMAPS-Layers/raw/main/WME-GMAPS-LAYERS.js
// @license      MIT
// @match        https://*.waze.com/*/editor*
// @match        https://*.waze.com/editor*
// @exclude      https://*.waze.com/user/editor*
// @grant        none
// @require      https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// ==/UserScript==

/* global W, OpenLayers, google, WazeWrap */

(function () {
    'use strict';

    const scriptName = GM_info.script.name;
    const scriptVersion = GM_info.script.version;
    const layerEnabledKey = "WMEGoogleMapsLayers-enabled";
    let gmap, trafficLayer, googleMapsDiv;
    let layerEnabled = (localStorage.getItem(layerEnabledKey) ?? 'false') === 'true';

    const elements = {};

    /**
     * Sync the layer state with the UI elements
     */
    function syncToggleState() {
        if (elements.toggleSwitch) elements.toggleSwitch.classList.toggle('on', layerEnabled);
        if (elements.shortcutCheckbox) elements.shortcutCheckbox.checked = layerEnabled;
        if (elements.tabCheckbox) elements.tabCheckbox.checked = layerEnabled;
        googleMapsDiv.style.display = layerEnabled ? "block" : "none";
    }

    /**
     * Toggle the visibility of the Google Maps layer
     */
    function toggleLayer() {
        layerEnabled = !layerEnabled;
        localStorage.setItem(layerEnabledKey, layerEnabled);
        syncToggleState();
    }

    /**
     * Create the script header for display in the layer settings form
     * @returns {HTMLElement} The created script header element
     */
    function createScriptHeader() {
        const headerDiv = document.createElement('div');
        headerDiv.className = 'script-header';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'script-name';
        nameSpan.textContent = scriptName;

        const versionSpan = document.createElement('span');
        versionSpan.className = 'script-version';
        versionSpan.textContent = `v${scriptVersion}`;

        headerDiv.append(nameSpan, versionSpan);
        return headerDiv;
    }

    /**
     * Create the toggle input for enabling or disabling the layer
     * @returns {HTMLElement} The created layer toggle input element
     */
    function createLayerToggleInput() {
        const div = document.createElement('div');
        div.className = 'toggle-container';

        const toggleSwitch = document.createElement('div');
        toggleSwitch.className = `toggle-switch${layerEnabled ? ' on' : ''}`;
        toggleSwitch.addEventListener('click', toggleLayer);

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
 * Create a feature input element for the layer settings form
 * @param {Object} options The options for the feature input
 * @returns {HTMLElement} The created feature input element
 */
    function createFeatureInput({ featureType, elementType = null, defaultChecked, humanLabel, description }) {
        const div = document.createElement('div');
        const id = featureType.replace('.', '_') + (elementType ? '_' + elementType.replace('.', '_') : '');

        // Load the saved state or default if not previously saved
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
            // Update localStorage when checkbox state changes
            localStorage.setItem(id, event.target.checked);
            updateMapStyles();
        });

        const label = document.createElement('label');
        label.textContent = humanLabel;
        label.htmlFor = id;
        label.className = 'setting-label';

        const desc = document.createElement('span');
        desc.className = 'description';
        desc.textContent = description;

        div.append(input, label, document.createElement('br'), desc);
        return div;
    }

    /**
     * Update the Google Maps styles based on the checkbox selections
     */
    function updateMapStyles() {
        // Base styles that sets everything to 'off'
        const baseStyles = [
            {"featureType": "administrative", "stylers": [{"visibility": "off"}]},
            {"featureType": "poi", "stylers": [{"visibility": "off"}]},
            {"featureType": "road", "stylers": [{"visibility": "off"}]},
            {"featureType": "transit", "stylers": [{"visibility": "off"}]},
            {"featureType": "landscape", "stylers": [{"visibility": "off"}]},
            {"featureType": "water", "stylers": [{"visibility": "off"}]}
        ];

        // Construct styles based on the checkbox inputs, turning on what's necessary
        const inputStyles = Array.from(document.querySelectorAll('.style-input')).filter(input => input.checked).map(input => {
            const { featureType, elementType } = input.dataset;
            return {
                "featureType": featureType,
                ...(elementType ? {"elementType": elementType} : {}),
                "stylers": [{"visibility": "on"}]
            };
        });

        gmap.setOptions({ styles: [...baseStyles, ...inputStyles] });
        updateTrafficLayer();
    }

    /**
     * Update the display of the traffic layer on Google Maps
     */
    function updateTrafficLayer() {
        const roadsTrafficCheckbox = document.querySelector('#road');
        if (roadsTrafficCheckbox && roadsTrafficCheckbox.checked) {
            trafficLayer.setMap(gmap); // Show traffic layer
        } else {
            trafficLayer.setMap(null); // Hide traffic layer
        }
        // Continuous set styles irrelevant of traffic layer visibility
        googleMapsDiv.style.pointerEvents = 'none'; // Block mouse events
        if (googleMapsDiv.firstElementChild) {
            googleMapsDiv.firstElementChild.style.backgroundColor = 'rgb(229 227 223 / 0%)'; // Set background color to transparent
        }
    }

    /**
     * Synchronize the Google Maps position with the Waze map position
     */
    function getTransformedCoordinates() {
        const lonlat = new OpenLayers.LonLat(W.map.getCenter().lon, W.map.getCenter().lat);
        lonlat.transform(
            new OpenLayers.Projection('EPSG:900913'), // WME projection
            new OpenLayers.Projection('EPSG:4326') // Google Maps projection
        );
        return lonlat;
    }

    function synchronizeMapPosition() {
        if (!gmap || !W.map) return; // Ensure both maps are initialized

        const lonlat = getTransformedCoordinates();

        // Update Google Maps center and zoom
        gmap.panTo(new google.maps.LatLng(lonlat.lat, lonlat.lon));
        gmap.setZoom(W.map.getZoom());

        console.log("Maps synchronized: Google Maps is set to", lonlat.lat, lonlat.lon);
    }

    /**
     * Initialize the Google Maps layers and UI
     */
    function initGoogleMapsLayers() {
        const { tabLabel, tabPane } = W.userscripts.registerSidebarTab("Gmaps in WME");
        tabLabel.innerText = 'GMAP';

        W.userscripts.waitForElementConnected(tabPane).then(() => {
            const form = document.createElement('form');
            form.className = 'settings-form';

            // Append elements
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
                ].map(createFeatureInput));

            tabPane.appendChild(form);

            googleMapsDiv = document.createElement('div');
            googleMapsDiv.id = "googleMapsDiv";
            googleMapsDiv.style.position = 'absolute';
            googleMapsDiv.style.top = '0';
            googleMapsDiv.style.left = '0';
            googleMapsDiv.style.right = '0';
            googleMapsDiv.style.bottom = '0';
            W.map.olMap.getViewport().appendChild(googleMapsDiv);

            const lonlat = getTransformedCoordinates(); // Get initial transformed coordinates

            gmap = new google.maps.Map(googleMapsDiv, {
                zoom: W.map.getZoom(),
                center: { lat: lonlat.lat, lng: lonlat.lon },
                disableDefaultUI: true,
            });

            // Listen for tilesloaded event to synchronize positions
            google.maps.event.addListenerOnce(gmap, 'tilesloaded', function() {
                synchronizeMapPosition();
            });

            trafficLayer = new google.maps.TrafficLayer();

            updateMapStyles(); // Sets initial styles and updates traffic layer visibility
            syncToggleState(); // Sets initial toggle switch state based on saved preferences or defaults

            WazeWrap.Events.register('moveend', null, synchronizeMapPosition);
            WazeWrap.Events.register('zoomend', null, synchronizeMapPosition);

            WazeWrap.Interface.AddLayerCheckbox(
                "display", "Google Maps Layers", layerEnabled, toggleLayer, W.map.getLayerByName("Google Maps Layers")
            );

            new WazeWrap.Interface.Shortcut(
                'WMEGoogleMapsLayers', 'Toggle Google Maps Layers', 'layers', 'layersToggleWMEGoogleMapsLayers', "Alt+G", toggleLayer, null
            ).add();
        }).catch(error => {
            console.error("WME Google Maps Layers initialization error:", error);
        });
    }

    if (W?.userscripts?.state?.isReady) {
        initGoogleMapsLayers();
    } else {
        document.addEventListener('wme-ready', initGoogleMapsLayers, { once: true });
    }

    // Add CSS for spacing and formatting
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
            box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.1);
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
